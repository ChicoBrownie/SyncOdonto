import { NextResponse } from "next/server"
import { getClinicScopedClient } from "@/lib/supabase/clinic-scope"
import { calculateSustainabilityMetrics } from "@/lib/sustainability/calculate-sustainability-metrics"

export const dynamic = "force-dynamic"

export async function GET() {
  const result = await getClinicScopedClient()
  if ("error" in result && result.error) return result.error

  try {
    const { supabase, ownerId } = result as Exclude<typeof result, { error: NextResponse }>
    const data = await calculateSustainabilityMetrics(supabase, ownerId)

    return NextResponse.json({ data }, {
      headers: { "Cache-Control": "private, no-store" },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao calcular impacto ambiental"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
