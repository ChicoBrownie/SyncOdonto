import { getClinicScopedClient } from "@/lib/supabase/clinic-scope"
import { requirePermission } from "@/lib/permissions-server"
import { NextResponse } from "next/server"
import { stripImmutableTenantFields } from "@/lib/security/request-data"
import { patientBelongsToClinic } from "@/lib/security/clinic-data"
import { financialInputSchema, parseInput } from "@/lib/validation/api-schemas"
import { recordAuditEvent } from "@/lib/security/audit"

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await getClinicScopedClient()
  if ("error" in result && result.error) return result.error
  const { supabase, ownerId, permissions, user } = result as any

  const denied = requirePermission(permissions, "financeiro")
  if (denied) return denied

  const { id } = await params

  const parsed = parseInput(financialInputSchema.partial(), stripImmutableTenantFields(await request.json()))
  if (!parsed.data) return NextResponse.json({ error: parsed.error }, { status: 400 })
  const body = parsed.data
  if (body.patient_id && !(await patientBelongsToClinic(supabase, body.patient_id, ownerId))) {
    return NextResponse.json({ error: "Paciente não pertence à clínica." }, { status: 403 })
  }

  const { data, error } = await supabase
    .from("financial_transactions")
    .update(body)
    .eq("id", id)
    .eq("user_id", ownerId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await recordAuditEvent({ supabase, clinicId: ownerId, actorUserId: user.id, action: "financial.updated", entityType: "financial_transactions", entityId: id, metadata: { fields: Object.keys(body) } })
  return NextResponse.json({ data })
}
