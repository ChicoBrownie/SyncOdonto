import { NextResponse } from "next/server"
import { z } from "zod"
import { apiError, databaseError, encounterContext, readJson } from "@/lib/encounters/server"
export async function GET() {
  const context = await encounterContext()
  if (context.error) return context.error
  const { data, error } = await context.supabase.from("encounter_guide_visits").select("area").eq("clinic_id", context.ownerId).eq("actor_user_id", context.user.id)
  if (error) return databaseError(error)
  return NextResponse.json({ data }, { headers: { "Cache-Control": "no-store" } })
}
export async function POST(request: Request) {
  const context = await encounterContext()
  if (context.error) return context.error
  try {
    const { area } = z.object({ area: z.string().regex(/^[a-z-]+$/).max(80) }).strict().parse(await readJson(request))
    const { error } = await context.supabase.from("encounter_guide_visits").upsert({ clinic_id: context.ownerId, actor_user_id: context.user.id, area }, { onConflict: "clinic_id,actor_user_id,area" })
    if (error) return databaseError(error)
    return NextResponse.json({ success: true })
  } catch (error) { return apiError(error) }
}
