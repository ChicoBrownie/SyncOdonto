"use client"

import { useMemo, useState } from "react"
import useSWR from "swr"
import { BarChart3, Calendar, ChevronLeft, ChevronRight, Clock, DollarSign, Download, FileText, Loader2, PieChart, TrendingUp, Users } from "lucide-react"
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart as RechartsPieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

type Period = "day" | "week" | "month"
type Row = Record<string, string | number>
const COLORS = ["#0ea5e9", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"]
const fetcher = async (url: string) => {
  const response = await fetch(url)
  if (!response.ok) throw new Error("Não foi possível carregar os dados")
  return response.json()
}

function localISO(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}
function getRange(period: Period, offset: number) {
  const date = new Date(); date.setHours(12, 0, 0, 0)
  if (period === "day") { date.setDate(date.getDate() + offset); return { start: date, end: new Date(date) } }
  if (period === "week") {
    date.setDate(date.getDate() - ((date.getDay() + 6) % 7) + offset * 7)
    const end = new Date(date); end.setDate(end.getDate() + 6)
    return { start: date, end }
  }
  date.setMonth(date.getMonth() + offset, 1)
  return { start: date, end: new Date(date.getFullYear(), date.getMonth() + 1, 0, 12) }
}
function formatDate(date: Date, withYear = true) {
  return date.toLocaleDateString("pt-BR", withYear ? { day: "2-digit", month: "2-digit", year: "numeric" } : { day: "2-digit", month: "2-digit" })
}
function money(value: number) { return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) }
function escapeCsv(value: string | number) { return `"${String(value ?? "").replaceAll('"', '""')}"` }
function downloadCsv(filename: string, rows: Row[]) {
  if (!rows.length) { toast.info("Não há dados para exportar neste período."); return }
  const columns = Array.from(new Set(rows.flatMap(Object.keys)))
  const content = "\uFEFF" + [columns.map(escapeCsv).join(";"), ...rows.map(row => columns.map(column => escapeCsv(row[column] ?? "")).join(";"))].join("\r\n")
  const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }))
  const link = document.createElement("a"); link.href = url; link.download = filename; link.click(); URL.revokeObjectURL(url)
  toast.success("Relatório gerado com sucesso.")
}

export function ReportsView() {
  const [period, setPeriod] = useState<Period>("week")
  const [offset, setOffset] = useState(0)
  const range = useMemo(() => getRange(period, offset), [period, offset])
  const previous = useMemo(() => getRange(period, offset - 1), [period, offset])
  const startISO = localISO(range.start), endISO = localISO(range.end)
  const { data: appointmentsRes, isLoading: loadingAppointments } = useSWR(`/api/appointments?startDate=${startISO}&endDate=${endISO}`, fetcher)
  const { data: previousRes } = useSWR(`/api/appointments?startDate=${localISO(previous.start)}&endDate=${localISO(previous.end)}`, fetcher)
  const { data: patientsRes, isLoading: loadingPatients } = useSWR("/api/patients", fetcher)
  const { data: staffRes, isLoading: loadingStaff } = useSWR("/api/clinic-staff", fetcher)
  const { data: financialRes, isLoading: loadingFinancial } = useSWR(`/api/financial?startDate=${startISO}&endDate=${endISO}`, fetcher, { shouldRetryOnError: false })
  const appointments = useMemo<any[]>(() => appointmentsRes?.data || [], [appointmentsRes])
  const transactions = useMemo<any[]>(() => financialRes?.data || [], [financialRes])
  const previousAppointments: any[] = previousRes?.data || [], patients: any[] = patientsRes?.data || []
  const staff = useMemo<any[]>(() => staffRes?.data || [], [staffRes])
  const loading = loadingAppointments || loadingPatients || loadingStaff
  const completed = appointments.filter(item => item.status === "Concluída"), cancelled = appointments.filter(item => item.status === "Cancelada")
  const rate = (count: number) => appointments.length ? Math.round(count / appointments.length * 100) : 0
  const completionRate = rate(completed.length), cancellationRate = rate(cancelled.length), attendanceRate = rate(appointments.length - cancelled.length)
  const comparison = previousAppointments.length ? Math.round((appointments.length - previousAppointments.length) / previousAppointments.length * 100) : 0
  const revenue = transactions.filter(item => item.status === "paid" || item.status === "completed").reduce((sum, item) => sum + Number(item.amount || 0), 0)
  const pending = transactions.filter(item => item.status === "pending").reduce((sum, item) => sum + Number(item.amount || 0), 0)
  const newPatients = patients.filter(item => { const created = String(item.created_at || "").slice(0, 10); return created >= startISO && created <= endISO }).length

  const chartData = useMemo(() => {
    const result = [], cursor = new Date(range.start)
    while (cursor <= range.end) {
      const date = localISO(cursor), items = appointments.filter(item => item.date === date)
      result.push({ label: period === "month" ? formatDate(cursor, false) : cursor.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit" }).replace(".", ""), total: items.length, concluídas: items.filter(item => item.status === "Concluída").length, canceladas: items.filter(item => item.status === "Cancelada").length })
      cursor.setDate(cursor.getDate() + 1)
    }
    return result
  }, [appointments, period, range])
  const procedures = useMemo(() => {
    const counts: Record<string, number> = {}
    appointments.forEach(item => { const name = item.procedure_type || item.appointment_type || item.title || "Não informado"; counts[name] = (counts[name] || 0) + 1 })
    return Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
  }, [appointments])
  const employees = useMemo(() => staff.map(member => {
    const name = member.full_name || member.name || "Sem nome", role = member.access_role || member.role || "Não informado"
    const own = appointments.filter(item => String(item.doctor_name || "").trim().toLocaleLowerCase("pt-BR") === name.trim().toLocaleLowerCase("pt-BR")), ownCompleted = own.filter(item => item.status === "Concluída")
    return { name, role, appointments: own.length, completed: ownCompleted.length, cancellations: own.filter(item => item.status === "Cancelada").length, production: ownCompleted.reduce((sum, item) => sum + Number(item.cost || 0), 0) }
  }), [appointments, staff])
  const periodLabel = period === "day" ? formatDate(range.start) : `${formatDate(range.start)} a ${formatDate(range.end)}`
  const periodName = { day: "Diário", week: "Semanal", month: "Mensal" }[period]
  const setNewPeriod = (value: Period) => { setPeriod(value); setOffset(0) }
  const appointmentRows = appointments.map(item => ({ Data: item.date, Horário: String(item.time || "").slice(0, 5), Paciente: item.patient?.full_name || "", Dentista: item.doctor_name || "", Procedimento: item.procedure_type || item.title || "", Status: item.status || "", Valor: Number(item.cost || 0) }))
  const patientRows = patients.filter(item => String(item.created_at || "").slice(0, 10) >= startISO && String(item.created_at || "").slice(0, 10) <= endISO).map(item => ({ Paciente: item.full_name || "", Telefone: item.phone || "", Email: item.email || "", Cadastro: String(item.created_at || "").slice(0, 10) }))
  const financialRows = transactions.map(item => ({ Data: String(item.paid_date || item.created_at || "").slice(0, 10), Paciente: item.patient?.full_name || "", Descrição: item.description || "", Tipo: item.type || item.transaction_type || "", Status: item.status || "", Valor: Number(item.amount || 0), Pagamento: item.payment_method || "" }))
  const reports = [
    { name: "Consultas", description: "Agenda, paciente, dentista e status", icon: Calendar, rows: appointmentRows },
    { name: "Pacientes", description: "Novos cadastros no período", icon: Users, rows: patientRows },
    { name: "Procedimentos", description: "Volume por procedimento", icon: FileText, rows: procedures.map(item => ({ Procedimento: item.name, Quantidade: item.value })) },
    { name: "Agendamentos", description: "Horários e situação da agenda", icon: Clock, rows: appointmentRows },
    { name: "Financeiro", description: "Recebimentos e pendências", icon: DollarSign, rows: financialRows },
    { name: "Desempenho", description: "Conversão, faltas e produtividade", icon: TrendingUp, rows: [{ Período: periodLabel, Agendamentos: appointments.length, Concluídos: completed.length, Cancelados: cancelled.length, "Taxa de conclusão (%)": completionRate, "Taxa de comparecimento (%)": attendanceRate, "Taxa de cancelamento (%)": cancellationRate, "Novos pacientes": newPatients, "Receita recebida": revenue }] },
    { name: "Funcionários", description: "Atendimentos e produção por profissional", icon: BarChart3, rows: employees.map(item => ({ Funcionário: item.name, Função: item.role, Agendamentos: item.appointments, Concluídos: item.completed, Cancelados: item.cancellations, "Produção estimada": item.production })) },
    { name: "Personalizado", description: "Resumo consolidado do período", icon: PieChart, rows: [{ Período: periodLabel, Consultas: appointments.length, Concluídas: completed.length, Canceladas: cancelled.length, "Novos pacientes": newPatients, "Receita recebida": revenue, "A receber": pending, "Equipe ativa": staff.filter(item => item.is_active).length }] },
  ]

  return <div className="space-y-6 p-4 md:p-6 lg:p-8">
    <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between"><div><h1 className="text-2xl font-bold md:text-3xl">Relatório {periodName}</h1><p className="mt-1 text-muted-foreground">{periodLabel}</p></div><div className="flex flex-col gap-2 sm:flex-row sm:items-center"><div className="flex rounded-lg border p-1">{(["day", "week", "month"] as Period[]).map(value => <Button key={value} size="sm" variant={period === value ? "default" : "ghost"} onClick={() => setNewPeriod(value)}>{{ day: "Dia", week: "Semana", month: "Mês" }[value]}</Button>)}</div><div className="flex gap-2"><Button variant="outline" size="icon" aria-label="Período anterior" onClick={() => setOffset(value => value - 1)}><ChevronLeft className="h-4 w-4" /></Button><Button variant="outline" onClick={() => setOffset(0)} disabled={offset === 0}>Atual</Button><Button variant="outline" size="icon" aria-label="Próximo período" onClick={() => setOffset(value => value + 1)} disabled={offset >= 0}><ChevronRight className="h-4 w-4" /></Button></div></div></div>
    {loading ? <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div> : <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[
        { label: "Consultas", value: appointments.length, detail: `${comparison >= 0 ? "+" : ""}${comparison}% vs. período anterior`, icon: Calendar },
        { label: "Concluídas", value: completed.length, detail: `${completionRate}% de conclusão`, icon: TrendingUp },
        { label: "Novos pacientes", value: newPatients, detail: `${patients.length} pacientes cadastrados`, icon: Users },
        { label: "Receita recebida", value: loadingFinancial ? "…" : money(revenue), detail: `${money(pending)} a receber`, icon: DollarSign },
      ].map(({ label, value, detail, icon: Icon }) => <Card key={label} className="p-4"><div className="flex justify-between gap-4"><div><p className="text-sm text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-bold">{value}</p><p className="mt-1 text-xs text-muted-foreground">{detail}</p></div><div className="h-fit rounded-lg bg-primary/10 p-3"><Icon className="h-5 w-5 text-primary" /></div></div></Card>)}</div>
      <Card className="p-6"><h2 className="text-lg font-semibold">Atendimentos no período</h2><p className="mb-6 text-sm text-muted-foreground">Total, conclusões e cancelamentos por dia</p>{appointments.length ? <ResponsiveContainer width="100%" height={300}><BarChart data={chartData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="label" /><YAxis allowDecimals={false} /><Tooltip /><Legend /><Bar dataKey="concluídas" fill="#22c55e" /><Bar dataKey="canceladas" fill="#ef4444" /><Bar dataKey="total" fill="#0ea5e9" /></BarChart></ResponsiveContainer> : <div className="flex h-48 items-center justify-center text-muted-foreground">Nenhum atendimento neste período</div>}</Card>
      <div className="grid gap-6 lg:grid-cols-2"><Card className="p-6"><h2 className="text-lg font-semibold">Procedimentos</h2><p className="mb-4 text-sm text-muted-foreground">Distribuição dos procedimentos agendados</p>{procedures.length ? <ResponsiveContainer width="100%" height={260}><RechartsPieChart><Pie data={procedures} dataKey="value" nameKey="name" outerRadius={90} label>{procedures.map((_, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}</Pie><Tooltip /></RechartsPieChart></ResponsiveContainer> : <div className="flex h-48 items-center justify-center text-muted-foreground">Sem procedimentos no período</div>}</Card><Card className="p-6"><h2 className="text-lg font-semibold">Desempenho da clínica</h2><p className="mb-5 text-sm text-muted-foreground">Indicadores definidos para acompanhar eficiência e resultados</p><div className="grid grid-cols-2 gap-4">{[["Conclusão", `${completionRate}%`], ["Comparecimento", `${attendanceRate}%`], ["Cancelamento", `${cancellationRate}%`], ["Ocupação estimada", `${Math.min(Math.round(appointments.length / Math.max(chartData.length * 8, 1) * 100), 100)}%`]].map(([label, value]) => <div key={label} className="rounded-lg border p-4"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-bold">{value}</p></div>)}</div><p className="mt-4 text-xs text-muted-foreground">Ocupação estimada com capacidade de referência de 8 atendimentos por dia.</p></Card></div>
      <Card className="p-6"><h2 className="text-lg font-semibold">Desempenho por funcionário</h2><p className="mb-4 text-sm text-muted-foreground">Atendimentos associados ao nome do profissional na agenda. A produção usa o valor informado no agendamento.</p><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left text-muted-foreground"><th className="py-3 pr-4">Funcionário</th><th className="px-4 py-3">Função</th><th className="px-4 py-3 text-right">Agendados</th><th className="px-4 py-3 text-right">Concluídos</th><th className="px-4 py-3 text-right">Produção</th></tr></thead><tbody>{employees.map(item => <tr key={item.name} className="border-b last:border-0"><td className="py-3 pr-4 font-medium">{item.name}</td><td className="px-4 py-3 capitalize">{item.role}</td><td className="px-4 py-3 text-right">{item.appointments}</td><td className="px-4 py-3 text-right">{item.completed}</td><td className="px-4 py-3 text-right">{money(item.production)}</td></tr>)}</tbody></table></div><p className="mt-4 text-xs text-muted-foreground">Para recepcionistas, captação e contatos ainda não aparecem porque o sistema não registra quem originou cada paciente. O relatório não inventa esse dado.</p></Card>
      <Card className="p-6"><h2 className="text-lg font-semibold">Exportar relatórios</h2><p className="mb-4 text-sm text-muted-foreground">Os arquivos seguem o período selecionado acima e abrem normalmente no Excel.</p><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{reports.map(report => <Button key={report.name} variant="outline" className="h-auto justify-start bg-transparent py-4 text-left" onClick={() => downloadCsv(`relatorio-${report.name.toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replaceAll(" ", "-")}-${startISO}-${endISO}.csv`, report.rows)}><report.icon className="mr-3 h-5 w-5 shrink-0 text-primary" /><span><span className="block font-medium">{report.name}</span><span className="block whitespace-normal text-xs font-normal text-muted-foreground">{report.description}</span><span className="mt-1 flex items-center text-xs text-primary"><Download className="mr-1 h-3 w-3" />Baixar CSV</span></span></Button>)}</div></Card>
    </>}
  </div>
}
