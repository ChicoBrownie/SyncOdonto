import { getClinicScopedClient } from "@/lib/supabase/clinic-scope"
import { NextResponse } from "next/server"
import { notificarConfirmacaoConsulta } from "@/lib/whatsapp"

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

  const body = await request.json()

  // Busca o status anterior para detectar transição para "Confirmada"
  const { data: anterior } = await supabase
    .from("appointments")
    .select("status")
    .eq("id", id)
    .eq("user_id", ownerId)
    .single()

  const { data, error } = await supabase
    .from("appointments")
    .update(body)
    .eq("id", id)
    .eq("user_id", ownerId)
    .select(`*, patient:patients(id, full_name, phone, email)`)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // ── Cancelamento: cancela transação financeira vinculada ─────────────────
  if (body.status === "Cancelada" || body.status === "Falta") {
    await supabase
      .from("financial_transactions")
      .update({ status: "cancelled" })
      .eq("user_id", ownerId)
      .eq("status", "pending")
      .or(`description.ilike.%${data.procedure_type}%,patient_id.eq.${data.patient_id}`)
      .gte("created_at", data.date + "T00:00:00")
      .lte("created_at", data.date + "T23:59:59")
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