"use client"

import { useState, useCallback, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { DentalChart, type ToothCondition, CONDITIONS, CONDITION_TO_DB, DB_TO_CONDITION } from "./dental-chart"
import { ChartLegend } from "./chart-legend"
import { Badge } from "@/components/ui/badge"
import { CheckSquare, X } from "lucide-react"
import { toast } from "sonner"

interface DentalChartViewProps {
  patientId?: string
}

export function DentalChartView({ patientId }: DentalChartViewProps) {
  const [selectedTooth, setSelectedTooth] = useState<number | null>(null)
  const [toothData, setToothData] = useState<Record<number, ToothCondition>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [savingTooth, setSavingTooth] = useState<number | null>(null)

  const [multiSelectMode, setMultiSelectMode] = useState(false)
  const [selectedTeeth, setSelectedTeeth] = useState<Set<number>>(new Set())
  const [isBulkSaving, setIsBulkSaving] = useState(false)

  useEffect(() => {
    if (!patientId) return

    setIsLoading(true)
    fetch(`/api/dental-charts?patientId=${patientId}`)
      .then(r => r.json())
      .then(({ data }) => {
        if (!data) return
        const mapped: Record<number, ToothCondition> = {}
        for (const row of data) {
          // row.condition vem do banco em inglês (healthy, caries, filled...);
          // traduzimos de volta para o valor em português usado na UI.
          const uiCondition = DB_TO_CONDITION[row.condition]
          if (uiCondition) {
            mapped[row.tooth_number] = uiCondition
          }
        }
        setToothData(mapped)
      })
      .catch(console.error)
      .finally(() => setIsLoading(false))
  }, [patientId])

  const saveTooth = async (tooth: number, condition: ToothCondition) => {
    const dbCondition = CONDITION_TO_DB[condition]

    if (dbCondition === null) {
      // "Sem Registros" não existe como valor no banco — a ausência de linha
      // é o que representa essa condição, então apagamos o registro.
      const res = await fetch(
        `/api/dental-charts?patientId=${patientId}&toothNumber=${tooth}`,
        { method: "DELETE" },
      )
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `Erro ao limpar dente ${tooth}`)
      }
      return
    }

    const res = await fetch("/api/dental-charts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        patient_id: patientId,
        tooth_number: tooth,
        condition: dbCondition,
        notes: null,
      }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || `Erro ao salvar dente ${tooth}`)
    }
  }

  const handleConditionChange = useCallback(async (tooth: number, condition: ToothCondition) => {
    const previous = toothData[tooth]

    setToothData(prev => {
      const updated = { ...prev }
      if (condition === "Sem Registros") delete updated[tooth]
      else updated[tooth] = condition
      return updated
    })

    if (!patientId) return

    setSavingTooth(tooth)
    try {
      await saveTooth(tooth, condition)
    } catch (err) {
      setToothData(prev => {
        const reverted = { ...prev }
        if (!previous || previous === "Sem Registros") delete reverted[tooth]
        else reverted[tooth] = previous
        return reverted
      })
      toast.error(err instanceof Error ? err.message : "Erro ao salvar dente")
    } finally {
      setSavingTooth(null)
    }
  }, [patientId, toothData])

  const toggleToothSelection = useCallback((tooth: number) => {
    setSelectedTeeth(prev => {
      const next = new Set(prev)
      if (next.has(tooth)) next.delete(tooth)
      else next.add(tooth)
      return next
    })
  }, [])

  const exitMultiSelect = () => {
    setMultiSelectMode(false)
    setSelectedTeeth(new Set())
  }

  const applyConditionToSelected = async (condition: ToothCondition) => {
    if (selectedTeeth.size === 0 || !patientId) return
    setIsBulkSaving(true)

    const teeth = Array.from(selectedTeeth)
    const previousData = { ...toothData }

    setToothData(prev => {
      const updated = { ...prev }
      for (const tooth of teeth) {
        if (condition === "Sem Registros") delete updated[tooth]
        else updated[tooth] = condition
      }
      return updated
    })

    try {
      await Promise.all(teeth.map(tooth => saveTooth(tooth, condition)))
      toast.success(`${teeth.length} dente${teeth.length !== 1 ? "s" : ""} atualizado${teeth.length !== 1 ? "s" : ""}`)
      exitMultiSelect()
    } catch (err) {
      setToothData(previousData)
      toast.error(err instanceof Error ? err.message : "Erro ao salvar alterações em lote")
    } finally {
      setIsBulkSaving(false)
    }
  }

  const selectedCondition = selectedTooth ? toothData[selectedTooth] || "Sem Registros" : null
  const selectedConditionDef = selectedCondition ? CONDITIONS.find(c => c.value === selectedCondition) : null

  const registeredCount = Object.keys(toothData).length

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ChartLegend />
        {!multiSelectMode ? (
          <Button
            variant="outline"
            size="sm"
            className="gap-2 bg-transparent"
            onClick={() => { setSelectedTooth(null); setMultiSelectMode(true) }}
          >
            <CheckSquare className="h-4 w-4" />
            Selecionar vários dentes
          </Button>
        ) : (
          <Button variant="ghost" size="sm" className="gap-2" onClick={exitMultiSelect}>
            <X className="h-4 w-4" />
            Cancelar seleção
          </Button>
        )}
      </div>

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
              multiSelectMode={multiSelectMode}
              selectedTeeth={selectedTeeth}
              onToggleToothSelection={toggleToothSelection}
            />
          )}

          <div className="mt-6 flex items-center justify-center gap-3">
            <p className="text-xs text-muted-foreground">
              {multiSelectMode
                ? `${selectedTeeth.size} dente${selectedTeeth.size !== 1 ? "s" : ""} selecionado${selectedTeeth.size !== 1 ? "s" : ""}. Clique nos dentes para marcar/desmarcar.`
                : savingTooth
                  ? `Salvando dente ${savingTooth}...`
                  : "Clique em um dente para alterar sua condição"}
              {registeredCount > 0 && !savingTooth && !multiSelectMode && (
                <span className="ml-2 text-foreground font-medium">
                  ({registeredCount} dente{registeredCount !== 1 ? "s" : ""} registrado{registeredCount !== 1 ? "s" : ""})
                </span>
              )}
            </p>
          </div>
        </CardContent>
      </Card>

      {multiSelectMode && selectedTeeth.size > 0 && (
        <Card className="border-primary/40">
          <CardContent className="p-4">
            <p className="text-sm font-medium text-foreground mb-3">
              Aplicar condição a {selectedTeeth.size} dente{selectedTeeth.size !== 1 ? "s" : ""}:
            </p>
            <div className="flex flex-wrap gap-2">
              {CONDITIONS.map(c => (
                <Button
                  key={c.value}
                  size="sm"
                  variant="outline"
                  disabled={isBulkSaving}
                  className="gap-2 bg-transparent"
                  onClick={() => applyConditionToSelected(c.value)}
                >
                  <div className={`h-3 w-3 rounded-full ${c.dotColor}`} />
                  {c.label}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {!multiSelectMode && selectedTooth && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">Dente {selectedTooth}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {selectedConditionDef?.value === "Sem Registros"
                    ? "Nenhuma condição registrada. Clique no dente para selecionar."
                    : `Condição: ${selectedConditionDef?.label}`}
                </p>
              </div>
              {selectedConditionDef && selectedConditionDef.value !== "Sem Registros" && (
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
