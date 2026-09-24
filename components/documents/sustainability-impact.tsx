"use client"

import { Card, CardContent } from "@/components/ui/card"
import type { SustainabilityMetrics } from "@/lib/sustainability/calculate-sustainability-metrics"
import { Droplets, Info, Leaf, Printer, Recycle, Trees, Wind } from "lucide-react"
import useSWR from "swr"

const numberFormatter = new Intl.NumberFormat("pt-BR")
const decimalFormatter = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 3 })
const compactDecimalFormatter = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

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
  const impact = data?.data.allTime
  const monthDocuments = data?.data.month.documents ?? 0

  const metrics = [
    {
      icon: Leaf,
      label: "Papel Economizado",
      value: numberFormatter.format(impact?.sheets ?? 0),
      subtitle: "Folhas no acumulado",
      color: "text-success",
      bgColor: "bg-success/10",
    },
    {
      icon: Trees,
      label: "Árvores Preservadas",
      value: formatTrees(impact?.trees ?? 0, impact?.sheets ?? 0),
      subtitle: "Equivalente no acumulado",
      color: "text-success",
      bgColor: "bg-success/10",
    },
    {
      icon: Wind,
      label: "CO₂ Reduzido",
      value: `${decimalFormatter.format(impact?.co2Kg ?? 0)} kg`,
      subtitle: "Emissões evitadas no acumulado",
      color: "text-success",
      bgColor: "bg-success/10",
    },
    {
      icon: Droplets,
      label: "Água Economizada",
      value: `${numberFormatter.format(impact?.waterLiters ?? 0)} L`,
      subtitle: "Litros preservados no acumulado",
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      icon: Printer,
      label: "Tinta Evitada",
      value: `${decimalFormatter.format(impact?.inkMl ?? 0)} mL`,
      subtitle: "Estimativa de impressão no acumulado",
      color: "text-amber-700",
      bgColor: "bg-amber-100",
    },
    {
      icon: Recycle,
      label: "Cartuchos Equivalentes",
      value: compactDecimalFormatter.format(impact?.cartridgeEquivalents ?? 0),
      subtitle: "Referência de cartucho de tinta de 8 mL",
      color: "text-amber-700",
      bgColor: "bg-amber-100",
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
            {data && <p className="mt-1 text-xs text-muted-foreground">{numberFormatter.format(monthDocuments)} {monthDocuments === 1 ? "documento emitido" : "documentos emitidos"} neste mês</p>}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50/70 p-4 text-sm text-amber-950">
          <div className="flex items-start gap-2">
            <Printer className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
            <div>
              <p className="font-medium">Por que reduzir tinta e cartuchos importa?</p>
              <p className="mt-1 text-xs leading-5 text-amber-900/80">Tintas e toners variam muito na composição. Dependendo do produto e do descarte, podem envolver pigmentos, solventes e embalagens plásticas; por isso, menos impressão reduz a demanda por esses insumos e por cartuchos. Quando houver impressão, dê preferência à coleta e à remanufatura do cartucho.</p>
            </div>
          </div>
        </div>
        <div className="mt-4 flex items-start gap-1.5 text-xs text-muted-foreground" role="note">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>
            {error
              ? "Não foi possível atualizar as métricas agora. Tente novamente em instantes."
              : "Cálculo estimado com base em todos os documentos digitais emitidos: 3 folhas por documento e 0,05 mL de tinta por folha. A estimativa de cartucho usa 8 mL; ela varia conforme impressora e cobertura da página."}
          </span>
        </div>
      </CardContent>
    </Card>
  )
}
