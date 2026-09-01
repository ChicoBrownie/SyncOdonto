import { getClinicScopedClient } from "@/lib/supabase/clinic-scope"
import { requirePermission } from "@/lib/permissions-server"
import { stripImmutableTenantFields } from "@/lib/security/request-data"
import { patientBelongsToClinic } from "@/lib/security/clinic-data"
import { financialInputSchema, parseInput } from "@/lib/validation/api-schemas"
import { recordAuditEvent } from "@/lib/security/audit"
import { NextResponse } from "next/server"

// The clinic currently operates in Fortaleza (UTC-03:00). Date filters arrive as
// calendar dates, so they must be converted to UTC before comparing TIMESTAMPTZ.
// Using `YYYY-MM-DDT00:00:00Z` made every local day end at 20:59.
function clinicDayRange(startDate: string, endDate: string) {
  const start = new Date(`${startDate}T00:00:00-03:00`)
  const endExclusive = new Date(`${endDate}T00:00:00-03:00`)
  endExclusive.setUTCDate(endExclusive.getUTCDate() + 1)
  return { start: start.toISOString(), endExclusive: endExclusive.toISOString() }
}

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
  const verificationStatus = searchParams.get("verification_status")

  let query = supabase
    .from("financial_transactions")
    .select(`*, patient:patients(id, full_name), treatment:treatments(id, treatment_type)`)
    .eq("user_id", ownerId)
    .order("created_at", { ascending: false })

  if (type && type !== "all") query = query.eq("type", type)
  if (status && status !== "all") query = query.eq("status", status)
  if (startDate && endDate) {
    const range = clinicDayRange(startDate, endDate)
    query = query
      .gte("created_at", range.start)
      .lt("created_at", range.endExclusive)
  }
  if (verificationStatus) query = query.eq("verification_status", verificationStatus)
  if (patientId) query = query.eq("patient_id", patientId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(request: Request) {
  const result = await getClinicScopedClient()
  if ("error" in result && result.error) return result.error
  const { supabase, ownerId, permissions, user } = result as any

  const denied = requirePermission(permissions, "financeiro")
  if (denied) return denied

  const parsed = parseInput(financialInputSchema, stripImmutableTenantFields(await request.json()))
  if (!parsed.data) return NextResponse.json({ error: parsed.error }, { status: 400 })
  const body = parsed.data

  // Validações
  if (!body.patient_id) {
    return NextResponse.json({ error: "Paciente é obrigatório." }, { status: 400 })
  }
  if (!(await patientBelongsToClinic(supabase, body.patient_id, ownerId))) {
    return NextResponse.json({ error: "Paciente não pertence à clínica." }, { status: 403 })
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
  await recordAuditEvent({ supabase, clinicId: ownerId, actorUserId: user.id, action: "financial.created", entityType: "financial_transactions", entityId: data.id, metadata: { type: data.type, amount: data.amount, patient_id: data.patient_id } })
  return NextResponse.json({ data })
}
