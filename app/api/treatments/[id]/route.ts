import { getClinicScopedClient } from "@/lib/supabase/clinic-scope"
import { NextResponse } from "next/server"
import { stripImmutableTenantFields } from "@/lib/security/request-data"
import { patientBelongsToClinic } from "@/lib/security/clinic-data"
import { parseInput, treatmentInputSchema } from "@/lib/validation/api-schemas"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await getClinicScopedClient()
  if ("error" in result && result.error) return result.error
  const { supabase, ownerId } = result as any
  const { id } = await params

  const { data, error } = await supabase
    .from("treatments")
    .select(`*, patient:patients(id, full_name)`)
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
  const parsed = parseInput(treatmentInputSchema.partial(), stripImmutableTenantFields(await request.json()))
  if (!parsed.data) return NextResponse.json({ error: parsed.error }, { status: 400 })
  const body = parsed.data
  if (body.patient_id && !(await patientBelongsToClinic(supabase, body.patient_id, ownerId))) {
    return NextResponse.json({ error: "Paciente não pertence à clínica." }, { status: 403 })
  }

  const { data: previous } = await supabase
    .from("treatments")
    .select("id, patient_id, treatment_type, status, cost, appointment_id, completed_date, result_condition")
    .eq("id", id)
    .eq("user_id", ownerId)
    .maybeSingle()
  if (!previous) return NextResponse.json({ error: "Procedimento não encontrado." }, { status: 404 })

  const { data, error } = await supabase
    .from("treatments")
    .update(body)
    .eq("id", id)
    .eq("user_id", ownerId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Procedimentos concluídos fora de uma consulta viram uma conta a receber.
  // Os vinculados a uma consulta são cobrados ao encerrar a consulta, evitando duplicidade.
  if (body.status === "completed" && previous.status !== "completed" && !data.appointment_id && Number(data.cost || 0) > 0) {
    const { data: existingTransaction, error: lookupError } = await supabase
      .from("financial_transactions")
      .select("id")
      .eq("user_id", ownerId)
      .eq("treatment_id", id)
      .maybeSingle()

    if (lookupError) {
      await supabase.from("treatments").update({ status: previous.status }).eq("id", id).eq("user_id", ownerId)
      return NextResponse.json({ error: `Não foi possível verificar o lançamento financeiro: ${lookupError.message}` }, { status: 500 })
    }

    if (!existingTransaction) {
      const { error: financialError } = await supabase.from("financial_transactions").insert({
        user_id: ownerId,
        patient_id: data.patient_id,
        treatment_id: data.id,
        description: `Procedimento - ${data.treatment_type}`,
        amount: data.cost,
        payment_method: null,
        type: "income",
        status: "pending",
        verification_status: "pending_verification",
      })

      if (financialError) {
        await supabase.from("treatments").update({
          status: previous.status,
          completed_date: previous.completed_date,
          result_condition: previous.result_condition,
        }).eq("id", id).eq("user_id", ownerId)
        return NextResponse.json({ error: `Não foi possível lançar a pendência financeira: ${financialError.message}` }, { status: 500 })
      }
    }
  }

  if (body.status === "cancelled") {
    await supabase.from("financial_transactions")
      .update({ status: "cancelled" })
      .eq("user_id", ownerId)
      .eq("treatment_id", id)
      .eq("status", "pending")
  } else if (body.cost !== undefined) {
    await supabase.from("financial_transactions")
      .update({ amount: data.cost })
      .eq("user_id", ownerId)
      .eq("treatment_id", id)
      .eq("status", "pending")
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

  const { error } = await supabase.from("treatments").delete().eq("id", id).eq("user_id", ownerId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
