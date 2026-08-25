import type { SupabaseClient } from "@supabase/supabase-js"

type AuditEvent = {
  supabase: SupabaseClient
  clinicId: string
  actorUserId: string
  action: string
  entityType: string
  entityId?: string | null
  metadata?: Record<string, unknown>
}

export async function recordAuditEvent(event: AuditEvent) {
  const { error } = await event.supabase.from("audit_logs").insert({
    clinic_id: event.clinicId,
    actor_user_id: event.actorUserId,
    action: event.action,
    entity_type: event.entityType,
    entity_id: event.entityId || null,
    metadata: event.metadata || {},
  })
  if (error) console.error("Falha ao registrar auditoria:", error.message)
}
