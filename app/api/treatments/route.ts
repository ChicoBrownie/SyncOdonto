import { getClinicScopedClient } from "@/lib/supabase/clinic-scope"
import { NextResponse } from "next/server"
import { stripImmutableTenantFields } from "@/lib/security/request-data"
import { patientBelongsToClinic } from "@/lib/security/clinic-data"

export async function GET(request: Request) {
  const result = await getClinicScopedClient()
  if ("error" in result && result.error) return result.error
  const { supabase, ownerId } = result as any

  const { searchParams } = new URL(request.url)
  const patientId = searchParams.get("patientId") || searchParams.get("patient_id")
  const status = searchParams.get("status")

  let query = supabase
    .from("treatments")
    .select(`*, patient:patients(id, full_name)`)
    .eq("user_id", ownerId)
    .order("created_at", { ascending: false })

  if (patientId) {
    query = query.eq("patient_id", patientId)
  }

  if (status && status !== "all") {
    query = query.eq("status", status)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data })
}

export async function POST(request: Request) {
  const result = await getClinicScopedClient()
  if ("error" in result && result.error) return result.error
  const { supabase, ownerId } = result as any

  const body = stripImmutableTenantFields(await request.json())

  if (!(await patientBelongsToClinic(supabase, body.patient_id, ownerId))) {
    return NextResponse.json({ error: "Paciente não pertence à clínica." }, { status: 403 })
  }

  const { data, error } = await supabase
    .from("treatments")
    .insert({ ...body, user_id: ownerId })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data })
}
