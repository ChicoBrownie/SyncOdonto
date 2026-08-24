import { NextResponse } from "next/server"
import { getAuthenticatedClient } from "@/lib/supabase/api-helper"
import { createClient } from "@supabase/supabase-js"
import { getEffectivePermissions } from "@/lib/permissions"

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET() {
  const result = await getAuthenticatedClient()
  if ("error" in result && result.error) return result.error
  const { user } = result as any

  const adminClient = getServiceClient()

  const { data: staffRecord } = await adminClient
    .from("clinic_staff")
    .select("access_role, permissions, is_active")
    .eq("auth_user_id", user.id)
    .maybeSingle()

  if (staffRecord?.is_active === false) {
    return NextResponse.json({ error: "Acesso desativado pelo gestor da clínica." }, { status: 403 })
  }

  const access_role = staffRecord
    ? staffRecord.access_role === "gestor" || staffRecord.access_role === "dentista" || staffRecord.access_role === "recepcionista"
      ? staffRecord.access_role
      : "recepcionista"
    : "gestor"
  const permissions = getEffectivePermissions(access_role, staffRecord?.permissions as any)

  return NextResponse.json({ access_role, permissions, user_id: user.id })
}
