import { getAuthenticatedClient } from "@/lib/supabase/api-helper"
import { NextResponse } from "next/server"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await getAuthenticatedClient()
  if ("error" in result && result.error) return result.error
  const { supabase, user } = result as any
  const { id } = await params

  const { data, error } = await supabase
    .from("appointments")
    .select(`*, patient:patients(id, full_name, phone, email)`)
    .eq("id", id)
    .eq("user_id", user.id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await getAuthenticatedClient()
  if ("error" in result && result.error) return result.error
  const { supabase, user } = result as any
  const { id } = await params

  const body = await request.json()

  const { data, error } = await supabase
    .from("appointments")
    .update(body)
    .eq("id", id)
    .eq("user_id", user.id)
    .select(`*, patient:patients(id, full_name, phone, email)`)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Se o agendamento foi cancelado ou marcado como Falta,
  // cancela automaticamente a transação financeira pendente vinculada
  if (body.status === "Cancelada" || body.status === "Falta") {
    await supabase
      .from("financial_transactions")
      .update({ status: "cancelled" })
      .eq("user_id", user.id)
      .eq("status", "pending")
      .or(`description.ilike.%${data.procedure_type}%,patient_id.eq.${data.patient_id}`)
      // Restringe ao mesmo dia para evitar cancelar transações erradas
      .gte("created_at", data.date + "T00:00:00")
      .lte("created_at", data.date + "T23:59:59")
  }

  return NextResponse.json({ data })
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await getAuthenticatedClient()
  if ("error" in result && result.error) return result.error
  const { supabase, user } = result as any
  const { id } = await params

  const { error } = await supabase
    .from("appointments")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
