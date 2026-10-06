import { NextResponse } from "next/server"
import { z } from "zod"
import { encounterPayloadSchema, emptyPayload, steps } from "@/lib/encounters/model"
import { apiError, databaseError, draftColumns, encounterContext, readJson } from "@/lib/encounters/server"
import { patientBelongsToClinic } from "@/lib/security/clinic-data"

export async function GET(request?: Request) {
  const context = await encounterContext()
  if (context.error) return context.error
  const { supabase, ownerId, user } = context
  const requestedOffset = request ? Number(new URL(request.url).searchParams.get("offset") || 0) : 0
  if (!Number.isSafeInteger(requestedOffset) || requestedOffset < 0) return NextResponse.json({ error: "Página inválida." }, { status: 400 })
  const { data, error, count } = await supabase.from("encounter_drafts")
    .select("id, patient_id, appointment_id, step, revision, updated_at, patient:patients(id, full_name)", { count: "exact" })
    .eq("clinic_id", ownerId).eq("actor_user_id", user.id).eq("status", "active")
    .order("updated_at", { ascending: false }).range(requestedOffset, requestedOffset + 4)
  if (error) return databaseError(error)
  return NextResponse.json({ data, count }, { headers: { "Cache-Control": "no-store" } })
}

export async function POST(request: Request) {
  const context = await encounterContext()
  if (context.error) return context.error
  const { supabase, ownerId, user } = context
  try {
    const body = z.object({ id: z.string().uuid(), patient_id: z.string().uuid().nullable().optional(), appointment_id: z.string().uuid().nullable().optional(), step: z.enum(steps).optional(), payload: encounterPayloadSchema.optional() }).strict().parse(await readJson(request))
    if (body.patient_id && !await patientBelongsToClinic(supabase, body.patient_id, ownerId)) return NextResponse.json({ error: "Paciente não pertence à clínica." }, { status: 403 })
    if (body.appointment_id) {
      const { data, error } = await supabase.from("appointments").select("id, patient_id").eq("id", body.appointment_id).eq("user_id", ownerId).maybeSingle()
      if (error) return databaseError(error)
      if (!data || data.patient_id !== body.patient_id) return NextResponse.json({ error: "Consulta não pertence a este paciente e clínica." }, { status: 403 })
    }
    // Reuse an unfinished encounter rather than creating another one for the same patient.
    if (body.patient_id) {
      const { data, error } = await supabase.from("encounter_drafts").select(draftColumns).eq("clinic_id", ownerId).eq("actor_user_id", user.id).eq("patient_id", body.patient_id).eq("status", "active").maybeSingle()
      if (error) return databaseError(error)
      if (data) return NextResponse.json({ data })
    }
    const { error } = await supabase.from("encounter_drafts").upsert({ id: body.id, clinic_id: ownerId, actor_user_id: user.id, patient_id: body.patient_id || null, appointment_id: body.appointment_id || null, step: body.step || "patient", payload: body.payload || emptyPayload() }, { onConflict: "id", ignoreDuplicates: true })
    if (error) {
      if (error.code === "23505" && body.patient_id) {
        const { data } = await supabase.from("encounter_drafts").select(draftColumns).eq("clinic_id", ownerId).eq("actor_user_id", user.id).eq("patient_id", body.patient_id).eq("status", "active").maybeSingle()
        if (data) return NextResponse.json({ data })
      }
      return databaseError(error)
    }
    const { data, error: readError } = await supabase.from("encounter_drafts").select(draftColumns).eq("id", body.id).eq("clinic_id", ownerId).eq("actor_user_id", user.id).eq("status", "active").maybeSingle()
    if (readError) return databaseError(readError)
    if (!data) return NextResponse.json({ error: "Rascunho indisponível." }, { status: 404 })
    return NextResponse.json({ data })
  } catch (error) { return apiError(error) }
}
