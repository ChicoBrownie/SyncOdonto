import { getAuthenticatedClient } from "@/lib/supabase/api-helper"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
  const result = await getAuthenticatedClient()
  if ("error" in result && result.error) return result.error
  const { supabase, user } = result as any

  const { searchParams } = new URL(request.url)
  const date = searchParams.get("date")
  const startDate = searchParams.get("startDate")
  const endDate = searchParams.get("endDate")
  const status = searchParams.get("status")
  const patientId = searchParams.get("patientId") || searchParams.get("patient_id")

  let query = supabase
    .from("appointments")
    .select(`*, patient:patients(id, full_name, phone, email)`)
    .eq("user_id", user.id)
    .order("date", { ascending: true })
    .order("time", { ascending: true })

  if (date) {
    query = query.eq("date", date)
  }

  if (startDate && endDate) {
    query = query.gte("date", startDate).lte("date", endDate)
  }

  if (status && status !== "all") {
    query = query.eq("status", status)
  }

  if (patientId) {
    query = query.eq("patient_id", patientId)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data })
}

// Verifica se dois intervalos de tempo se sobrepõem
// [start1, end1) e [start2, end2) — usa minutos desde meia-noite para comparação
function parseMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number)
  return h * 60 + m
}

function hasTimeConflict(
  startA: string,
  durationA: number,
  startB: string,
  durationB: number
): boolean {
  const startAMin = parseMinutes(startA)
  const endAMin = startAMin + durationA
  const startBMin = parseMinutes(startB)
  const endBMin = startBMin + durationB
  // Sobreposição ocorre quando um intervalo começa antes do outro terminar
  return startAMin < endBMin && startBMin < endAMin
}

export async function POST(request: Request) {
  const result = await getAuthenticatedClient()
  if ("error" in result && result.error) return result.error
  const { supabase, user } = result as any

  const body = await request.json()

  // --- Validações básicas ---
  if (!body.patient_id) {
    return NextResponse.json(
      { error: "Paciente é obrigatório." },
      { status: 400 }
    )
  }

  if (!body.doctor_name || body.doctor_name.trim() === "") {
    return NextResponse.json(
      { error: "Dentista responsável é obrigatório." },
      { status: 400 }
    )
  }

  if (!body.date || !body.time) {
    return NextResponse.json(
      { error: "Data e horário são obrigatórios." },
      { status: 400 }
    )
  }

  const duration = body.duration_minutes ?? 60

  if (typeof body.cost === "number" && body.cost < 0) {
    return NextResponse.json(
      { error: "O valor do procedimento não pode ser negativo." },
      { status: 400 }
    )
  }

  // --- Validação de data e horário ---
  const today = new Date().toISOString().split("T")[0]

  if (body.date < today) {
    return NextResponse.json(
      { error: "Não é possível agendar em datas passadas." },
      { status: 400 }
    )
  }

  if (body.date === today) {
    const now = new Date()
    const nowMinutes = now.getHours() * 60 + now.getMinutes()
    const [h, m] = body.time.split(":").map(Number)
    const apptMinutes = h * 60 + m
    if (apptMinutes <= nowMinutes) {
      return NextResponse.json(
        { error: "Não é possível agendar para um horário que já passou." },
        { status: 400 }
      )
    }
  }

  // --- Busca agendamentos existentes na mesma data ---
  // Exclui cancelados e concluídos pois não ocupam mais o horário
  const { data: existingAppointments, error: fetchError } = await supabase
    .from("appointments")
    .select("id, time, duration_minutes, patient_id, doctor_name, status")
    .eq("user_id", user.id)
    .eq("date", body.date)
    .not("status", "in", '("Cancelada","Concluída")')

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 })
  }

  // --- Verifica conflitos para o mesmo dentista e para o mesmo paciente ---
  for (const existing of existingAppointments ?? []) {
    const existingDuration = existing.duration_minutes ?? 60

    const conflict = hasTimeConflict(
      body.time,
      duration,
      existing.time,
      existingDuration
    )

    if (!conflict) continue

    // Conflito de dentista
    if (
      existing.doctor_name &&
      body.doctor_name &&
      existing.doctor_name.trim().toLowerCase() ===
        body.doctor_name.trim().toLowerCase()
    ) {
      return NextResponse.json(
        {
          error: `Conflito de horário: o(a) dentista ${body.doctor_name} já possui um agendamento às ${existing.time.substring(0, 5)} nesta data.`,
        },
        { status: 409 }
      )
    }

    // Conflito de paciente
    if (existing.patient_id === body.patient_id) {
      return NextResponse.json(
        {
          error: `Conflito de horário: este paciente já possui um agendamento às ${existing.time.substring(0, 5)} nesta data.`,
        },
        { status: 409 }
      )
    }
  }

  // --- Sem conflitos, insere o agendamento ---
  const { data, error } = await supabase
    .from("appointments")
    .insert({ ...body, user_id: user.id })
    .select(`*, patient:patients(id, full_name, phone, email)`)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data })
}
