import { NextResponse } from "next/server"

import { getClinicScopedClient } from "@/lib/supabase/clinic-scope"
import { patientBelongsToClinic } from "@/lib/security/clinic-data"

export async function GET(request: Request) {
  const result = await getClinicScopedClient()
  if ("error" in result && result.error) return result.error
  const { supabase, ownerId } = result as any

  const patientId = new URL(request.url).searchParams.get("patientId")
  if (!patientId) return NextResponse.json({ error: "Paciente é obrigatório." }, { status: 400 })
  if (!(await patientBelongsToClinic(supabase, patientId, ownerId))) {
    return NextResponse.json({ error: "Paciente não pertence à clínica." }, { status: 403 })
  }

  const { data, error } = await supabase
    .from("dental_chart_versions")
    .select("id, version_number, snapshot, snapshot_type, professional_name, appointment_id, created_at")
    .eq("user_id", ownerId)
    .eq("patient_id", patientId)
    .in("snapshot_type", ["initial", "appointment_closed"])
    .order("version_number", { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
