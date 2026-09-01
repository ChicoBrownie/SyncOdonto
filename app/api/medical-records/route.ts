import { getClinicScopedClient } from "@/lib/supabase/clinic-scope"
import { NextResponse } from "next/server"
import { stripImmutableTenantFields } from "@/lib/security/request-data"
import { patientBelongsToClinic } from "@/lib/security/clinic-data"
import { recordAuditEvent } from "@/lib/security/audit"
import { medicalRecordInputSchema, parseInput } from "@/lib/validation/api-schemas"

const TABLE_NAME = "medical_records"

export async function GET(request: Request) {
  const result = await getClinicScopedClient()
  if ("error" in result && result.error) return result.error
  const { supabase, ownerId } = result as any

  const { searchParams } = new URL(request.url)
  const patientId = searchParams.get("patientId")
  const recordType = searchParams.get("recordType")

  let query = supabase
    .from(TABLE_NAME)
    .select(`*, patient:patients(id, full_name)`)
    .eq("user_id", ownerId)
    .order("created_at", { ascending: false })

  if (patientId) {
    query = query.eq("patient_id", patientId)
  }

  if (recordType && recordType !== "all") {
    query = query.eq("record_type", recordType)
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

  const parsed = parseInput(medicalRecordInputSchema, stripImmutableTenantFields(await request.json()))
  if (!parsed.data) return NextResponse.json({ error: parsed.error }, { status: 400 })
  const body = parsed.data

  if (!(await patientBelongsToClinic(supabase, body.patient_id, ownerId))) {
    return NextResponse.json({ error: "Paciente não pertence à clínica." }, { status: 403 })
  }

  const { data, error } = await supabase
    .from(TABLE_NAME)
    .insert({ ...body, user_id: ownerId })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await recordAuditEvent({ supabase, clinicId: ownerId, actorUserId: user.id, action: "medical_record.created", entityType: TABLE_NAME, entityId: data.id, metadata: { patient_id: data.patient_id, record_type: data.record_type } })

  return NextResponse.json({ data })
}

export async function DELETE(request: Request) {
  const result = await getClinicScopedClient()
  if ("error" in result && result.error) return result.error
  const { supabase, ownerId, user } = result as any

  const { searchParams } = new URL(request.url)
  const id = searchParams.get("id")

  if (!id) return NextResponse.json({ error: "ID obrigatorio" }, { status: 400 })

  const { error } = await supabase
    .from(TABLE_NAME)
    .delete()
    .eq("id", id)
    .eq("user_id", ownerId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await recordAuditEvent({ supabase, clinicId: ownerId, actorUserId: user.id, action: "medical_record.deleted", entityType: TABLE_NAME, entityId: id })
  return NextResponse.json({ success: true })
}
