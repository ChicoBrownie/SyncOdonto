import { NextResponse } from "next/server"
import { z } from "zod"

import { getClinicScopedClient } from "@/lib/supabase/clinic-scope"
import { addCalendarDays, calculateSupplyRisks } from "@/lib/supplies/planning"

const uuid = z.string().uuid()
const quantity = z.number().finite().min(0).max(1_000_000)
const positiveQuantity = quantity.refine((value) => value > 0, "A quantidade deve ser maior que zero.")
const supplier = z.string().trim().min(2).max(160)
const itemFields = z.object({
  name: z.string().trim().min(2).max(160),
  unit: z.string().trim().min(1).max(40),
  is_critical: z.boolean(),
  minimum_quantity: quantity,
  primary_supplier: supplier.nullable(),
  primary_lead_days: z.number().int().min(0).max(365).nullable(),
  backup_supplier: supplier.nullable(),
  backup_lead_days: z.number().int().min(0).max(365).nullable(),
})
const actions = z.discriminatedUnion("action", [
  itemFields.extend({ action: z.literal("create_item"), usable_quantity: quantity }).strict(),
  itemFields.extend({ action: z.literal("update_item"), id: uuid }).strict(),
  z.object({ action: z.literal("set_stock"), id: uuid, usable_quantity: quantity, expected_last_counted_at: z.string().datetime().nullable() }).strict(),
  z.object({ action: z.literal("archive_item"), id: uuid }).strict(),
  z.object({ action: z.literal("add_rule"), item_id: uuid, procedure_type: z.string().trim().min(1).max(200), quantity_per_appointment: positiveQuantity }).strict(),
  z.object({ action: z.literal("remove_rule"), id: uuid }).strict(),
  z.object({ action: z.literal("add_order"), item_id: uuid, supplier_name: supplier, quantity: positiveQuantity, ordered_on: z.string().date(), promised_on: z.string().date() }).strict(),
  z.object({ action: z.literal("close_order"), id: uuid, status: z.enum(["received", "cancelled"]) }).strict(),
])

function todayInClinic() {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Fortaleza", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date())
  const date = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${date.year}-${date.month}-${date.day}`
}

function databaseError(error: { code?: string; message: string }) {
  if (error.code === "42P01") return NextResponse.json({ error: "O módulo de insumos ainda não foi ativado no banco. Aplique a migração 018." }, { status: 503 })
  if (error.code === "23505") return NextResponse.json({ error: "Esse cadastro já existe para a clínica." }, { status: 409 })
  if (error.code === "23503") return NextResponse.json({ error: "O material informado não pertence a esta clínica." }, { status: 403 })
  return NextResponse.json({ error: error.message }, { status: 500 })
}

export async function GET() {
  const context = await getClinicScopedClient()
  if ("error" in context && context.error) return context.error
  const { supabase, ownerId } = context as Exclude<typeof context, { error: NextResponse }>
  const today = todayInClinic()
  const endDate = addCalendarDays(today, 14)

  const [itemsResult, rulesResult, openOrdersResult, recentOrdersResult, appointmentsResult, catalogResult] = await Promise.all([
    supabase.from("supply_items").select("*").eq("user_id", ownerId).eq("is_active", true).order("name"),
    supabase.from("supply_usage_rules").select("*").eq("user_id", ownerId),
    supabase.from("supply_orders").select("*").eq("user_id", ownerId).eq("status", "ordered"),
    supabase.from("supply_orders").select("*").eq("user_id", ownerId).neq("status", "ordered").order("created_at", { ascending: false }).limit(30),
    supabase.from("appointments").select("id,date,procedure_type,status").eq("user_id", ownerId).gte("date", today).lte("date", endDate).in("status", ["Pendente", "Confirmada", "Aguardando", "Atrasado", "Em Andamento", "scheduled", "confirmed", "in_progress"]),
    supabase.from("procedure_catalog").select("name").eq("user_id", ownerId).eq("is_active", true).order("name"),
  ])
  for (const result of [itemsResult, rulesResult, openOrdersResult, recentOrdersResult, appointmentsResult, catalogResult]) {
    if (result.error) return databaseError(result.error)
  }
  const items = itemsResult.data || []
  const rules = rulesResult.data || []
  const orders = [...(openOrdersResult.data || []), ...(recentOrdersResult.data || [])]
  const appointments = appointmentsResult.data || []
  return NextResponse.json({
    data: {
      items, rules, orders, today,
      procedure_types: [...new Set([...(catalogResult.data || []).map((row) => row.name), ...appointments.map((row) => row.procedure_type)])],
      risks: calculateSupplyRisks(items, rules, orders, appointments, today),
    },
  })
}

export async function POST(request: Request) {
  const context = await getClinicScopedClient()
  if ("error" in context && context.error) return context.error
  const { supabase, ownerId, accessRole } = context as Exclude<typeof context, { error: NextResponse }>
  if (accessRole !== "gestor") return NextResponse.json({ error: "Somente o gestor pode alterar o planejamento de insumos." }, { status: 403 })

  const raw = await request.json().catch(() => null)
  const parsed = actions.safeParse(raw)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues.map((issue) => issue.message).join("; ") }, { status: 400 })
  const body = parsed.data

  if (body.action === "create_item") {
    const { action: _action, usable_quantity, ...fields } = body
    const { data, error } = await supabase.from("supply_items").insert({ ...fields, usable_quantity, last_counted_at: new Date().toISOString(), user_id: ownerId }).select().single()
    if (error) return databaseError(error)
    return NextResponse.json({ data }, { status: 201 })
  }
  if (body.action === "update_item") {
    const { action: _action, id, ...fields } = body
    const { data, error } = await supabase.from("supply_items").update({ ...fields, updated_at: new Date().toISOString() }).eq("id", id).eq("user_id", ownerId).eq("is_active", true).select().maybeSingle()
    if (error) return databaseError(error)
    if (!data) return NextResponse.json({ error: "Material não encontrado." }, { status: 404 })
    return NextResponse.json({ data })
  }
  if (body.action === "set_stock") {
    let query = supabase.from("supply_items")
      .update({ usable_quantity: body.usable_quantity, last_counted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", body.id).eq("user_id", ownerId).eq("is_active", true)
    query = body.expected_last_counted_at === null
      ? query.is("last_counted_at", null)
      : query.eq("last_counted_at", body.expected_last_counted_at)
    const { data, error } = await query.select().maybeSingle()
    if (error) return databaseError(error)
    if (!data) return NextResponse.json({ error: "A quantidade foi alterada por outra pessoa. Atualize a tela antes de salvar." }, { status: 409 })
    return NextResponse.json({ data })
  }
  if (body.action === "archive_item") {
    const { count, error: openError } = await supabase.from("supply_orders").select("id", { count: "exact", head: true }).eq("user_id", ownerId).eq("item_id", body.id).eq("status", "ordered")
    if (openError) return databaseError(openError)
    if (count) return NextResponse.json({ error: "Conclua ou cancele os pedidos pendentes antes de arquivar o material." }, { status: 409 })
    const { data, error } = await supabase.from("supply_items").update({ is_active: false, updated_at: new Date().toISOString() }).eq("id", body.id).eq("user_id", ownerId).select().maybeSingle()
    if (error) return databaseError(error)
    if (!data) return NextResponse.json({ error: "Material não encontrado." }, { status: 404 })
    return NextResponse.json({ data })
  }
  if (body.action === "remove_rule") {
    const { data, error } = await supabase.from("supply_usage_rules").delete().eq("id", body.id).eq("user_id", ownerId).select("id").maybeSingle()
    if (error) return databaseError(error)
    if (!data) return NextResponse.json({ error: "Regra não encontrada." }, { status: 404 })
    return NextResponse.json({ data })
  }
  if (body.action === "close_order") {
    const { data, error } = await supabase.from("supply_orders").update({ status: body.status, received_on: body.status === "received" ? todayInClinic() : null, updated_at: new Date().toISOString() }).eq("id", body.id).eq("user_id", ownerId).eq("status", "ordered").select().maybeSingle()
    if (error) return databaseError(error)
    if (!data) return NextResponse.json({ error: "Pedido pendente não encontrado." }, { status: 404 })
    return NextResponse.json({ data })
  }

  const { data: ownedItem, error: ownedError } = await supabase.from("supply_items").select("id").eq("id", body.item_id).eq("user_id", ownerId).eq("is_active", true).maybeSingle()
  if (ownedError) return databaseError(ownedError)
  if (!ownedItem) return NextResponse.json({ error: "Material não encontrado nesta clínica." }, { status: 404 })

  if (body.action === "add_rule") {
    const { data, error } = await supabase.from("supply_usage_rules").insert({ user_id: ownerId, item_id: body.item_id, procedure_type: body.procedure_type, quantity_per_appointment: body.quantity_per_appointment }).select().single()
    if (error) return databaseError(error)
    return NextResponse.json({ data }, { status: 201 })
  }
  if (body.promised_on < body.ordered_on) return NextResponse.json({ error: "A entrega prometida não pode ser anterior ao pedido." }, { status: 400 })
  const { data, error } = await supabase.from("supply_orders").insert({ user_id: ownerId, item_id: body.item_id, supplier_name: body.supplier_name, quantity: body.quantity, ordered_on: body.ordered_on, promised_on: body.promised_on }).select().single()
  if (error) return databaseError(error)
  return NextResponse.json({ data }, { status: 201 })
}
