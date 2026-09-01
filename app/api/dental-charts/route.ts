import { getClinicScopedClient } from "@/lib/supabase/clinic-scope"
import { NextResponse } from "next/server"
import { patientBelongsToClinic } from "@/lib/security/clinic-data"
import { dentalChartInputSchema, parseInput } from "@/lib/validation/api-schemas"

export async function GET(request: Request) {
  const result = await getClinicScopedClient()
  if ("error" in result && result.error) return result.error
  const { supabase, ownerId } = result as any

  const { searchParams } = new URL(request.url)
  const patientId = searchParams.get("patientId")

  if (!patientId) {
    return NextResponse.json({ error: "Patient ID is required" }, { status: 400 })
  }

  const { data, error } = await supabase
    .from("dental_charts")
    .select("*")
    .eq("user_id", ownerId)
    .eq("patient_id", patientId)
    .order("tooth_number", { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data })
}

export async function POST(request: Request) {
  const result = await getClinicScopedClient()
  if ("error" in result && result.error) return result.error
  const { supabase, ownerId } = result as any

  const parsed = parseInput(dentalChartInputSchema, await request.json())
  if (!parsed.data) return NextResponse.json({ error: parsed.error }, { status: 400 })
  const body = parsed.data
  if (!(await patientBelongsToClinic(supabase, body.patient_id, ownerId))) {
    return NextResponse.json({ error: "Paciente não pertence à clínica." }, { status: 403 })
  }

  const { data, error } = await supabase
    .from("dental_charts")
    .upsert(
      {
        user_id: ownerId,
        patient_id: body.patient_id,
        tooth_number: body.tooth_number,
        condition: body.condition,
        surface_conditions: body.surface_conditions ?? {},
        surfaces: Object.keys(body.surface_conditions ?? {}),
        notes: body.notes ?? null,
      },
      { onConflict: "user_id,patient_id,tooth_number" },
    )
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data })
}

export async function DELETE(request: Request) {
  const result = await getClinicScopedClient()
  if ("error" in result && result.error) return result.error
  const { supabase, ownerId } = result as any

  const { searchParams } = new URL(request.url)
  const patientId = searchParams.get("patientId")
  const toothNumber = searchParams.get("toothNumber")

  if (!patientId || !toothNumber) {
    return NextResponse.json({ error: "patientId e toothNumber são obrigatórios" }, { status: 400 })
  }

  const { error } = await supabase
    .from("dental_charts")
    .delete()
    .eq("user_id", ownerId)
    .eq("patient_id", patientId)
    .eq("tooth_number", Number(toothNumber))

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
