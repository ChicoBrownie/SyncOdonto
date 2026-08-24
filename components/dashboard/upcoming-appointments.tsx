"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Calendar, Clock, Loader2, Plus } from "lucide-react"
import { updateAppointment, useDashboard } from "@/lib/hooks/use-data"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

export function UpcomingAppointments() {
  const { upcomingAppointments, isLoading, mutate } = useDashboard()
  const [startingId, setStartingId] = useState<string | null>(null)
  const router = useRouter()

  const startAppointment = async (appointment: any) => {
    setStartingId(appointment.id)
    const current = upcomingAppointments || []
    await mutate(
      (cached: any) => ({
        ...cached,
        upcomingAppointments: (cached?.upcomingAppointments || []).filter((item: any) => item.id !== appointment.id),
      }),
      { revalidate: false }
    )
    try {
      await updateAppointment(appointment.id, { status: "Em Andamento" } as any)
      await mutate()
      router.push(`/prontuario/${appointment.patient_id}`)
    } catch (error) {
      await mutate((cached: any) => ({ ...cached, upcomingAppointments: current }), { revalidate: false })
      toast.error(error instanceof Error ? error.message : "Não foi possível iniciar o atendimento")
    } finally {
      setStartingId(null)
    }
  }

  const formatTime = (timeString: string) => {
    if (!timeString) return "--:--"
    return timeString.substring(0, 5)
  }

  const today = new Date().toLocaleDateString("pt-BR", {
    day: "numeric",
    month: "long",
  })

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Proximos Atendimentos
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">Hoje, {today}</p>
        </div>
        <Link href="/agenda">
          <Button variant="outline" size="sm" className="gap-2 bg-transparent">
            <Plus className="h-4 w-4" />
            Agendar
          </Button>
        </Link>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !upcomingAppointments || upcomingAppointments.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">Nenhum atendimento agendado</p>
            <Link href="/agenda">
              <Button className="mt-4 bg-transparent" variant="outline">
                Agendar consulta
              </Button>
            </Link>
          </div>
        ) : (
          upcomingAppointments.map((appointment) => (
            <div
              key={appointment.id}
              className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-3"
            >
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center rounded-lg bg-primary/10 px-3 py-2">
                  <Clock className="h-4 w-4 text-primary mr-1" />
                  <span className="text-sm font-medium text-foreground">
                    {formatTime(appointment.time)}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {appointment.patient?.full_name || "Paciente"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {appointment.procedure_type}
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                disabled={startingId === appointment.id}
                onClick={() => startAppointment(appointment)}
              >
                {startingId === appointment.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Iniciar
              </Button>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}
