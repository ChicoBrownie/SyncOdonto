import { NextResponse } from "next/server"
import { getPlatformAdminContext } from "@/lib/security/platform-admin"

export async function POST(request: Request) {
  const context = await getPlatformAdminContext()
  if ("error" in context) return context.error
  const { supabase, user } = context

  const body = await request.json().catch(() => null)
  const clinicId = typeof body?.clinicId === "string" ? body.clinicId : ""
  const reason = typeof body?.reason === "string" ? body.reason.trim() : ""
  if (!clinicId || reason.length < 10 || reason.length > 1000) {
    return NextResponse.json({ error: "Informe uma justificativa entre 10 e 1.000 caracteres." }, { status: 400 })
  }

  const { error: auditError } = await supabase.from("audit_logs").insert({
    clinic_id: clinicId,
    actor_user_id: user.id,
    action: "platform_admin.support_access",
    entity_type: "clinic_support",
    entity_id: clinicId,
    metadata: { reason },
  })
  if (auditError) {
    return NextResponse.json({ error: "Não foi possível registrar o acesso de suporte." }, { status: 500 })
  }

  const [clinicResult, patientsResult, staffResult] = await Promise.all([
    supabase.from("clinic_settings").select("clinic_name, email, phone, city, state").eq("user_id", clinicId).maybeSingle(),
    supabase.from("patients").select("id, full_name, status, last_visit_at, created_at").eq("user_id", clinicId).order("created_at", { ascending: false }).limit(100),
    supabase.from("clinic_staff").select("id, full_name, email, role, specialty, access_role, is_active").eq("user_id", clinicId).order("created_at", { ascending: true }),
  ])
  const resultError = [clinicResult, patientsResult, staffResult].map((result) => result.error).find(Boolean)
  if (resultError) return NextResponse.json({ error: resultError.message }, { status: 500 })

  return NextResponse.json({
    clinic: clinicResult.data,
    patients: patientsResult.data || [],
    staff: staffResult.data || [],
  })
}
