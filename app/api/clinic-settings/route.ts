import { getClinicScopedClient } from "@/lib/supabase/clinic-scope"
import { requirePermission } from "@/lib/permissions-server"
import { stripImmutableTenantFields } from "@/lib/security/request-data"
import { NextResponse } from "next/server"

export async function GET() {
  const result = await getClinicScopedClient()
  if ("error" in result && result.error) return result.error
  const { supabase, ownerId, permissions } = result as any

  const denied = requirePermission(permissions, "configuracoes")
  if (denied) return denied

  const { data, error } = await supabase
    .from("clinic_settings")
    .select("*")
    .eq("user_id", ownerId)
    .single()

  if (error && error.code !== "PGRST116") {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data })
}

export async function POST(request: Request) {
  const result = await getClinicScopedClient()
  if ("error" in result && result.error) return result.error
  const { supabase, ownerId, permissions } = result as any

  const denied = requirePermission(permissions, "configuracoes")
  if (denied) return denied

  const body = stripImmutableTenantFields(await request.json())

  const { data: existing } = await supabase
    .from("clinic_settings")
    .select("id")
    .eq("user_id", ownerId)
    .single()

  if (existing) {
    const { data, error } = await supabase
      .from("clinic_settings")
      .update(body)
      .eq("user_id", ownerId)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  }

  const { data, error } = await supabase
    .from("clinic_settings")
    .insert({ ...body, user_id: ownerId })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
