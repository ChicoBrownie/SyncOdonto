import { getClinicScopedClient } from "@/lib/supabase/clinic-scope"
import { NextResponse } from "next/server"

export async function GET() {
  const result = await getClinicScopedClient()
  if ("error" in result && result.error) return result.error
  const { supabase, ownerId } = result as any

  const today = new Date()
  const todayStr = today.toISOString().split("T")[0]
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split("T")[0]
  const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split("T")[0]

  const [
    { count: totalPatients },
    { count: appointmentsToday },
    { count: pendingTreatments },
    { count: completedTreatments },
    { data: revenueData },
    { count: aiAnalysesToday },
    { data: upcomingAppointments },
    { data: recentPatients },
  ] = await Promise.all([
    supabase.from("patients").select("*", { count: "exact", head: true }).eq("user_id", ownerId).eq("status", "Ativo"),
    supabase.from("appointments").select("*", { count: "exact", head: true }).eq("user_id", ownerId).eq("date", todayStr),
    supabase.from("treatments").select("*", { count: "exact", head: true }).eq("user_id", ownerId).in("status", ["planned", "in_progress"]),
    supabase.from("treatments").select("*", { count: "exact", head: true }).eq("user_id", ownerId).eq("status", "completed").gte("completed_date", startOfMonth).lte("completed_date", endOfMonth),
    supabase.from("financial_transactions").select("amount").eq("user_id", ownerId).eq("type", "income").eq("status", "paid").gte("paid_date", startOfMonth).lte("paid_date", endOfMonth),
    supabase.from("ai_analyses").select("*", { count: "exact", head: true }).eq("user_id", ownerId).gte("created_at", `${todayStr}T00:00:00`).lte("created_at", `${todayStr}T23:59:59`),
    supabase.from("appointments").select("*, patient:patients(id, full_name, phone)").eq("user_id", ownerId).gte("date", todayStr).order("date", { ascending: true }).order("time", { ascending: true }).limit(5),
    supabase.from("patients").select("*").eq("user_id", ownerId).order("created_at", { ascending: false }).limit(5),
  ])

  const monthlyRevenue = revenueData?.reduce((sum: number, t: any) => sum + (Number(t.amount) || 0), 0) || 0

  return NextResponse.json({
    stats: {
      totalPatients: totalPatients || 0,
      appointmentsToday: appointmentsToday || 0,
      pendingTreatments: pendingTreatments || 0,
      completedTreatments: completedTreatments || 0,
      monthlyRevenue,
      aiAnalysesToday: aiAnalysesToday || 0,
    },
    upcomingAppointments: upcomingAppointments || [],
    recentPatients: recentPatients || [],
  })
}
