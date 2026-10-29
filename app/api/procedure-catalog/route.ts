import { NextResponse } from "next/server"

import { getClinicScopedClient } from "@/lib/supabase/clinic-scope"
import { missingDefaultProcedureRows } from "@/lib/dental-chart/catalog-seed"
import { parseInput, procedureCatalogInputSchema } from "@/lib/validation/api-schemas"
import { stripImmutableTenantFields } from "@/lib/security/request-data"

const QUICK_OPTION_LIMIT = 5

async function seedDefaultProcedures(supabase: any, ownerId: string) {
  const { data: existing, error } = await supabase.from("procedure_catalog").select("id, name").eq("user_id", ownerId)
  if (error) return error
  const rows = missingDefaultProcedureRows(ownerId, existing || [])
  if (rows.length === 0) return null
  const { error: insertError } = await supabase.from("procedure_catalog").upsert(rows, { onConflict: "id", ignoreDuplicates: true })
  // Uma criação simultânea com o mesmo nome pode vencer a corrida; a próxima leitura completa o lote.
  return insertError?.code === "23505" ? null : insertError
}

async function quickOptionLimitReached(supabase: any, ownerId: string) {
  const { count, error } = await supabase
    .from("procedure_catalog")
    .select("id", { count: "exact", head: true })
    .eq("user_id", ownerId)
    .eq("is_active", true)
    .eq("is_favorite", true)
  if (error) throw error
  return (count || 0) >= QUICK_OPTION_LIMIT
}

export async function GET(request: Request) {
  const result = await getClinicScopedClient()
  if ("error" in result && result.error) return result.error
  const { supabase, ownerId } = result as any
  const includeInactive = new URL(request.url).searchParams.get("includeInactive") === "true"

  const seedError = await seedDefaultProcedures(supabase, ownerId)
  if (seedError) return NextResponse.json({ error: seedError.message }, { status: 500 })

  let query = supabase
    .from("procedure_catalog")
    .select("*")
    .eq("user_id", ownerId)
    .order("is_favorite", { ascending: false })
    .order("name", { ascending: true })

  if (!includeInactive) query = query.eq("is_active", true)
  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(request: Request) {
  const result = await getClinicScopedClient()
  if ("error" in result && result.error) return result.error
  const { supabase, ownerId } = result as any

  const parsed = parseInput(procedureCatalogInputSchema, stripImmutableTenantFields(await request.json()))
  if (!parsed.data) return NextResponse.json({ error: parsed.error }, { status: 400 })

  if (parsed.data.is_favorite) {
    try {
      if (await quickOptionLimitReached(supabase, ownerId)) {
        return NextResponse.json({ error: "A clínica pode ter no máximo cinco opções rápidas." }, { status: 409 })
      }
    } catch (error: any) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }

  const { data, error } = await supabase
    .from("procedure_catalog")
    .insert({ ...parsed.data, user_id: ownerId })
    .select()
    .single()

  if (error?.code === "23505") {
    return NextResponse.json({ error: "Já existe um procedimento com esse nome." }, { status: 409 })
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}
