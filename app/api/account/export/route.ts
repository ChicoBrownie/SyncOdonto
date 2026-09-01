import { NextResponse } from "next/server"

import { getClinicScopedClient } from "@/lib/supabase/clinic-scope"
import { isClinicManager } from "@/lib/security/request-data"
import { consumeRateLimit } from "@/lib/security/rate-limit"
import { recordAuditEvent } from "@/lib/security/audit"

export const dynamic = "force-dynamic"

const CLINIC_TABLES = [
  "patients",
  "appointments",
  "dental_charts",
  "medical_records",
  "treatments",
  "documents",
  "ai_analyses",
  "clinic_settings",
  "financial_transactions",
  "paperless_templates",
] as const

export async function GET() {
  const scoped = await getClinicScopedClient()
  if ("error" in scoped && scoped.error) return scoped.error
  const { supabase, ownerId, accessRole, user } = scoped as any

  if (!isClinicManager(accessRole)) {
    return NextResponse.json({ error: "Apenas o gestor pode exportar os dados da clínica." }, { status: 403 })
  }

  if (!(await consumeRateLimit(supabase, `clinic-export:${ownerId}`, 3, 24 * 60 * 60))) {
    return NextResponse.json({ error: "Limite diário de exportações atingido." }, { status: 429 })
  }

  const [profileResult, staffResult, auditResult, ...tableResults] = await Promise.all([
    supabase.from("profiles").select("id, full_name, role, phone, cro, specialty, created_at, updated_at").eq("id", ownerId).maybeSingle(),
    supabase.from("clinic_staff").select("id, auth_user_id, full_name, email, access_role, permissions, is_active, created_at, updated_at").eq("user_id", ownerId),
    supabase.from("audit_logs").select("id, actor_user_id, action, entity_type, entity_id, metadata, created_at").eq("clinic_id", ownerId).order("created_at", { ascending: true }),
    ...CLINIC_TABLES.map((table) => supabase.from(table).select("*").eq("user_id", ownerId)),
  ])

  const failures = [
    profileResult.error && `profiles: ${profileResult.error.message}`,
    staffResult.error && `clinic_staff: ${staffResult.error.message}`,
    auditResult.error && `audit_logs: ${auditResult.error.message}`,
    ...tableResults.map((result, index) => result.error && `${CLINIC_TABLES[index]}: ${result.error.message}`),
  ].filter(Boolean)

  if (failures.length > 0) {
    await recordAuditEvent({
      supabase,
      clinicId: ownerId,
      actorUserId: user.id,
      action: "clinic_export.failed",
      entityType: "clinic",
      entityId: ownerId,
      metadata: { failures },
    })
    return NextResponse.json({ error: "Não foi possível gerar uma exportação completa.", details: failures }, { status: 500 })
  }

  const tables = Object.fromEntries(CLINIC_TABLES.map((table, index) => [table, tableResults[index].data ?? []]))
  const exportedAt = new Date().toISOString()
  const payload = {
    format: "syncodonto-clinic-export",
    version: 1,
    exported_at: exportedAt,
    clinic_id: ownerId,
    scope: "Dados cadastrais, clínicos, financeiros, documentos (metadados) e auditoria da clínica.",
    important_notes: [
      "Este arquivo contém dados pessoais e dados de saúde. Armazene-o de forma criptografada e com acesso restrito.",
      "Arquivos binários de documentos e exames não estão incorporados; os metadados e caminhos de armazenamento estão incluídos.",
      "A exportação não exclui nem altera dados no SyncOdonto.",
    ],
    clinic_profile: profileResult.data,
    clinic_staff: staffResult.data ?? [],
    audit_logs: auditResult.data ?? [],
    tables,
  }

  await recordAuditEvent({
    supabase,
    clinicId: ownerId,
    actorUserId: user.id,
    action: "clinic_export.downloaded",
    entityType: "clinic",
    entityId: ownerId,
    metadata: {
      exported_at: exportedAt,
      record_counts: Object.fromEntries(Object.entries(tables).map(([table, rows]) => [table, (rows as unknown[]).length])),
    },
  })

  const date = exportedAt.slice(0, 10)
  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="syncodonto-export-${date}.json"`,
      "Cache-Control": "no-store, private",
      "X-Content-Type-Options": "nosniff",
    },
  })
}
