"use client"

import { Card, CardContent } from "@/components/ui/card"
import type { SustainabilityMetrics } from "@/lib/sustainability/calculate-sustainability-metrics"
import { Droplets, Info, Leaf, Trees, Wind } from "lucide-react"
import useSWR from "swr"

const numberFormatter = new Intl.NumberFormat("pt-BR")
const decimalFormatter = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 3 })

const fetcher = async (url: string) => {
  const response = await fetch(url)
  const payload = await response.json()
  if (!response.ok) throw new Error(payload.error || "Erro ao carregar impacto ambiental")
  return payload
}

function formatTrees(value: number, sheets: number) {
  return sheets > 10_000 ? numberFormatter.format(Math.round(value)) : decimalFormatter.format(value)
}

export function SustainabilityImpact() {
  const { data, error, isLoading } = useSWR<{ data: SustainabilityMetrics }>(
    "/api/sustainability-metrics",
    fetcher,
  )
  const impact = data?.data.month

  const metrics = [
    {
      icon: Leaf,
      label: "Papel Economizado",
      value: numberFormatter.format(impact?.sheets ?? 0),
      subtitle: "Folhas este mês",
      color: "text-success",
      bgColor: "bg-success/10",
    },
    {
      icon: Trees,
      label: "Árvores Preservadas",
      value: formatTrees(impact?.trees ?? 0, impact?.sheets ?? 0),
      subtitle: "Equivalente este mês",
      color: "text-success",
      bgColor: "bg-success/10",
    },
    {
      icon: Wind,
      label: "CO₂ Reduzido",
      value: `${decimalFormatter.format(impact?.co2Kg ?? 0)} kg`,
      subtitle: "Emissões evitadas",
      color: "text-success",
      bgColor: "bg-success/10",
    },
    {
      icon: Droplets,
      label: "Água Economizada",
      value: `${numberFormatter.format(impact?.waterLiters ?? 0)} L`,
      subtitle: "Litros preservados",
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
  ]

  return (
    <Card className="border-success/20 bg-success/5">
      <CardContent className="p-6">
        <div className="flex items-start gap-3 mb-4">
          <Leaf className="h-6 w-6 text-success mt-1" />
          <div>
            <h2 className="text-lg font-semibold text-foreground">Impacto Sustentável da Clínica</h2>
            <p className="text-sm text-muted-foreground">
              {data ? `${numberFormatter.format(data.data.allTime.documents)} documentos digitais no acumulado` : "Sua contribuição para um futuro mais verde"}
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {metrics.map((metric) => {
            const Icon = metric.icon
            return (
              <div key={metric.label} className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-center gap-2">
                  <div className={`rounded-lg p-2 ${metric.bgColor}`}>
                    <Icon className={`h-4 w-4 ${metric.color}`} />
                  </div>
                  <p className="text-xs text-muted-foreground">{metric.label}</p>
                </div>
                <p className={`mt-2 text-2xl font-bold text-foreground ${isLoading ? "animate-pulse" : ""}`}>{metric.value}</p>
                <p className="text-xs text-muted-foreground">{metric.subtitle}</p>
              </div>
            )
          })}
        </div>
        <div className="mt-4 flex items-start gap-1.5 text-xs text-muted-foreground" role="note">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>
            {error
              ? "Não foi possível atualizar as métricas agora. Tente novamente em instantes."
              : "Cálculo estimado com base nos documentos digitais emitidos pela clínica neste mês (3 folhas por documento)."}
          </span>
        </div>
      </CardContent>
    </Card>
  )
}
