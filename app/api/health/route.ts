import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { checkDatabaseHealth } from "@/lib/monitoring/health"

export const dynamic = "force-dynamic"

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) {
    return NextResponse.json({ status: "degraded", database: "error", environment: process.env.APP_ENV || "development" }, { status: 503 })
  }

  const supabase = createClient(url, anonKey, { auth: { persistSession: false } })
  const health = await checkDatabaseHealth(() => supabase.from("clinic_settings").select("id", { head: true, count: "exact" }).limit(1))
  return NextResponse.json(
    { ...health, environment: process.env.APP_ENV || process.env.NODE_ENV || "unknown", checkedAt: new Date().toISOString() },
    { status: health.status === "ok" ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  )
}
