import { NextResponse } from "next/server"

import { getClinicScopedClient } from "@/lib/supabase/clinic-scope"
import { isClinicManager } from "@/lib/security/request-data"
import { consumeRateLimit } from "@/lib/security/rate-limit"
import { recordAuditEvent } from "@/lib/security/audit"
import { dataSubjectRequestSchema, parseInput } from "@/lib/validation/api-schemas"

export async function GET() {
  const scoped = await getClinicScopedClient()
  if ("error" in scoped && scoped.error) return scoped.error
  const { supabase, ownerId, accessRole } = scoped as any
  if (!isClinicManager(accessRole)) return NextResponse.json({ error: "Apenas o gestor pode consultar solicitações de dados." }, { status: 403 })

  const { data, error } = await supabase
    .from("data_subject_requests")
    .select("id, request_type, status, reason, requested_at, completed_at")
    .eq("clinic_id", ownerId)
    .order("requested_at", { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(request: Request) {
  const scoped = await getClinicScopedClient()
  if ("error" in scoped && scoped.error) return scoped.error
  const { supabase, ownerId, accessRole, user } = scoped as any
  if (!isClinicManager(accessRole)) return NextResponse.json({ error: "Apenas o gestor pode solicitar exportação ou exclusão." }, { status: 403 })

  const parsed = parseInput(dataSubjectRequestSchema, await request.json())
  if (!parsed.data) return NextResponse.json({ error: parsed.error }, { status: 400 })
  if (!(await consumeRateLimit(supabase, `data-request:${ownerId}`, 3, 24 * 60 * 60))) {
    return NextResponse.json({ error: "Limite diário de solicitações atingido." }, { status: 429 })
  }

  const { data, error } = await supabase.from("data_subject_requests").insert({
    clinic_id: ownerId,
    requested_by: user.id,
    request_type: parsed.data.request_type,
    reason: parsed.data.reason || null,
  }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await recordAuditEvent({ supabase, clinicId: ownerId, actorUserId: user.id, action: `data_request.${parsed.data.request_type}`, entityType: "data_subject_requests", entityId: data.id })
  return NextResponse.json({ data }, { status: 202 })
}
