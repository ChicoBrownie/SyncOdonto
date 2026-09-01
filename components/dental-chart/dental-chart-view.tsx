"use client"

import { useCallback, useEffect, useState } from "react"
import { CheckSquare, Info, Loader2, X } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ChartLegend } from "./chart-legend"
import {
  CONDITIONS, CONDITION_TO_DB, DB_TO_CONDITION, DentalChart, SURFACE_LABELS,
  type DentalSurface, type ToothArea, type ToothCondition, type ToothState,
} from "./dental-chart"

interface DentalChartViewProps { patientId?: string }

const emptyTooth = (): ToothState => ({ surfaces: {} })

export function DentalChartView({ patientId }: DentalChartViewProps) {
  const [selectedTooth, setSelectedTooth] = useState<number | null>(null)
  const [selectedArea, setSelectedArea] = useState<ToothArea | null>(null)
  const [toothData, setToothData] = useState<Record<number, ToothState>>({})
  const [dentition, setDentition] = useState<"permanent" | "deciduous">("permanent")
  const [isLoading, setIsLoading] = useState(false)
  const [savingTooth, setSavingTooth] = useState<number | null>(null)
  const [multiSelectMode, setMultiSelectMode] = useState(false)
  const [selectedTeeth, setSelectedTeeth] = useState<Set<number>>(new Set())
  const [isBulkSaving, setIsBulkSaving] = useState(false)

  useEffect(() => {
    if (!patientId) return
    setIsLoading(true)
    fetch(`/api/dental-charts?patientId=${patientId}`)
      .then(async (response) => {
        const body = await response.json()
        if (!response.ok) throw new Error(body.error || "Não foi possível carregar o odontograma.")
        return body
      })
      .then(({ data }) => {
        const mapped: Record<number, ToothState> = {}
        for (const row of data || []) {
          const surfaces: ToothState["surfaces"] = {}
          for (const [surface, dbCondition] of Object.entries(row.surface_conditions || {})) {
            const condition = DB_TO_CONDITION[String(dbCondition)]
            if (condition) surfaces[surface as DentalSurface] = condition
          }
          mapped[row.tooth_number] = { whole: DB_TO_CONDITION[row.condition], surfaces }
        }
        setToothData(mapped)
      })
      .catch((error) => toast.error(error instanceof Error ? error.message : "Erro ao carregar odontograma"))
      .finally(() => setIsLoading(false))
  }, [patientId])

  const saveState = async (tooth: number, state: ToothState) => {
    if (!patientId) return
    const surfaceConditions = Object.fromEntries(Object.entries(state.surfaces)
      .map(([surface, condition]) => [surface, CONDITION_TO_DB[condition]])
      .filter(([, condition]) => condition !== null))
    const hasData = Boolean(state.whole) || Object.keys(surfaceConditions).length > 0

    if (!hasData) {
      const response = await fetch(`/api/dental-charts?patientId=${patientId}&toothNumber=${tooth}`, { method: "DELETE" })
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || `Erro ao limpar dente ${tooth}`)
      return
    }
    const response = await fetch("/api/dental-charts", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        patient_id: patientId,
        tooth_number: tooth,
        condition: state.whole ? CONDITION_TO_DB[state.whole] : null,
        surface_conditions: surfaceConditions,
        notes: null,
      }),
    })
    if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || `Erro ao salvar dente ${tooth}`)
  }

  const updateArea = useCallback(async (condition: ToothCondition) => {
    if (!selectedTooth || !selectedArea) return
    const tooth = selectedTooth
    const previous = toothData[tooth] || emptyTooth()
    const next: ToothState = { whole: previous.whole, surfaces: { ...previous.surfaces } }
    const value = condition === "Sem Registros" ? undefined : condition
    if (selectedArea === "whole") {
      next.whole = value
      if (value) next.surfaces = {}
    } else if (value) next.surfaces[selectedArea] = value
    else delete next.surfaces[selectedArea]

    setToothData((current) => ({ ...current, [tooth]: next }))
    setSavingTooth(tooth)
    try { await saveState(tooth, next); toast.success(`Dente ${tooth} atualizado`) }
    catch (error) {
      setToothData((current) => ({ ...current, [tooth]: previous }))
      toast.error(error instanceof Error ? error.message : "Erro ao salvar alteração")
    } finally { setSavingTooth(null) }
  }, [patientId, selectedArea, selectedTooth, toothData])

  const selectArea = (tooth: number, area: ToothArea) => { setSelectedTooth(tooth); setSelectedArea(area) }
  const toggleTooth = (tooth: number) => setSelectedTeeth((current) => {
    const next = new Set(current); next.has(tooth) ? next.delete(tooth) : next.add(tooth); return next
  })
  const exitMultiSelect = () => { setMultiSelectMode(false); setSelectedTeeth(new Set()) }

  const applyBulk = async (condition: ToothCondition) => {
    if (!patientId || selectedTeeth.size === 0) return
    const previous = { ...toothData }
    const teeth = [...selectedTeeth]
    const nextStates = teeth.map((tooth) => [tooth, condition === "Sem Registros" ? emptyTooth() : { whole: condition, surfaces: {} }] as const)
    setToothData((current) => ({ ...current, ...Object.fromEntries(nextStates) }))
    setIsBulkSaving(true)
    try {
      await Promise.all(nextStates.map(([tooth, state]) => saveState(tooth, state)))
      toast.success(`${teeth.length} dentes atualizados`); exitMultiSelect()
    } catch (error) { setToothData(previous); toast.error(error instanceof Error ? error.message : "Erro ao salvar dentes") }
    finally { setIsBulkSaving(false) }
  }

  const registeredCount = Object.values(toothData).filter((state) => state.whole || Object.keys(state.surfaces).length).length
  const currentCondition = selectedTooth && selectedArea
    ? selectedArea === "whole" ? toothData[selectedTooth]?.whole : toothData[selectedTooth]?.surfaces[selectedArea]
    : undefined

  return <div className="space-y-5">
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <ChartLegend />
      {!multiSelectMode
        ? <Button variant="outline" size="sm" onClick={() => { setSelectedTooth(null); setSelectedArea(null); setMultiSelectMode(true) }}><CheckSquare className="mr-2 h-4 w-4" />Selecionar vários dentes</Button>
        : <Button variant="ghost" size="sm" onClick={exitMultiSelect}><X className="mr-2 h-4 w-4" />Cancelar seleção</Button>}
    </div>

    <Card><CardContent className="p-3 sm:p-6">
      <Tabs value={dentition} onValueChange={(value) => { setDentition(value as typeof dentition); setSelectedTooth(null); setSelectedArea(null) }} className="mb-6">
        <TabsList className="mx-auto grid w-full max-w-sm grid-cols-2"><TabsTrigger value="permanent">Permanentes</TabsTrigger><TabsTrigger value="deciduous">Decíduos</TabsTrigger></TabsList>
      </Tabs>
      {isLoading ? <div className="flex h-48 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>
        : <DentalChart selectedTooth={selectedTooth} selectedArea={selectedArea} onAreaSelect={selectArea} toothData={toothData} multiSelectMode={multiSelectMode} selectedTeeth={selectedTeeth} onToggleToothSelection={toggleTooth} dentition={dentition} />}
      <p className="mt-4 text-center text-xs text-muted-foreground">{savingTooth ? `Salvando dente ${savingTooth}...` : `${registeredCount} dente${registeredCount === 1 ? "" : "s"} com registro`}</p>
    </CardContent></Card>

    {!multiSelectMode && selectedTooth && selectedArea && <Card className="border-primary/40"><CardContent className="p-4 sm:p-5">
      <div className="mb-4 flex items-start gap-3"><Info className="mt-0.5 h-5 w-5 text-primary" /><div><p className="font-semibold">Dente {selectedTooth} — {SURFACE_LABELS[selectedArea]}</p><p className="text-sm text-muted-foreground">{currentCondition ? `Registro atual: ${currentCondition}` : "Escolha a condição encontrada nesta região."}</p></div></div>
      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">{CONDITIONS.map((item) => <Button key={item.value} size="sm" variant={currentCondition === item.value ? "default" : "outline"} disabled={savingTooth === selectedTooth} className="justify-start gap-2" onClick={() => updateArea(item.value)}><span className={`h-3 w-3 rounded-full ${item.dotColor}`} />{item.label}</Button>)}</div>
    </CardContent></Card>}

    {multiSelectMode && selectedTeeth.size > 0 && <Card className="border-primary/40"><CardContent className="p-4"><p className="mb-3 text-sm font-medium">Aplicar ao dente inteiro em {selectedTeeth.size} selecionados:</p><div className="flex flex-wrap gap-2">{CONDITIONS.map((item) => <Button key={item.value} size="sm" variant="outline" disabled={isBulkSaving} onClick={() => applyBulk(item.value)}><span className={`mr-2 h-3 w-3 rounded-full ${item.dotColor}`} />{item.label}</Button>)}</div></CardContent></Card>}
  </div>
}
