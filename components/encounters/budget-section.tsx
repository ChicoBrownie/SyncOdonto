"use client"

import { useEffect, useState } from "react"
import { ChevronDown, Percent, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { budgetTotal, formatBudgetRegion, type BudgetItem } from "@/lib/encounters/model"

const money = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
const moneyInput = (value: number) => value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const skipRemovalPromptKey = "syncodonto-budget-skip-removal-prompt"

function normalizeMoneyDraft(input: string) {
  const raw = input.replace(/[^\d,.]/g, "")
  const separator = raw.includes(",") ? "," : raw.includes(".") ? "." : null
  const position = separator ? raw.indexOf(separator) : -1
  const whole = (position >= 0 ? raw.slice(0, position) : raw).replace(/\D/g, "").replace(/^0+(?=\d)/, "")
  const cents = position >= 0 ? raw.slice(position + 1).replace(/\D/g, "").slice(0, 2) : ""
  return separator ? `${whole || "0"},${cents}` : whole
}

function moneyDraftValue(value: string) {
  const [whole, cents = ""] = value.split(",")
  return Number(whole || 0) + Number(cents.padEnd(2, "0")) / 100
}

type BudgetGroup = { key: string; name: string; indices: number[] }
type Removal = { name: string; indices: number[]; selected: number[] }

function groupItems(items: BudgetItem[]): BudgetGroup[] {
  const groups = new Map<string, BudgetGroup>()
  items.forEach((item, index) => {
    const name = item.procedure.trim() || "Procedimento sem nome"
    const key = name.toLocaleLowerCase("pt-BR")
    const group = groups.get(key)
    if (group) group.indices.push(index)
    else groups.set(key, { key, name, indices: [index] })
  })
  return [...groups.values()]
}

function toothSummary(items: BudgetItem[], indices: number[]) {
  const teeth = [...new Set(indices.flatMap(index => [...items[index].region.matchAll(/\bDente\s+(\d+)\b/gi)].map(match => match[1])))]
  return teeth.length ? `${teeth.length === 1 ? "Dente" : "Dentes"} ${teeth.join(", ")}` : indices.map(index => items[index].region || "Geral").join(" · ")
}

type Props = {
  items: BudgetItem[]
  paymentMethod: string
  signed: boolean
  importing: boolean
  onImport: () => void
  onDiscount: (indices: number[], value: number) => void
  onRemove: (indices: number[]) => void
  onPaymentChange: (value: string) => void
}

export function BudgetSection({ items, paymentMethod, signed, importing, onImport, onDiscount, onRemove, onPaymentChange }: Props) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [discountOpen, setDiscountOpen] = useState<string | null>(null)
  const [discountDraft, setDiscountDraft] = useState<{ key: string; value: string } | null>(null)
  const [removal, setRemoval] = useState<Removal | null>(null)
  const [skipRemovalPrompt, setSkipRemovalPrompt] = useState(false)
  const [rememberChoice, setRememberChoice] = useState(false)
  useEffect(() => {
    try { setSkipRemovalPrompt(window.localStorage.getItem(skipRemovalPromptKey) === "true") } catch { /* Storage may be unavailable. */ }
  }, [])

  const groups = groupItems(items)
  const requestRemoval = (group: BudgetGroup) => {
    if (group.indices.length === 1 && skipRemovalPrompt) {
      onRemove(group.indices)
      return
    }
    setRememberChoice(false)
    setRemoval({ name: group.name, indices: group.indices, selected: group.indices.length === 1 ? group.indices : [] })
  }
  const confirmRemoval = () => {
    if (!removal?.selected.length) return
    if (rememberChoice) {
      setSkipRemovalPrompt(true)
      try { window.localStorage.setItem(skipRemovalPromptKey, "true") } catch { /* Keep this preference for the current page. */ }
    }
    onRemove(removal.selected)
    setRemoval(null)
  }

  return <div data-guide="budget-fields" className="space-y-3">
    {signed ? <p>Esta proposta já foi assinada. Seus valores e itens estão preservados.</p> : <>
      {groups.length === 0 && <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Nenhum procedimento no orçamento. Traga os procedimentos do odontograma.</p>}
      {groups.map(group => {
        const groupItems = group.indices.map(index => items[index])
        const groupTotal = budgetTotal(groupItems)
        const groupDiscount = Math.round(groupItems.reduce((sum, item) => sum + item.discount, 0) * 100) / 100
        const isExpanded = Boolean(expanded[group.key])
        return <section key={group.key} className="min-w-0 rounded-lg border bg-background">
          <div className="flex min-w-0 items-center gap-1 p-2">
            <button type="button" aria-expanded={isExpanded} className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-md px-2 text-left hover:bg-accent" onClick={() => setExpanded(value => ({ ...value, [group.key]: !isExpanded }))}>
              <ChevronDown aria-hidden="true" className={`size-4 shrink-0 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
              <span className="min-w-0"><span className="block truncate font-semibold">{group.name}</span><span className="block truncate text-xs text-muted-foreground">{toothSummary(items, group.indices)} · {group.indices.length} {group.indices.length === 1 ? "item" : "itens"} · {money(groupTotal)}</span></span>
            </button>
            <Button type="button" size="icon" className="size-11 shrink-0" aria-label={`Desconto em ${group.name}`} title="Desconto" aria-expanded={discountOpen === group.key} onClick={() => { setDiscountDraft({ key: group.key, value: moneyInput(groupDiscount) }); setDiscountOpen(value => value === group.key ? null : group.key) }}><Percent aria-hidden="true" className="size-6" /></Button>
            <Button type="button" size="icon" className="size-11 shrink-0" aria-label={`Remover itens de ${group.name}`} title="Remover" onClick={() => requestRemoval(group)}><Trash2 aria-hidden="true" className="size-6" /></Button>
          </div>
          {discountOpen === group.key && <div className="flex flex-col gap-2 border-t px-3 py-4"><Label htmlFor={`group-discount-${group.indices[0]}`}>Desconto deste procedimento (R$)</Label><Input id={`group-discount-${group.indices[0]}`} type="text" inputMode="decimal" autoComplete="off" className="text-base tabular-nums" value={discountDraft?.key === group.key ? discountDraft.value : moneyInput(groupDiscount)} onFocus={event => event.currentTarget.select()} onChange={event => { const value = normalizeMoneyDraft(event.target.value); setDiscountDraft({ key: group.key, value }); onDiscount(group.indices, moneyDraftValue(value)) }} onBlur={() => setDiscountDraft({ key: group.key, value: moneyInput(groupDiscount) })} /></div>}
          {isExpanded && <div className="space-y-2 border-t p-3">{group.indices.map(index => <div key={items[index].source_id || `manual-${index}`} className="rounded-md border p-3 text-sm font-medium">
            {formatBudgetRegion(items[index].region) || "Geral"} · {money(Math.max(0, items[index].unitValue - items[index].discount))}
          </div>)}</div>}
        </section>
      })}
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2 pt-2">
        <div className="flex min-w-0 flex-col gap-2"><Label htmlFor="payment">Pagamento previsto</Label><select id="payment" className="min-h-11 w-full min-w-0 rounded-md border bg-background px-2" value={paymentMethod} onChange={event => onPaymentChange(event.target.value)}>{["A combinar", "Pix", "Cartão de crédito", "Cartão de débito", "Dinheiro", "Parcelado"].map(method => <option key={method}>{method}</option>)}</select></div>
        <Button type="button" className="min-h-11 max-w-36 whitespace-normal px-2 text-center text-xs sm:max-w-none sm:px-4 sm:text-sm" disabled={importing} onClick={onImport}>{importing ? "Buscando…" : "Trazer procedimentos"}</Button>
      </div>
    </>}
    <p className="text-xl font-semibold">Total da proposta: {money(budgetTotal(items))}</p>
    <Dialog open={removal !== null} onOpenChange={open => { if (!open) setRemoval(null) }}><DialogContent className="max-h-[85dvh] overflow-y-auto"><DialogHeader><DialogTitle>Remover {removal?.name}?</DialogTitle><DialogDescription>{removal && removal.indices.length > 1 ? "Selecione os dentes ou itens que deseja remover do orçamento." : "Você deseja remover este item do orçamento?"}</DialogDescription></DialogHeader>
      {removal && removal.indices.length > 1 && <div className="space-y-2"><label className="flex min-h-11 items-center gap-2"><input type="checkbox" className="size-5" checked={removal.selected.length === removal.indices.length} onChange={event => setRemoval(value => value ? { ...value, selected: event.target.checked ? value.indices : [] } : null)} />Selecionar todos</label>{removal.indices.map(index => <label key={items[index].source_id || `remove-${index}`} className="flex min-h-11 items-center gap-2 rounded-md border px-3"><input type="checkbox" className="size-5" checked={removal.selected.includes(index)} onChange={event => setRemoval(value => value ? { ...value, selected: event.target.checked ? [...value.selected, index] : value.selected.filter(selected => selected !== index) } : null)} /><span className="min-w-0 truncate">{formatBudgetRegion(items[index].region) || "Geral"} · {money(items[index].unitValue - items[index].discount)}</span></label>)}</div>}
      <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" className="size-5" checked={rememberChoice} onChange={event => setRememberChoice(event.target.checked)} />Não perguntar novamente ao remover um item único</label>
      <div className="flex gap-2"><Button type="button" variant="outline" className="min-h-11 flex-1" onClick={() => setRemoval(null)}>Cancelar</Button><Button type="button" className="min-h-11 flex-1" disabled={!removal?.selected.length} onClick={confirmRemoval}>Remover {removal?.selected.length && removal.selected.length > 1 ? `${removal.selected.length} itens` : "item"}</Button></div>
    </DialogContent></Dialog>
  </div>
}
