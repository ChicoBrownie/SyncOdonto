"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Calendar, ChevronLeft, ChevronRight, Plus, Loader2, AlertCircle, AlertTriangle, CalendarClock, Trash2 } from "lucide-react"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import useSWR from "swr"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { getDailyWorkingHours, getWeekGridHours, isWithinWorkingHours, type WorkingHours } from "@/lib/appointments/working-hours"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Checkbox } from "@/components/ui/checkbox"

const NON_RESCHEDULABLE_STATUSES = ["Em Andamento", "Concluída", "Cancelada", "Falta"]
type AgendaBlock = { id: string; title: string; scope: "dentist" | "clinic"; doctor_name: string | null; resource_name: string | null; notes: string | null; date: string; start_time: string | null; end_time: string | null; all_day: boolean }

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

function formatMinutes(minutes: number): string {
  const inDay = ((minutes % 1440) + 1440) % 1440
  return `${String(Math.floor(inDay / 60)).padStart(2, "0")}:${String(inDay % 60).padStart(2, "0")}`
}

function appointmentColor(name: string): string {
  const colors = [
    "border-l-sky-500 bg-sky-100 text-sky-950",
    "border-l-emerald-500 bg-emerald-100 text-emerald-950",
    "border-l-violet-500 bg-violet-100 text-violet-950",
    "border-l-amber-500 bg-amber-100 text-amber-950",
    "border-l-rose-500 bg-rose-100 text-rose-950",
  ]
  const hash = Array.from(name || "Paciente").reduce((sum, char) => sum + char.charCodeAt(0), 0)
  return colors[hash % colors.length]
}

function layoutAppointments(appointments: any[]) {
  const sorted = [...appointments].sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time))
  const groups: any[][] = []
  let groupEnd = -1
  for (const appointment of sorted) {
    const start = timeToMinutes(appointment.time)
    const end = start + Math.max(15, Number(appointment.duration_minutes) || 60)
    if (!groups.length || start >= groupEnd) {
      groups.push([])
      groupEnd = end
    } else {
      groupEnd = Math.max(groupEnd, end)
    }
    groups[groups.length - 1].push(appointment)
  }
  return groups.flatMap(group => {
    const columnsEnd: number[] = []
    const positioned = group.map(appointment => {
      const start = timeToMinutes(appointment.time)
      const free = columnsEnd.findIndex(end => end <= start)
      const column = free < 0 ? columnsEnd.length : free
      columnsEnd[column] = start + Math.max(15, Number(appointment.duration_minutes) || 60)
      return { appointment, column }
    })
    return positioned.map(item => ({ ...item, columns: columnsEnd.length }))
  })
}

type AppointmentTimeStatus = "ok" | "late" | "missed"

function getAppointmentTimeStatus(
  appointmentDate: string,
  appointmentTime: string
): AppointmentTimeStatus {
  const now = new Date()
  const todayString = toLocalDateString(now)
  if (appointmentDate !== todayString) {
    return "ok"
  }
  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  const apptMinutes = timeToMinutes(appointmentTime)
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
  { value: "Aguardando", label: "Aguardando" },
  { value: "Atrasado", label: "Atrasado" },
  { value: "Em Andamento", label: "Em Andamento" },
  { value: "Concluída", label: "Concluída" },
  { value: "Cancelada", label: "Cancelada" },
  { value: "Falta", label: "Falta" },
]

export function AgendaView() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const targetAppointmentId = searchParams.get("appointmentId")
  const targetDate = searchParams.get("date")
  const validTargetDate = targetDate && /^\d{4}-\d{2}-\d{2}$/.test(targetDate) ? targetDate : null
  const [selectedDate, setSelectedDate] = useState(() => validTargetDate ? new Date(`${validTargetDate}T12:00:00`) : new Date())
  const [viewMode, setViewMode] = useState<"day" | "week" | "custom">(validTargetDate ? "day" : "week")
  useEffect(() => {
    if (validTargetDate) {
      setSelectedDate(new Date(`${validTargetDate}T12:00:00`))
      setViewMode("day")
    }
  }, [validTargetDate])
  const [customStart, setCustomStart] = useState(toLocalDateString(new Date()))
  const [customEnd, setCustomEnd] = useState(toLocalDateString(new Date()))
  const [datePickerOpen, setDatePickerOpen] = useState(false)
  const [jumpDate, setJumpDate] = useState(toLocalDateString(new Date()))
  const [rangeStart, setRangeStart] = useState(toLocalDateString(new Date()))
  const [rangeEnd, setRangeEnd] = useState(toLocalDateString(new Date()))
  const [movingId, setMovingId] = useState<string | null>(null)
  const [movingBusy, setMovingBusy] = useState(false)
  const [optimisticMoves, setOptimisticMoves] = useState<Record<string, { date: string; time: string }>>({})
  const weekPanRef = useRef<{ pointerId: number; startX: number; startScrollLeft: number; moved: boolean } | null>(null)
  const suppressWeekClickRef = useRef(false)
  const [detailsId, setDetailsId] = useState<string | null>(null)
  const [detailDate, setDetailDate] = useState("")
  const [detailTime, setDetailTime] = useState("")
  const [detailProcedure, setDetailProcedure] = useState("")
  const [detailDoctor, setDetailDoctor] = useState("")
  const [detailError, setDetailError] = useState<string | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isBlockDialogOpen, setIsBlockDialogOpen] = useState(false)
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null)
  const [isSavingBlock, setIsSavingBlock] = useState(false)
  const [blockError, setBlockError] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [, setTick] = useState(0)

  // Modal de cancelamento
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
  const { appointments, isLoading, error, mutate } = useAppointments({ date: dateString, enabled: viewMode === "day" })
  const appointmentsList: any[] = (appointments as any[]) || []
  useEffect(() => {
    if (!targetAppointmentId || isLoading || !appointmentsList.some(appt => appt.id === targetAppointmentId)) return
    const frame = requestAnimationFrame(() => {
      const matches = document.querySelectorAll<HTMLElement>(`[data-agenda-appointment="${CSS.escape(targetAppointmentId)}"]`)
      const visible = [...matches].find(node => node.getClientRects().length > 0)
      visible?.scrollIntoView({ block: "center", behavior: "smooth" })
    })
    return () => cancelAnimationFrame(frame)
  }, [appointmentsList, isLoading, targetAppointmentId])

  const weekDays = getWeekDays(selectedDate)
  const weekStart = toLocalDateString(weekDays[0])
  const weekEnd = toLocalDateString(weekDays[6])
  const { data: weekData, mutate: mutateWeek } = useSWR(
    viewMode === "week" ? `/api/appointments?startDate=${weekStart}&endDate=${weekEnd}` : null,
    (url: string) => fetch(url).then(r => r.json())
  )
  const { data: blocksRes, mutate: mutateBlocks } = useSWR(`/api/agenda-blocks?startDate=${weekStart}&endDate=${weekEnd}`, (url: string) => fetch(url).then(r => r.json()))
  const agendaBlocks: AgendaBlock[] = blocksRes?.data || []
  const weekAppointments: any[] = (weekData?.data || []).map((item: any) => optimisticMoves[item.id] ? { ...item, ...optimisticMoves[item.id] } : item)
  const detailAppointment = weekAppointments.find(a => a.id === detailsId)

  const { data: customData } = useSWR(viewMode === "custom" && customStart <= customEnd ? `/api/appointments?startDate=${customStart}&endDate=${customEnd}` : null, (url: string) => fetch(url).then(r => r.json()))
  const customAppointments: any[] = customData?.data || []

  const { patients } = usePatients(undefined, undefined, undefined, isDialogOpen)
  const { data: staffRes } = useSWR(isDialogOpen || isBlockDialogOpen ? "/api/clinic-staff" : null, (url: string) => fetch(url).then(r => r.json()))
  const staff = staffRes?.data || []
  const { data: settingsRes } = useSWR(viewMode === "week" ? "/api/clinic-settings/working-hours" : null, (url: string) => fetch(url).then(r => r.json()))
  const workingHours: WorkingHours | null = settingsRes?.data ?? null

  const [newAppointment, setNewAppointment] = useState({
    patient_id: "", procedure_type: "Consulta", date: toLocalDateString(new Date()), time: "",
    duration_minutes: 60, notes: "", doctor_name: "",
  })
  const [blockForm, setBlockForm] = useState({ title: "", scope: "dentist" as "dentist" | "clinic", doctor_name: "", resource_name: "", notes: "", date: dateString, start_time: "08:00", end_time: "09:00", all_day: false })

  const startNewBlock = () => {
    setEditingBlockId(null)
    setBlockError(null)
    setBlockForm({ title: "", scope: "dentist", doctor_name: "", resource_name: "", notes: "", date: dateString, start_time: "08:00", end_time: "09:00", all_day: false })
    setIsBlockDialogOpen(true)
  }

  const editBlock = (block: AgendaBlock) => {
    setEditingBlockId(block.id)
    setBlockError(null)
    setBlockForm({ title: block.title, scope: block.scope, doctor_name: block.doctor_name || "", resource_name: block.resource_name || "", notes: block.notes || "", date: block.date, start_time: block.start_time?.slice(0, 5) || "08:00", end_time: block.end_time?.slice(0, 5) || "09:00", all_day: block.all_day })
    setIsBlockDialogOpen(true)
  }

  const saveBlock = async () => {
    setBlockError(null)
    if (blockForm.title.trim().length < 2) { setBlockError("Informe o nome do compromisso."); return }
    if (blockForm.scope === "dentist" && !blockForm.doctor_name) { setBlockError("Selecione o dentista."); return }
    if (!blockForm.all_day && blockForm.end_time <= blockForm.start_time) { setBlockError("O horário final precisa ser posterior ao inicial."); return }
    setIsSavingBlock(true)
    try {
      const response = await fetch(editingBlockId ? `/api/agenda-blocks/${editingBlockId}` : "/api/agenda-blocks", {
        method: editingBlockId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...blockForm, start_time: blockForm.all_day ? null : blockForm.start_time, end_time: blockForm.all_day ? null : blockForm.end_time }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "Não foi possível salvar o compromisso.")
      await mutateBlocks()
      setIsBlockDialogOpen(false)
      toast.success(editingBlockId ? "Compromisso atualizado." : "Compromisso reservado na agenda.")
    } catch (error) {
      setBlockError(error instanceof Error ? error.message : "Não foi possível salvar o compromisso.")
    } finally {
      setIsSavingBlock(false)
    }
  }

  const deleteBlock = async () => {
    if (!editingBlockId || !window.confirm("Excluir este compromisso da agenda?")) return
    setIsSavingBlock(true)
    try {
      const response = await fetch(`/api/agenda-blocks/${editingBlockId}`, { method: "DELETE" })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "Não foi possível excluir o compromisso.")
      await mutateBlocks()
      setIsBlockDialogOpen(false)
      toast.success("Compromisso removido da agenda.")
    } catch (error) {
      setBlockError(error instanceof Error ? error.message : "Não foi possível excluir o compromisso.")
    } finally {
      setIsSavingBlock(false)
    }
  }

  const resetForm = () => {
    setNewAppointment({ patient_id: "", procedure_type: "Consulta", date: dateString, time: "", duration_minutes: 60, notes: "", doctor_name: "" })
    setFormError(null)
  }

  const refreshAppointments = useCallback(async () => {
    await Promise.all([mutate(), mutateWeek()])
  }, [mutate, mutateWeek])

  const handleCreateAppointment = async () => {
    setFormError(null)
    if (!newAppointment.patient_id) { setFormError("Selecione um paciente."); return }
    if (!newAppointment.date) { setFormError("Escolha o dia da consulta."); return }
    if (!newAppointment.time) { setFormError("Informe o horário."); return }
    if (!newAppointment.doctor_name?.trim()) { setFormError("Informe o dentista responsável."); return }
    setIsCreating(true)
    try {
      await createAppointment({
        patient_id: newAppointment.patient_id,
        date: newAppointment.date,
        time: newAppointment.time,
        duration_minutes: newAppointment.duration_minutes,
        procedure_type: newAppointment.procedure_type,
        notes: newAppointment.notes,
        doctor_name: newAppointment.doctor_name.trim(),
        status: "Pendente",
      } as any)
      toast.success("Consulta agendada com sucesso!")
      if (viewMode === "day" && newAppointment.date === dateString) void mutate()
      setSelectedDate(new Date(`${newAppointment.date}T12:00:00`))
      setViewMode("day")
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
      void refreshAppointments()
    } catch {
      toast.error("Erro ao atualizar status")
    }
  }, [refreshAppointments])

  const moveAppointment = async (id: string, date: string, time: string) => {
    const item = weekAppointments.find(a => a.id === id)
    if (!item || movingBusy) return false
    setMovingId(null)
    if (item.date === date && item.time.slice(0, 5) === time) return true
    setDetailError(null)
    setMovingBusy(true)
    setOptimisticMoves(current => ({ ...current, [id]: { date, time } }))
    try {
      await updateAppointment(id, { date, time } as any)
      await refreshAppointments()
      return true
    } catch (error) {
      const message = error instanceof Error ? error.message : "Não foi possível remarcar. Confira o horário."
      if (detailsId === id) setDetailError(message)
      toast.error(message)
      return false
    }
    finally {
      setOptimisticMoves(current => {
        const next = { ...current }
        delete next[id]
        return next
      })
      setMovingBusy(false)
    }
  }

  const openDetails = (appointment: any) => {
    setDetailsId(appointment.id)
    setDetailDate(appointment.date)
    setDetailTime(appointment.time.slice(0, 5))
    setDetailProcedure(appointment.procedure_type || "Consulta")
    setDetailDoctor(appointment.doctor_name || "")
    setDetailError(null)
  }

  const saveAppointmentDetails = async () => {
    if (!detailAppointment || movingBusy) return
    const procedure = detailProcedure.trim()
    const doctor = detailDoctor.trim()
    if (!procedure || doctor.length < 2 || !detailDate || !detailTime) {
      setDetailError("Informe procedimento, dentista, data e horário válidos.")
      return
    }
    const changes: Record<string, string> = {}
    if (procedure !== detailAppointment.procedure_type) changes.procedure_type = procedure
    if (doctor !== detailAppointment.doctor_name) changes.doctor_name = doctor
    if (detailDate !== detailAppointment.date) changes.date = detailDate
    if (detailTime !== detailAppointment.time.slice(0, 5)) changes.time = detailTime
    if (!Object.keys(changes).length) { setDetailsId(null); return }
    setDetailError(null)
    setMovingBusy(true)
    try {
      await updateAppointment(detailAppointment.id, changes as any)
      await refreshAppointments()
      toast.success("Consulta atualizada.")
      setDetailsId(null)
    } catch (error) {
      setDetailError(error instanceof Error ? error.message : "Não foi possível atualizar a consulta.")
    } finally {
      setMovingBusy(false)
    }
  }

  const scheduleAgain = (appointment: any) => {
    setNewAppointment({
      patient_id: appointment.patient_id,
      procedure_type: appointment.procedure_type || "Consulta",
      date: toLocalDateString(new Date()),
      time: "",
      duration_minutes: Number(appointment.duration_minutes) || 60,
      notes: "",
      doctor_name: appointment.doctor_name || "",
    })
    setDetailsId(null)
    setFormError(null)
    setIsDialogOpen(true)
  }

  // Iniciar: atualiza status e redireciona para prontuário
  const handleIniciar = async (appointment: any) => {
    router.push(`/atendimento?patientId=${appointment.patient_id}&appointmentId=${appointment.id}`)
  }

  // Cancelamento com modal
  const openCancelModal = (id: string, patientName: string) => {
    setCancelTarget({ id, patientName })
    setCancelStep("confirm")
    setCancelReason("")
    setCancelOtherText("")
  }

  const handleCancelConfirm = () => setCancelStep("reason")

  const handleCancelFinish = async () => {
    if (!cancelTarget) return
    if (!cancelReason) { toast.error("Selecione um motivo."); return }
    setIsCancelling(true)
    try {
      const notes = cancelReason === "Outros" && cancelOtherText
        ? `Cancelado: Outros — ${cancelOtherText}`
        : `Cancelado: ${cancelReason}`
      await updateAppointment(cancelTarget.id, { status: "Cancelada", notes } as any)
      toast.success("Consulta cancelada.")
      void refreshAppointments()
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
  const navigateDate = (direction: "prev" | "next") => {
    const delta = direction === "next" ? 1 : -1
    if (viewMode === "custom") {
      const start = new Date(`${customStart}T12:00:00`)
      const end = new Date(`${customEnd}T12:00:00`)
      const span = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1)
      start.setDate(start.getDate() + delta * span)
      end.setDate(end.getDate() + delta * span)
      setCustomStart(toLocalDateString(start)); setCustomEnd(toLocalDateString(end))
      return
    }
    const d = new Date(selectedDate)
    if (viewMode === "day") d.setDate(d.getDate() + delta)
    else if (viewMode === "week") d.setDate(d.getDate() + delta * 7)
    else d.setDate(d.getDate() + delta * 7)
    setSelectedDate(d)
  }

  const getStatusBadge = (status: string) => {
    const map: Record<string, string> = {
      "Confirmada": "bg-green-100 text-green-800",
      "Aguardando": "bg-teal-100 text-teal-800",
      "Pendente": "bg-blue-100 text-blue-800",
      "Atrasado": "bg-yellow-100 text-yellow-800",
      "Em Andamento": "bg-yellow-100 text-yellow-800",
      "Concluída": "bg-gray-100 text-gray-800",
      "Cancelada": "bg-red-100 text-red-800",
      "Falta": "bg-orange-100 text-orange-800",
    }
    return <Badge className={map[status] || ""}>{status}</Badge>
  }

  // Comparações tipadas como string explicitamente — o tipo do banco vem em inglês
  // ("active"/"inactive" etc.) mas o app inteiro usa rótulos em português.
  const navTitle = viewMode === "day"
    ? `${formatDisplayDate(selectedDate)} · ${formatWeekday(selectedDate)}`
    : viewMode === "week"
    ? `${weekDays[0].getDate()} – ${weekDays[6].getDate()} de ${weekDays[6].toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}`
    : `${customStart.split("-").reverse().join("/")} – ${customEnd.split("-").reverse().join("/")}`

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-muted-foreground">Erro ao carregar agenda. Faça login para continuar.</p>
        <Link href="/auth/login"><Button className="mt-4">Fazer Login</Button></Link>
      </div>
    )
  }

  const WeekView = () => {
    if (!settingsRes || !weekData) return <div className="flex h-48 items-center justify-center" role="status"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /><span className="sr-only">Carregando agenda</span></div>
    const gridItems = [...weekAppointments, ...agendaBlocks.filter(block => !block.all_day && block.start_time && block.end_time).map(block => ({ time: block.start_time!, duration_minutes: timeToMinutes(block.end_time!) - timeToMinutes(block.start_time!) }))]
    const { firstHour, lastHour } = getWeekGridHours(weekDays, gridItems, workingHours)
    const slotMinutes = 15
    const slotHeight = 74
    const slots = Array.from({ length: Math.max(1, (lastHour - firstHour) * 60 / slotMinutes) }, (_, i) => formatMinutes(firstHour * 60 + i * slotMinutes))
    const gridHeight = slots.length * slotHeight
    const movingAppointment = weekAppointments.find(item => item.id === movingId)

    return <div
      className="overflow-x-auto overscroll-x-contain"
      aria-label="Agenda semanal"
      onPointerDown={event => {
        if (event.pointerType !== "mouse" || event.button !== 0 || movingId || !(event.target as Element).closest("[data-agenda-slot]")) return
        weekPanRef.current = { pointerId: event.pointerId, startX: event.clientX, startScrollLeft: event.currentTarget.scrollLeft, moved: false }
      }}
      onPointerMove={event => {
        const pan = weekPanRef.current
        if (!pan || pan.pointerId !== event.pointerId) return
        const distance = event.clientX - pan.startX
        if (!pan.moved && Math.abs(distance) < 6) return
        if (!pan.moved) {
          pan.moved = true
          event.currentTarget.setPointerCapture(event.pointerId)
        }
        event.currentTarget.scrollLeft = pan.startScrollLeft - distance
        event.preventDefault()
      }}
      onPointerUp={event => {
        const pan = weekPanRef.current
        if (!pan || pan.pointerId !== event.pointerId) return
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
        if (pan.moved) {
          suppressWeekClickRef.current = true
          window.setTimeout(() => { suppressWeekClickRef.current = false }, 0)
        }
        weekPanRef.current = null
      }}
      onPointerCancel={() => { weekPanRef.current = null }}
      onClickCapture={event => {
        if (!suppressWeekClickRef.current) return
        event.preventDefault()
        event.stopPropagation()
        suppressWeekClickRef.current = false
      }}
    >
      <div className="flex w-max min-w-full">
        <div className="sticky left-0 z-20 w-16 shrink-0 bg-card shadow-[1px_0_0_0_var(--border)]">
          <div className="h-12 border-b border-border bg-card" />
          <div className="relative" style={{ height: gridHeight }}>
            {slots.map((slot, index) => <span key={slot} className={`absolute right-2 text-sm text-muted-foreground ${index % 4 ? "opacity-80" : "font-semibold"}`} style={{ top: index * slotHeight + 4 }}>{slot}</span>)}
          </div>
          <div className="relative h-7 border-t border-border"><span className="absolute right-2 top-1 text-sm font-semibold text-muted-foreground">{lastHour === 24 ? "24:00" : formatMinutes(lastHour * 60)}</span></div>
        </div>
        {weekDays.map(day => {
          const ds = toLocalDateString(day)
          const dayHours = getDailyWorkingHours(day, workingHours)
          const dayAppointments = layoutAppointments(weekAppointments.filter(a => a.date === ds))
          return <div key={ds} className={`w-[216px] shrink-0 border-l border-border/70 sm:w-[232px] lg:flex-1 lg:min-w-[176px] ${ds === dateString ? "bg-primary/[0.06]" : ""}`}>
            <button type="button" aria-pressed={ds === dateString} onClick={() => setSelectedDate(day)} className={`sticky top-0 z-10 flex h-12 w-full flex-col items-center justify-center border-b border-border text-base font-semibold capitalize ${ds === dateString ? "bg-primary/15 text-primary ring-2 ring-inset ring-primary" : "bg-card text-foreground hover:bg-muted/70"}`}>
              <span>{formatWeekday(day)}</span><span className="text-sm font-medium">{day.toLocaleDateString("pt-BR", { day: "2-digit", month: "long" })}</span>
            </button>
            <div className="relative" style={{ height: gridHeight }}>
              {slots.map((slot, index) => {
                const startMinutes = firstHour * 60 + index * slotMinutes
                const isOpen = isWithinWorkingHours(day, startMinutes, slotMinutes, workingHours)
                const canMoveHere = isWithinWorkingHours(day, startMinutes, Math.max(15, Number(movingAppointment?.duration_minutes) || 60), workingHours)
                return <button key={slot} data-agenda-slot type="button" aria-label={`${day.toLocaleDateString("pt-BR")} às ${slot}`} disabled={Boolean(movingId) && !canMoveHere} onDragOver={event => { if (movingId && canMoveHere) event.preventDefault() }} onDrop={event => { event.preventDefault(); if (movingId && canMoveHere) void moveAppointment(movingId, ds, slot) }} onClick={() => { if (movingId && canMoveHere) void moveAppointment(movingId, ds, slot) }} className={`absolute inset-x-0 border-t text-left transition-colors ${index % 4 ? "border-border/35" : "border-border/70"} ${isOpen ? movingId ? "cursor-pointer hover:bg-primary/10" : "cursor-grab hover:bg-muted/40 active:cursor-grabbing" : "bg-muted/40"} ${movingId && !canMoveHere ? "cursor-not-allowed" : ""}`} style={{ top: index * slotHeight, height: slotHeight }} />
              })}
              {dayHours.closed && <span className="pointer-events-none absolute left-1/2 top-4 z-[1] -translate-x-1/2 rounded bg-card/90 px-2 py-1 text-sm font-medium text-muted-foreground">Fechado</span>}
              {agendaBlocks.filter(block => block.date === ds).map(block => {
                const start = block.all_day ? firstHour * 60 : timeToMinutes(block.start_time || `${firstHour}:00`)
                const duration = block.all_day ? (lastHour - firstHour) * 60 : timeToMinutes(block.end_time || block.start_time || `${firstHour}:00`) - start
                const top = block.all_day ? 4 : Math.max(0, ((start - firstHour * 60) / slotMinutes) * slotHeight + 2)
                const height = block.all_day ? gridHeight - 4 : Math.max(34, duration / slotMinutes * slotHeight - 4)
                return <button key={block.id} type="button" onClick={() => editBlock(block)} aria-label={`Compromisso: ${block.title}, ${block.all_day ? "dia inteiro" : `${block.start_time?.slice(0, 5)} às ${block.end_time?.slice(0, 5)}`}`} className={`absolute z-[1] overflow-hidden rounded-md border-l-4 border-l-orange-500 px-2 py-1.5 text-left text-orange-950 shadow-sm dark:text-orange-100 ${block.all_day ? "bg-orange-100/70 dark:bg-orange-950/40" : "bg-orange-100 dark:bg-orange-950/60"}`} style={{ top, height, left: "4px", right: "4px" }}>
                  <strong className="block truncate text-sm leading-tight">{block.all_day ? "Dia inteiro · " : `${block.start_time?.slice(0, 5)} · `}{block.title}</strong>
                  <span className="block truncate text-xs opacity-80">{block.scope === "dentist" ? block.doctor_name : block.resource_name || "Clínica"}</span>
                </button>
              })}
              {dayAppointments.map(({ appointment: appt, column, columns }) => {
                const start = timeToMinutes(appt.time)
                const duration = Math.max(15, Number(appt.duration_minutes) || 60)
                const canMove = !NON_RESCHEDULABLE_STATUSES.includes(appt.status)
                const compact = duration < 45
                const singleLine = duration < 30
                const width = 100 / columns
                return <button key={appt.id} type="button" draggable={canMove} onDragStart={event => { event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", appt.id); setMovingId(appt.id) }} onDragEnd={() => setMovingId(null)} onClick={() => openDetails(appt)} aria-label={`${appt.patient?.full_name || "Paciente"}, ${formatTime(appt.time)} a ${formatMinutes(start + duration)}, ${appt.doctor_name || "dentista não informado"}. ${appt.status || ""}`} className={`absolute z-[1] overflow-hidden rounded-md border-l-4 px-2 ${singleLine ? "py-0.5" : "py-1.5"} text-left shadow-sm transition-shadow hover:shadow-md focus-visible:outline-2 focus-visible:outline-primary ${appointmentColor(appt.doctor_name || appt.patient?.full_name || "")} ${movingId === appt.id ? "ring-2 ring-primary ring-offset-1" : ""} ${["Cancelada", "Falta"].includes(appt.status) ? "opacity-50" : ""}`} style={{ top: Math.max(0, ((start - firstHour * 60) / slotMinutes) * slotHeight + 2), height: Math.max(singleLine ? 20 : 35, duration / slotMinutes * slotHeight - 4), left: `calc(${column * width}% + 4px)`, width: `calc(${width}% - 8px)` }}>
                  {!singleLine && <span className="block truncate text-sm font-semibold leading-tight">{formatTime(appt.time)}–{formatMinutes(start + duration)}</span>}
                  <strong className={`block truncate text-base leading-tight ${singleLine ? "" : compact ? "mt-0.5" : "mt-1"}`}>{appt.patient?.full_name || "Paciente"}</strong>
                  {!compact && <span className="mt-1 block truncate text-sm leading-tight opacity-80">{appt.doctor_name || appt.procedure_type || "Consulta"}</span>}
                </button>
              })}
            </div>
            <div className="h-7 border-t border-border" />
          </div>
        })}
      </div>
    </div>
  }

  // ── Status/ação de uma consulta — usado tanto na linha da tabela quanto no card mobile ──
  const useAppointmentState = (appointment: any) => {
    const isActiveStatus = appointment.status === "Pendente" || appointment.status === "Confirmada" || appointment.status === "Aguardando" || appointment.status === "Atrasado"
    const timeStatus = isActiveStatus
      ? getAppointmentTimeStatus(appointment.date, appointment.time)
      : "ok"

    const currentStatus = timeStatus === "late" && appointment.status !== "Atrasado" && isActiveStatus
      ? "Atrasado"
      : appointment.status

    const canStart = !["Concluída", "Cancelada", "Falta", "Em Andamento"].includes(appointment.status)
    const canCancel = appointment.status !== "Concluída" &&
      appointment.status !== "Cancelada" &&
      appointment.status !== "Falta"
    const isLate = timeStatus === "late" || currentStatus === "Atrasado"

    return { currentStatus, canStart, canCancel, isLate }
  }

  const StatusSelector = ({ appointment }: { appointment: any }) => {
    const { canCancel } = useAppointmentState(appointment)
    if (["Concluída", "Cancelada", "Falta"].includes(appointment.status)) {
      return <div className="py-1">{getStatusBadge(appointment.status)}</div>
    }
    return (
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
          {STATUS_OPTIONS.filter(o => {
            if (o.value === "Cancelada") return canCancel
            return true
          }).map(o => (
            <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  }

  const AppointmentActionButton = ({ appointment }: { appointment: any }) => {
    const { canStart } = useAppointmentState(appointment)
    return (
      <>
        {canStart && (
          <Button size="sm" onClick={() => handleIniciar(appointment)}>
            Iniciar
          </Button>
        )}
        {appointment.status === "Em Andamento" && (
          <div className="flex items-center gap-2">
            <Badge className="bg-yellow-100 text-yellow-800 animate-pulse text-xs">Em atendimento</Badge>
            <Button size="sm" className="bg-success text-white hover:bg-success/90"
              onClick={() => router.push(`/prontuario/${appointment.patient_id}`)}>
              Revisar e encerrar
            </Button>
          </div>
        )}
        {appointment.status === "Concluída" && <Badge className="bg-gray-100 text-gray-800">Encerrado</Badge>}
        {appointment.status === "Cancelada" && <Badge className="bg-red-100 text-red-800">Cancelada</Badge>}
        {appointment.status === "Falta" && <Badge className="bg-orange-100 text-orange-800">Falta</Badge>}
      </>
    )
  }

  // ── LINHA DE TABELA (desktop) ─────────────────────────────────────────────
  const AppointmentRow = ({ appointment }: { appointment: any }) => {
    const { isLate } = useAppointmentState(appointment)
    const rowBg = isLate ? "bg-yellow-50 dark:bg-yellow-950/20" : ""

    return (
      <tr data-agenda-appointment={appointment.id} className={`border-b border-border transition-colors ${rowBg} ${targetAppointmentId === appointment.id ? "bg-primary/10 outline outline-2 outline-primary" : ""}`}>
        <td className="py-3 px-4 text-sm font-medium text-foreground whitespace-nowrap">
          <div className="flex items-center gap-1">
            {formatTime(appointment.time)}
            {isLate && <AlertTriangle className="h-3 w-3 text-yellow-600" />}
          </div>
        </td>
        <td className="py-3 px-4 text-sm text-foreground">
          {appointment.patient?.full_name || "—"}
        </td>
        <td className="py-3 px-4 text-sm text-muted-foreground">
          {appointment.doctor_name ? `Dr(a). ${appointment.doctor_name}` : "—"}
        </td>
        <td className="py-3 px-4">
          <StatusSelector appointment={appointment} />
        </td>
        <td className="py-3 px-4 text-right">
          <div className="flex items-center justify-end gap-2">
            <AppointmentActionButton appointment={appointment} />
          </div>
        </td>
      </tr>
    )
  }

  // ── CARD (mobile) ──────────────────────────────────────────────────────────
  const AppointmentCard = ({ appointment }: { appointment: any }) => {
    const { isLate } = useAppointmentState(appointment)
    return (
      <Card data-agenda-appointment={appointment.id} className={`${isLate ? "border-yellow-300 bg-yellow-50 dark:bg-yellow-950/20" : ""} ${targetAppointmentId === appointment.id ? "border-primary bg-primary/10 ring-2 ring-primary" : ""}`}>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-base font-semibold text-foreground">{formatTime(appointment.time)}</span>
                {isLate && <AlertTriangle className="h-3.5 w-3.5 text-yellow-600" />}
              </div>
              <p className="text-sm text-foreground mt-0.5">{appointment.patient?.full_name || "—"}</p>
              <p className="text-xs text-muted-foreground">
                {appointment.doctor_name ? `Dr(a). ${appointment.doctor_name}` : "—"}
              </p>
            </div>
            <StatusSelector appointment={appointment} />
          </div>
          <div className="flex justify-end gap-2 pt-1 border-t border-border">
            <AppointmentActionButton appointment={appointment} />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="pl-12 text-3xl font-bold text-foreground lg:pl-0">Agendamento</h1>
      </div>

      {/* Navegação */}
      <Card className="py-2">
        <CardContent className="px-3 py-1">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <Button variant="outline" size="icon" className="bg-transparent shrink-0" onClick={() => navigateDate("prev")}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <button type="button" onClick={() => { setJumpDate(dateString); setRangeStart(viewMode === "custom" ? customStart : weekStart); setRangeEnd(viewMode === "custom" ? customEnd : weekEnd); setDatePickerOpen(true) }} className="flex min-w-0 items-center gap-2 rounded-md px-1 py-2 text-left hover:bg-muted focus-visible:outline-2 focus-visible:outline-primary" aria-label="Escolher data ou intervalo">
                <Calendar className="h-5 w-5 shrink-0 text-primary" />
                <span className="truncate text-sm font-semibold capitalize text-foreground sm:text-base">{navTitle}</span>
              </button>
              <Button variant="outline" size="icon" className="bg-transparent shrink-0" onClick={() => navigateDate("next")}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex gap-2">
                 {(["day", "week"] as const).map((mode) => (
                  <Button key={mode} variant={viewMode === mode ? "default" : "outline"} size="sm"
                    aria-pressed={viewMode === mode}
                    onClick={() => setViewMode(mode)} className={viewMode !== mode ? "bg-transparent" : ""}>
                     {mode === "day" ? "Dia" : "Semana"}
                  </Button>
                ))}
              </div>
              <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (open) setNewAppointment(current => ({ ...current, date: dateString })); else resetForm() }}>
                <DialogTrigger asChild>
                  <Button className="gap-2">
                    <Plus className="h-4 w-4" />
                    <span className="hidden sm:inline">Novo Agendamento</span>
                    <span className="sm:hidden">Novo</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="w-[calc(100vw-2rem)] sm:w-full sm:max-w-[500px]">
                  <DialogHeader>
                    <DialogTitle>Novo Agendamento</DialogTitle>
                    <DialogDescription>Escolha o paciente, o dia e o horário da consulta.</DialogDescription>
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
                      <Label htmlFor="appointment-date">Dia da consulta *</Label>
                      <Input id="appointment-date" type="date" value={newAppointment.date} onChange={(event) => setNewAppointment({ ...newAppointment, date: event.target.value })} />
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
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="appointment-time">Horário *</Label>
                        <Input id="appointment-time" type="time" value={newAppointment.time}
                          onChange={(e) => setNewAppointment({ ...newAppointment, time: e.target.value })} />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="appointment-duration">Duração (min)</Label>
                        <Input id="appointment-duration" type="number" min={1} value={newAppointment.duration_minutes}
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
              <Button type="button" variant="outline" className="gap-2" onClick={startNewBlock}>
                <CalendarClock className="h-4 w-4" /><span>Bloquear horário</span>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isBlockDialogOpen} onOpenChange={setIsBlockDialogOpen}>
        <DialogContent className="max-h-[90dvh] w-[calc(100vw-2rem)] overflow-y-auto sm:max-w-[620px]">
          <DialogHeader>
            <DialogTitle>{editingBlockId ? "Editar compromisso" : "Bloquear horário"}</DialogTitle>
            <DialogDescription>Reserve um período para um compromisso do dentista ou da clínica. Nenhum paciente precisa ser cadastrado.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-5 py-2">
            {blockError && <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{blockError}</div>}
            <div className="grid gap-2">
              <Label htmlFor="agenda-block-title">Nome do compromisso *</Label>
              <Input id="agenda-block-title" autoFocus placeholder="Ex.: Viagem, reunião, compromisso pessoal" maxLength={160} value={blockForm.title} onChange={event => setBlockForm({ ...blockForm, title: event.target.value })} />
            </div>
            <fieldset className="grid gap-3">
              <legend className="text-sm font-medium">Bloquear para</legend>
              <RadioGroup value={blockForm.scope} onValueChange={value => setBlockForm({ ...blockForm, scope: value as "dentist" | "clinic" })} className="grid grid-cols-2 gap-3">
                <label htmlFor="agenda-block-dentist" className="flex cursor-pointer items-center gap-2 rounded-md border p-3"><RadioGroupItem value="dentist" id="agenda-block-dentist" /><span>Dentista</span></label>
                <label htmlFor="agenda-block-clinic" className="flex cursor-pointer items-center gap-2 rounded-md border p-3"><RadioGroupItem value="clinic" id="agenda-block-clinic" /><span>Clínica inteira</span></label>
              </RadioGroup>
            </fieldset>
            {blockForm.scope === "dentist" ? <div className="grid gap-2"><Label>Dentista *</Label>{staff.filter((member: any) => member.is_active).length ? <Select value={blockForm.doctor_name} onValueChange={value => setBlockForm({ ...blockForm, doctor_name: value })}><SelectTrigger><SelectValue placeholder="Selecione o dentista" /></SelectTrigger><SelectContent>{staff.filter((member: any) => member.is_active).map((member: any) => <SelectItem key={member.id} value={member.full_name}>{member.full_name}</SelectItem>)}</SelectContent></Select> : <Input aria-label="Dentista" placeholder="Nome do dentista" value={blockForm.doctor_name} onChange={event => setBlockForm({ ...blockForm, doctor_name: event.target.value })} />}</div> : <div className="grid gap-2"><Label htmlFor="agenda-block-resource">Clínica, cadeira ou consultório</Label><Input id="agenda-block-resource" placeholder="Ex.: Consultório 01 - Adulto" value={blockForm.resource_name} onChange={event => setBlockForm({ ...blockForm, resource_name: event.target.value })} /></div>}
            <div className="grid gap-2"><Label htmlFor="agenda-block-notes">Observações</Label><Textarea id="agenda-block-notes" placeholder="Detalhes opcionais" maxLength={2000} rows={3} value={blockForm.notes} onChange={event => setBlockForm({ ...blockForm, notes: event.target.value })} /></div>
            <div className="grid gap-3">
              <Label htmlFor="agenda-block-date">Data *</Label>
              <div className="flex flex-wrap items-center gap-3"><Input id="agenda-block-date" type="date" className="w-auto" value={blockForm.date} onChange={event => setBlockForm({ ...blockForm, date: event.target.value })} /><label className="flex items-center gap-2 text-sm"><Checkbox checked={blockForm.all_day} onCheckedChange={checked => setBlockForm({ ...blockForm, all_day: checked === true })} />Dia inteiro</label></div>
            </div>
            {!blockForm.all_day && <div className="grid grid-cols-2 gap-3"><div className="grid gap-2"><Label htmlFor="agenda-block-start">Início *</Label><Input id="agenda-block-start" type="time" step={900} value={blockForm.start_time} onChange={event => setBlockForm({ ...blockForm, start_time: event.target.value })} /></div><div className="grid gap-2"><Label htmlFor="agenda-block-end">Fim *</Label><Input id="agenda-block-end" type="time" step={900} value={blockForm.end_time} onChange={event => setBlockForm({ ...blockForm, end_time: event.target.value })} /></div></div>}
          </div>
          <DialogFooter className="flex-col-reverse sm:flex-row">
            {editingBlockId && <Button type="button" variant="destructive" className="sm:mr-auto" disabled={isSavingBlock} onClick={() => void deleteBlock()}><Trash2 className="mr-2 h-4 w-4" />Excluir</Button>}
            <Button type="button" variant="outline" onClick={() => setIsBlockDialogOpen(false)}>Cancelar</Button>
            <Button type="button" disabled={isSavingBlock} onClick={() => void saveBlock()}>{isSavingBlock ? "Salvando..." : editingBlockId ? "Salvar alterações" : "Salvar compromisso"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={datePickerOpen} onOpenChange={setDatePickerOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Escolher data</DialogTitle>
            <DialogDescription>Vá diretamente a um dia ou consulte um intervalo de datas.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="agenda-jump-date">Data</Label>
              <Input id="agenda-jump-date" type="date" value={jumpDate} onChange={event => setJumpDate(event.target.value)} />
              <Button disabled={!jumpDate} onClick={() => { setSelectedDate(new Date(`${jumpDate}T12:00:00`)); setViewMode("week"); setDatePickerOpen(false) }}>Mostrar semana</Button>
            </div>
            <div className="border-t pt-4">
              <p className="mb-3 text-sm font-medium">Consultar intervalo</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2"><Label htmlFor="agenda-range-start">De</Label><Input id="agenda-range-start" type="date" value={rangeStart} onChange={event => setRangeStart(event.target.value)} /></div>
                <div className="grid gap-2"><Label htmlFor="agenda-range-end">Até</Label><Input id="agenda-range-end" type="date" min={rangeStart} value={rangeEnd} onChange={event => setRangeEnd(event.target.value)} /></div>
              </div>
              <Button variant="outline" className="mt-3 w-full" disabled={!rangeStart || !rangeEnd || rangeStart > rangeEnd} onClick={() => { setCustomStart(rangeStart); setCustomEnd(rangeEnd); setViewMode("custom"); setDatePickerOpen(false) }}>Ver consultas</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!detailsId} onOpenChange={open => { if (!open) setDetailsId(null) }}>
        <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-[480px]">
          {detailAppointment && <>
            <DialogHeader>
              <DialogTitle>{detailAppointment.patient?.full_name || "Paciente"}</DialogTitle>
              <DialogDescription>Consulta em {new Date(`${detailAppointment.date}T12:00:00`).toLocaleDateString("pt-BR")} às {formatTime(detailAppointment.time)}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 text-sm">
              <div className="flex items-center gap-3"><span className="font-medium">Status</span>{StatusSelector({ appointment: detailAppointment })}</div>
              {NON_RESCHEDULABLE_STATUSES.includes(detailAppointment.status) ? <div className="space-y-3 rounded-md border p-3">
                <p><strong>Procedimento:</strong> {detailAppointment.procedure_type || "Consulta"}</p>
                <p><strong>Dentista:</strong> {detailAppointment.doctor_name || "—"}</p>
                <p>Esta consulta está {detailAppointment.status.toLowerCase()} e seu horário faz parte do histórico. Agende uma nova consulta para este paciente.</p>
                <Button onClick={() => scheduleAgain(detailAppointment)}>Agendar novamente</Button>
              </div> : <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2"><Label htmlFor="detail-procedure">Procedimento</Label><Input id="detail-procedure" value={detailProcedure} maxLength={200} onChange={event => setDetailProcedure(event.target.value)} /></div>
                  <div className="space-y-2"><Label htmlFor="detail-doctor">Dentista</Label><Input id="detail-doctor" value={detailDoctor} maxLength={160} onChange={event => setDetailDoctor(event.target.value)} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2"><Label htmlFor="detail-date">Data</Label><Input id="detail-date" type="date" value={detailDate} onChange={event => setDetailDate(event.target.value)} /></div>
                  <div className="space-y-2"><Label htmlFor="detail-time">Horário</Label><Input id="detail-time" type="time" step={900} value={detailTime} onChange={event => setDetailTime(event.target.value)} /></div>
                </div>
                {detailError && <p role="alert" className="text-destructive">{detailError}</p>}
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" disabled={movingBusy} onClick={() => void saveAppointmentDetails()}>Salvar alterações</Button>
                  <Button variant="outline" onClick={() => { setMovingId(detailAppointment.id); setDetailsId(null) }}>Escolher na grade</Button>
                </div>
              </>}
              {detailAppointment.notes && <p><strong>Observações:</strong> {detailAppointment.notes}</p>}
            </div>
            <DialogFooter>
              {AppointmentActionButton({ appointment: detailAppointment })}
            </DialogFooter>
          </>}
        </DialogContent>
      </Dialog>

      {/* Modal de cancelamento */}
      <Dialog open={!!cancelTarget} onOpenChange={(open) => { if (!open) setCancelTarget(null) }}>
        <DialogContent className="w-[calc(100vw-2rem)] sm:w-full sm:max-w-[400px]">
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
                  <Textarea
                    placeholder="Descreva o motivo (opcional)..."
                    value={cancelOtherText}
                    onChange={(e) => setCancelOtherText(e.target.value)}
                    className="resize-none"
                    rows={3}
                  />
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

      {/* Views */}
      {viewMode === "week" && (
        <>
          {movingId && <div role="status" className="flex items-center justify-between gap-3 rounded-md border border-primary/40 bg-primary/10 p-3 text-sm">
            <span>Escolha na grade o novo horário da consulta.</span>
            <Button size="sm" variant="outline" onClick={() => setMovingId(null)}>Cancelar</Button>
          </div>}
          <Card className="overflow-hidden">
            <CardContent className="p-0">{WeekView()}</CardContent>
          </Card>
        </>
      )}

      {viewMode === "custom" && <Card><CardHeader><CardTitle className="text-base">Consultas do período</CardTitle></CardHeader><CardContent className="space-y-2">{customStart > customEnd ? <p>Escolha uma data final igual ou posterior à inicial.</p> : customAppointments.length ? customAppointments.map(appt => <div key={appt.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm"><div><strong>{appt.date.split("-").reverse().join("/")} · {formatTime(appt.time)}</strong><p>{appt.patient?.full_name || "Paciente"} · {appt.doctor_name}</p></div><Button size="sm" variant="outline" onClick={() => { setSelectedDate(new Date(`${appt.date}T12:00:00`)); setViewMode("day") }}>Ver dia</Button></div>) : <p className="text-muted-foreground">Nenhuma consulta neste período.</p>}</CardContent></Card>}

      {viewMode === "day" && (
        <div>
          <div>
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Consultas do Dia</CardTitle>
                  <span className="text-sm text-muted-foreground">
                    {isLoading ? "..." : `${appointmentsList.length} agendamentos`}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {agendaBlocks.filter(block => block.date === dateString).length > 0 && <div className="space-y-2 border-b p-4">{agendaBlocks.filter(block => block.date === dateString).map(block => <button key={block.id} type="button" onClick={() => editBlock(block)} className="flex w-full items-center justify-between gap-3 rounded-md border-l-4 border-l-orange-500 bg-orange-50 p-3 text-left text-orange-950 dark:bg-orange-950/40 dark:text-orange-100"><span><strong className="block">{block.title}</strong><span className="text-sm">{block.all_day ? "Dia inteiro" : `${block.start_time?.slice(0, 5)}–${block.end_time?.slice(0, 5)}`} · {block.scope === "dentist" ? block.doctor_name : block.resource_name || "Clínica"}</span></span><span className="text-xs">Editar</span></button>)}</div>}
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : appointmentsList.length === 0 ? (
                  <div className="text-center py-8 px-4">
                    <p className="text-muted-foreground">Nenhuma consulta agendada para este dia</p>
                    <Button className="mt-4 bg-transparent" variant="outline" onClick={() => { setNewAppointment(current => ({ ...current, date: dateString })); setIsDialogOpen(true) }}>
                      <Plus className="h-4 w-4 mr-2" />Agendar Consulta
                    </Button>
                  </div>
                ) : (
                  <>
                    {/* Tabela — desktop */}
                    <div className="hidden lg:block overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border bg-muted/50">
                            <th className="py-2 px-4 text-left text-xs font-medium text-muted-foreground">Horário</th>
                            <th className="py-2 px-4 text-left text-xs font-medium text-muted-foreground">Paciente</th>
                            <th className="py-2 px-4 text-left text-xs font-medium text-muted-foreground">Profissional</th>
                            <th className="py-2 px-4 text-left text-xs font-medium text-muted-foreground">Status</th>
                            <th className="py-2 px-4 text-right text-xs font-medium text-muted-foreground"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {appointmentsList.map(appt => <AppointmentRow key={appt.id} appointment={appt} />)}
                        </tbody>
                      </table>
                    </div>

                    {/* Cards — mobile/tablet */}
                    <div className="lg:hidden space-y-3 p-4">
                      {appointmentsList.map(appt => <AppointmentCard key={appt.id} appointment={appt} />)}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

        </div>
      )}
    </div>
  )
}
