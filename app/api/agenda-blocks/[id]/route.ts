import { getClinicScopedClient } from "@/lib/supabase/clinic-scope"
import { NextResponse } from "next/server"
import { z } from "zod"

const blockInput = z.object({
  title: z.string().trim().min(2).max(160),
  scope: z.enum(["dentist", "clinic"]),
  doctor_name: z.string().trim().max(160).optional().nullable(),
  resource_name: z.string().trim().max(160).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  start_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional().nullable(),
  end_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional().nullable(),
  all_day: z.boolean().default(false),
})

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const result = await getClinicScopedClient()
  if ("error" in result && result.error) return result.error
  const { supabase, ownerId } = result as any
  const { id } = await params
  const parsed = blockInput.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Confira os dados do compromisso." }, { status: 400 })
  const body = parsed.data
  if (body.scope === "dentist" && !body.doctor_name?.trim()) return NextResponse.json({ error: "Selecione o dentista responsável." }, { status: 400 })
  if (!body.all_day && (!body.start_time || !body.end_time || body.end_time <= body.start_time)) return NextResponse.json({ error: "Informe um horário final posterior ao horário inicial." }, { status: 400 })
  const { data: existing, error: existingError } = await supabase.from("agenda_blocks").select("id").eq("id", id).eq("clinic_id", ownerId).maybeSingle()
  if (existingError) return NextResponse.json({ error: existingError.message }, { status: existingError.code === "42P01" ? 503 : 500 })
  if (!existing) return NextResponse.json({ error: "Compromisso não encontrado." }, { status: 404 })
  const rangeStart = body.all_day ? "00:00" : body.start_time!
  const rangeEnd = body.all_day ? "24:00" : body.end_time!
  let query = supabase.from("appointments").select("time,duration_minutes,doctor_name").eq("user_id", ownerId).eq("date", body.date).not("status", "in", '("Cancelada","Concluída","Falta")')
  if (body.scope === "dentist") query = query.ilike("doctor_name", body.doctor_name!.trim())
  const { data: appointments, error: appointmentsError } = await query
  if (appointmentsError) return NextResponse.json({ error: appointmentsError.message }, { status: 500 })
  const overlapsAppointment = (appointments || []).some((appointment: any) => {
    const [hour, minute] = appointment.time.slice(0, 5).split(":").map(Number)
    const appointmentEndMinutes = hour * 60 + minute + (Number(appointment.duration_minutes) || 60)
    const appointmentEnd = `${String(Math.floor(appointmentEndMinutes / 60)).padStart(2, "0")}:${String(appointmentEndMinutes % 60).padStart(2, "0")}`
    return appointment.time.slice(0, 5) < rangeEnd && appointmentEnd > rangeStart
  })
  if (overlapsAppointment) return NextResponse.json({ error: "Já existe uma consulta neste período. Confira a agenda antes de bloquear o horário." }, { status: 409 })
  const { data, error } = await supabase.from("agenda_blocks").update({
    ...body,
    doctor_name: body.scope === "dentist" ? body.doctor_name!.trim() : null,
    start_time: body.all_day ? null : body.start_time,
    end_time: body.all_day ? null : body.end_time,
    resource_name: body.resource_name || null,
    notes: body.notes || null,
    updated_at: new Date().toISOString(),
  }).eq("id", id).eq("clinic_id", ownerId).select("*").single()
  if (error) return NextResponse.json({ error: error.message }, { status: error.code === "42P01" ? 503 : 500 })
  return NextResponse.json({ data })
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const result = await getClinicScopedClient()
  if ("error" in result && result.error) return result.error
  const { supabase, ownerId } = result as any
  const { id } = await params
  const { error } = await supabase.from("agenda_blocks").delete().eq("id", id).eq("clinic_id", ownerId)
  if (error) return NextResponse.json({ error: error.message }, { status: error.code === "42P01" ? 503 : 500 })
  return NextResponse.json({ success: true })
}
