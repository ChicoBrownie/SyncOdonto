import { NextResponse } from "next/server"
import { getAuthenticatedClient } from "@/lib/supabase/api-helper"
import { createClient } from "@supabase/supabase-js"

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST() {
  const result = await getAuthenticatedClient()
  if ("error" in result && result.error) return result.error
  const { user } = result as any

  if (!user.email) {
    return NextResponse.json({ error: "Usuário sem email." }, { status: 400 })
  }

  const invitedBy = user.user_metadata?.invited_by
  if (typeof invitedBy !== "string" || !invitedBy) {
    return NextResponse.json({ error: "Convite de clínica inválido ou ausente." }, { status: 403 })
  }

  const adminClient = getServiceClient()

  const { data, error } = await adminClient
    .from("clinic_staff")
    .update({ auth_user_id: user.id })
    .eq("email", user.email)
    .eq("user_id", invitedBy)
    .is("auth_user_id", null)
    .select()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ linked: (data?.length || 0) > 0, data })
}
