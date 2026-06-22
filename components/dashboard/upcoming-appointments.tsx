"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Calendar, Clock, Loader2, Plus } from "lucide-react"
import { useDashboard } from "@/lib/hooks/use-data"
import Link from "next/link"

export function UpcomingAppointments() {
  const { upcomingAppointments, isLoading } = useDashboard()

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
              {appointment.status === "Concluída" ? (
                <span className="text-xs text-muted-foreground px-3 py-1.5 rounded-md bg-muted">
                  Encerrado
                </span>
              ) : appointment.status === "Cancelada" ? (
                <span className="text-xs text-red-600 px-3 py-1.5 rounded-md bg-red-50">
                  Cancelada
                </span>
              ) : (
                <Link href={`/prontuario/${appointment.patient_id}`}>
                  <Button size="sm">Iniciar</Button>
                </Link>
              )}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}
