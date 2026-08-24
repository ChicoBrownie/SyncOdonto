"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import {
  DollarSign, Plus, Loader2, AlertCircle, TrendingUp, TrendingDown,
  Wallet, CreditCard, Banknote, Smartphone, CheckCircle,
  Clock, ShieldCheck, AlertTriangle, CalendarDays,
} from "lucide-react"
import { useFinancialTransactions, usePatients, createFinancialTransaction } from "@/lib/hooks/use-data"
import { toast } from "sonner"

const PAYMENT_METHODS = [
  { value: "Espécie", label: "Espécie", icon: Banknote },
  { value: "Cartão Débito", label: "Cartão Débito", icon: CreditCard },
  { value: "Cartão Crédito", label: "Cartão Crédito", icon: CreditCard },
  { value: "Pix", label: "Pix (maquininha)", icon: Smartphone },
]

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })
}

function getPaymentIcon(method: string) {
  const found = PAYMENT_METHODS.find(m => m.value === method)
  const Icon = found?.icon || Wallet
  return <Icon className="h-4 w-4" />
}

function toLocalDateString(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

// ── Hook de atualização de transação (com mutate compartilhado) ───────────
async function patchTransaction(id: string, body: object) {
  const res = await fetch(`/api/financial/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error || "Erro ao atualizar")
  }
  return res.json()
}

// ── Componente Fechamento de Caixa ────────────────────────────────────────
function CashClosing({ onMutate }: { onMutate: () => void }) {
  const [filterDate, setFilterDate] = useState(toLocalDateString(new Date()))
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [isProcessing, setIsProcessing] = useState(false)

  const dateStart = filterDate
  const dateEnd = filterDate

  const { transactions, isLoading, mutate } = useFinancialTransactions({
    startDate: dateStart,
    endDate: dateEnd,
  })

  // Só mostra transações pendentes de verificação (geradas pelo encerramento de consultas)
  const pendingVerification = useMemo(() =>
    (transactions || []).filter(t =>
      t.status === "pending" && (t as any).verification_status === "pending_verification"
    ), [transactions])

  const allIds = pendingVerification.map(t => t.id)
  const allSelected = allIds.length > 0 && allIds.every(id => selected.has(id))

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set())
    } else {
      setSelected(new Set(allIds))
    }
  }

  const toggleOne = (id: string) => {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelected(next)
  }

  const handleBulkAction = async (action: "confirmed" | "incorrect") => {
    if (selected.size === 0) { toast.error("Selecione ao menos uma transação."); return }
    setIsProcessing(true)
    try {
      const ids = Array.from(selected)
      const newStatus = action === "confirmed" ? "paid" : "cancelled"
      const verificationStatus = action === "confirmed" ? "confirmed" : "incorrect"

      await Promise.all(ids.map(id =>
        patchTransaction(id, { status: newStatus, verification_status: verificationStatus })
      ))

      toast.success(
        action === "confirmed"
          ? `${ids.length} pagamento(s) confirmado(s)!`
          : `${ids.length} marcado(s) como Pagamento Incorreto.`
      )
      setSelected(new Set())
      mutate()
      onMutate() // sincroniza a lista de Transações
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao processar.")
    } finally {
      setIsProcessing(false)
    }
  }

  const totalPending = pendingVerification.reduce((s, t) => s + (t.amount || 0), 0)

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
              Fechamento de Caixa
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Verifique e confirme os pagamentos recebidos
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={filterDate}
              onChange={(e) => { setFilterDate(e.target.value); setSelected(new Set()) }}
              className="h-8 text-sm w-36"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : pendingVerification.length === 0 ? (
          <div className="text-center py-8">
            <CheckCircle className="h-10 w-10 text-success mx-auto mb-2 opacity-60" />
            <p className="text-sm text-muted-foreground">
              Nenhum pagamento pendente de verificação para este dia.
            </p>
          </div>
        ) : (
          <>
            {/* Resumo — FIX: flex-wrap para não estourar em telas estreitas */}
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3 px-1">
              <span className="text-sm text-muted-foreground">
                {pendingVerification.length} pendente(s) · Total: <strong>{formatCurrency(totalPending)}</strong>
              </span>
              <div className="flex gap-2 flex-wrap">
                <Button size="sm" variant="outline"
                  className="h-7 text-xs bg-transparent text-green-600 border-green-300 hover:bg-green-50 gap-1"
                  onClick={() => handleBulkAction("confirmed")}
                  disabled={selected.size === 0 || isProcessing}>
                  {isProcessing ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3" />}
                  Confirmado ({selected.size})
                </Button>
                <Button size="sm" variant="outline"
                  className="h-7 text-xs bg-transparent text-orange-600 border-orange-300 hover:bg-orange-50 gap-1"
                  onClick={() => handleBulkAction("incorrect")}
                  disabled={selected.size === 0 || isProcessing}>
                  <AlertTriangle className="h-3 w-3" />
                  Incorreto ({selected.size})
                </Button>
              </div>
            </div>

            {/* Tabela — FIX: overflow-x-auto em vez de overflow-hidden, pra rolar em vez de cortar no mobile */}
            <div className="rounded-lg border border-border overflow-x-auto">
              <table className="w-full text-sm min-w-[560px]">
                <thead>
                  <tr className="bg-muted/50 border-b border-border">
                    <th className="py-2 px-3 text-left w-8">
                      <Checkbox
                        checked={allSelected}
                        onCheckedChange={toggleAll}
                        className="h-4 w-4"
                      />
                    </th>
                    <th className="py-2 px-3 text-left text-xs font-medium text-muted-foreground">Paciente</th>
                    <th className="py-2 px-3 text-left text-xs font-medium text-muted-foreground">Descrição</th>
                    <th className="py-2 px-3 text-left text-xs font-medium text-muted-foreground">Forma</th>
                    <th className="py-2 px-3 text-right text-xs font-medium text-muted-foreground">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingVerification.map(t => (
                    <tr key={t.id}
                      className={`border-b border-border last:border-0 cursor-pointer transition-colors ${selected.has(t.id) ? "bg-primary/5" : "hover:bg-muted/30"}`}
                      onClick={() => toggleOne(t.id)}>
                      <td className="py-3 px-3">
                        <Checkbox
                          checked={selected.has(t.id)}
                          onCheckedChange={() => toggleOne(t.id)}
                          className="h-4 w-4"
                          onClick={(e) => e.stopPropagation()}
                        />
                      </td>
                      <td className="py-3 px-3 text-foreground font-medium">
                        {(t as any).patient?.full_name || "—"}
                      </td>
                      <td className="py-3 px-3 text-muted-foreground text-xs">{t.description}</td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          {getPaymentIcon(t.payment_method || "")}
                          {t.payment_method || "—"}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right font-semibold text-foreground">
                        {formatCurrency(t.amount || 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

// ── View principal de Financeiro ──────────────────────────────────────────
export function FinancialView() {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState("all")
  const [filterMethod, setFilterMethod] = useState("all")
  const [filterPeriod, setFilterPeriod] = useState("month")
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [transactionToReceive, setTransactionToReceive] = useState<any | null>(null)
  const [receiveMethod, setReceiveMethod] = useState("")
  const [receiveDate, setReceiveDate] = useState(toLocalDateString(new Date()))
  const [receiveError, setReceiveError] = useState<string | null>(null)

  const { patients } = usePatients()

  const [form, setForm] = useState({
    patient_id: "", description: "", amount: "",
    payment_method: "Espécie", status: "paid", type: "income",
  })

  const dateFilter = useMemo(() => {
    const now = new Date()
    if (filterPeriod === "today") {
      const d = toLocalDateString(now)
      return { startDate: d, endDate: d }
    }
    if (filterPeriod === "week") {
      const day = now.getDay()
      const monday = new Date(now)
      monday.setDate(now.getDate() - ((day + 6) % 7))
      const sunday = new Date(monday)
      sunday.setDate(monday.getDate() + 6)
      return { startDate: toLocalDateString(monday), endDate: toLocalDateString(sunday) }
    }
    if (filterPeriod === "month") {
      const start = new Date(now.getFullYear(), now.getMonth(), 1)
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      return { startDate: toLocalDateString(start), endDate: toLocalDateString(end) }
    }
    return {}
  }, [filterPeriod])

  const { transactions, isLoading, mutate } = useFinancialTransactions({
    status: filterStatus !== "all" ? filterStatus : undefined,
    ...dateFilter,
  })

  const filteredTransactions = useMemo(() => {
    if (!transactions) return []
    let list = transactions
    if (filterMethod !== "all") list = list.filter(t => t.payment_method === filterMethod)
    return list
  }, [transactions, filterMethod])

  const metrics = useMemo(() => {
    const paid = filteredTransactions.filter(t => t.status === "paid" && t.type === "income")
    const pending = filteredTransactions.filter(t => t.status === "pending" && t.type === "income")
    const cancelled = filteredTransactions.filter(t => t.status === "cancelled")
    return {
      totalPaid: paid.reduce((s, t) => s + (t.amount || 0), 0),
      totalPending: pending.reduce((s, t) => s + (t.amount || 0), 0),
      countPaid: paid.length, countPending: pending.length, countCancelled: cancelled.length,
    }
  }, [filteredTransactions])

  const resetForm = () => {
    setForm({ patient_id: "", description: "", amount: "", payment_method: "Espécie", status: "paid", type: "income" })
    setFormError(null)
  }

  const handleCreate = async () => {
    setFormError(null)
    if (!form.patient_id) { setFormError("Selecione o paciente."); return }
    if (!form.description.trim()) { setFormError("Informe a descrição do serviço."); return }
    if (!form.amount || isNaN(Number(form.amount)) || Number(form.amount) <= 0) {
      setFormError("Informe um valor válido maior que zero.")
      return
    }
    setIsCreating(true)
    try {
      await createFinancialTransaction({
        patient_id: form.patient_id,
        description: form.description.trim(),
        amount: Number(form.amount),
        payment_method: form.payment_method,
        status: form.status as any,
        type: form.type as any,
      })
      toast.success("Transação registrada com sucesso!")
      mutate()
      setIsDialogOpen(false)
      resetForm()
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao registrar transação"
      setFormError(message)
      toast.error(message)
    } finally {
      setIsCreating(false)
    }
  }

  const openReceiveDialog = (transaction: any) => {
    setTransactionToReceive(transaction)
    setReceiveMethod(transaction.payment_method || "")
    setReceiveDate(toLocalDateString(new Date()))
    setReceiveError(null)
  }

  const handleReceive = async () => {
    if (!transactionToReceive) return
    if (!receiveMethod) {
      setReceiveError("Escolha como o paciente realizou o pagamento.")
      return
    }
    setUpdatingId(transactionToReceive.id)
    try {
      await patchTransaction(transactionToReceive.id, {
        status: "paid",
        verification_status: "confirmed",
        payment_method: receiveMethod,
        paid_date: new Date(`${receiveDate}T12:00:00-03:00`).toISOString(),
      })
      toast.success(`Recebimento de ${formatCurrency(transactionToReceive.amount || 0)} registrado.`)
      await mutate()
      setTransactionToReceive(null)
    } catch (err) {
      setReceiveError(err instanceof Error ? err.message : "Erro ao registrar recebimento")
    } finally {
      setUpdatingId(null)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "paid": return <Badge className="bg-green-100 text-green-800">Pago</Badge>
      case "pending": return <Badge className="bg-yellow-100 text-yellow-800">Pendente</Badge>
      case "cancelled": return <Badge className="bg-red-100 text-red-800">Cancelado</Badge>
      default: return <Badge variant="secondary">{status}</Badge>
    }
  }

  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Financeiro</h1>
          <p className="text-muted-foreground">Registro de pagamentos e receitas da clínica</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm() }}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" />Registrar Pagamento</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[480px]">
            <DialogHeader>
              <DialogTitle>Registrar Pagamento</DialogTitle>
              <DialogDescription>Registre um pagamento recebido na clínica</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              {formError && (
                <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span>{formError}</span>
                </div>
              )}
              <div className="grid gap-2">
                <Label>Paciente *</Label>
                <Select value={form.patient_id} onValueChange={(v) => setForm({ ...form, patient_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione o paciente" /></SelectTrigger>
                  <SelectContent>{patients?.map(p => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Descrição do Serviço *</Label>
                <Input placeholder="Ex: Consulta, Limpeza..." value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Valor (R$) *</Label>
                  <Input type="number" min="0.01" step="0.01" placeholder="0,00" value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })} />
                </div>
                <div className="grid gap-2">
                  <Label>Forma de Pagamento</Label>
                  <Select value={form.payment_method} onValueChange={(v) => setForm({ ...form, payment_method: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PAYMENT_METHODS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="paid">Pago</SelectItem>
                    <SelectItem value="pending">Pendente (pagar depois)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setIsDialogOpen(false); resetForm() }}>Cancelar</Button>
              <Button onClick={handleCreate} disabled={isCreating}>
                {isCreating ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Registrando...</> : "Registrar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Recebido</p>
              <p className="text-2xl font-bold text-green-600">{formatCurrency(metrics.totalPaid)}</p>
              <p className="text-xs text-muted-foreground mt-1">{metrics.countPaid} transações pagas</p>
            </div>
            <div className="p-3 bg-green-100 rounded-lg"><TrendingUp className="w-5 h-5 text-green-600" /></div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground">A Receber</p>
              <p className="text-2xl font-bold text-yellow-600">{formatCurrency(metrics.totalPending)}</p>
              <p className="text-xs text-muted-foreground mt-1">{metrics.countPending} pendentes</p>
            </div>
            <div className="p-3 bg-yellow-100 rounded-lg"><Clock className="w-5 h-5 text-yellow-600" /></div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Cancelados</p>
              <p className="text-2xl font-bold text-red-600">{metrics.countCancelled}</p>
              <p className="text-xs text-muted-foreground mt-1">transações canceladas</p>
            </div>
            <div className="p-3 bg-red-100 rounded-lg"><TrendingDown className="w-5 h-5 text-red-600" /></div>
          </div>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-medium">Período e filtros</p>
              <p className="text-xs text-muted-foreground">Os totais e a lista abaixo seguem estes filtros.</p>
            </div>
            <div className="flex flex-wrap gap-3 items-center">
            <div className="flex gap-1">
              {[{ value: "today", label: "Hoje" }, { value: "week", label: "Semana" },
                { value: "month", label: "Mês" }, { value: "all", label: "Tudo" }].map(p => (
                <Button key={p.value} size="sm"
                  variant={filterPeriod === p.value ? "default" : "outline"}
                  className={filterPeriod !== p.value ? "bg-transparent" : ""}
                  onClick={() => setFilterPeriod(p.value)}>
                  {p.label}
                </Button>
              ))}
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-36 h-8 text-sm"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos status</SelectItem>
                <SelectItem value="paid">Pagos</SelectItem>
                <SelectItem value="pending">Pendentes</SelectItem>
                <SelectItem value="cancelled">Cancelados</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterMethod} onValueChange={setFilterMethod}>
              <SelectTrigger className="w-44 h-8 text-sm"><SelectValue placeholder="Forma" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as formas</SelectItem>
                {PAYMENT_METHODS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
              </SelectContent>
            </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Transações */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base">Transações</CardTitle>
          <span className="text-sm text-muted-foreground">
            {isLoading ? "..." : `${filteredTransactions.length} registros`}
          </span>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="text-center py-12">
              <DollarSign className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-40" />
              <p className="text-muted-foreground">Nenhuma transação encontrada</p>
              <Button className="mt-4" variant="outline" onClick={() => setIsDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" /> Registrar Pagamento
              </Button>
            </div>
          ) : (
            filteredTransactions.map((transaction) => (
              <div key={transaction.id}
                className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-lg border border-border bg-muted/30 p-4">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="flex items-center justify-center rounded-lg bg-primary/10 p-3 shrink-0">
                    {getPaymentIcon(transaction.payment_method || "")}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {(transaction as any).patient?.full_name || "Paciente"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {transaction.description}{transaction.payment_method ? ` · ${transaction.payment_method}` : " · Forma de pagamento a definir"}
                    </p>
                    <p className="text-xs text-muted-foreground">{formatDate(transaction.created_at)}</p>
                  </div>
                  {getStatusBadge(transaction.status)}
                </div>
                <div className="flex items-center justify-between sm:justify-end gap-3 flex-wrap">
                  <span className={`text-base font-semibold ${transaction.status === "cancelled" ? "line-through text-muted-foreground" : "text-foreground"}`}>
                    {formatCurrency(transaction.amount || 0)}
                  </span>
                  <div className="flex gap-1 flex-wrap">
                    {transaction.status === "pending" && (
                      <Button size="sm"
                        className="gap-1.5"
                        disabled={updatingId === transaction.id}
                        onClick={() => openReceiveDialog(transaction)}>
                        <Wallet className="h-3.5 w-3.5" /> Receber
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Dialog open={transactionToReceive !== null} onOpenChange={(open) => { if (!open && !updatingId) setTransactionToReceive(null) }}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>Receber pagamento</DialogTitle>
            <DialogDescription>
              Confirme a forma escolhida pelo paciente no momento do pagamento.
            </DialogDescription>
          </DialogHeader>

          {transactionToReceive && (
            <div className="space-y-5 py-2">
              <div className="rounded-lg border bg-muted/30 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium">{transactionToReceive.patient?.full_name || "Paciente"}</p>
                    <p className="text-sm text-muted-foreground">{transactionToReceive.description || "Atendimento odontológico"}</p>
                  </div>
                  <p className="text-lg font-bold whitespace-nowrap">{formatCurrency(transactionToReceive.amount || 0)}</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Como o paciente pagou? *</Label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {PAYMENT_METHODS.map(({ value, label, icon: Icon }) => (
                    <button
                      type="button"
                      key={value}
                      onClick={() => { setReceiveMethod(value); setReceiveError(null) }}
                      className={`flex min-h-20 flex-col items-center justify-center gap-2 rounded-lg border px-2 py-3 text-sm transition-colors ${receiveMethod === value ? "border-primary bg-primary/10 text-primary ring-1 ring-primary" : "hover:bg-muted"}`}
                    >
                      <Icon className="h-5 w-5" />
                      <span className="text-center leading-tight">{label}</span>
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">Mostre somente formas que a clínica realmente aceita.</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="receive-date">Data do recebimento</Label>
                <div className="relative">
                  <CalendarDays className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input id="receive-date" type="date" value={receiveDate} onChange={(e) => setReceiveDate(e.target.value)} className="pl-9" />
                </div>
              </div>

              {receiveError && (
                <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{receiveError}
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" disabled={updatingId !== null} onClick={() => setTransactionToReceive(null)}>Voltar</Button>
            <Button disabled={updatingId !== null || !transactionToReceive} onClick={handleReceive}>
              {updatingId ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
              Confirmar recebimento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
