import { getClinicScopedClient } from "@/lib/supabase/clinic-scope"
import { NextResponse } from "next/server"

export async function GET() {
  const result = await getClinicScopedClient()
  if ("error" in result && result.error) return result.error
  const { supabase, ownerId } = result

  const { data, error } = await supabase
    .from("clinic_settings")
    .select("working_hours")
    .eq("user_id", ownerId)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: data?.working_hours ?? null })
}
