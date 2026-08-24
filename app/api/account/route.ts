import { NextResponse } from "next/server"
import { getClinicScopedClient } from "@/lib/supabase/clinic-scope"

export async function GET() {
  const scoped = await getClinicScopedClient()
  if ("error" in scoped && scoped.error) return scoped.error
  const { supabase, user } = scoped as any
  const { data, error } = await supabase.from("profiles").select("full_name, phone").eq("id", user.id).maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: { ...data, email: user.email } })
}
