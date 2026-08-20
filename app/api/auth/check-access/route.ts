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
    .select("access_role, permissions")
    .eq("auth_user_id", user.id)
    .maybeSingle()

  const access_role = staffRecord?.access_role || "gestor"
  const permissions = getEffectivePermissions(access_role, staffRecord?.permissions as any)

  return NextResponse.json({ access_role, permissions, user_id: user.id })
}
