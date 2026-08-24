import { getClinicScopedClient } from "@/lib/supabase/clinic-scope"
import { NextResponse } from "next/server"

export async function GET() {
  const result = await getClinicScopedClient()
  if ("error" in result && result.error) return result.error
  const { supabase, ownerId } = result as any

  const today = new Date()
  const todayStr = today.toISOString().split("T")[0]
  const [
    { count: totalPatients },
    { count: appointmentsToday },
    { count: pendingTreatments },
    { data: upcomingAppointments },
    { data: recentPatients },
  ] = await Promise.all([
    supabase.from("patients").select("*", { count: "exact", head: true }).eq("user_id", ownerId).eq("status", "Ativo"),
    supabase.from("appointments").select("*", { count: "exact", head: true }).eq("user_id", ownerId).eq("date", todayStr),
    supabase.from("treatments").select("*", { count: "exact", head: true }).eq("user_id", ownerId).in("status", ["planned", "in_progress"]),
    supabase.from("appointments").select("*, patient:patients(id, full_name, phone)").eq("user_id", ownerId).eq("date", todayStr).in("status", ["Pendente", "Confirmada", "Aguardando"]).order("time", { ascending: true }).limit(5),
    supabase.from("patients").select("*").eq("user_id", ownerId).order("created_at", { ascending: false }).limit(5),
  ])

  return NextResponse.json({
    stats: {
      totalPatients: totalPatients || 0,
      appointmentsToday: appointmentsToday || 0,
      pendingTreatments: pendingTreatments || 0,
    },
    upcomingAppointments: upcomingAppointments || [],
    recentPatients: recentPatients || [],
  })
}
