import { getClinicScopedClient } from "@/lib/supabase/clinic-scope"
import { NextResponse } from "next/server"
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
  const body = stripImmutableTenantFields(await request.json())
  if (body.patient_id && !(await patientBelongsToClinic(supabase, body.patient_id, ownerId))) {
    return NextResponse.json({ error: "Paciente não pertence à clínica." }, { status: 403 })
  }

  const { data, error } = await supabase
    .from("treatments")
    .update(body)
    .eq("id", id)
    .eq("user_id", ownerId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
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
