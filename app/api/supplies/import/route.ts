import { NextResponse } from "next/server"
import { getClinicScopedClient } from "@/lib/supabase/clinic-scope"
import { consumeRateLimit } from "@/lib/security/rate-limit"
import { recordAuditEvent } from "@/lib/security/audit"
import { normalizeHeader } from "@/lib/imports/spreadsheet"
import { readSupplySpreadsheet } from "@/lib/supplies/import"

export const runtime = "nodejs"

export async function GET() {
  const header = "Material;Unidade;Quantidade utilizável;Mínimo;Essencial;Fornecedor principal;Prazo principal;Fornecedor alternativo;Prazo alternativo\r\n"
  return new Response(`\uFEFF${header}`, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": "attachment; filename=modelo-insumos.csv", "Cache-Control": "private, no-store" } })
}

export async function POST(request: Request) {
  const context = await getClinicScopedClient()
  if ("error" in context && context.error) return context.error
  const { supabase, ownerId, accessRole, user } = context as Exclude<typeof context, { error: NextResponse }>
  if (accessRole !== "gestor") return NextResponse.json({ error: "Somente o gestor pode importar materiais." }, { status: 403 })
  if (Number(request.headers.get("content-length")) > 2_500_000) return NextResponse.json({ error: "Arquivo muito grande." }, { status: 413 })
  const form = await request.formData().catch(() => null)
  const file = form?.get("file")
  const mode = form?.get("mode")
  if (!(file instanceof File) || !file.size || (mode !== "preview" && mode !== "commit")) return NextResponse.json({ error: "Selecione um arquivo CSV ou Excel válido." }, { status: 400 })
  if (mode === "commit" && !(await consumeRateLimit(supabase, `supply-import:${ownerId}:${user.id}`, 5, 60))) return NextResponse.json({ error: "Aguarde um minuto antes de importar novamente." }, { status: 429 })

  try {
    const { rows, errors, unmapped } = await readSupplySpreadsheet(file)
    const existing = new Set<string>()
    for (let start = 0; start < 10000; start += 1000) {
      const result = await supabase.from("supply_items").select("name").eq("user_id", ownerId).range(start, start + 999)
      if (result.error) throw new Error(result.error.code === "42P01" ? "O módulo de insumos ainda não foi ativado no banco." : "Não foi possível conferir os materiais existentes.")
      for (const item of result.data || []) existing.add(normalizeHeader(item.name))
      if ((result.data || []).length < 1000) break
      if (start === 9000) throw new Error("A clínica tem muitos materiais para esta versão do importador.")
    }
    const newRows = rows.filter(row => !existing.has(normalizeHeader(row.name)))
    const skippedCount = rows.length - newRows.length
    const preview = {
      newCount: newRows.length, skippedCount, errors, unmapped,
      rows: rows.slice(0, 15).map(row => ({ line: row.line, name: row.name, unit: row.unit, usable_quantity: row.usable_quantity, status: existing.has(normalizeHeader(row.name)) ? "existing" : "new" })),
    }
    if (mode === "preview") return NextResponse.json({ data: preview })
    if (errors.length) return NextResponse.json({ error: "Corrija as linhas indicadas antes de importar.", data: preview }, { status: 400 })
    if (!newRows.length) return NextResponse.json({ data: { ...preview, importedCount: 0 } })

    const now = new Date().toISOString()
    const { data: inserted, error: insertError } = await supabase.from("supply_items").insert(newRows.map(({ line: _line, ...row }) => ({ ...row, user_id: ownerId, last_counted_at: now }))).select("id")
    if (insertError) return NextResponse.json({ error: insertError.code === "23505" ? "Um material foi cadastrado enquanto a planilha era importada. Atualize a prévia e tente novamente." : "Não foi possível importar os materiais." }, { status: insertError.code === "23505" ? 409 : 500 })
    await recordAuditEvent({ supabase, clinicId: ownerId, actorUserId: user.id, action: "supplies.imported", entityType: "supply_items", metadata: { imported: inserted?.length || 0, skipped: skippedCount } })
    return NextResponse.json({ data: { ...preview, importedCount: inserted?.length || 0 } })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível ler a planilha." }, { status: 400 })
  }
}
