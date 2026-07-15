import { getClinicScopedClient } from "@/lib/supabase/clinic-scope"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
  const result = await getClinicScopedClient()
  if ("error" in result && result.error) return result.error
  const { supabase, ownerId } = result as any

  const { searchParams } = new URL(request.url)
  const patientId = searchParams.get("patientId")

  if (!patientId) {
    return NextResponse.json({ error: "Patient ID is required" }, { status: 400 })
  }

  const { data, error } = await supabase
    .from("dental_chart")
    .select("*")
    .eq("user_id", ownerId)
    .eq("patient_id", patientId)
    .order("tooth_number", { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data })
}

export async function POST(request: Request) {
  const result = await getClinicScopedClient()
  if ("error" in result && result.error) return result.error
  const { supabase, ownerId } = result as any

  const body = await request.json()

  const { data: existing } = await supabase
    .from("dental_chart")
    .select("id")
    .eq("user_id", ownerId)
    .eq("patient_id", body.patient_id)
    .eq("tooth_number", body.tooth_number)
    .single()

  if (existing) {
    const { data, error } = await supabase
      .from("dental_chart")
      .update({ condition: body.condition, notes: body.notes })
      .eq("id", existing.id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data })
  }

  const { data, error } = await supabase
    .from("dental_chart")
    .insert({ ...body, user_id: ownerId })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data })
}
