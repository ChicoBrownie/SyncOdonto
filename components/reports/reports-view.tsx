"use client"

import { useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Download,
  TrendingUp,
  Users,
  Calendar,
  Clock,
  DollarSign,
  FileText,
  BarChart3,
  PieChart,
  Loader2,
} from "lucide-react"
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
} from "recharts"
import useSWR from "swr"

const fetcher = (url: string) => fetch(url).then((res) => res.json())

const COLORS = ["#0ea5e9", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"]

function getWeekDates(offset: number = 0) {
  const now = new Date()
  const dayOfWeek = now.getDay()
  const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1)
  const monday = new Date(now.setDate(diff + offset * 7))
  monday.setHours(0, 0, 0, 0)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  sunday.setHours(23, 59, 59, 999)
  return { start: monday, end: sunday }
}

function formatDateBR(date: Date) {
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
}

function getDayLabel(dateStr: string) {
  const date = new Date(dateStr + "T12:00:00")
  return date.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "")
}

export function ReportsView() {
  const [weekOffset, setWeekOffset] = useState(0)

  const week = useMemo(() => getWeekDates(weekOffset), [weekOffset])
  const startISO = week.start.toISOString().split("T")[0]
  const endISO = week.end.toISOString().split("T")[0]

  const { data: appointmentsData, isLoading: loadingAppts } = useSWR(
    `/api/appointments?startDate=${startISO}&endDate=${endISO}`,
    fetcher
  )
  const { data: patientsData, isLoading: loadingPatients } = useSWR(
    "/api/patients",
    fetcher
  )
  const { data: prevAppointmentsData } = useSWR(() => {
    const prev = getWeekDates(weekOffset - 1)
    const pStartISO = prev.start.toISOString().split("T")[0]
    const pEndISO = prev.end.toISOString().split("T")[0]
    return `/api/appointments?startDate=${pStartISO}&endDate=${pEndISO}`
  }, fetcher)

  // Visão geral da clínica (hoje) — cards que vieram da tela de Gestão da Clínica
  const { data: staffRes, isLoading: loadingStaff } = useSWR("/api/clinic-staff", fetcher)
  const staff = staffRes?.data || []
  const activeStaff = staff.filter((s: any) => s.is_active).length

  const todayISO = new Date().toISOString().split("T")[0]
  const { data: todayApptRes, isLoading: loadingToday } = useSWR(
    `/api/appointments?date=${todayISO}`,
    fetcher
  )
  const todayAppointments = todayApptRes?.data || []
  const isLoadingClinicOverview = loadingStaff || loadingToday

  const appointments = appointmentsData?.data || []
  const prevAppointments = prevAppointmentsData?.data || []
  const patients = patientsData?.data || []
  const isLoading = loadingAppts || loadingPatients

  // Metrics
  const totalAppointments = appointments.length
  const prevTotalAppointments = prevAppointments.length
  const completedAppointments = appointments.filter(
    (a: any) => a.status === "Concluída"
  ).length
  const cancelledAppointments = appointments.filter(
    (a: any) => a.status === "Cancelada"
  ).length
  const completionRate =
    totalAppointments > 0
      ? Math.round((completedAppointments / totalAppointments) * 100)
      : 0
  const apptChange =
    prevTotalAppointments > 0
      ? Math.round(
          ((totalAppointments - prevTotalAppointments) / prevTotalAppointments) * 100
        )
      : 0

  const newPatientsThisWeek = patients.filter((p: any) => {
    const created = new Date(p.created_at)
    return created >= week.start && created <= week.end
  }).length

  // Daily appointments chart
  const dailyData = useMemo(() => {
    const days: { day: string; date: string; consultas: number; concluidas: number; canceladas: number }[] = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(week.start)
      d.setDate(d.getDate() + i)
      const dateStr = d.toISOString().split("T")[0]
      const dayAppts = appointments.filter((a: any) => a.date === dateStr)
      days.push({
        day: getDayLabel(dateStr),
        date: dateStr,
        consultas: dayAppts.length,
        concluidas: dayAppts.filter((a: any) => a.status === "Concluída").length,
        canceladas: dayAppts.filter((a: any) => a.status === "Cancelada").length,
      })
    }
    return days
  }, [appointments, week.start])

  // Procedures breakdown
  const proceduresData = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const a of appointments) {
      const type = (a as any).procedure_type || "Outro"
      counts[type] = (counts[type] || 0) + 1
    }
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
  }, [appointments])

  // Status breakdown
  const statusData = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const a of appointments) {
      const status = (a as any).status || "Outro"
      counts[status] = (counts[status] || 0) + 1
    }
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
  }, [appointments])

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">
            Relatorio Semanal
          </h1>
          <p className="text-muted-foreground mt-1">
            {formatDateBR(week.start)} - {formatDateBR(week.end)}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="bg-transparent"
            onClick={() => setWeekOffset((o) => o - 1)}
          >
            Semana anterior
          </Button>
          <Button
            variant="outline"
            className="bg-transparent"
            disabled={weekOffset === 0}
            onClick={() => setWeekOffset(0)}
          >
            Atual
          </Button>
          <Button
            variant="outline"
            className="bg-transparent"
            disabled={weekOffset >= 0}
            onClick={() => setWeekOffset((o) => o + 1)}
          >
            Proxima
          </Button>
        </div>
      </div>

      {/* Visão Geral da Clínica (Hoje) — antigos cards de Gestão da Clínica */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-3">
          Visão Geral da Clínica (Hoje)
        </h2>
        {isLoadingClinicOverview ? (
          <div className="flex items-center justify-center h-24">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "Membros Ativos", value: activeStaff, sub: `de ${staff.length} cadastrados`, icon: Users, color: "bg-primary/10 text-primary" },
              { label: "Consultas Hoje", value: todayAppointments.length, sub: "Agendadas para hoje", icon: Calendar, color: "bg-green-500/10 text-green-600" },
              { label: "Taxa de Ocupação", value: `${Math.min(Math.round((todayAppointments.length / 8) * 100), 100)}%`, sub: "Base: 8 consultas/dia", icon: Clock, color: "bg-purple-500/10 text-purple-600" },
              { label: "Concluídas Hoje", value: todayAppointments.filter((a: any) => a.status === "Concluída").length, sub: "Finalizadas", icon: TrendingUp, color: "bg-orange-500/10 text-orange-600" },
            ].map(({ label, value, sub, icon: Icon, color }) => (
              <Card key={label} className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{label}</p>
                    <p className="text-2xl font-bold text-foreground mt-1">{value}</p>
                    <p className="text-xs text-muted-foreground mt-1">{sub}</p>
                  </div>
                  <div className={`p-3 rounded-lg ${color.split(" ")[0]}`}>
                    <Icon className={`w-5 h-5 ${color.split(" ")[1]}`} />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* Key Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-4 border-border">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Consultas</p>
                  <p className="text-2xl font-bold text-foreground mt-1">
                    {totalAppointments}
                  </p>
                  <p
                    className={`text-xs mt-1 flex items-center gap-1 ${apptChange >= 0 ? "text-green-600" : "text-red-600"}`}
                  >
                    <TrendingUp className="w-3 h-3" />
                    {apptChange >= 0 ? "+" : ""}
                    {apptChange}% vs semana anterior
                  </p>
                </div>
                <div className="p-3 bg-primary/10 rounded-lg">
                  <Calendar className="w-5 h-5 text-primary" />
                </div>
              </div>
            </Card>

            <Card className="p-4 border-border">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Concluidas</p>
                  <p className="text-2xl font-bold text-foreground mt-1">
                    {completedAppointments}
                  </p>
                  <p className="text-xs text-green-600 mt-1">
                    Taxa de {completionRate}%
                  </p>
                </div>
                <div className="p-3 bg-green-100 rounded-lg dark:bg-green-900/30">
                  <TrendingUp className="w-5 h-5 text-green-600" />
                </div>
              </div>
            </Card>

            <Card className="p-4 border-border">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Canceladas</p>
                  <p className="text-2xl font-bold text-foreground mt-1">
                    {cancelledAppointments}
                  </p>
                  <p className="text-xs text-red-600 mt-1">
                    {totalAppointments > 0
                      ? Math.round(
                          (cancelledAppointments / totalAppointments) * 100
                        )
                      : 0}
                    % do total
                  </p>
                </div>
                <div className="p-3 bg-red-100 rounded-lg dark:bg-red-900/30">
                  <BarChart3 className="w-5 h-5 text-red-600" />
                </div>
              </div>
            </Card>

            <Card className="p-4 border-border">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Novos Pacientes</p>
                  <p className="text-2xl font-bold text-foreground mt-1">
                    {newPatientsThisWeek}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {patients.length} total cadastrados
                  </p>
                </div>
                <div className="p-3 bg-purple-100 rounded-lg dark:bg-purple-900/30">
                  <Users className="w-5 h-5 text-purple-600" />
                </div>
              </div>
            </Card>
          </div>

          {/* Daily Chart */}
          <Card className="p-6 border-border">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-semibold text-foreground">
                  Consultas por Dia da Semana
                </h3>
                <p className="text-sm text-muted-foreground">
                  Distribuicao diaria de atendimentos
                </p>
              </div>
              <FileText className="w-5 h-5 text-muted-foreground" />
            </div>
            {dailyData.some((d) => d.consultas > 0) ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={dailyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="day" stroke="var(--color-muted-foreground)" />
                  <YAxis stroke="var(--color-muted-foreground)" allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--color-card)",
                      border: "1px solid var(--color-border)",
                      borderRadius: "8px",
                      color: "var(--color-foreground)",
                    }}
                  />
                  <Legend />
                  <Bar
                    dataKey="concluidas"
                    fill="#22c55e"
                    name="Concluidas"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="canceladas"
                    fill="#ef4444"
                    name="Canceladas"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="consultas"
                    fill="#0ea5e9"
                    name="Total"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-48 text-muted-foreground">
                Nenhuma consulta nesta semana
              </div>
            )}
          </Card>

          {/* Two Column Charts */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Procedures Chart */}
            <Card className="p-6 border-border">
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-foreground">
                  Procedimentos Realizados
                </h3>
                <p className="text-sm text-muted-foreground">
                  Distribuicao por tipo
                </p>
              </div>
              {proceduresData.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={250}>
                    <RechartsPieChart>
                      <Pie
                        data={proceduresData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent = 0 }) =>
                          `${name} ${(percent * 100).toFixed(0)}%`
                        }
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {proceduresData.map((_entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={COLORS[index % COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip />
                    </RechartsPieChart>
                  </ResponsiveContainer>
                  <div className="mt-4 space-y-2">
                    {proceduresData.map((item, index) => (
                      <div
                        key={item.name}
                        className="flex items-center justify-between text-sm"
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{
                              backgroundColor: COLORS[index % COLORS.length],
                            }}
                          />
                          <span className="text-foreground">{item.name}</span>
                        </div>
                        <span className="font-semibold text-foreground">
                          {item.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center h-48 text-muted-foreground">
                  Sem dados nesta semana
                </div>
              )}
            </Card>

            {/* Status Breakdown */}
            <Card className="p-6 border-border">
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-foreground">
                  Status das Consultas
                </h3>
                <p className="text-sm text-muted-foreground">Visao geral</p>
              </div>
              {statusData.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={statusData} layout="vertical">
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="var(--color-border)"
                      />
                      <XAxis
                        type="number"
                        stroke="var(--color-muted-foreground)"
                        allowDecimals={false}
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        stroke="var(--color-muted-foreground)"
                        width={110}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "var(--color-card)",
                          border: "1px solid var(--color-border)",
                          borderRadius: "8px",
                          color: "var(--color-foreground)",
                        }}
                      />
                      <Bar dataKey="value" name="Consultas" radius={[0, 4, 4, 0]}>
                        {statusData.map((_entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={COLORS[index % COLORS.length]}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  <div className="mt-4 space-y-2">
                    {statusData.map((item, index) => (
                      <div
                        key={item.name}
                        className="flex items-center justify-between text-sm"
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{
                              backgroundColor: COLORS[index % COLORS.length],
                            }}
                          />
                          <span className="text-foreground">{item.name}</span>
                        </div>
                        <span className="font-semibold text-foreground">
                          {item.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center h-48 text-muted-foreground">
                  Sem dados nesta semana
                </div>
              )}
            </Card>
          </div>

          {/* Download Reports */}
          <Card className="p-6 border-border">
            <h3 className="text-lg font-semibold text-foreground mb-4">
              Exportar Relatorios
            </h3>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[
                { name: "Relatorio de Consultas", icon: Calendar },
                { name: "Relatorio de Pacientes", icon: Users },
                { name: "Relatorio de Procedimentos", icon: FileText },
                { name: "Relatorio de Agendamentos", icon: Calendar },
                { name: "Relatorio de Performance", icon: TrendingUp },
                { name: "Relatorio Personalizado", icon: PieChart },
              ].map((report, i) => (
                <Button
                  key={i}
                  variant="outline"
                  className="justify-start h-auto py-4 bg-transparent"
                >
                  <report.icon className="w-5 h-5 mr-3 text-primary" />
                  <div className="text-left">
                    <p className="font-medium">{report.name}</p>
                    <p className="text-xs text-muted-foreground">Gerar PDF</p>
                  </div>
                </Button>
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  )
}
