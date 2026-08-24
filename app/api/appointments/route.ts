import { getClinicScopedClient } from "@/lib/supabase/clinic-scope"
import { NextResponse } from "next/server"
import { stripImmutableTenantFields } from "@/lib/security/request-data"
import { getLocalDate, getLocalMinutes, hasTimeConflict, parseMinutes } from "@/lib/appointments/scheduling"
import { patientBelongsToClinic } from "@/lib/security/clinic-data"

export async function GET(request: Request) {
  const result = await getClinicScopedClient()
  if ("error" in result && result.error) return result.error
  const { supabase, ownerId } = result as any

  const { searchParams } = new URL(request.url)
  const date = searchParams.get("date")
  const startDate = searchParams.get("startDate")
  const endDate = searchParams.get("endDate")
  const status = searchParams.get("status")
  const patientId = searchParams.get("patientId") || searchParams.get("patient_id")

  let query = supabase
    .from("appointments")
    .select(`*, patient:patients(id, full_name, phone, email)`)
    .eq("user_id", ownerId)
    .order("date", { ascending: true })
    .order("time", { ascending: true })

  if (date) query = query.eq("date", date)
  if (startDate && endDate) query = query.gte("date", startDate).lte("date", endDate)
  if (status && status !== "all") query = query.eq("status", status)
  if (patientId) query = query.eq("patient_id", patientId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(request: Request) {
  const result = await getClinicScopedClient()
  if ("error" in result && result.error) return result.error
  const { supabase, ownerId } = result as any

  const body = stripImmutableTenantFields(await request.json())

  // Validações básicas
  if (!body.patient_id) {
    return NextResponse.json({ error: "Paciente é obrigatório." }, { status: 400 })
  }
  if (!(await patientBelongsToClinic(supabase, body.patient_id, ownerId))) {
    return NextResponse.json({ error: "Paciente não pertence à clínica." }, { status: 403 })
  }
  if (!body.doctor_name || body.doctor_name.trim() === "") {
    return NextResponse.json({ error: "Dentista responsável é obrigatório." }, { status: 400 })
  }
  if (!body.date || !body.time) {
    return NextResponse.json({ error: "Data e horário são obrigatórios." }, { status: 400 })
  }
  if (typeof body.cost === "number" && body.cost < 0) {
    return NextResponse.json({ error: "O valor do procedimento não pode ser negativo." }, { status: 400 })
  }

  const duration = body.duration_minutes ?? 60

  // FIX BUG 4: usa data de Brasília para comparação
  const today = getLocalDate()

  if (body.date < today) {
    return NextResponse.json({ error: "Não é possível agendar em datas passadas." }, { status: 400 })
  }

  // FIX BUG 1: compara minutos sem adicionar buffer de horas
  if (body.date === today) {
    const nowMinutes = getLocalMinutes()
    const apptMinutes = parseMinutes(body.time)
    if (apptMinutes <= nowMinutes) {
      return NextResponse.json({ error: "Não é possível agendar para um horário que já passou." }, { status: 400 })
    }
  }

  // Busca agendamentos existentes na mesma data
  const { data: existingAppointments, error: fetchError } = await supabase
    .from("appointments")
    .select("id, time, duration_minutes, patient_id, doctor_name, status")
    .eq("user_id", ownerId)
    .eq("date", body.date)
    .not("status", "in", '("Cancelada","Concluída")')

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 })
  }

  // Verifica conflitos
  for (const existing of existingAppointments ?? []) {
    const existingDuration = existing.duration_minutes ?? 60
    const conflict = hasTimeConflict(body.time, duration, existing.time, existingDuration)
    if (!conflict) continue

    if (existing.doctor_name && body.doctor_name &&
      existing.doctor_name.trim().toLowerCase() === body.doctor_name.trim().toLowerCase()) {
      return NextResponse.json({
        error: `Conflito de horário: o(a) dentista ${body.doctor_name} já possui um agendamento às ${existing.time.substring(0, 5)} nesta data.`,
      }, { status: 409 })
    }

    if (existing.patient_id === body.patient_id) {
      return NextResponse.json({
        error: `Conflito de horário: este paciente já possui um agendamento às ${existing.time.substring(0, 5)} nesta data.`,
      }, { status: 409 })
    }
  }

  const { data, error } = await supabase
    .from("appointments")
    .insert({ ...body, user_id: ownerId })
    .select(`*, patient:patients(id, full_name, phone, email)`)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
