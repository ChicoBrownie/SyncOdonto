"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Loader2, CheckCircle2, AlertTriangle, ChevronDown, ChevronRight, Wallet } from "lucide-react"
import { toast } from "sonner"
import useSWR from "swr"

const fetcher = (url: string) => fetch(url).then(r => r.json())

type VerificationStatus = "pending_verification" | "confirmed" | "incorrect"

type Transaction = {
  id: string
  description: string | null
  amount: number
  payment_method: string | null
  verification_status: VerificationStatus | null
  created_at: string
  paid_date: string | null
  patient?: { id: string; full_name: string } | null
  source_appointment_id?: string | null
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })
}

function groupByDate(transactions: Transaction[]): Record<string, Transaction[]> {
  return transactions.reduce<Record<string, Transaction[]>>((acc, t) => {
    const key = formatDate(t.created_at)
    if (!acc[key]) acc[key] = []
    acc[key].push(t)
    return acc
  }, {})
}

export function CashClosing() {
  const { data, isLoading, mutate } = useSWR(
    "/api/financial?status=pending&verification_status=pending_verification",
    fetcher
  )

  // Filtramos no cliente para garantir só os pending_verification
  const pending: Transaction[] = useMemo(() => {
    const all: Transaction[] = data?.data || []
    return all.filter(t => t.verification_status === "pending_verification")
  }, [data])

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  const grouped = useMemo(() => groupByDate(pending), [pending])
  const dateKeys = Object.keys(grouped).sort((a, b) => {
    // sort desc (mais recente primeiro)
    const [da, ma, ya] = a.split("/").map(Number)
    const [db, mb, yb] = b.split("/").map(Number)
    return new Date(yb, mb - 1, db).getTime() - new Date(ya, ma - 1, da).getTime()
  })

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selected.size === pending.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(pending.map(t => t.id)))
    }
  }

  const toggleCollapseDate = (date: string) => {
    setCollapsed(prev => {
      const next = new Set(prev)
      next.has(date) ? next.delete(date) : next.add(date)
      return next
    })
  }

  const patchAll = async (ids: string[], status: VerificationStatus) => {
    const results = await Promise.allSettled(
      ids.map(id =>
        fetch(`/api/financial/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ verification_status: status }),
        }).then(r => { if (!r.ok) throw new Error(); return r.json() })
      )
    )
    const failed = results.filter(r => r.status === "rejected").length
    return { failed, ok: ids.length - failed }
  }

  const handleVerify = async (status: VerificationStatus) => {
    if (selected.size === 0) {
      toast.warning("Selecione pelo menos um pagamento.")
      return
    }
    setSaving(true)
    try {
      const ids = Array.from(selected)
      const { ok, failed } = await patchAll(ids, status)
      if (failed === 0) {
        toast.success(
          status === "confirmed"
            ? `${ok} pagamento${ok > 1 ? "s" : ""} confirmado${ok > 1 ? "s" : ""}!`
            : `${ok} pagamento${ok > 1 ? "s marcados" : " marcado"} como Pagamento Incorreto.`
        )
      } else {
        toast.warning(`${ok} atualizados, ${failed} falharam.`)
      }
      setSelected(new Set())
      mutate()
    } catch {
      toast.error("Erro ao atualizar pagamentos.")
    } finally {
      setSaving(false)
    }
  }

  const totalPending = pending.reduce((s, t) => s + t.amount, 0)
  const totalSelected = pending
    .filter(t => selected.has(t.id))
    .reduce((s, t) => s + t.amount, 0)

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Wallet className="h-4 w-4" />
            Fechamento de Caixa
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Wallet className="h-4 w-4" />
              Fechamento de Caixa
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Pagamentos gerados ao encerrar consultas, aguardando verificação.
            </p>
          </div>
          {pending.length > 0 && (
            <div className="flex flex-col items-end gap-1 shrink-0">
              <span className="text-xs text-muted-foreground">Total pendente</span>
              <span className="text-lg font-bold text-foreground">{formatCurrency(totalPending)}</span>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {pending.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-2 text-center">
            {/* text-success não existe no tema (não está definido em globals.css/tailwind.config),
                então o ícone ficava sem cor. Trocado para emerald-600, mesmo padrão usado
                em outras partes do app (ex: "Convite enviado"). */}
            <CheckCircle2 className="h-8 w-8 text-emerald-600" />
            <p className="text-sm font-medium text-foreground">Tudo verificado!</p>
            <p className="text-xs text-muted-foreground">Nenhum pagamento pendente de verificação no momento.</p>
          </div>
        ) : (
          <>
            {/* Toolbar de seleção */}
            <div className="flex flex-wrap items-center gap-3 rounded-lg bg-muted/50 px-3 py-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="select-all"
                  checked={selected.size > 0 && selected.size === pending.length}
                  onCheckedChange={toggleSelectAll}
                />
                <label htmlFor="select-all" className="text-xs text-muted-foreground cursor-pointer select-none">
                  {selected.size === 0
                    ? "Selecionar todos"
                    : selected.size === pending.length
                    ? "Desmarcar todos"
                    : `${selected.size} selecionado${selected.size > 1 ? "s" : ""}`}
                </label>
              </div>

              {selected.size > 0 && (
                <>
                  <span className="text-xs text-muted-foreground hidden sm:inline">·</span>
                  <span className="text-xs font-medium text-foreground">
                    {formatCurrency(totalSelected)}
                  </span>
                  <div className="flex gap-2 ml-auto">
                    <Button
                      size="sm"
                      className="h-7 text-xs bg-emerald-600 text-white hover:bg-emerald-600/90"
                      onClick={() => handleVerify("confirmed")}
                      disabled={saving}
                    >
                      {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <CheckCircle2 className="h-3 w-3 mr-1" />}
                      Confirmado
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs border-orange-400 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950/20 bg-transparent"
                      onClick={() => handleVerify("incorrect")}
                      disabled={saving}
                    >
                      {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <AlertTriangle className="h-3 w-3 mr-1" />}
                      Pagamento Incorreto
                    </Button>
                  </div>
                </>
              )}
            </div>

            {/* Lista agrupada por data */}
            <div className="space-y-3">
              {dateKeys.map(date => {
                const dayItems = grouped[date]
                const isCollapsed = collapsed.has(date)
                const dayTotal = dayItems.reduce((s, t) => s + t.amount, 0)
                const daySelected = dayItems.filter(t => selected.has(t.id)).length

                return (
                  <div key={date} className="rounded-lg border border-border overflow-hidden">
                    {/* Header do grupo de data */}
                    <button
                      className="w-full flex items-center justify-between px-4 py-2.5 bg-muted/40 hover:bg-muted/60 transition-colors"
                      onClick={() => toggleCollapseDate(date)}
                    >
                      <div className="flex items-center gap-2">
                        {isCollapsed
                          ? <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                          : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                        }
                        <span className="text-sm font-medium text-foreground">{date}</span>
                        <Badge variant="secondary" className="text-xs h-5">
                          {dayItems.length} pagamento{dayItems.length > 1 ? "s" : ""}
                        </Badge>
                        {daySelected > 0 && (
                          <Badge className="text-xs h-5 bg-primary/10 text-primary">
                            {daySelected} selecionado{daySelected > 1 ? "s" : ""}
                          </Badge>
                        )}
                      </div>
                      <span className="text-sm font-semibold text-foreground">{formatCurrency(dayTotal)}</span>
                    </button>

                    {/* Linhas de transação */}
                    {!isCollapsed && (
                      <div className="divide-y divide-border">
                        {dayItems.map(transaction => (
                          <div
                            key={transaction.id}
                            className={`flex items-center gap-3 px-4 py-3 transition-colors ${
                              selected.has(transaction.id) ? "bg-primary/5" : "hover:bg-muted/30"
                            }`}
                          >
                            <Checkbox
                              checked={selected.has(transaction.id)}
                              onCheckedChange={() => toggleSelect(transaction.id)}
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">
                                {transaction.patient?.full_name || "—"}
                              </p>
                              <p className="text-xs text-muted-foreground truncate">
                                {transaction.description || "Consulta"}
                              </p>
                            </div>
                            <div className="flex flex-col items-end gap-0.5 shrink-0">
                              <span className="text-sm font-semibold text-foreground">
                                {formatCurrency(transaction.amount)}
                              </span>
                              {transaction.payment_method && (
                                <span className="text-xs text-muted-foreground">
                                  {transaction.payment_method}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
