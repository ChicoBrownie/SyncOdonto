import { getClinicScopedClient } from "@/lib/supabase/clinic-scope"
import { requirePermission } from "@/lib/permissions-server"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
  const result = await getClinicScopedClient()
  if ("error" in result && result.error) return result.error
  const { supabase, ownerId, permissions } = result as any

  const denied = requirePermission(permissions, "financeiro")
  if (denied) return denied

  const { searchParams } = new URL(request.url)
  const type = searchParams.get("type")
  const status = searchParams.get("status")
  const startDate = searchParams.get("startDate")
  const endDate = searchParams.get("endDate")
  const patientId = searchParams.get("patientId")

  let query = supabase
    .from("financial_transactions")
    .select(`*, patient:patients(id, full_name), treatment:treatments(id, treatment_type)`)
    .eq("user_id", ownerId)
    .order("created_at", { ascending: false })

  if (type && type !== "all") query = query.eq("type", type)
  if (status && status !== "all") query = query.eq("status", status)
  if (startDate && endDate) {
    query = query
      .gte("created_at", `${startDate}T00:00:00.000Z`)
      .lt("created_at", `${endDate}T23:59:59.999Z`)
  }
  if (patientId) query = query.eq("patient_id", patientId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(request: Request) {
  const result = await getClinicScopedClient()
  if ("error" in result && result.error) return result.error
  const { supabase, ownerId, permissions } = result as any

  const denied = requirePermission(permissions, "financeiro")
  if (denied) return denied

  const body = await request.json()

  // Validações
  if (!body.patient_id) {
    return NextResponse.json({ error: "Paciente é obrigatório." }, { status: 400 })
  }
  if (!body.description || body.description.trim() === "") {
    return NextResponse.json({ error: "Descrição é obrigatória." }, { status: 400 })
  }
  if (typeof body.amount !== "number" || body.amount <= 0) {
    return NextResponse.json({ error: "Valor deve ser maior que zero." }, { status: 400 })
  }

  const { data, error } = await supabase
    .from("financial_transactions")
    .insert({ ...body, user_id: ownerId })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
