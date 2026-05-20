"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Calendar, ChevronLeft, ChevronRight, Clock, Plus, Loader2, AlertCircle, AlertTriangle } from "lucide-react"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import useSWR from "swr"
import Link from "next/link"

// Horário de fechamento padrão da clínica (caso não venha das configurações)
const DEFAULT_CLOSING_HOUR = 18

// Converte "HH:MM" ou "HH:MM:SS" em minutos desde meia-noite
function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number)
  return h * 60 + m
}

// Retorna o status de tempo de um agendamento em relação ao momento atual
// Só faz sentido para o dia de hoje
type AppointmentTimeStatus = "ok" | "late" | "missed"

function getAppointmentTimeStatus(
  appointmentDate: string,
  appointmentTime: string,
  closingHour: number
): AppointmentTimeStatus {
  const now = new Date()
  const todayString = now.toISOString().split("T")[0]

  // Só aplica lógica de atraso/falta no dia correto
  if (appointmentDate !== todayString) {
    // Dia passado sem iniciar = falta
    if (appointmentDate < todayString) return "missed"
    // Dia futuro = ok
    return "ok"
  }

  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  const apptMinutes = timeToMinutes(appointmentTime)
  const closingMinutes = closingHour * 60

  if (nowMinutes >= closingMinutes) return "missed"
  if (nowMinutes >= apptMinutes + 15) return "late"
  return "ok"
}

export function AgendaView() {
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [viewMode, setViewMode] = useState<"day" | "week" | "month">("day")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  // Tick a cada minuto para atualizar badges de atraso em tempo real
  const [, setTick] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 60_000)
    return () => clearInterval(interval)
  }, [])

  const dateString = selectedDate.toISOString().split("T")[0]
  const todayString = new Date().toISOString().split("T")[0]
  const isPastDate = dateString < todayString

  const { appointments, isLoading, error, mutate } = useAppointments({ date: dateString })
  const { patients } = usePatients()

  const [newAppointment, setNewAppointment] = useState({
    patient_id: "",
    procedure_type: "Consulta",
    time: "",
    duration_minutes: 60,
    notes: "",
    doctor_name: "",
  })

  const { data: staffRes } = useSWR("/api/clinic-staff", (url: string) => fetch(url).then(r => r.json()))
  const staff = staffRes?.data || []

  // Busca horário de fechamento da clínica
  const { data: settingsRes } = useSWR("/api/clinic-settings", (url: string) => fetch(url).then(r => r.json()))
  const closingHour: number = settingsRes?.data?.working_hours?.end
    ? parseInt(settingsRes.data.working_hours.end.split(":")[0])
    : DEFAULT_CLOSING_HOUR

  const resetForm = () => {
    setNewAppointment({
      patient_id: "",
      procedure_type: "Consulta",
      time: "",
      duration_minutes: 60,
      notes: "",
      doctor_name: "",
    })
    setFormError(null)
  }

  const handleCreateAppointment = async () => {
    setFormError(null)

    if (!newAppointment.patient_id) {
      setFormError("Selecione um paciente.")
      return
    }
    if (!newAppointment.procedure_type) {
      setFormError("Selecione o tipo de procedimento.")
      return
    }
    if (!newAppointment.time) {
      setFormError("Informe o horário do agendamento.")
      return
    }
    if (!newAppointment.doctor_name || newAppointment.doctor_name.trim() === "") {
      setFormError("Selecione ou informe o dentista responsável.")
      return
    }

    // Bloqueia agendamento em data passada
    if (dateString < todayString) {
      setFormError("Não é possível agendar em datas passadas.")
      return
    }

    // Bloqueia horário que já passou no mesmo dia
    if (dateString === todayString) {
      const now = new Date()
      const nowMinutes = now.getHours() * 60 + now.getMinutes()
      const apptMinutes = timeToMinutes(newAppointment.time)
      if (apptMinutes <= nowMinutes) {
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
      const message = err instanceof Error ? err.message : "Erro ao agendar consulta"
      setFormError(message)
      toast.error(message)
    } finally {
      setIsCreating(false)
    }
  }

  const handleUpdateStatus = async (id: string, status: string) => {
    try {
      await updateAppointment(id, { status } as any)
      toast.success("Status atualizado!")
      mutate()
    } catch (err) {
      toast.error("Erro ao atualizar status")
    }
  }

  // Marca automaticamente como falta os agendamentos que passaram do expediente
  const handleAutoMissed = async (id: string) => {
    try {
      await updateAppointment(id, { status: "Falta" } as any)
      mutate()
    } catch {
      // silencioso — será tentado novamente no próximo tick
    }
  }

  const formatTime = (timeString: string) => {
    if (!timeString) return "--:--"
    return timeString.substring(0, 5)
  }

  const formatDisplayDate = (date: Date) => {
    return date.toLocaleDateString("pt-BR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    })
  }

  const formatWeekday = (date: Date) => {
    return date.toLocaleDateString("pt-BR", { weekday: "long" })
  }

  const navigateDate = (direction: "prev" | "next") => {
    const newDate = new Date(selectedDate)
    newDate.setDate(newDate.getDate() + (direction === "next" ? 1 : -1))
    setSelectedDate(newDate)
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Confirmada":
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">Confirmada</Badge>
      case "Pendente":
        return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">Pendente</Badge>
      case "Em Andamento":
        return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">Em Andamento</Badge>
      case "Concluída":
        return <Badge className="bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400">Concluida</Badge>
      case "Cancelada":
        return <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">Cancelada</Badge>
      case "Falta":
        return <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400">Falta</Badge>
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  const confirmedCount = appointments?.filter(a => a.status === "Confirmada").length || 0
  const pendingCount = appointments?.filter(a => a.status === "Pendente").length || 0

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-muted-foreground">Erro ao carregar agenda. Faca login para continuar.</p>
        <Link href="/auth/login">
          <Button className="mt-4">Fazer Login</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Agenda Inteligente</h1>
        <p className="text-muted-foreground">Gerencie consultas com sugestoes automaticas</p>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <Button variant="outline" size="icon" className="bg-transparent" onClick={() => navigateDate("prev")}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                <span className="text-lg font-semibold text-foreground">{formatDisplayDate(selectedDate)}</span>
                <span className="text-sm text-muted-foreground capitalize">{formatWeekday(selectedDate)}</span>
              </div>
              <Button variant="outline" size="icon" className="bg-transparent" onClick={() => navigateDate("next")}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex gap-2">
              {(["day", "week", "month"] as const).map((mode) => (
                <Button
                  key={mode}
                  variant={viewMode === mode ? "default" : "outline"}
                  size="sm"
                  onClick={() => setViewMode(mode)}
                  className={viewMode !== mode ? "bg-transparent" : ""}
                >
                  {mode === "day" ? "Dia" : mode === "week" ? "Semana" : "Mês"}
                </Button>
              ))}
            </div>

            <Dialog
              open={isDialogOpen}
              onOpenChange={(open) => {
                setIsDialogOpen(open)
                if (!open) resetForm()
              }}
            >
              <DialogTrigger asChild>
                {/* Botão desabilitado para datas passadas */}
                <Button className="gap-2" disabled={isPastDate} title={isPastDate ? "Não é possível agendar em datas passadas" : ""}>
                  <Plus className="h-4 w-4" />
                  Novo Agendamento
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>Novo Agendamento</DialogTitle>
                  <DialogDescription>
                    Agende uma nova consulta para {formatDisplayDate(selectedDate)}
                  </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                  {formError && (
                    <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>{formError}</span>
                    </div>
                  )}

                  <div className="grid gap-2">
                    <Label htmlFor="patient">Paciente *</Label>
                    <Select
                      value={newAppointment.patient_id}
                      onValueChange={(value) => setNewAppointment({ ...newAppointment, patient_id: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um paciente" />
                      </SelectTrigger>
                      <SelectContent>
                        {patients?.map((patient) => (
                          <SelectItem key={patient.id} value={patient.id}>
                            {patient.full_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="procedure_type">Procedimento *</Label>
                    <Select
                      value={newAppointment.procedure_type}
                      onValueChange={(value) => setNewAppointment({ ...newAppointment, procedure_type: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o procedimento" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Consulta">Consulta</SelectItem>
                        <SelectItem value="Limpeza">Limpeza</SelectItem>
                        <SelectItem value="Tratamento">Tratamento</SelectItem>
                        <SelectItem value="Cirurgia">Cirurgia</SelectItem>
                        <SelectItem value="Emergencia">Emergencia</SelectItem>
                        <SelectItem value="Retorno">Retorno</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="time">Horario *</Label>
                      <Input
                        id="time"
                        type="time"
                        value={newAppointment.time}
                        min={dateString === todayString ? `${String(new Date().getHours()).padStart(2, "0")}:${String(new Date().getMinutes()).padStart(2, "0")}` : undefined}
                        onChange={(e) => setNewAppointment({ ...newAppointment, time: e.target.value })}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="duration">Duracao (min)</Label>
                      <Input
                        id="duration"
                        type="number"
                        min={1}
                        value={newAppointment.duration_minutes}
                        onChange={(e) =>
                          setNewAppointment({
                            ...newAppointment,
                            duration_minutes: Math.max(1, parseInt(e.target.value) || 60),
                          })
                        }
                      />
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="doctor">Dentista Responsavel *</Label>
                    {staff.length > 0 ? (
                      <Select
                        value={newAppointment.doctor_name}
                        onValueChange={(value) => setNewAppointment({ ...newAppointment, doctor_name: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o dentista" />
                        </SelectTrigger>
                        <SelectContent>
                          {staff.filter((s: any) => s.is_active).map((s: any) => (
                            <SelectItem key={s.id} value={s.full_name}>
                              {s.full_name} - {s.specialty || s.role}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        id="doctor"
                        placeholder="Nome do dentista (obrigatório)"
                        value={newAppointment.doctor_name}
                        onChange={(e) => setNewAppointment({ ...newAppointment, doctor_name: e.target.value })}
                      />
                    )}
                  </div>
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => { setIsDialogOpen(false); resetForm() }}>
                    Cancelar
                  </Button>
                  <Button onClick={handleCreateAppointment} disabled={isCreating}>
                    {isCreating ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Agendando...
                      </>
                    ) : (
                      "Agendar"
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base">Consultas do Dia</CardTitle>
              <span className="text-sm text-muted-foreground">
                {isLoading ? "..." : `${appointments?.length || 0} agendamentos`}
              </span>
            </CardHeader>
            <CardContent className="space-y-3">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : !appointments || appointments.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">Nenhuma consulta agendada para este dia</p>
                  {!isPastDate && (
                    <Button className="mt-4 bg-transparent" variant="outline" onClick={() => setIsDialogOpen(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Agendar Consulta
                    </Button>
                  )}
                </div>
              ) : (
                appointments.map((appointment) => {
                  const isActiveStatus = appointment.status === "Pendente" || appointment.status === "Confirmada"
                  const timeStatus = isActiveStatus
                    ? getAppointmentTimeStatus(appointment.date, appointment.time, closingHour)
                    : "ok"

                  // Dispara atualização automática para falta
                  if (timeStatus === "missed" && isActiveStatus) {
                    handleAutoMissed(appointment.id)
                  }

                  return (
                    <div
                      key={appointment.id}
                      className={`flex items-center justify-between rounded-lg border p-4 ${
                        timeStatus === "missed"
                          ? "border-orange-300 bg-orange-50 dark:border-orange-800 dark:bg-orange-950/20"
                          : timeStatus === "late"
                          ? "border-yellow-300 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950/20"
                          : "border-border bg-muted/30"
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className="flex items-center justify-center rounded-lg bg-primary/10 px-3 py-2 min-w-[80px]">
                          <Clock className="h-4 w-4 text-primary mr-2" />
                          <span className="text-sm font-medium text-foreground">{formatTime(appointment.time)}</span>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">{appointment.patient?.full_name || "Paciente"}</p>
                          <p className="text-xs text-muted-foreground">
                            {appointment.procedure_type}
                            {appointment.doctor_name && ` - Dr(a). ${appointment.doctor_name}`}
                          </p>
                          {/* Badge de atraso */}
                          {timeStatus === "late" && (
                            <div className="flex items-center gap-1 mt-1">
                              <AlertTriangle className="h-3 w-3 text-yellow-600" />
                              <span className="text-xs text-yellow-600 font-medium">Atrasado</span>
                            </div>
                          )}
                        </div>
                        {getStatusBadge(appointment.status)}
                      </div>
                      <div className="flex items-center gap-2">
                        {appointment.status === "Pendente" && timeStatus !== "missed" && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="bg-transparent"
                            onClick={() => handleUpdateStatus(appointment.id, "Confirmada")}
                          >
                            Confirmar
                          </Button>
                        )}
                        {/* Botão Iniciar: liberado antes do horário e após (até fechar), bloqueado se falta */}
                        {isActiveStatus && timeStatus !== "missed" && (
                          <Button
                            size="sm"
                            onClick={() => handleUpdateStatus(appointment.id, "Em Andamento")}
                          >
                            Iniciar
                          </Button>
                        )}
                        {appointment.status === "Em Andamento" && (
                          <>
                            <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 animate-pulse">
                              Em atendimento
                            </Badge>
                            <Button
                              size="sm"
                              variant="outline"
                              className="bg-transparent text-destructive border-destructive/30 hover:bg-destructive/10"
                              onClick={() => handleUpdateStatus(appointment.id, "Cancelada")}
                            >
                              Cancelar
                            </Button>
                            <Button
                              size="sm"
                              className="bg-success text-white hover:bg-success/90"
                              onClick={() => handleUpdateStatus(appointment.id, "Concluída")}
                            >
                              Encerrar
                            </Button>
                          </>
                        )}
                        {appointment.status === "Concluída" && (
                          <Badge className="bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400">
                            Encerrado
                          </Badge>
                        )}
                        {appointment.status === "Cancelada" && (
                          <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
                            Cancelada
                          </Badge>
                        )}
                        {appointment.status === "Falta" && (
                          <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400">
                            Falta
                          </Badge>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Estatisticas do Dia</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Taxa de Ocupacao</span>
                <span className="text-sm font-semibold text-foreground">
                  {appointments ? `${Math.min(Math.round((appointments.length / 8) * 100), 100)}%` : "0%"}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-success transition-all"
                  style={{ width: `${appointments ? Math.min(Math.round((appointments.length / 8) * 100), 100) : 0}%` }}
                />
              </div>
              <div className="pt-2 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Total de Consultas</span>
                  <span className="text-sm font-semibold text-foreground">{appointments?.length || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Confirmadas</span>
                  <Badge variant="default" className="bg-success/10 text-success hover:bg-success/20">{confirmedCount}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Pendentes</span>
                  <Badge variant="secondary" className="bg-warning/10 text-warning hover:bg-warning/20">{pendingCount}</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Sugestoes Inteligentes</CardTitle>
              <p className="text-xs text-muted-foreground">Horarios otimizados para agendamento</p>
            </CardHeader>
            <CardContent className="space-y-2">
              {[
                { time: "11:30", label: "Horario livre - Alta demanda" },
                { time: "13:00", label: "Horario otimizado para retornos" },
              ].map(({ time, label }) => (
                <div key={time} className="rounded-lg bg-purple-600/10 border border-purple-600/20 p-3">
                  <p className="text-sm font-medium text-foreground">{time}</p>
                  <p className="text-xs text-muted-foreground mt-1">{label}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2 h-7 text-xs bg-transparent"
                    disabled={isPastDate}
                    onClick={() => {
                      setNewAppointment({ ...newAppointment, time })
                      setIsDialogOpen(true)
                    }}
                  >
                    Agendar
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
