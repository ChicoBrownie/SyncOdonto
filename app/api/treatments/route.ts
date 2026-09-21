import { getClinicScopedClient } from "@/lib/supabase/clinic-scope"
import { NextResponse } from "next/server"
import { stripImmutableTenantFields } from "@/lib/security/request-data"
import { patientBelongsToClinic } from "@/lib/security/clinic-data"
import { parseInput, treatmentInputSchema } from "@/lib/validation/api-schemas"

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
  const { supabase, ownerId, user } = result as any

  const parsed = parseInput(treatmentInputSchema, stripImmutableTenantFields(await request.json()))
  if (!parsed.data) return NextResponse.json({ error: parsed.error }, { status: 400 })
  const body = parsed.data

  if (!(await patientBelongsToClinic(supabase, body.patient_id, ownerId))) {
    return NextResponse.json({ error: "Paciente não pertence à clínica." }, { status: 403 })
  }

  const { data, error } = await supabase
    .from("treatments")
    .insert({
      ...body,
      professional_name: body.professional_name || user.user_metadata?.full_name || user.email || "Profissional não informado",
      user_id: ownerId,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data })
}
