"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  DollarSign,
  Plus,
  Loader2,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Wallet,
  CreditCard,
  Banknote,
  Smartphone,
  CheckCircle,
  XCircle,
  Clock,
} from "lucide-react"
import { useFinancialTransactions, usePatients, createFinancialTransaction } from "@/lib/hooks/use-data"
import { toast } from "sonner"
import useSWR from "swr"

const fetcher = (url: string) => fetch(url).then(r => r.json())

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

function getStatusBadge(status: string) {
  switch (status) {
    case "paid": return <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">Pago</Badge>
    case "pending": return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">Pendente</Badge>
    case "cancelled": return <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">Cancelado</Badge>
    default: return <Badge variant="secondary">{status}</Badge>
  }
}

export function FinancialView() {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState("all")
  const [filterMethod, setFilterMethod] = useState("all")
  const [filterPeriod, setFilterPeriod] = useState("month") // today | week | month | all

  const { patients } = usePatients()

  const [form, setForm] = useState({
    patient_id: "",
    description: "",
    amount: "",
    payment_method: "Espécie",
    status: "paid",
    type: "income",
  })

  // Monta filtro de datas
  const dateFilter = useMemo(() => {
    const now = new Date()
    if (filterPeriod === "today") {
      const d = now.toISOString().split("T")[0]
      return { startDate: d, endDate: d }
    }
    if (filterPeriod === "week") {
      const day = now.getDay()
      const monday = new Date(now)
      monday.setDate(now.getDate() - ((day + 6) % 7))
      const sunday = new Date(monday)
      sunday.setDate(monday.getDate() + 6)
      return {
        startDate: monday.toISOString().split("T")[0],
        endDate: sunday.toISOString().split("T")[0],
      }
    }
    if (filterPeriod === "month") {
      const start = new Date(now.getFullYear(), now.getMonth(), 1)
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      return {
        startDate: start.toISOString().split("T")[0],
        endDate: end.toISOString().split("T")[0],
      }
    }
    return {}
  }, [filterPeriod])

  const { transactions, isLoading, mutate } = useFinancialTransactions({
    status: filterStatus !== "all" ? filterStatus : undefined,
    ...dateFilter,
  })

  // Filtra por forma de pagamento no cliente (API não tem esse filtro)
  const filteredTransactions = useMemo(() => {
    if (!transactions) return []
    if (filterMethod === "all") return transactions
    return transactions.filter(t => t.payment_method === filterMethod)
  }, [transactions, filterMethod])

  // Métricas
  const metrics = useMemo(() => {
    const paid = filteredTransactions.filter(t => t.status === "paid" && t.type === "income")
    const pending = filteredTransactions.filter(t => t.status === "pending" && t.type === "income")
    const cancelled = filteredTransactions.filter(t => t.status === "cancelled")
    const totalPaid = paid.reduce((sum, t) => sum + (t.amount || 0), 0)
    const totalPending = pending.reduce((sum, t) => sum + (t.amount || 0), 0)
    return { totalPaid, totalPending, countPaid: paid.length, countPending: pending.length, countCancelled: cancelled.length }
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

  const handleUpdateStatus = async (id: string, status: string) => {
    try {
      const res = await fetch(`/api/financial/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Erro ao atualizar")
      }
      toast.success("Status atualizado!")
      mutate()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao atualizar status")
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
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Registrar Pagamento
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[480px]">
            <DialogHeader>
              <DialogTitle>Registrar Pagamento</DialogTitle>
              <DialogDescription>Registre um pagamento recebido na clínica</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              {formError && (
                <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="grid gap-2">
                <Label>Paciente *</Label>
                <Select value={form.patient_id} onValueChange={(v) => setForm({ ...form, patient_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione o paciente" /></SelectTrigger>
                  <SelectContent>
                    {patients?.map(p => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label>Descrição do Serviço *</Label>
                <Input
                  placeholder="Ex: Consulta, Limpeza, Tratamento de canal..."
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Valor (R$) *</Label>
                  <Input
                    type="number"
                    min="0.01"
                    step="0.01"
                    placeholder="0,00"
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Forma de Pagamento</Label>
                  <Select value={form.payment_method} onValueChange={(v) => setForm({ ...form, payment_method: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PAYMENT_METHODS.map(m => (
                        <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                      ))}
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
            <div className="p-3 bg-green-100 rounded-lg dark:bg-green-900/30">
              <TrendingUp className="w-5 h-5 text-green-600" />
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground">A Receber</p>
              <p className="text-2xl font-bold text-yellow-600">{formatCurrency(metrics.totalPending)}</p>
              <p className="text-xs text-muted-foreground mt-1">{metrics.countPending} pendentes</p>
            </div>
            <div className="p-3 bg-yellow-100 rounded-lg dark:bg-yellow-900/30">
              <Clock className="w-5 h-5 text-yellow-600" />
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Cancelados</p>
              <p className="text-2xl font-bold text-red-600">{metrics.countCancelled}</p>
              <p className="text-xs text-muted-foreground mt-1">transações canceladas</p>
            </div>
            <div className="p-3 bg-red-100 rounded-lg dark:bg-red-900/30">
              <TrendingDown className="w-5 h-5 text-red-600" />
            </div>
          </div>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex gap-1">
              {[
                { value: "today", label: "Hoje" },
                { value: "week", label: "Semana" },
                { value: "month", label: "Mês" },
                { value: "all", label: "Tudo" },
              ].map(p => (
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
                {PAYMENT_METHODS.map(m => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Lista de transações */}
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
                className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-4">
                <div className="flex items-center gap-4">
                  <div className="flex items-center justify-center rounded-lg bg-primary/10 p-3">
                    {getPaymentIcon(transaction.payment_method || "")}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {transaction.patient?.full_name || "Paciente"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {transaction.description} · {transaction.payment_method}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(transaction.created_at)}
                    </p>
                  </div>
                  {getStatusBadge(transaction.status)}
                </div>

                <div className="flex items-center gap-3">
                  <span className={`text-base font-semibold ${transaction.status === "cancelled" ? "line-through text-muted-foreground" : "text-foreground"}`}>
                    {formatCurrency(transaction.amount || 0)}
                  </span>
                  <div className="flex gap-1">
                    {transaction.status === "pending" && (
                      <Button size="sm" variant="outline"
                        className="bg-transparent text-green-600 border-green-300 hover:bg-green-50 gap-1"
                        onClick={() => handleUpdateStatus(transaction.id, "paid")}>
                        <CheckCircle className="h-3 w-3" /> Confirmar
                      </Button>
                    )}
                    {transaction.status !== "cancelled" && transaction.status !== "paid" && (
                      <Button size="sm" variant="outline"
                        className="bg-transparent text-destructive border-destructive/30 hover:bg-destructive/10 gap-1"
                        onClick={() => handleUpdateStatus(transaction.id, "cancelled")}>
                        <XCircle className="h-3 w-3" /> Cancelar
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
