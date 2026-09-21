import type { SupabaseClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
import { getPlatformAdminContext } from "@/lib/security/platform-admin"

const PERIODS = {
  "7d": { label: "Últimos 7 dias", days: 7 },
  "30d": { label: "Últimos 30 dias", days: 30 },
  "90d": { label: "Últimos 90 dias", days: 90 },
  month: { label: "Este mês", days: null },
  all: { label: "Todo o histórico", days: null },
} as const

type PeriodKey = keyof typeof PERIODS

function getPeriod(key: string | null) {
  const periodKey: PeriodKey = key && key in PERIODS ? key as PeriodKey : "30d"
  const config = PERIODS[periodKey]
  if (periodKey === "all") return { key: periodKey, label: config.label, start: null }

  const start = new Date()
  if (periodKey === "month") start.setDate(1)
  else start.setDate(start.getDate() - (config.days || 0) + 1)
  start.setHours(0, 0, 0, 0)
  return { key: periodKey, label: config.label, start }
}

function isInPeriod(value: string | null | undefined, start: Date | null) {
  return Boolean(value) && (!start || new Date(value!).getTime() >= start.getTime())
}

function dayKey(value: string) {
  return new Date(value).toISOString().slice(0, 10)
}

async function listAllUsers(supabase: SupabaseClient) {
  const users: Array<{ id: string; email?: string; created_at?: string; last_sign_in_at?: string; user_metadata?: Record<string, unknown> }> = []
  const perPage = 1000
  let page = 1

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage })
    if (error) throw error
    users.push(...data.users)
    if (data.users.length < perPage) return users
    page += 1
  }
}

export async function GET(request: Request) {
  const context = await getPlatformAdminContext()
  if ("error" in context) return context.error
  const { supabase } = context
  const { searchParams } = new URL(request.url)
  const period = getPeriod(searchParams.get("period"))

  try {
    const [users, patientsResult, appointmentsResult, financialResult, settingsResult, staffResult] = await Promise.all([
      listAllUsers(supabase),
      supabase.from("patients").select("user_id, created_at"),
      supabase.from("appointments").select("user_id, date, status, created_at"),
      supabase.from("financial_transactions").select("user_id, amount, status, type, created_at"),
      supabase.from("clinic_settings").select("user_id, clinic_name, city, state"),
      supabase.from("clinic_staff").select("user_id, auth_user_id, is_active"),
    ])

    const resultError = [patientsResult, appointmentsResult, financialResult, settingsResult, staffResult]
      .map((result) => result.error)
      .find(Boolean)
    if (resultError) return NextResponse.json({ error: resultError.message }, { status: 500 })

    const patients = patientsResult.data || []
    const appointments = appointmentsResult.data || []
    const financial = financialResult.data || []
    const settings = settingsResult.data || []
    const staff = staffResult.data || []
    const staffUserIds = new Set(staff.map((member) => member.auth_user_id).filter(Boolean))
    const clinicIds = new Set<string>([
      ...patients.map((row) => row.user_id),
      ...appointments.map((row) => row.user_id),
      ...financial.map((row) => row.user_id),
      ...settings.map((row) => row.user_id),
      ...users.filter((user) => !staffUserIds.has(user.id)).map((user) => user.id),
    ])
    const usersById = new Map(users.map((user) => [user.id, user]))
    const settingsByClinic = new Map(settings.map((setting) => [setting.user_id, setting]))

    const accounts = Array.from(clinicIds).map((clinicId) => {
      const authUser = usersById.get(clinicId)
      const clinicPatients = patients.filter((row) => row.user_id === clinicId)
      const clinicAppointments = appointments.filter((row) => row.user_id === clinicId)
      const clinicFinancial = financial.filter((row) => row.user_id === clinicId)
      const clinicStaff = staff.filter((row) => row.user_id === clinicId)
      const activityDates = [
        ...clinicPatients.map((row) => row.created_at),
        ...clinicAppointments.map((row) => row.created_at),
        ...clinicFinancial.map((row) => row.created_at),
      ].filter(Boolean).map((value) => new Date(value!).getTime())
      const activityInPeriod = [
        ...clinicPatients.map((row) => row.created_at),
        ...clinicAppointments.map((row) => row.created_at),
        ...clinicFinancial.map((row) => row.created_at),
      ].some((value) => isInPeriod(value, period.start))
      const revenueInPeriod = clinicFinancial
        .filter((row) => row.type === "income" && row.status === "paid" && isInPeriod(row.created_at, period.start))
        .reduce((total, row) => total + (Number(row.amount) || 0), 0)
      const setting = settingsByClinic.get(clinicId)
      const clinicName = setting?.clinic_name || (authUser?.user_metadata?.full_name as string | undefined) || authUser?.email || "Clínica sem identificação"

      return {
        userId: clinicId,
        clinicName,
        location: [setting?.city, setting?.state].filter(Boolean).join(" - ") || null,
        email: authUser?.email || "—",
        createdAt: authUser?.created_at || null,
        lastSignInAt: authUser?.last_sign_in_at || null,
        lastActivity: activityDates.length ? new Date(Math.max(...activityDates)).toISOString() : null,
        totalPatients: clinicPatients.length,
        newPatients: clinicPatients.filter((row) => isInPeriod(row.created_at, period.start)).length,
        totalAppointments: clinicAppointments.length,
        appointmentsInPeriod: clinicAppointments.filter((row) => isInPeriod(row.created_at, period.start)).length,
        revenueInPeriod,
        teamCount: clinicStaff.filter((member) => member.is_active !== false).length + 1,
        isActive: activityInPeriod || isInPeriod(authUser?.last_sign_in_at, period.start),
      }
    }).sort((a, b) => {
      const activityA = a.lastActivity ? new Date(a.lastActivity).getTime() : 0
      const activityB = b.lastActivity ? new Date(b.lastActivity).getTime() : 0
      return activityB - activityA
    })

    const chart = new Map<string, { date: string; appointments: number; revenue: number; patients: number }>()
    const addChartValue = (value: string | null, field: "appointments" | "revenue" | "patients", amount = 1) => {
      if (!value || !isInPeriod(value, period.start)) return
      const date = dayKey(value)
      const current = chart.get(date) || { date, appointments: 0, revenue: 0, patients: 0 }
      current[field] += amount
      chart.set(date, current)
    }
    appointments.forEach((row) => addChartValue(row.created_at, "appointments"))
    patients.forEach((row) => addChartValue(row.created_at, "patients"))
    financial
      .filter((row) => row.type === "income" && row.status === "paid")
      .forEach((row) => addChartValue(row.created_at, "revenue", Number(row.amount) || 0))

    return NextResponse.json({
      period: { key: period.key, label: period.label, start: period.start?.toISOString() || null },
      summary: {
        totalClinics: accounts.length,
        activeClinics: accounts.filter((account) => account.isActive).length,
        patients: accounts.reduce((total, account) => total + account.totalPatients, 0),
        newPatients: accounts.reduce((total, account) => total + account.newPatients, 0),
        appointments: accounts.reduce((total, account) => total + account.appointmentsInPeriod, 0),
        revenue: accounts.reduce((total, account) => total + account.revenueInPeriod, 0),
      },
      chart: Array.from(chart.values()).sort((a, b) => a.date.localeCompare(b.date)),
      accounts,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível carregar a visão da plataforma."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
