import { NextResponse } from "next/server"
import { getAuthenticatedClient } from "@/lib/supabase/api-helper"
import { createClient } from "@supabase/supabase-js"

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
    .select("access_role")
    .eq("auth_user_id", user.id)
    .maybeSingle()

  return NextResponse.json({
    access_role: staffRecord?.access_role || "gestor",
  })
}
