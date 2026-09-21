"use client"

import { useEffect, useState } from "react"
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { Activity, Building2, CalendarDays, ChevronRight, DollarSign, Loader2, RefreshCw, ShieldAlert, Users, UserPlus } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

type PeriodKey = "7d" | "30d" | "90d" | "month" | "all"

type Account = {
  userId: string
  clinicName: string
  location: string | null
  email: string
  createdAt: string | null
  lastSignInAt: string | null
  lastActivity: string | null
  totalPatients: number
  newPatients: number
  totalAppointments: number
  appointmentsInPeriod: number
  revenueInPeriod: number
  teamCount: number
  isActive: boolean
}

type PlatformData = {
  period: { key: PeriodKey; label: string; start: string | null }
  summary: {
    totalClinics: number
    activeClinics: number
    patients: number
    newPatients: number
    appointments: number
    revenue: number
  }
  chart: Array<{ date: string; appointments: number; revenue: number; patients: number }>
  accounts: Account[]
}

type SupportData = {
  clinic: { clinic_name: string | null; email: string | null; phone: string | null; city: string | null; state: string | null } | null
  patients: Array<{ id: string; full_name: string; status: string | null; last_visit_at: string | null; created_at: string | null }>
  staff: Array<{ id: string; full_name: string; email: string | null; role: string | null; specialty: string | null; access_role: string | null; is_active: boolean | null }>
}

const PERIOD_OPTIONS: Array<{ value: PeriodKey; label: string }> = [
  { value: "7d", label: "Últimos 7 dias" },
  { value: "30d", label: "Últimos 30 dias" },
  { value: "90d", label: "Últimos 90 dias" },
  { value: "month", label: "Este mês" },
  { value: "all", label: "Todo o histórico" },
]

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)
}

function formatDate(value: string | null) {
  if (!value) return "Nunca"
  return new Date(value).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
}

function formatChartDate(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
}

export default function AdminPage() {
  const [period, setPeriod] = useState<PeriodKey>("30d")
  const [data, setData] = useState<PlatformData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedClinic, setSelectedClinic] = useState<Account | null>(null)
  const [reason, setReason] = useState("")
  const [supportData, setSupportData] = useState<SupportData | null>(null)
  const [supportError, setSupportError] = useState<string | null>(null)
  const [isLoadingSupport, setIsLoadingSupport] = useState(false)

  const fetchData = async (selectedPeriod = period) => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/admin/overview?period=${selectedPeriod}`)
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || "Erro ao carregar os dados")
      setData(payload)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Erro desconhecido")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  // A mudança de período é a única atualização automática necessária.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period])

  const openClinic = (clinic: Account) => {
    setSelectedClinic(clinic)
    setReason("")
    setSupportData(null)
    setSupportError(null)
  }

  const requestSupportAccess = async () => {
    if (!selectedClinic || reason.trim().length < 10) return
    setIsLoadingSupport(true)
    setSupportError(null)
    try {
      const response = await fetch("/api/admin/clinic-support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clinicId: selectedClinic.userId, reason: reason.trim() }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || "Erro ao liberar o acesso de suporte")
      setSupportData(payload)
    } catch (requestError) {
      setSupportError(requestError instanceof Error ? requestError.message : "Erro desconhecido")
    } finally {
      setIsLoadingSupport(false)
    }
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background p-6 flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="p-8 text-center">
            <ShieldAlert className="mx-auto mb-4 h-12 w-12 text-destructive" />
            <h1 className="text-lg font-semibold">Acesso negado</h1>
            <p className="mt-2 text-sm text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const summary = data?.summary
  return (
    <main className="min-h-screen bg-background p-5 lg:p-10">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-medium text-primary">SyncOdonto · Plataforma</p>
            <h1 className="text-3xl font-bold tracking-tight">Central administrativa</h1>
            <p className="mt-1 text-muted-foreground">Visão global das clínicas, uso do produto e indicadores financeiros.</p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={period} onValueChange={(value) => setPeriod(value as PeriodKey)}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PERIOD_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={() => fetchData()} disabled={isLoading} className="gap-2">
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} /> Atualizar
            </Button>
          </div>
        </div>

        {isLoading || !summary ? (
          <div className="flex justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
        ) : (
          <>
            <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard icon={<Building2 className="h-5 w-5 text-primary" />} label="Clínicas" value={String(summary.totalClinics)} detail={`${summary.activeClinics} ativas no período`} />
              <MetricCard icon={<Users className="h-5 w-5 text-violet-600" />} label="Pacientes cadastrados" value={String(summary.patients)} detail={`+${summary.newPatients} no período`} />
              <MetricCard icon={<CalendarDays className="h-5 w-5 text-blue-600" />} label="Agendamentos registrados" value={String(summary.appointments)} detail={data.period.label} />
              <MetricCard icon={<DollarSign className="h-5 w-5 text-emerald-600" />} label="Receita recebida" value={formatCurrency(summary.revenue)} detail={data.period.label} />
            </section>

            <section className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Evolução da plataforma</CardTitle>
                  <p className="text-sm text-muted-foreground">Agendamentos e novos pacientes registrados por dia.</p>
                </CardHeader>
                <CardContent className="h-[280px]">
                  {data.chart.length ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={data.chart} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                        <CartesianGrid vertical={false} strokeDasharray="3 3" />
                        <XAxis dataKey="date" tickFormatter={formatChartDate} tickLine={false} axisLine={false} fontSize={12} />
                        <YAxis yAxisId="count" allowDecimals={false} tickLine={false} axisLine={false} fontSize={12} />
                        <YAxis yAxisId="revenue" orientation="right" tickFormatter={(value) => `R$ ${value}`} tickLine={false} axisLine={false} fontSize={12} />
                        <Tooltip />
                        <Area yAxisId="count" type="monotone" dataKey="appointments" name="Agendamentos" fill="#dbeafe" stroke="#2563eb" strokeWidth={2} />
                        <Line yAxisId="count" type="monotone" dataKey="patients" name="Novos pacientes" stroke="#7c3aed" strokeWidth={2} dot={false} />
                        <Line yAxisId="revenue" type="monotone" dataKey="revenue" name="Receita" stroke="#059669" strokeWidth={2} dot={false} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  ) : <EmptyState label="Ainda não há movimentação no período selecionado." />}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Leitura rápida</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Insight icon={<Activity className="h-4 w-4 text-primary" />} label="Adoção" value={`${summary.activeClinics} de ${summary.totalClinics} clínicas ativas`} />
                  <Insight icon={<UserPlus className="h-4 w-4 text-violet-600" />} label="Captação" value={`${summary.newPatients} pacientes novos`} />
                  <Insight icon={<DollarSign className="h-4 w-4 text-emerald-600" />} label="Ticket médio" value={summary.appointments ? formatCurrency(summary.revenue / summary.appointments) : "Sem agendamentos"} />
                  <p className="rounded-md bg-muted p-3 text-xs text-muted-foreground">Receita considera lançamentos de entrada pagos. A contagem de agendamentos considera registros criados no período.</p>
                </CardContent>
              </Card>
            </section>

            <Card>
              <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-base">Clínicas</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">Cada conta dona de clínica aparece aqui, mesmo sem movimentação.</p>
                </div>
                <Badge variant="secondary">{data.accounts.length} no total</Badge>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[920px] text-sm">
                    <thead><tr className="border-y bg-muted/50 text-left text-xs text-muted-foreground">
                      <th className="px-5 py-3 font-medium">Clínica</th><th className="px-3 py-3 font-medium">Situação</th><th className="px-3 py-3 font-medium">Pacientes</th><th className="px-3 py-3 font-medium">Agenda</th><th className="px-3 py-3 font-medium">Receita</th><th className="px-3 py-3 font-medium">Último login</th><th className="px-5 py-3" />
                    </tr></thead>
                    <tbody>{data.accounts.map((account) => (
                      <tr key={account.userId} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="px-5 py-4"><p className="font-medium">{account.clinicName}</p><p className="mt-0.5 text-xs text-muted-foreground">{account.email}{account.location ? ` · ${account.location}` : ""}</p></td>
                        <td className="px-3 py-4"><Badge className={account.isActive ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100" : "bg-muted text-muted-foreground hover:bg-muted"}>{account.isActive ? "Ativa" : "Sem atividade"}</Badge></td>
                        <td className="px-3 py-4"><span className="font-medium">{account.totalPatients}</span><span className="block text-xs text-muted-foreground">+{account.newPatients} no período</span></td>
                        <td className="px-3 py-4"><span className="font-medium">{account.appointmentsInPeriod}</span><span className="block text-xs text-muted-foreground">{data.period.label.toLowerCase()}</span></td>
                        <td className="px-3 py-4 font-medium">{formatCurrency(account.revenueInPeriod)}</td>
                        <td className="px-3 py-4 text-xs text-muted-foreground">{formatDate(account.lastSignInAt)}</td>
                        <td className="px-5 py-4 text-right"><Button variant="ghost" size="sm" onClick={() => openClinic(account)} className="gap-1">Detalhes <ChevronRight className="h-4 w-4" /></Button></td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <Dialog open={Boolean(selectedClinic)} onOpenChange={(open) => !open && setSelectedClinic(null)}>
        <DialogContent className="max-h-[calc(100vh-2rem)] max-w-4xl overflow-y-auto">
          {selectedClinic && <>
            <DialogHeader>
              <DialogTitle>{selectedClinic.clinicName}</DialogTitle>
              <DialogDescription>{selectedClinic.email} · Dados operacionais da clínica e acesso de suporte registrado.</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <DetailMetric label="Pacientes" value={String(selectedClinic.totalPatients)} />
              <DetailMetric label="Equipe" value={String(selectedClinic.teamCount)} />
              <DetailMetric label="Agendamentos" value={String(selectedClinic.appointmentsInPeriod)} />
              <DetailMetric label="Receita" value={formatCurrency(selectedClinic.revenueInPeriod)} />
            </div>

            {!supportData ? <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
              <div><h2 className="font-medium">Acesso de suporte a dados identificáveis</h2><p className="mt-1 text-sm text-muted-foreground">Informe o motivo. A liberação registra seu usuário, a clínica, o horário e a justificativa no log de auditoria.</p></div>
              <Textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Ex.: Atendimento de solicitação aberta pela clínica para localizar um paciente." maxLength={1000} />
              {supportError && <p className="text-sm text-destructive">{supportError}</p>}
              <DialogFooter><Button onClick={requestSupportAccess} disabled={reason.trim().length < 10 || isLoadingSupport}>{isLoadingSupport && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Liberar dados de suporte</Button></DialogFooter>
            </div> : <SupportPanel data={supportData} />}
          </>}
        </DialogContent>
      </Dialog>
    </main>
  )
}

function MetricCard({ icon, label, value, detail }: { icon: React.ReactNode; label: string; value: string; detail: string }) {
  return <Card><CardContent className="flex gap-3 p-5"><div className="rounded-lg bg-muted p-3">{icon}</div><div><p className="text-sm text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-bold">{value}</p><p className="mt-1 text-xs text-muted-foreground">{detail}</p></div></CardContent></Card>
}

function Insight({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <div className="flex items-center gap-3"><div className="rounded-full bg-muted p-2">{icon}</div><div><p className="text-xs text-muted-foreground">{label}</p><p className="text-sm font-medium">{value}</p></div></div>
}

function DetailMetric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-md border p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 font-semibold">{value}</p></div>
}

function EmptyState({ label }: { label: string }) {
  return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">{label}</div>
}

function SupportPanel({ data }: { data: SupportData }) {
  return <div className="space-y-5">
    <div className="rounded-lg bg-emerald-50 p-4 text-sm text-emerald-900">Acesso de suporte registrado. A lista abaixo fica limitada a 100 pacientes e não inclui prontuários, informações de saúde, documentos ou dados financeiros individuais.</div>
    {data.clinic && <div className="rounded-lg border p-4 text-sm"><p className="font-medium">Contato da clínica</p><p className="mt-1 text-muted-foreground">{[data.clinic.email, data.clinic.phone, [data.clinic.city, data.clinic.state].filter(Boolean).join(" - ")].filter(Boolean).join(" · ") || "Não informado"}</p></div>}
    <div><h2 className="mb-2 font-medium">Pacientes recentes</h2><div className="overflow-x-auto rounded-lg border"><table className="w-full min-w-[580px] text-sm"><thead><tr className="border-b bg-muted/50 text-left text-xs text-muted-foreground"><th className="px-4 py-2">Nome</th><th className="px-4 py-2">Situação</th><th className="px-4 py-2">Última visita</th><th className="px-4 py-2">Cadastro</th></tr></thead><tbody>{data.patients.map((patient) => <tr key={patient.id} className="border-b last:border-0"><td className="px-4 py-3 font-medium">{patient.full_name}</td><td className="px-4 py-3">{patient.status || "—"}</td><td className="px-4 py-3 text-muted-foreground">{formatDate(patient.last_visit_at)}</td><td className="px-4 py-3 text-muted-foreground">{formatDate(patient.created_at)}</td></tr>)}{!data.patients.length && <tr><td className="px-4 py-6 text-center text-muted-foreground" colSpan={4}>Nenhum paciente encontrado.</td></tr>}</tbody></table></div></div>
    <div><h2 className="mb-2 font-medium">Equipe cadastrada</h2><div className="overflow-x-auto rounded-lg border"><table className="w-full min-w-[580px] text-sm"><thead><tr className="border-b bg-muted/50 text-left text-xs text-muted-foreground"><th className="px-4 py-2">Nome</th><th className="px-4 py-2">E-mail</th><th className="px-4 py-2">Função</th><th className="px-4 py-2">Situação</th></tr></thead><tbody>{data.staff.map((member) => <tr key={member.id} className="border-b last:border-0"><td className="px-4 py-3 font-medium">{member.full_name}</td><td className="px-4 py-3 text-muted-foreground">{member.email || "—"}</td><td className="px-4 py-3">{member.access_role || member.role || "—"}</td><td className="px-4 py-3">{member.is_active === false ? "Inativo" : "Ativo"}</td></tr>)}{!data.staff.length && <tr><td className="px-4 py-6 text-center text-muted-foreground" colSpan={4}>Nenhum membro adicional encontrado.</td></tr>}</tbody></table></div></div>
  </div>
}
