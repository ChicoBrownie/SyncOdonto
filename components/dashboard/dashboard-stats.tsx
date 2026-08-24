"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Users, CheckCircle, Calendar, Loader2 } from "lucide-react"
import { useDashboard } from "@/lib/hooks/use-data"

export function DashboardStats() {
  const { stats, isLoading } = useDashboard()

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6 flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  const statsData = [
    {
      icon: Users,
      label: "Pacientes Ativos",
      value: stats?.totalPatients?.toString() || "0",
      subtitle: "Total cadastrados",
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      icon: Calendar,
      label: "Consultas Hoje",
      value: stats?.appointmentsToday?.toString() || "0",
      subtitle: "Agendamentos do dia",
      color: "text-blue-600",
      bgColor: "bg-blue-600/10",
    },
    {
      icon: CheckCircle,
      label: "Tratamentos Pendentes",
      value: stats?.pendingTreatments?.toString() || "0",
      subtitle: "Em andamento",
      color: "text-amber-600",
      bgColor: "bg-amber-600/10",
    },
  ]

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {statsData.map((stat) => {
        const Icon = stat.icon
        return (
          <Card key={stat.label}>
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <div className={`rounded-lg p-2 ${stat.bgColor}`}>
                      <Icon className={`h-5 w-5 ${stat.color}`} />
                    </div>
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">{stat.label}</p>
                  <p className="mt-1 text-2xl font-bold text-foreground">{stat.value}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{stat.subtitle}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
