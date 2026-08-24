"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, Calendar, Brain, BarChart3, DollarSign, Loader2 } from "lucide-react"
import Link from "next/link"
import useSWR from "swr"

const quickAccessItems = [
  {
    icon: Users,
    label: "Pacientes",
    href: "/pacientes",
    color: "text-primary",
    bgColor: "bg-primary/10",
  },
  {
    icon: Calendar,
    label: "Agenda",
    href: "/agenda",
    color: "text-success",
    bgColor: "bg-success/10",
  },
  {
    icon: Brain,
    label: "Análise IA",
    href: "/analise-ia",
    color: "text-purple-600",
    bgColor: "bg-purple-600/10",
  },
  {
    icon: BarChart3,
    label: "Relatórios",
    href: "/relatorios",
    color: "text-warning",
    bgColor: "bg-warning/10",
    permission: "relatorios" as const,
  },
  {
    icon: DollarSign,
    label: "Financeiro",
    href: "/gestao-clinica?tab=financeiro",
    color: "text-emerald-600",
    bgColor: "bg-emerald-600/10",
    permission: "financeiro" as const,
  },
]

export function QuickAccess() {
  const { data, isLoading } = useSWR("/api/auth/check-access", (url) =>
    fetch(url).then((response) => response.ok ? response.json() : null)
  )
  const items = quickAccessItems.filter((item) =>
    !("permission" in item) || data?.permissions?.[item.permission!]
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>Acesso Rápido</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {items.map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex flex-col items-center gap-3 rounded-lg border border-border bg-muted/30 p-6 transition-colors hover:bg-muted"
              >
                <div className={`rounded-lg p-3 ${item.bgColor}`}>
                  <Icon className={`h-6 w-6 ${item.color}`} />
                </div>
                <span className="text-sm font-medium text-center">{item.label}</span>
              </Link>
            )
          })}
        </div>}
      </CardContent>
    </Card>
  )
}
