import { getClinicScopedClient } from "@/lib/supabase/clinic-scope"
import { NextResponse } from "next/server"
import { notificarConfirmacaoConsulta } from "@/lib/whatsapp"
import { stripImmutableTenantFields } from "@/lib/security/request-data"
import { patientBelongsToClinic } from "@/lib/security/clinic-data"
import { appointmentInputSchema, parseInput } from "@/lib/validation/api-schemas"
import { validateAppointmentTransition } from "@/lib/appointments/lifecycle"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await getClinicScopedClient()
  if ("error" in result && result.error) return result.error
  const { supabase, ownerId } = result as any
  const { id } = await params

  const { data, error } = await supabase
    .from("appointments")
    .select(`*, patient:patients(id, full_name, phone, email)`)
    .eq("id", id)
    .eq("user_id", ownerId)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await getClinicScopedClient()
  if ("error" in result && result.error) return result.error
  const { supabase, ownerId } = result as any
  const { id } = await params

  const parsed = parseInput(appointmentInputSchema.partial(), stripImmutableTenantFields(await request.json()))
  if (!parsed.data) return NextResponse.json({ error: parsed.error }, { status: 400 })
  const body = parsed.data
  if (body.status === "Concluída") {
    const { error: schemaError } = await supabase.from("encounter_drafts").select("id").eq("clinic_id", ownerId).limit(1)
    if (schemaError) return NextResponse.json({ error: "Aplique a migração 014 antes de encerrar consultas nesta versão do aplicativo." }, { status: 503 })
  }
  if (body.patient_id && !(await patientBelongsToClinic(supabase, body.patient_id, ownerId))) {
    return NextResponse.json({ error: "Paciente não pertence à clínica." }, { status: 403 })
  }

  // A migração 014 cria a pendência na mesma transação do encerramento.
  const { data: anterior } = await supabase
    .from("appointments")
    .select("status, cost, payment_method")
    .eq("id", id)
    .eq("user_id", ownerId)
    .single()

  if (!anterior) return NextResponse.json({ error: "Consulta não encontrada." }, { status: 404 })

  const transitionError = validateAppointmentTransition(anterior.status, body.status)
  if (transitionError) return NextResponse.json({ error: transitionError }, { status: 409 })

  const { data, error } = await supabase
    .from("appointments")
    .update(body)
    .eq("id", id)
    .eq("user_id", ownerId)
    .select(`*, patient:patients(id, full_name, phone, email)`)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: error.code === "P0001" || error.code === "23505" ? 409 : 500 })

  // ── Cancelamento: cancela transação financeira vinculada ─────────────────
  if (body.status === "Cancelada" || body.status === "Falta") {
    await supabase
      .from("financial_transactions")
      .update({ status: "cancelled" })
      .eq("user_id", ownerId)
      .eq("status", "pending")
      .eq("source_appointment_id", id)
  }

  // ── Confirmação: dispara notificação WhatsApp ─────────────────────────────
  if (body.status === "Confirmada" && anterior?.status !== "Confirmada") {
    try {
      // Busca telefone do profissional na tabela clinic_staff
      let telefoneProfissional: string | null = null
      if (data.doctor_name) {
        const { data: staffData } = await supabase
          .from("clinic_staff")
          .select("phone")
          .eq("user_id", ownerId)
          .ilike("full_name", data.doctor_name)
          .single()
        telefoneProfissional = staffData?.phone ?? null
      }

      await notificarConfirmacaoConsulta({
        telefonePaciente: data.patient?.phone ?? null,
        nomePaciente: data.patient?.full_name ?? "Paciente",
        telefoneProfissional,
        nomeProfissional: data.doctor_name ?? "Profissional",
        dataConsulta: data.date,
        horarioConsulta: data.time,
        procedimento: data.procedure_type,
      })
    } catch (errNotif) {
      // Não bloqueia a resposta se a notificação falhar
      console.error("[WhatsApp] Erro ao enviar notificação:", errNotif)
    }
  }

  return NextResponse.json({ data })
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await getClinicScopedClient()
  if ("error" in result && result.error) return result.error
  const { supabase, ownerId } = result as any
  const { id } = await params

  const { error } = await supabase
    .from("appointments")
    .delete()
    .eq("id", id)
    .eq("user_id", ownerId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
