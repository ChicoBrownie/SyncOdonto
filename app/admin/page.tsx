"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2, Users, Calendar, DollarSign, ShieldAlert, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"

interface AccountData {
  userId: string
  email: string
  createdAt: string | null
  lastSignInAt: string | null
  lastActivity: string | null
  totalPatients: number
  totalAppointments: number
  appointmentsThisMonth: number
  revenueThisMonth: number
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "Nunca"
  return new Date(dateStr).toLocaleDateString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit"
  })
}

function getActivityBadge(lastActivity: string | null) {
  if (!lastActivity) return <Badge className="bg-gray-100 text-gray-600">Sem atividade</Badge>
  const days = (Date.now() - new Date(lastActivity).getTime()) / (1000 * 60 * 60 * 24)
  if (days <= 7) return <Badge className="bg-green-100 text-green-700">Ativo</Badge>
  if (days <= 30) return <Badge className="bg-yellow-100 text-yellow-700">Pouco ativo</Badge>
  return <Badge className="bg-red-100 text-red-700">Inativo</Badge>
}

export default function AdminPage() {
  const [accounts, setAccounts] = useState<AccountData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/admin/overview")
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Erro ao carregar dados")
      }
      const data = await res.json()
      setAccounts(data.accounts || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const totals = accounts.reduce(
    (acc, a) => ({
      patients: acc.patients + a.totalPatients,
      appointments: acc.appointments + a.totalAppointments,
      revenue: acc.revenue + a.revenueThisMonth,
    }),
    { patients: 0, appointments: 0, revenue: 0 }
  )

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <Card className="max-w-md">
          <CardContent className="p-8 text-center">
            <ShieldAlert className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-foreground mb-2">Acesso negado</h2>
            <p className="text-sm text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-6 lg:p-10">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Painel Administrativo</h1>
            <p className="text-muted-foreground">Monitoramento de uso do SyncOdonto por conta</p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchData} className="gap-2 bg-transparent">
            <RefreshCw className="h-4 w-4" />
            Atualizar
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Resumo geral */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-primary/10 rounded-lg"><Users className="w-5 h-5 text-primary" /></div>
                  <div>
                    <p className="text-sm text-muted-foreground">Contas Ativas</p>
                    <p className="text-2xl font-bold text-foreground">{accounts.length}</p>
                  </div>
                </div>
              </Card>
              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-blue-100 rounded-lg"><Calendar className="w-5 h-5 text-blue-600" /></div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Agendamentos</p>
                    <p className="text-2xl font-bold text-foreground">{totals.appointments}</p>
                  </div>
                </div>
              </Card>
              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-green-100 rounded-lg"><DollarSign className="w-5 h-5 text-green-600" /></div>
                  <div>
                    <p className="text-sm text-muted-foreground">Faturamento do Mês (todas)</p>
                    <p className="text-2xl font-bold text-foreground">{formatCurrency(totals.revenue)}</p>
                  </div>
                </div>
              </Card>
            </div>

            {/* Lista de contas */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Contas Cadastradas</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/50">
                        <th className="py-2 px-4 text-left text-xs font-medium text-muted-foreground">Email</th>
                        <th className="py-2 px-4 text-left text-xs font-medium text-muted-foreground">Atividade</th>
                        <th className="py-2 px-4 text-left text-xs font-medium text-muted-foreground">Pacientes</th>
                        <th className="py-2 px-4 text-left text-xs font-medium text-muted-foreground">Agend. (mês)</th>
                        <th className="py-2 px-4 text-left text-xs font-medium text-muted-foreground">Faturamento (mês)</th>
                        <th className="py-2 px-4 text-left text-xs font-medium text-muted-foreground">Último acesso</th>
                        <th className="py-2 px-4 text-left text-xs font-medium text-muted-foreground">Cadastro</th>
                      </tr>
                    </thead>
                    <tbody>
                      {accounts.map((acc) => (
                        <tr key={acc.userId} className="border-b border-border hover:bg-muted/30">
                          <td className="py-3 px-4 font-medium text-foreground">{acc.email}</td>
                          <td className="py-3 px-4">{getActivityBadge(acc.lastActivity)}</td>
                          <td className="py-3 px-4 text-muted-foreground">{acc.totalPatients}</td>
                          <td className="py-3 px-4 text-muted-foreground">{acc.appointmentsThisMonth}</td>
                          <td className="py-3 px-4 text-muted-foreground">{formatCurrency(acc.revenueThisMonth)}</td>
                          <td className="py-3 px-4 text-xs text-muted-foreground">{formatDate(acc.lastSignInAt)}</td>
                          <td className="py-3 px-4 text-xs text-muted-foreground">{formatDate(acc.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {accounts.length === 0 && (
                  <div className="py-12 text-center text-muted-foreground">Nenhuma conta encontrada.</div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  )
}