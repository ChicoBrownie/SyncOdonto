"use client"

import { useState, useCallback, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { DentalChart, type ToothCondition, CONDITIONS } from "./dental-chart"
import { ChartLegend } from "./chart-legend"
import { Badge } from "@/components/ui/badge"

interface DentalChartViewProps {
  patientId?: string
}

export function DentalChartView({ patientId }: DentalChartViewProps) {
  const [selectedTooth, setSelectedTooth] = useState<number | null>(null)
  const [toothData, setToothData] = useState<Record<number, ToothCondition>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [savingTooth, setSavingTooth] = useState<number | null>(null)

  // Carrega os dados do banco ao montar o componente
  useEffect(() => {
    if (!patientId) return

    setIsLoading(true)
    fetch(`/api/dental-charts?patientId=${patientId}`)
      .then(r => r.json())
      .then(({ data }) => {
        if (!data) return
        const mapped: Record<number, ToothCondition> = {}
        for (const row of data) {
          mapped[row.tooth_number] = row.condition
        }
        setToothData(mapped)
      })
      .catch(console.error)
      .finally(() => setIsLoading(false))
  }, [patientId])

  // Salva no banco ao alterar condição
  const handleConditionChange = useCallback(async (tooth: number, condition: ToothCondition) => {
    // Atualiza o estado local imediatamente (otimista)
    setToothData(prev => {
      const updated = { ...prev }
      if (condition === "none") {
        delete updated[tooth]
      } else {
        updated[tooth] = condition
      }
      return updated
    })

    if (!patientId) return

    setSavingTooth(tooth)
    try {
      await fetch("/api/dental-charts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patient_id: patientId,
          tooth_number: tooth,
          condition: condition === "none" ? null : condition,
          notes: null,
        }),
      })
    } catch (err) {
      console.error("Erro ao salvar condição do dente:", err)
    } finally {
      setSavingTooth(null)
    }
  }, [patientId])

  const selectedCondition = selectedTooth ? toothData[selectedTooth] || "none" : null
  const selectedConditionDef = selectedCondition ? CONDITIONS.find(c => c.value === selectedCondition) : null

  const registeredCount = Object.keys(toothData).length

  return (
    <div className="space-y-6">
      {/* Legend */}
      <ChartLegend />

      {/* Dental Chart */}
      <Card>
        <CardContent className="p-6">
          {isLoading ? (
            <div className="flex items-center justify-center h-40">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : (
            <DentalChart
              selectedTooth={selectedTooth}
              onToothSelect={setSelectedTooth}
              toothData={toothData}
              onConditionChange={handleConditionChange}
            />
          )}

          <div className="mt-6 flex items-center justify-center gap-3">
            <p className="text-xs text-muted-foreground">
              {savingTooth
                ? `Salvando dente ${savingTooth}...`
                : "Clique em um dente para alterar sua condição"}
              {registeredCount > 0 && !savingTooth && (
                <span className="ml-2 text-foreground font-medium">
                  ({registeredCount} dente{registeredCount !== 1 ? "s" : ""} registrado{registeredCount !== 1 ? "s" : ""})
                </span>
              )}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Selected tooth info */}
      {selectedTooth && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">Dente {selectedTooth}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {selectedConditionDef?.value === "none"
                    ? "Nenhuma condição registrada. Clique no dente para selecionar."
                    : `Condição: ${selectedConditionDef?.label}`
                  }
                </p>
              </div>
              {selectedConditionDef && selectedConditionDef.value !== "none" && (
                <Badge className={`${selectedConditionDef.dotColor} text-white`}>
                  {selectedConditionDef.label}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
