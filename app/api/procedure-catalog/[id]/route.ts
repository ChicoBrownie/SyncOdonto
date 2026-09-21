import { NextResponse } from "next/server"

import { getClinicScopedClient } from "@/lib/supabase/clinic-scope"
import { parseInput, procedureCatalogInputSchema } from "@/lib/validation/api-schemas"
import { stripImmutableTenantFields } from "@/lib/security/request-data"

const QUICK_OPTION_LIMIT = 5

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const result = await getClinicScopedClient()
  if ("error" in result && result.error) return result.error
  const { supabase, ownerId } = result as any
  const { id } = await params

  const parsed = parseInput(procedureCatalogInputSchema.partial(), stripImmutableTenantFields(await request.json()))
  if (!parsed.data) return NextResponse.json({ error: parsed.error }, { status: 400 })

  if (parsed.data.is_favorite === true) {
    const { data: current, error: currentError } = await supabase
      .from("procedure_catalog")
      .select("is_favorite")
      .eq("id", id)
      .eq("user_id", ownerId)
      .maybeSingle()
    if (currentError) return NextResponse.json({ error: currentError.message }, { status: 500 })
    if (!current) return NextResponse.json({ error: "Procedimento não encontrado." }, { status: 404 })
    if (!current.is_favorite) {
      const { count, error: countError } = await supabase
        .from("procedure_catalog")
        .select("id", { count: "exact", head: true })
        .eq("user_id", ownerId)
        .eq("is_active", true)
        .eq("is_favorite", true)
      if (countError) return NextResponse.json({ error: countError.message }, { status: 500 })
      if ((count || 0) >= QUICK_OPTION_LIMIT) {
        return NextResponse.json({ error: "A clínica pode ter no máximo cinco opções rápidas." }, { status: 409 })
      }
    }
  }

  const { data, error } = await supabase
    .from("procedure_catalog")
    .update(parsed.data)
    .eq("id", id)
    .eq("user_id", ownerId)
    .select()
    .single()

  if (error?.code === "23505") {
    return NextResponse.json({ error: "Já existe um procedimento com esse nome." }, { status: 409 })
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const result = await getClinicScopedClient()
  if ("error" in result && result.error) return result.error
  const { supabase, ownerId } = result as any
  const { id } = await params

  // Procedimentos já usados não são apagados: apenas deixam de aparecer nas novas buscas.
  const { data, error } = await supabase
    .from("procedure_catalog")
    .update({ is_active: false })
    .eq("id", id)
    .eq("user_id", ownerId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
