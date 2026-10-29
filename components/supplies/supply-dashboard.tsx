"use client"

import { useEffect, useState } from "react"
import useSWR from "swr"
import { AlertTriangle, CalendarClock, Check, Loader2, Package, Plus, RefreshCw, Search, Truck, Upload } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { SupplyImportDialog } from "./supply-import-dialog"
import { addCalendarDays, type SupplyItem, type SupplyOrder, type SupplyRisk, type SupplyUsageRule } from "@/lib/supplies/planning"

type DashboardData = {
  items: SupplyItem[]
  rules: SupplyUsageRule[]
  orders: SupplyOrder[]
  risks: SupplyRisk[]
  procedure_types: string[]
  today: string
}

type ItemForm = {
  name: string
  unit: string
  usable_quantity: string
  minimum_quantity: string
  is_critical: boolean
  primary_supplier: string
  primary_lead_days: string
  backup_supplier: string
  backup_lead_days: string
}

const emptyItemForm: ItemForm = {
  name: "", unit: "unidade", usable_quantity: "0", minimum_quantity: "0", is_critical: true,
  primary_supplier: "", primary_lead_days: "", backup_supplier: "", backup_lead_days: "",
}

async function fetcher(url: string) {
  const response = await fetch(url)
  const body = await response.json()
  if (!response.ok) throw new Error(body.error || "Não foi possível carregar o planejamento de insumos.")
  return body
}

function formatDate(date: string | null) {
  if (!date) return "—"
  return new Intl.DateTimeFormat("pt-BR").format(new Date(`${date.slice(0, 10)}T12:00:00`))
}

function nullableText(value: string) {
  return value.trim() || null
}

function nullableDays(value: string) {
  return value.trim() === "" ? null : Number(value)
}

function riskLabel(risk?: SupplyRisk) {
  if (!risk || risk.status === "unconfigured") return { text: "Configure o consumo", className: "border-slate-300 text-slate-700" }
  if (risk.status === "shortage") return { text: "Risco para a agenda", className: "border-red-300 bg-red-50 text-red-800" }
  if (risk.status === "low_stock") return { text: "Abaixo do mínimo", className: "border-amber-300 bg-amber-50 text-amber-800" }
  return { text: "Cobertura estimada", className: "border-emerald-300 bg-emerald-50 text-emerald-800" }
}

export function SupplyDashboard() {
  const { data: response, error, isLoading, mutate } = useSWR<{ data: DashboardData }>("/api/supplies", fetcher)
  const { data: accessResponse } = useSWR<{ access_role: string }>("/api/auth/check-access", fetcher)
  const canManage = accessResponse?.access_role === "gestor"
  const data = response?.data
  const [form, setForm] = useState<ItemForm>(emptyItemForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!canManage || new URLSearchParams(window.location.search).get("importar") !== "1") return
    const frame = requestAnimationFrame(() => setImportOpen(true))
    return () => cancelAnimationFrame(frame)
  }, [canManage])

  const submit = async (payload: Record<string, unknown>, success: string) => {
    setBusy(true)
    try {
      const result = await fetch("/api/supplies", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
      const body = await result.json()
      if (!result.ok) {
        if (result.status === 409) await mutate()
        throw new Error(body.error || "Não foi possível salvar.")
      }
      await mutate()
      toast.success(success)
      return true
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Não foi possível salvar.")
      return false
    } finally {
      setBusy(false)
    }
  }

  const submitItem = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const primaryDays = nullableDays(form.primary_lead_days)
    const backupDays = nullableDays(form.backup_lead_days)
    if (!form.name.trim() || !form.unit.trim() || !Number.isFinite(Number(form.usable_quantity)) || !Number.isFinite(Number(form.minimum_quantity)) || Number(form.usable_quantity) < 0 || Number(form.minimum_quantity) < 0 || (primaryDays !== null && (!Number.isInteger(primaryDays) || primaryDays < 0)) || (backupDays !== null && (!Number.isInteger(backupDays) || backupDays < 0))) {
      toast.error("Confira as quantidades e os prazos informados.")
      return
    }
    const payload = {
      action: editingId ? "update_item" : "create_item", ...(editingId ? { id: editingId } : { usable_quantity: Number(form.usable_quantity) }),
      name: form.name.trim(), unit: form.unit.trim(), is_critical: form.is_critical,
      minimum_quantity: Number(form.minimum_quantity),
      primary_supplier: nullableText(form.primary_supplier), primary_lead_days: primaryDays,
      backup_supplier: nullableText(form.backup_supplier), backup_lead_days: backupDays,
    }
    if (await submit(payload, editingId ? "Material atualizado." : "Material cadastrado.")) {
      setForm(emptyItemForm)
      setEditingId(null)
      setFormOpen(false)
    }
  }

  const startEditing = (item: SupplyItem) => {
    setEditingId(item.id)
    setForm({
      name: item.name, unit: item.unit, usable_quantity: String(item.usable_quantity), minimum_quantity: String(item.minimum_quantity),
      is_critical: item.is_critical, primary_supplier: item.primary_supplier || "", primary_lead_days: item.primary_lead_days === null ? "" : String(item.primary_lead_days),
      backup_supplier: item.backup_supplier || "", backup_lead_days: item.backup_lead_days === null ? "" : String(item.backup_lead_days),
    })
    setFormOpen(true)
  }

  const riskCount = data?.risks.filter((risk) => risk.status === "shortage").length || 0
  const visibleItems = data?.items.filter(item => item.name.toLocaleLowerCase("pt-BR").includes(search.toLocaleLowerCase("pt-BR"))) || []

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-4 pb-12 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><div className="flex items-center gap-2"><Package className="h-6 w-6 text-primary" /><h1 className="text-2xl font-bold">Insumos</h1></div>
          <p className="mt-1 text-sm text-muted-foreground">Acompanhe o saldo e antecipe faltas para os próximos 14 dias.</p></div>
        <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" size="sm" onClick={() => void mutate()} aria-label="Atualizar insumos"><RefreshCw className="h-4 w-4" /></Button>{canManage && <><Button type="button" variant="outline" size="sm" onClick={() => setImportOpen(true)}><Upload className="mr-2 h-4 w-4" />Importar planilha</Button><Button type="button" size="sm" onClick={() => { setEditingId(null); setForm(emptyItemForm); setFormOpen(true) }}><Plus className="mr-2 h-4 w-4" />Novo material</Button></>}</div>
      </div>

      {error ? <Card className="border-destructive/30 p-5 text-sm text-destructive">{error.message}</Card> : isLoading ? (
        <div className="flex items-center gap-2 py-12 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" />Carregando insumos...</div>
      ) : data ? <>
        <div className="grid gap-3 sm:grid-cols-3">
          <Card className="p-4"><p className="text-sm text-muted-foreground">Materiais acompanhados</p><p className="mt-1 text-2xl font-bold">{data.items.length}</p></Card>
          <Card className="p-4"><p className="text-sm text-muted-foreground">Riscos para a agenda</p><p className="mt-1 text-2xl font-bold text-red-700">{riskCount}</p></Card>
          <Card className="p-4"><p className="text-sm text-muted-foreground">Pedidos pendentes</p><p className="mt-1 text-2xl font-bold">{data.orders.filter((order) => order.status === "ordered").length}</p></Card>
        </div>

        <Dialog open={formOpen} onOpenChange={setFormOpen}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl"><DialogHeader><DialogTitle>{editingId ? "Editar material" : "Novo material"}</DialogTitle><DialogDescription>Cadastre o essencial agora. Fornecedores e prazos podem ser preenchidos depois.</DialogDescription></DialogHeader>
          <form id="supply-item-form" onSubmit={submitItem} className="space-y-4">
            <div className="space-y-1.5"><Label htmlFor="supply-name">Material</Label><Input id="supply-name" required value={form.name} maxLength={160} onChange={event => setForm({ ...form, name: event.target.value })} placeholder="Ex.: luvas descartáveis" /></div>
            <div className="grid gap-3 sm:grid-cols-2"><div className="space-y-1.5"><Label htmlFor="supply-unit">Unidade</Label><Input id="supply-unit" required value={form.unit} maxLength={40} onChange={event => setForm({ ...form, unit: event.target.value })} placeholder="caixa, unidade, tubete" /></div><div className="space-y-1.5"><Label htmlFor="supply-min">Estoque mínimo</Label><Input id="supply-min" type="number" step="0.001" min="0" required value={form.minimum_quantity} onChange={event => setForm({ ...form, minimum_quantity: event.target.value })} /></div></div>
            {!editingId && <div className="space-y-1.5"><Label htmlFor="supply-qty">Saldo utilizável conferido</Label><Input id="supply-qty" type="number" step="0.001" min="0" required value={form.usable_quantity} onChange={event => setForm({ ...form, usable_quantity: event.target.value })} /></div>}
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_critical} onChange={event => setForm({ ...form, is_critical: event.target.checked })} />A falta deste material pode afetar atendimentos</label>
            <details className="rounded-lg border p-3"><summary className="cursor-pointer text-sm font-medium">Fornecedores e prazos (opcional)</summary><div className="mt-3 grid gap-3 sm:grid-cols-2"><div className="space-y-1.5"><Label htmlFor="supply-primary">Fornecedor principal</Label><Input id="supply-primary" value={form.primary_supplier} maxLength={160} onChange={event => setForm({ ...form, primary_supplier: event.target.value })} /></div><div className="space-y-1.5"><Label htmlFor="supply-lead">Prazo em dias</Label><Input id="supply-lead" type="number" min="0" max="365" value={form.primary_lead_days} onChange={event => setForm({ ...form, primary_lead_days: event.target.value })} /></div><div className="space-y-1.5"><Label htmlFor="supply-backup">Fornecedor alternativo</Label><Input id="supply-backup" value={form.backup_supplier} maxLength={160} onChange={event => setForm({ ...form, backup_supplier: event.target.value })} /></div><div className="space-y-1.5"><Label htmlFor="supply-backup-lead">Prazo alternativo em dias</Label><Input id="supply-backup-lead" type="number" min="0" max="365" value={form.backup_lead_days} onChange={event => setForm({ ...form, backup_lead_days: event.target.value })} /></div></div></details>
          </form><DialogFooter><Button type="button" variant="outline" onClick={() => setFormOpen(false)}>Cancelar</Button><Button type="submit" form="supply-item-form" disabled={busy}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{editingId ? "Salvar alterações" : "Adicionar material"}</Button></DialogFooter>
        </DialogContent></Dialog>
        <SupplyImportDialog open={importOpen} onOpenChange={setImportOpen} onImported={() => void mutate()} />

        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">Materiais</h2><div className="relative w-full sm:w-64"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input aria-label="Buscar material" placeholder="Buscar material..." value={search} onChange={event => setSearch(event.target.value)} className="pl-9" /></div></div>
          {data.items.length === 0 ? <Card className="p-8 text-center text-sm text-muted-foreground">{canManage ? "Nenhum material cadastrado. Use Novo material ou importe uma planilha para começar." : "Ainda não há materiais cadastrados pela clínica."}</Card> : visibleItems.length === 0 ? <Card className="p-6 text-center text-sm text-muted-foreground">Nenhum material encontrado para esta busca.</Card> : visibleItems.map((item) => (
            <SupplyItemCard key={`${item.id}:${item.last_counted_at}`} item={item} risk={data.risks.find((risk) => risk.item_id === item.id)} rules={data.rules.filter((rule) => rule.item_id === item.id)} orders={data.orders.filter((order) => order.item_id === item.id)} today={data.today} procedureTypes={data.procedure_types} canManage={canManage} busy={busy} submit={submit} startEditing={startEditing} />
          ))}
        </div>

        <details className="rounded-lg border bg-muted/20 p-4 text-xs text-muted-foreground"><summary className="cursor-pointer font-medium text-foreground">Como funciona a estimativa</summary><p className="mt-2">A agenda usa as regras de consumo cadastradas para estimar os próximos 14 dias. Agendar não baixa o estoque. Ao receber um pedido, confira o material e atualize o saldo utilizável.</p></details>
      </> : null}
    </div>
  )
}

function SupplyItemCard({ item, risk, rules, orders, today, procedureTypes, canManage, busy, submit, startEditing }: {
  item: SupplyItem; risk?: SupplyRisk; rules: SupplyUsageRule[]; orders: SupplyOrder[]; today: string; procedureTypes: string[]; canManage: boolean; busy: boolean;
  submit: (payload: Record<string, unknown>, success: string) => Promise<boolean>;
  startEditing: (item: SupplyItem) => void;
}) {
  const [stock, setStock] = useState(String(item.usable_quantity))
  const [procedure, setProcedure] = useState("")
  const [usage, setUsage] = useState("1")
  const [supplierName, setSupplierName] = useState(item.primary_supplier || "")
  const [orderQuantity, setOrderQuantity] = useState("")
  const [promisedOn, setPromisedOn] = useState("")
  const badge = riskLabel(risk)

  const saveStock = async () => {
    const value = Number(stock)
    if (!Number.isFinite(value) || value < 0) return toast.error("Informe uma quantidade válida.")
    await submit({ action: "set_stock", id: item.id, usable_quantity: value, expected_last_counted_at: item.last_counted_at }, "Quantidade conferida atualizada.")
  }
  const saveRule = async () => {
    const value = Number(usage)
    if (!procedure.trim() || !Number.isFinite(value) || value <= 0) return toast.error("Informe um procedimento e um consumo válido.")
    if (await submit({ action: "add_rule", item_id: item.id, procedure_type: procedure.trim(), quantity_per_appointment: value }, "Consumo estimado cadastrado.")) { setProcedure(""); setUsage("1") }
  }
  const saveOrder = async () => {
    const value = Number(orderQuantity)
    if (!supplierName.trim() || !promisedOn || !Number.isFinite(value) || value <= 0) return toast.error("Informe fornecedor, quantidade e previsão de entrega.")
    if (await submit({ action: "add_order", item_id: item.id, supplier_name: supplierName.trim(), quantity: value, ordered_on: today, promised_on: promisedOn }, "Pedido registrado.")) { setOrderQuantity(""); setPromisedOn("") }
  }
  const copyQuoteRequest = async () => {
    const suggestedQuantity = risk?.suggested_replenishment_quantity || 0
    const deliveryBy = risk?.first_shortage_date ? formatDate(addCalendarDays(risk.first_shortage_date, -1)) : null
    const message = `Olá! Gostaria de confirmar a disponibilidade de ${suggestedQuantity || "[quantidade]"} ${item.unit} de ${item.name}${deliveryBy ? `, com entrega até ${deliveryBy}` : ""}. Pode informar preço, frete e prazo confirmado?`
    try {
      await navigator.clipboard.writeText(message)
      toast.success("Solicitação copiada. Revise antes de enviar ao fornecedor.")
    } catch {
      toast.error("Não foi possível copiar a solicitação neste navegador.")
    }
  }

  return <Card className="space-y-3 p-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{item.name}</h3>{item.is_critical && <Badge variant="outline">Essencial</Badge>}<Badge variant="outline" className={badge.className}>{badge.text}</Badge></div><p className="mt-1 text-sm text-muted-foreground">Saldo: <strong className="text-foreground">{item.usable_quantity} {item.unit}</strong> · Mínimo: {item.minimum_quantity}{item.last_counted_at ? ` · Conferido em ${formatDate(item.last_counted_at)}` : ""}</p></div>
      {canManage && <div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => startEditing(item)}>Editar</Button><Button size="sm" variant="ghost" disabled={busy} onClick={() => { if (window.confirm(`Arquivar ${item.name}?`)) void submit({ action: "archive_item", id: item.id }, "Material arquivado.") }}>Arquivar</Button></div>}
    </div>

    {risk?.status === "shortage" ? <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900"><div className="flex items-center gap-2 font-semibold"><AlertTriangle className="h-4 w-4" />Possível falta em {formatDate(risk.first_shortage_date)}</div><p className="mt-1">Reposição sugerida: {risk.suggested_replenishment_quantity} {item.unit}. {risk.last_safe_order_date ? `Peça até ${formatDate(risk.last_safe_order_date)}.` : "Informe o prazo do fornecedor para estimar quando pedir."}</p><Button type="button" size="sm" variant="outline" className="mt-2" onClick={() => void copyQuoteRequest()}>Copiar solicitação de cotação</Button></div> : risk?.status === "unconfigured" ? <p className="text-sm text-muted-foreground">Vincule procedimentos para estimar o consumo na agenda.</p> : <p className="text-sm text-muted-foreground">Demanda prevista: {risk?.scheduled_demand || 0} {item.unit} · Pedidos pendentes: {risk?.pending_quantity || 0} {item.unit}</p>}

    <details className="border-t pt-3"><summary className="cursor-pointer text-sm font-medium text-primary">Gerenciar saldo, consumo e pedidos</summary><div className="mt-4 grid gap-4 lg:grid-cols-3">
      <section className="space-y-3 rounded-lg border p-3"><div className="flex items-center gap-2 font-medium"><RefreshCw className="h-4 w-4" />Saldo conferido</div><p className="text-xs text-muted-foreground">Informe apenas unidades presentes, válidas e disponíveis. O recebimento de pedido não altera o saldo automaticamente.</p>{canManage && <div className="flex gap-2"><Input aria-label={`Quantidade utilizável de ${item.name}`} type="number" min="0" step="0.001" value={stock} onChange={(event) => setStock(event.target.value)} /><Button variant="outline" disabled={busy} onClick={saveStock}>Salvar</Button></div>}</section>
      <section className="space-y-3 rounded-lg border p-3"><div className="flex items-center gap-2 font-medium"><CalendarClock className="h-4 w-4" />Consumo por procedimento</div>{rules.length === 0 ? <p className="text-xs text-muted-foreground">Nenhuma regra cadastrada.</p> : <ul className="space-y-1 text-xs">{rules.map((rule) => <li key={rule.id} className="flex justify-between gap-2"><span>{rule.procedure_type}: {rule.quantity_per_appointment} {item.unit}</span>{canManage && <button type="button" className="text-destructive underline" disabled={busy} onClick={() => void submit({ action: "remove_rule", id: rule.id }, "Regra removida.")}>Remover</button>}</li>)}</ul>}{canManage && <><Input list={`procedures-${item.id}`} aria-label={`Procedimento que usa ${item.name}`} placeholder="Tipo de procedimento" value={procedure} onChange={(event) => setProcedure(event.target.value)} /><datalist id={`procedures-${item.id}`}>{procedureTypes.map((name) => <option key={name} value={name} />)}</datalist><div className="flex gap-2"><Input aria-label={`Quantidade de ${item.name} por procedimento`} type="number" min="0.001" step="0.001" value={usage} onChange={(event) => setUsage(event.target.value)} /><Button variant="outline" disabled={busy} onClick={saveRule}>Vincular</Button></div></>}</section>
      <section className="space-y-3 rounded-lg border p-3"><div className="flex items-center gap-2 font-medium"><Truck className="h-4 w-4" />Fornecimento</div><p className="text-xs text-muted-foreground">Principal: {item.primary_supplier || "não informado"} · {item.primary_lead_days === null ? "prazo desconhecido" : `${item.primary_lead_days} dia(s)`}<br />Alternativo: {item.backup_supplier || "não informado"}{item.backup_lead_days !== null ? ` · ${item.backup_lead_days} dia(s)` : ""}</p>{canManage && <><Input aria-label={`Fornecedor do pedido de ${item.name}`} placeholder="Fornecedor consultado" value={supplierName} onChange={(event) => setSupplierName(event.target.value)} /><div className="flex gap-2"><Input aria-label={`Quantidade pedida de ${item.name}`} type="number" min="0.001" step="0.001" placeholder="Qtd." value={orderQuantity} onChange={(event) => setOrderQuantity(event.target.value)} /><Input aria-label={`Entrega prometida de ${item.name}`} type="date" min={today} value={promisedOn} onChange={(event) => setPromisedOn(event.target.value)} /></div><Button variant="outline" disabled={busy} onClick={saveOrder}>Registrar pedido</Button></>}</section>
    </div>

    {orders.length > 0 && <div className="mt-4 space-y-2"><h4 className="text-sm font-medium">Pedidos registrados</h4><div className="space-y-2">{orders.map((order) => <div key={order.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs"><span>{order.quantity} {item.unit} · {order.supplier_name} · prometido para {formatDate(order.promised_on)}{order.received_on ? ` · recebido em ${formatDate(order.received_on)}` : ""}</span><div className="flex items-center gap-2"><Badge variant="outline">{order.status === "ordered" ? "Pendente" : order.status === "received" ? "Recebido" : "Cancelado"}</Badge>{canManage && order.status === "ordered" && <><Button size="sm" variant="outline" disabled={busy} onClick={() => void submit({ action: "close_order", id: order.id, status: "received" }, "Recebimento registrado. Confira e atualize o saldo utilizável.")}><Check className="mr-1 h-3 w-3" />Recebido</Button><Button size="sm" variant="ghost" disabled={busy} onClick={() => void submit({ action: "close_order", id: order.id, status: "cancelled" }, "Pedido cancelado.")}>Cancelar</Button></>}</div></div>)}</div></div>}
    </details>
  </Card>
}
