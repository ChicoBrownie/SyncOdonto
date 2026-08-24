import { getClinicScopedClient } from "@/lib/supabase/clinic-scope"
import { NextResponse } from "next/server"
import { notificarConfirmacaoConsulta } from "@/lib/whatsapp"
import { stripImmutableTenantFields } from "@/lib/security/request-data"
import { patientBelongsToClinic } from "@/lib/security/clinic-data"

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

  const body = stripImmutableTenantFields(await request.json())
  if (body.patient_id && !(await patientBelongsToClinic(supabase, body.patient_id, ownerId))) {
    return NextResponse.json({ error: "Paciente não pertence à clínica." }, { status: 403 })
  }

  // Busca o estado anterior para detectar transições e permitir compensação
  // caso o lançamento financeiro não possa ser criado.
  const { data: anterior } = await supabase
    .from("appointments")
    .select("status, cost, payment_method")
    .eq("id", id)
    .eq("user_id", ownerId)
    .single()

  if (!anterior) return NextResponse.json({ error: "Consulta não encontrada." }, { status: 404 })

  if (body.status === "Em Andamento" && !["Pendente", "Confirmada", "Aguardando"].includes(anterior.status)) {
    return NextResponse.json({ error: "Esta consulta não está disponível para início." }, { status: 409 })
  }
  if (body.status === "Concluída" && anterior.status !== "Em Andamento") {
    return NextResponse.json({ error: "Somente uma consulta em andamento pode ser encerrada." }, { status: 409 })
  }

  const { data, error } = await supabase
    .from("appointments")
    .update(body)
    .eq("id", id)
    .eq("user_id", ownerId)
    .select(`*, patient:patients(id, full_name, phone, email)`)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // O lançamento nasce no servidor junto com o encerramento. Assim não existe
  // mais a janela em que a consulta fica concluída, mas a segunda requisição do
  // navegador falha e deixa o caixa sem pendência.
  if (body.status === "Concluída" && anterior?.status !== "Concluída") {
    const { data: existingTransaction } = await supabase
      .from("financial_transactions")
      .select("id")
      .eq("user_id", ownerId)
      .eq("source_appointment_id", id)
      .maybeSingle()

    if (!existingTransaction) {
      const { error: financialError } = await supabase
        .from("financial_transactions")
        .insert({
          user_id: ownerId,
          patient_id: data.patient_id,
          description: `Consulta - ${data.procedure_type || "Consulta"} (${data.patient?.full_name || ""})`,
          amount: data.cost,
          payment_method: null,
          type: "income",
          status: "pending",
          verification_status: "pending_verification",
          source_appointment_id: id,
        })

      if (financialError) {
        await supabase
          .from("appointments")
          .update({
            status: anterior?.status,
            cost: anterior?.cost,
            payment_method: anterior?.payment_method,
          })
          .eq("id", id)
          .eq("user_id", ownerId)

        return NextResponse.json(
          { error: `Não foi possível lançar a pendência financeira: ${financialError.message}` },
          { status: 500 }
        )
      }
    }
  }

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
