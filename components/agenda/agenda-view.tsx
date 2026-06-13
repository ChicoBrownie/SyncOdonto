"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Calendar, ChevronLeft, ChevronRight, Plus, Loader2, AlertCircle, AlertTriangle, Pencil, Check, X } from "lucide-react"
import { useAppointments, usePatients, createAppointment, updateAppointment } from "@/lib/hooks/use-data"
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import useSWR from "swr"
import Link from "next/link"
import { useRouter } from "next/navigation"

const DEFAULT_CLOSING_HOUR = 18

const PAYMENT_METHODS = ["Espécie", "Cartão Débito", "Cartão Crédito", "Pix"]

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number)
  return h * 60 + m
}

function toLocalDateString(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

function formatCurrency(value: number | null) {
  if (value === null || value === undefined) return "—"
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)
}

type AppointmentTimeStatus = "ok" | "late" | "missed"

function getAppointmentTimeStatus(
  appointmentDate: string,
  appointmentTime: string,
  closingHour: number
): AppointmentTimeStatus {
  const now = new Date()
  const todayString = toLocalDateString(now)
  if (appointmentDate !== todayString) {
    if (appointmentDate < todayString) return "missed"
    return "ok"
  }
  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  const apptMinutes = timeToMinutes(appointmentTime)
  const closingMinutes = closingHour * 60
  if (nowMinutes >= closingMinutes) return "missed"
  if (nowMinutes >= apptMinutes + 15) return "late"
  return "ok"
}

function getWeekDays(referenceDate: Date): Date[] {
  const d = new Date(referenceDate)
  const day = d.getDay()
  const monday = new Date(d)
  monday.setDate(d.getDate() - ((day + 6) % 7))
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(monday)
    date.setDate(monday.getDate() + i)
    return date
  })
}

function getMonthDays(referenceDate: Date): (Date | null)[] {
  const year = referenceDate.getFullYear()
  const month = referenceDate.getMonth()
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const startOffset = (firstDay.getDay() + 6) % 7
  const days: (Date | null)[] = []
  for (let i = 0; i < startOffset; i++) days.push(null)
  for (let d = 1; d <= lastDay.getDate(); d++) days.push(new Date(year, month, d))
  return days
}

const CANCEL_REASONS = [
  "Falta de dinheiro",
  "Falta de tempo",
  "Compromisso",
  "Imprevisto",
  "Outros",
]

const STATUS_OPTIONS = [
  { value: "Pendente", label: "Pendente" },
  { value: "Confirmada", label: "Confirmada" },
  { value: "Atrasado", label: "Atrasado" },
  { value: "Em Andamento", label: "Em Andamento" },
  { value: "Concluída", label: "Concluída" },
  { value: "Cancelada", label: "Cancelada" },
  { value: "Falta", label: "Falta" },
]

export function AgendaView() {
  const router = useRouter()
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [viewMode, setViewMode] = useState<"day" | "week" | "month">("day")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [, setTick] = useState(0)

  const [cancelTarget, setCancelTarget] = useState<{ id: string; patientName: string } | null>(null)
  const [cancelStep, setCancelStep] = useState<"confirm" | "reason">("confirm")
  const [cancelReason, setCancelReason] = useState("")
  const [cancelOtherText, setCancelOtherText] = useState("")
  const [isCancelling, setIsCancelling] = useState(false)

  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 60_000)
    return () => clearInterval(interval)
  }, [])

  const dateString = toLocalDateString(selectedDate)
  const todayString = toLocalDateString(new Date())
  const isPastDate = dateString < todayString

  const { appointments, isLoading, error, mutate } = useAppointments({ date: dateString })

  const weekDays = getWeekDays(selectedDate)
  const weekStart = toLocalDateString(weekDays[0])
  const weekEnd = toLocalDateString(weekDays[6])
  const monthDays = getMonthDays(selectedDate)
  const monthStart = toLocalDateString(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1))
  const monthEnd = toLocalDateString(new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0))

  const { data: weekData } = useSWR(
    viewMode === "week" ? `/api/appointments?startDate=${weekStart}&endDate=${weekEnd}` : null,
    (url: string) => fetch(url).then(r => r.json())
  )
  const weekAppointments: any[] = weekData?.data || []

  const { data: monthData } = useSWR(
    viewMode === "month" ? `/api/appointments?startDate=${monthStart}&endDate=${monthEnd}` : null,
    (url: string) => fetch(url).then(r => r.json())
  )
  const monthAppointments: any[] = monthData?.data || []

  const { patients } = usePatients()
  const { data: staffRes } = useSWR("/api/clinic-staff", (url: string) => fetch(url).then(r => r.json()))
  const staff = staffRes?.data || []
  const { data: settingsRes } = useSWR("/api/clinic-settings", (url: string) => fetch(url).then(r => r.json()))
  const closingHour: number = settingsRes?.data?.working_hours?.end
    ? parseInt(settingsRes.data.working_hours.end.split(":")[0])
    : DEFAULT_CLOSING_HOUR

  const [newAppointment, setNewAppointment] = useState({
    patient_id: "", procedure_type: "Consulta", time: "",
    duration_minutes: 60, notes: "", doctor_name: "",
  })

  const resetForm = () => {
    setNewAppointment({ patient_id: "", procedure_type: "Consulta", time: "", duration_minutes: 60, notes: "", doctor_name: "" })
    setFormError(null)
  }

  const getCurrentTimeString = () => {
    const now = new Date()
    return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`
  }

  const handleCreateAppointment = async () => {
    setFormError(null)
    if (!newAppointment.patient_id) { setFormError("Selecione um paciente."); return }
    if (!newAppointment.time) { setFormError("Informe o horário."); return }
    if (!newAppointment.doctor_name?.trim()) { setFormError("Informe o dentista responsável."); return }
    if (dateString < todayString) { setFormError("Não é possível agendar em datas passadas."); return }
    if (dateString === todayString) {
      const now = new Date()
      const nowMinutes = now.getHours() * 60 + now.getMinutes()
      if (timeToMinutes(newAppointment.time) <= nowMinutes) {
        setFormError("Não é possível agendar para um horário que já passou.")
        return
      }
    }
    setIsCreating(true)
    try {
      await createAppointment({
        patient_id: newAppointment.patient_id,
        date: dateString,
        time: newAppointment.time,
        duration_minutes: newAppointment.duration_minutes,
        procedure_type: newAppointment.procedure_type,
        notes: newAppointment.notes,
        doctor_name: newAppointment.doctor_name.trim(),
        status: "Pendente",
      } as any)
      toast.success("Consulta agendada com sucesso!")
      mutate()
      setIsDialogOpen(false)
      resetForm()
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao agendar"
      setFormError(message)
      toast.error(message)
    } finally {
      setIsCreating(false)
    }
  }

  const handleUpdateStatus = useCallback(async (id: string, status: string) => {
    try {
      await updateAppointment(id, { status } as any)
      mutate()
    } catch {
      toast.error("Erro ao atualizar status")
    }
  }, [mutate])

  const handleAutoMissed = useCallback(async (id: string) => {
    try {
      await updateAppointment(id, { status: "Falta" } as any)
      mutate()
    } catch { }
  }, [mutate])

  const handleIniciar = async (appointment: any) => {
    await handleUpdateStatus(appointment.id, "Em Andamento")
    router.push(`/prontuario/${appointment.patient_id}`)
  }

  const openCancelModal = (id: string, patientName: string) => {
    setCancelTarget({ id, patientName })
    setCancelStep("confirm")
    setCancelReason("")
    setCancelOtherText("")
  }

  const handleCancelConfirm = () => setCancelStep("reason")

  const handleCancelFinish = async () => {
    if (!cancelTarget || !cancelReason) { toast.error("Selecione um motivo."); return }
    setIsCancelling(true)
    try {
      const notes = cancelReason === "Outros" && cancelOtherText
        ? `Cancelado: Outros — ${cancelOtherText}`
        : `Cancelado: ${cancelReason}`
      await updateAppointment(cancelTarget.id, { status: "Cancelada", notes } as any)
      toast.success("Consulta cancelada.")
      mutate()
      setCancelTarget(null)
    } catch {
      toast.error("Erro ao cancelar.")
    } finally {
      setIsCancelling(false)
    }
  }

  const formatTime = (t: string) => t ? t.substring(0, 5) : "--:--"
  const formatDisplayDate = (date: Date) =>
    date.toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" })
  const formatWeekday = (date: Date) =>
    date.toLocaleDateString("pt-BR", { weekday: "long" })
  const formatShortWeekday = (date: Date) =>
    date.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "")
  const formatMonthYear = (date: Date) =>
    date.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })

  const navigateDate = (direction: "prev" | "next") => {
    const d = new Date(selectedDate)
    const delta = direction === "next" ? 1 : -1
    if (viewMode === "day") d.setDate(d.getDate() + delta)
    else if (viewMode === "week") d.setDate(d.getDate() + delta * 7)
    else d.setMonth(d.getMonth() + delta)
    setSelectedDate(d)
  }

  const getStatusBadge = (status: string) => {
    const map: Record<string, string> = {
      "Confirmada": "bg-green-100 text-green-800",
      "Pendente": "bg-blue-100 text-blue-800",
      "Atrasado": "bg-yellow-100 text-yellow-800",
      "Em Andamento": "bg-yellow-100 text-yellow-800",
      "Concluída": "bg-gray-100 text-gray-800",
      "Cancelada": "bg-red-100 text-red-800",
      "Falta": "bg-orange-100 text-orange-800",
    }
    return <Badge className={map[status] || ""}>{status}</Badge>
  }

  const confirmedCount = appointments?.filter(a => a.status === "Confirmada").length || 0
  const pendingCount = appointments?.filter(a => a.status === "Pendente" || a.status === "Atrasado").length || 0
  const cancelledCount = appointments?.filter(a => a.status === "Cancelada" || a.status === "Falta").length || 0
  const occupancyRate = appointments ? Math.round((appointments.length / 8) * 100) : 0
  const occupancyWidth = Math.min(occupancyRate, 100)

  const navTitle = viewMode === "day"
    ? `${formatDisplayDate(selectedDate)} · ${formatWeekday(selectedDate)}`
    : viewMode === "week"
    ? `${weekDays[0].getDate()} – ${weekDays[6].getDate()} de ${weekDays[6].toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}`
    : formatMonthYear(selectedDate)

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-muted-foreground">Erro ao carregar agenda. Faça login para continuar.</p>
        <Link href="/auth/login"><Button className="mt-4">Fazer Login</Button></Link>
      </div>
    )
  }

  const WeekView = () => (
    <div className="grid grid-cols-7 gap-2">
      {weekDays.map((day) => {
        const ds = toLocalDateString(day)
        const isToday = ds === todayString
        const isPast = ds < todayString
        const dayAppts = weekAppointments.filter((a: any) => a.date === ds)
        return (
          <div key={ds} className="flex flex-col gap-1">
            <button onClick={() => { setSelectedDate(day); setViewMode("day") }}
              className={`rounded-lg p-2 text-center transition-colors hover:bg-muted ${isToday ? "bg-primary text-primary-foreground" : "bg-muted/40"}`}>
              <div className="text-xs font-medium capitalize">{formatShortWeekday(day)}</div>
              <div className={`text-lg font-bold ${isToday ? "" : isPast ? "text-muted-foreground" : "text-foreground"}`}>{day.getDate()}</div>
            </button>
            <div className="flex flex-col gap-1 min-h-[80px]">
              {dayAppts.length === 0 ? (
                <div className="rounded border border-dashed border-border p-1 text-center text-xs text-muted-foreground">—</div>
              ) : (
                dayAppts.slice(0, 3).map((appt: any) => (
                  <button key={appt.id} onClick={() => { setSelectedDate(day); setViewMode("day") }}
                    className="rounded bg-primary/10 border border-primary/20 px-1.5 py-1 text-left hover:bg-primary/20 transition-colors">
                    <div className="text-xs font-medium text-foreground truncate">{formatTime(appt.time)}</div>
                    <div className="text-xs text-muted-foreground truncate">{appt.patient?.full_name || "—"}</div>
                  </button>
                ))
              )}
              {dayAppts.length > 3 && (
                <button onClick={() => { setSelectedDate(day); setViewMode("day") }}
                  className="text-xs text-primary hover:underline text-center">+{dayAppts.length - 3} mais</button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )

  const MonthView = () => {
    const weekdayLabels = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"]
    return (
      <div>
        <div className="grid grid-cols-7 gap-1 mb-1">
          {weekdayLabels.map(d => (
            <div key={d} className="text-center text-xs font-medium text-muted-foreground py-1">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {monthDays.map((day, idx) => {
            if (!day) return <div key={`empty-${idx}`} />
            const ds = toLocalDateString(day)
            const isToday = ds === todayString
            const isPast = ds < todayString
            const dayAppts = monthAppointments.filter((a: any) => a.date === ds)
            return (
              <button key={ds} onClick={() => { setSelectedDate(day); setViewMode("day") }}
                className={`rounded-lg p-1.5 text-left transition-colors min-h-[64px] hover:bg-muted ${
                  isToday ? "bg-primary/10 border border-primary ring-1 ring-primary/40"
                  : isPast ? "bg-muted/20 opacity-60" : "bg-muted/30"
                }`}>
                <div className={`text-sm font-semibold mb-1 ${isToday ? "text-primary" : isPast ? "text-muted-foreground" : "text-foreground"}`}>
                  {day.getDate()}
                </div>
                {dayAppts.length > 0 && (
                  <div className="flex flex-col gap-0.5">
                    {dayAppts.slice(0, 2).map((appt: any) => (
                      <div key={appt.id} className="rounded bg-primary/20 px-1 text-xs text-foreground truncate">
                        {formatTime(appt.time)} {appt.patient?.full_name?.split(" ")[0] || ""}
                      </div>
                    ))}
                    {dayAppts.length > 2 && <div className="text-xs text-primary font-medium">+{dayAppts.length - 2}</div>}
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  // ── Popover de edição de valor ────────────────────────────────────────────
  const ValueEditor = ({ appointment }: { appointment: any }) => {
    const [open, setOpen] = useState(false)
    const [cost, setCost] = useState(appointment.cost?.toString() || "")
    const [paymentMethod, setPaymentMethod] = useState(appointment.payment_method || "")
    const [saving, setSaving] = useState(false)

    const handleSave = async () => {
      setSaving(true)
      try {
        await updateAppointment(appointment.id, {
          cost: cost ? Number(cost) : null,
          payment_method: paymentMethod || null,
        } as any)
        toast.success("Valor atualizado!")
        mutate()
        setOpen(false)
      } catch {
        toast.error("Erro ao salvar valor.")
      } finally {
        setSaving(false)
      }
    }

    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button className="flex items-center gap-1 group hover:text-primary transition-colors">
            <span className="text-sm font-medium">
              {appointment.cost ? formatCurrency(appointment.cost) : <span className="text-muted-foreground text-xs">Adicionar valor</span>}
            </span>
            <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-60 transition-opacity" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-4" align="end">
          <div className="space-y-3">
            <p className="text-sm font-medium text-foreground">Editar valor</p>
            <div className="grid gap-1.5">
              <Label className="text-xs">Valor (R$)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="0,00"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Forma de pagamento</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button size="sm" className="flex-1 h-7 text-xs" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Check className="h-3 w-3 mr-1" />Salvar</>}
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-xs bg-transparent" onClick={() => setOpen(false)}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    )
  }

  // ── Linha da tabela ───────────────────────────────────────────────────────
  const AppointmentRow = ({ appointment }: { appointment: any }) => {
    const isActiveStatus = appointment.status === "Pendente" || appointment.status === "Confirmada" || appointment.status === "Atrasado"
    const timeStatus = isActiveStatus
      ? getAppointmentTimeStatus(appointment.date, appointment.time, closingHour)
      : "ok"

    if (timeStatus === "missed" && isActiveStatus) handleAutoMissed(appointment.id)

    const currentStatus = timeStatus === "late" && appointment.status !== "Atrasado" && isActiveStatus
      ? "Atrasado" : appointment.status

    if (currentStatus === "Atrasado" && appointment.status !== "Atrasado") {
      handleUpdateStatus(appointment.id, "Atrasado")
    }

    const rowBg = timeStatus === "missed"
      ? "bg-orange-50 dark:bg-orange-950/20"
      : timeStatus === "late" || currentStatus === "Atrasado"
      ? "bg-yellow-50 dark:bg-yellow-950/20"
      : ""

    const canStart = !["Concluída","Cancelada","Falta","Em Andamento"].includes(appointment.status) && timeStatus !== "missed"
    const canCancel = !["Concluída","Cancelada","Falta"].includes(appointment.status)

    return (
      <tr className={`border-b border-border transition-colors ${rowBg}`}>
        {/* Horário */}
        <td className="py-3 px-4 text-sm font-medium text-foreground whitespace-nowrap">
          <div className="flex items-center gap-1">
            {formatTime(appointment.time)}
            {(timeStatus === "late" || currentStatus === "Atrasado") && (
              <AlertTriangle className="h-3 w-3 text-yellow-600" />
            )}
          </div>
        </td>
        {/* Paciente */}
        <td className="py-3 px-4 text-sm text-foreground">{appointment.patient?.full_name || "—"}</td>
        {/* Profissional */}
        <td className="py-3 px-4 text-sm text-muted-foreground">
          {appointment.doctor_name ? `Dr(a). ${appointment.doctor_name}` : "—"}
        </td>
        {/* Status dropdown */}
        <td className="py-3 px-4">
          <Select
            value={appointment.status}
            onValueChange={(val) => {
              if (val === "Cancelada") {
                openCancelModal(appointment.id, appointment.patient?.full_name || "Paciente")
              } else {
                handleUpdateStatus(appointment.id, val)
              }
            }}
          >
            <SelectTrigger className="h-7 w-36 text-xs border-0 bg-transparent p-0 shadow-none focus:ring-0">
              <SelectValue>{getStatusBadge(appointment.status)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.filter(o => o.value !== "Cancelada" || canCancel).map(o => (
                <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </td>
        {/* Valor — clicável */}
        <td className="py-3 px-4">
          <ValueEditor appointment={appointment} />
        </td>
        {/* Ação */}
        <td className="py-3 px-4 text-right">
          {canStart && (
            <Button size="sm" onClick={() => handleIniciar(appointment)}>Iniciar</Button>
          )}
          {appointment.status === "Em Andamento" && (
            <div className="flex items-center justify-end gap-2">
              <Badge className="bg-yellow-100 text-yellow-800 animate-pulse text-xs">Em atendimento</Badge>
              <Button size="sm" className="bg-success text-white hover:bg-success/90"
                onClick={() => handleUpdateStatus(appointment.id, "Concluída")}>
                Encerrar
              </Button>
            </div>
          )}
          {appointment.status === "Concluída" && <Badge className="bg-gray-100 text-gray-800">Encerrado</Badge>}
          {appointment.status === "Cancelada" && <Badge className="bg-red-100 text-red-800">Cancelada</Badge>}
          {appointment.status === "Falta" && <Badge className="bg-orange-100 text-orange-800">Falta</Badge>}
        </td>
      </tr>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Agenda Inteligente</h1>
        <p className="text-muted-foreground">Gerencie consultas com sugestões automáticas</p>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <Button variant="outline" size="icon" className="bg-transparent" onClick={() => navigateDate("prev")}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                <span className="text-base font-semibold text-foreground capitalize">{navTitle}</span>
              </div>
              <Button variant="outline" size="icon" className="bg-transparent" onClick={() => navigateDate("next")}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex gap-2">
              {(["day", "week", "month"] as const).map((mode) => (
                <Button key={mode} variant={viewMode === mode ? "default" : "outline"} size="sm"
                  onClick={() => setViewMode(mode)} className={viewMode !== mode ? "bg-transparent" : ""}>
                  {mode === "day" ? "Dia" : mode === "week" ? "Semana" : "Mês"}
                </Button>
              ))}
            </div>
            <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm() }}>
              <DialogTrigger asChild>
                <Button className="gap-2" disabled={isPastDate && viewMode === "day"}>
                  <Plus className="h-4 w-4" />Novo Agendamento
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>Novo Agendamento</DialogTitle>
                  <DialogDescription>Agende uma nova consulta para {formatDisplayDate(selectedDate)}</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  {formError && (
                    <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span>{formError}</span>
                    </div>
                  )}
                  <div className="grid gap-2">
                    <Label>Paciente *</Label>
                    <Select value={newAppointment.patient_id} onValueChange={(v) => setNewAppointment({ ...newAppointment, patient_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Selecione um paciente" /></SelectTrigger>
                      <SelectContent>{patients?.map(p => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Procedimento *</Label>
                    <Select value={newAppointment.procedure_type} onValueChange={(v) => setNewAppointment({ ...newAppointment, procedure_type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["Consulta","Limpeza","Tratamento","Cirurgia","Emergencia","Retorno"].map(p => (
                          <SelectItem key={p} value={p}>{p}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label>Horário *</Label>
                      <Input type="time" value={newAppointment.time}
                        min={dateString === todayString ? getCurrentTimeString() : undefined}
                        onChange={(e) => setNewAppointment({ ...newAppointment, time: e.target.value })} />
                    </div>
                    <div className="grid gap-2">
                      <Label>Duração (min)</Label>
                      <Input type="number" min={1} value={newAppointment.duration_minutes}
                        onChange={(e) => setNewAppointment({ ...newAppointment, duration_minutes: Math.max(1, parseInt(e.target.value) || 60) })} />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label>Dentista Responsável *</Label>
                    {staff.length > 0 ? (
                      <Select value={newAppointment.doctor_name} onValueChange={(v) => setNewAppointment({ ...newAppointment, doctor_name: v })}>
                        <SelectTrigger><SelectValue placeholder="Selecione o dentista" /></SelectTrigger>
                        <SelectContent>
                          {staff.filter((s: any) => s.is_active).map((s: any) => (
                            <SelectItem key={s.id} value={s.full_name}>{s.full_name} - {s.specialty || s.role}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input placeholder="Nome do dentista (obrigatório)" value={newAppointment.doctor_name}
                        onChange={(e) => setNewAppointment({ ...newAppointment, doctor_name: e.target.value })} />
                    )}
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => { setIsDialogOpen(false); resetForm() }}>Cancelar</Button>
                  <Button onClick={handleCreateAppointment} disabled={isCreating}>
                    {isCreating ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Agendando...</> : "Agendar"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>

      {/* Modal de cancelamento */}
      <Dialog open={!!cancelTarget} onOpenChange={(open) => { if (!open) setCancelTarget(null) }}>
        <DialogContent className="sm:max-w-[400px]">
          {cancelStep === "confirm" ? (
            <>
              <DialogHeader>
                <DialogTitle>Cancelar consulta</DialogTitle>
                <DialogDescription>
                  Tem certeza que deseja cancelar a consulta de <strong>{cancelTarget?.patientName}</strong>?
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCancelTarget(null)}>Não, voltar</Button>
                <Button variant="destructive" onClick={handleCancelConfirm}>Sim, cancelar</Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Motivo do cancelamento</DialogTitle>
                <DialogDescription>Selecione o motivo para registrar no histórico.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-3 py-2">
                <Select value={cancelReason} onValueChange={setCancelReason}>
                  <SelectTrigger><SelectValue placeholder="Selecione um motivo" /></SelectTrigger>
                  <SelectContent>
                    {CANCEL_REASONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
                {cancelReason === "Outros" && (
                  <Textarea placeholder="Descreva o motivo (opcional)..." value={cancelOtherText}
                    onChange={(e) => setCancelOtherText(e.target.value)} className="resize-none" rows={3} />
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCancelTarget(null)}>Voltar</Button>
                <Button variant="destructive" onClick={handleCancelFinish} disabled={isCancelling || !cancelReason}>
                  {isCancelling ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Cancelando...</> : "Confirmar cancelamento"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {viewMode === "week" && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Visão Semanal</CardTitle></CardHeader>
          <CardContent><WeekView /></CardContent>
        </Card>
      )}

      {viewMode === "month" && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base capitalize">{formatMonthYear(selectedDate)}</CardTitle></CardHeader>
          <CardContent><MonthView /></CardContent>
        </Card>
      )}

      {viewMode === "day" && (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Consultas do Dia</CardTitle>
                  <span className="text-sm text-muted-foreground">
                    {isLoading ? "..." : `${appointments?.length || 0} agendamentos`}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : !appointments || appointments.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">Nenhuma consulta agendada para este dia</p>
                    {!isPastDate && (
                      <Button className="mt-4 bg-transparent" variant="outline" onClick={() => setIsDialogOpen(true)}>
                        <Plus className="h-4 w-4 mr-2" />Agendar Consulta
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-muted/50">
                          <th className="py-2 px-4 text-left text-xs font-medium text-muted-foreground">Horário</th>
                          <th className="py-2 px-4 text-left text-xs font-medium text-muted-foreground">Paciente</th>
                          <th className="py-2 px-4 text-left text-xs font-medium text-muted-foreground">Profissional</th>
                          <th className="py-2 px-4 text-left text-xs font-medium text-muted-foreground">Status</th>
                          <th className="py-2 px-4 text-left text-xs font-medium text-muted-foreground">Valor</th>
                          <th className="py-2 px-4 text-right text-xs font-medium text-muted-foreground"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {appointments.map(appt => <AppointmentRow key={appt.id} appointment={appt} />)}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle className="text-base">Estatísticas do Dia</CardTitle>
                <Link href="/relatorios" className="text-xs text-primary hover:underline">Ver relatório →</Link>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Taxa de Ocupação</span>
                  <span className={`text-sm font-semibold ${occupancyRate > 100 ? "text-orange-500" : "text-foreground"}`}>
                    {occupancyRate}%{occupancyRate > 100 ? " ⚠️" : ""}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div className={`h-full transition-all ${occupancyRate > 100 ? "bg-orange-500" : "bg-success"}`}
                    style={{ width: `${occupancyWidth}%` }} />
                </div>
                <div className="pt-2 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Total de Consultas</span>
                    <span className="text-sm font-semibold">{appointments?.length || 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Confirmadas</span>
                    <Badge className="bg-success/10 text-success">{confirmedCount}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Pendentes</span>
                    <Badge className="bg-warning/10 text-warning">{pendingCount}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Canceladas/Falta</span>
                    <Badge className="bg-red-100 text-red-700">{cancelledCount}</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Sugestões Inteligentes</CardTitle>
                <p className="text-xs text-muted-foreground">Horários otimizados para agendamento</p>
              </CardHeader>
              <CardContent className="space-y-2">
                {[{ time: "11:30", label: "Horário livre - Alta demanda" }, { time: "13:00", label: "Horário otimizado para retornos" }].map(({ time, label }) => (
                  <div key={time} className="rounded-lg bg-purple-600/10 border border-purple-600/20 p-3">
                    <p className="text-sm font-medium text-foreground">{time}</p>
                    <p className="text-xs text-muted-foreground mt-1">{label}</p>
                    <Button variant="outline" size="sm" className="mt-2 h-7 text-xs bg-transparent" disabled={isPastDate}
                      onClick={() => { setNewAppointment({ ...newAppointment, time }); setIsDialogOpen(true) }}>
                      Agendar
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}