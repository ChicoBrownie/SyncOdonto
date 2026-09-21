"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Check, CheckCircle2, Clock3, History, Loader2,
  Pencil, Plus, Sparkles, Trash2, X,
} from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import {
  CONDITIONS, CONDITION_TO_DB, DB_TO_CONDITION, DentalChart, SURFACE_LABELS,
  type ToothArea, type ToothCondition, type ToothRegion, type ToothState, type ToothTreatmentIndicators,
} from "./dental-chart"

type CatalogItem = {
  id: string
  name: string
  description: string | null
  default_price: number
  is_favorite: boolean
  is_active: boolean
}

type TreatmentItem = {
  id: string
  tooth_number: number | null
  tooth_area: ToothArea | null
  problem: string | null
  procedure_id: string | null
  appointment_id: string | null
  treatment_type: string
  description: string | null
  status: "planned" | "in_progress" | "completed" | "cancelled"
  cost: number | null
  notes: string | null
  result_condition: string | null
  created_at: string
}

type ChartVersion = {
  id: string
  version_number: number
  snapshot_type: "initial" | "appointment_closed"
  snapshot: { teeth?: any[]; treatments?: TreatmentItem[] } | any[]
  professional_name: string
  appointment_id: string | null
  created_at: string
}

interface DentalChartViewProps {
  patientId?: string
  appointmentId?: string | null
  professionalName?: string | null
  onTreatmentTotalChange?: (total: number) => void
}

const emptyTooth = (): ToothState => ({ surfaces: {} })
const today = () => new Date().toISOString().slice(0, 10)
const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })
const plannedTreatmentColors = ["#f59e0b", "#ef4444", "#92400e"]

function versionLabel(version: ChartVersion, versions: ChartVersion[]) {
  if (version.snapshot_type === "initial") return "Estado inicial"
  const closedVersions = versions.filter((item) => item.snapshot_type === "appointment_closed").reverse()
  return `Atendimento ${closedVersions.findIndex((item) => item.id === version.id) + 1}`
}

function rowsToToothData(rows: any[]): Record<number, ToothState> {
  const mapped: Record<number, ToothState> = {}
  for (const row of rows || []) {
    const surfaces: ToothState["surfaces"] = {}
    for (const [surface, dbCondition] of Object.entries(row.surface_conditions || {})) {
      const condition = DB_TO_CONDITION[String(dbCondition)]
      if (condition) surfaces[surface as ToothRegion] = condition
    }
    mapped[row.tooth_number] = { whole: DB_TO_CONDITION[row.condition], surfaces }
  }
  return mapped
}

async function responseData(response: Response) {
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.error || "Não foi possível concluir a operação.")
  return body
}

function suggestedResult(name: string): ToothCondition | "" {
  const normalized = name.toLocaleLowerCase("pt-BR")
  if (normalized.includes("restaura")) return "Restaurado"
  if (normalized.includes("canal") || normalized.includes("endodont")) return "Canal tratado"
  if (normalized.includes("implante")) return "Implante"
  if (normalized.includes("extra") || normalized.includes("exodont")) return "Ausente"
  if (normalized.includes("coroa")) return "Coroa"
  return ""
}

function suggestedProblem(name: string) {
  const normalized = name.toLocaleLowerCase("pt-BR")
  if (normalized.includes("restaura")) return "Cárie"
  if (normalized.includes("canal") || normalized.includes("endodont")) return "Necessidade de tratamento de canal"
  if (normalized.includes("extra") || normalized.includes("exodont")) return "Indicação de extração"
  if (normalized.includes("limpeza") || normalized.includes("profilax")) return "Necessidade de profilaxia"
  return "Avaliação odontológica"
}

export function DentalChartView({ patientId, appointmentId, professionalName, onTreatmentTotalChange }: DentalChartViewProps) {
  const [selectedTooth, setSelectedTooth] = useState<number | null>(null)
  const [selectedArea, setSelectedArea] = useState<ToothArea | null>(null)
  const [toothData, setToothData] = useState<Record<number, ToothState>>({})
  const [dentition, setDentition] = useState<"permanent" | "deciduous">("permanent")
  const [isLoading, setIsLoading] = useState(false)
  const [savingTooth, setSavingTooth] = useState<number | null>(null)
  const [viewMode, setViewMode] = useState<"current" | "history">("current")

  const [catalog, setCatalog] = useState<CatalogItem[]>([])
  const [treatments, setTreatments] = useState<TreatmentItem[]>([])
  const [versions, setVersions] = useState<ChartVersion[]>([])
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null)
  const [selectedProcedureId, setSelectedProcedureId] = useState("")
  const [problem, setProblem] = useState("")
  const [notes, setNotes] = useState("")
  const [savingItem, setSavingItem] = useState(false)
  const [showNotes, setShowNotes] = useState(false)
  const [removingItemId, setRemovingItemId] = useState<string | null>(null)

  const [catalogDialogOpen, setCatalogDialogOpen] = useState(false)
  const [procedurePickerOpen, setProcedurePickerOpen] = useState(false)
  const [procedureSearch, setProcedureSearch] = useState("")
  const [newProcedure, setNewProcedure] = useState({ name: "", description: "", price: "", favorite: false })
  const [savingProcedure, setSavingProcedure] = useState(false)
  const [editingTreatment, setEditingTreatment] = useState<TreatmentItem | null>(null)
  const [editPrice, setEditPrice] = useState("")
  const [editNotes, setEditNotes] = useState("")
  const [savingEdit, setSavingEdit] = useState(false)
  const [completeItem, setCompleteItem] = useState<TreatmentItem | null>(null)
  const [completionResult, setCompletionResult] = useState<ToothCondition | "">("")
  const [completingItem, setCompletingItem] = useState(false)
  const favoriteCount = catalog.filter((item) => item.is_favorite && item.is_active).length

  const loadVersions = useCallback(async () => {
    if (!patientId) return
    try {
      const body = await responseData(await fetch(`/api/dental-chart-versions?patientId=${patientId}`))
      const data = body.data || []
      setVersions(data)
      setSelectedVersionId((current) => current || data[0]?.id || null)
    } catch {
      // A tela atual continua utilizável antes da aplicação da migração 008.
      setVersions([])
    }
  }, [patientId])

  useEffect(() => {
    if (!patientId) return
    let cancelled = false
    setIsLoading(true)
    Promise.all([
      fetch(`/api/dental-charts?patientId=${patientId}`).then(responseData),
      fetch("/api/procedure-catalog").then(responseData),
      fetch(`/api/treatments?patient_id=${patientId}`).then(responseData),
    ])
      .then(([chartBody, catalogBody, treatmentBody]) => {
        if (cancelled) return
        setToothData(rowsToToothData(chartBody.data || []))
        setCatalog(catalogBody.data || [])
        setTreatments(treatmentBody.data || [])
      })
      .catch((error) => toast.error(error instanceof Error ? error.message : "Erro ao carregar odontograma"))
      .finally(() => { if (!cancelled) setIsLoading(false) })
    loadVersions()
    return () => { cancelled = true }
  }, [patientId, loadVersions])

  const encounterTreatments = useMemo(() => {
    if (appointmentId) return treatments.filter((item) => item.appointment_id === appointmentId)
    return treatments
  }, [appointmentId, treatments])
  const encounterTotal = useMemo(
    () => encounterTreatments.filter((item) => item.status !== "cancelled").reduce((sum, item) => sum + Number(item.cost || 0), 0),
    [encounterTreatments],
  )

  const treatmentIndicators = useMemo<ToothTreatmentIndicators>(() => {
    const mapped: ToothTreatmentIndicators = {}
    const plannedByArea = new Map<string, number>()
    treatments
      .filter((item) => item.status !== "cancelled" && item.tooth_number && item.tooth_area)
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .forEach((item) => {
        const tooth = item.tooth_number as number
        const area = item.tooth_area as ToothArea
        const key = `${tooth}-${area}`
        const plannedPosition = plannedByArea.get(key) || 0
        if (item.status !== "completed") plannedByArea.set(key, plannedPosition + 1)
        const color = item.status === "completed" ? "#22c55e" : plannedTreatmentColors[Math.min(plannedPosition, plannedTreatmentColors.length - 1)]
        if (!mapped[tooth]) mapped[tooth] = {}
        const indicators = mapped[tooth][area] || []
        indicators.push({ color, label: `${item.treatment_type} — ${item.status === "completed" ? "realizado" : "planejado"}` })
        mapped[tooth][area] = indicators
      })
    return mapped
  }, [treatments])

  useEffect(() => onTreatmentTotalChange?.(encounterTotal), [encounterTotal, onTreatmentTotalChange])

  const saveState = useCallback(async (tooth: number, state: ToothState) => {
    if (!patientId) return
    const surfaceConditions = Object.fromEntries(
      Object.entries(state.surfaces)
        .map(([surface, condition]) => [surface, CONDITION_TO_DB[condition]])
        .filter(([, condition]) => condition !== null),
    )
    await responseData(await fetch("/api/dental-charts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        patient_id: patientId,
        tooth_number: tooth,
        condition: state.whole ? CONDITION_TO_DB[state.whole] : null,
        surface_conditions: surfaceConditions,
        notes: null,
        appointment_id: appointmentId || null,
        professional_name: professionalName || null,
      }),
    }))
  }, [appointmentId, patientId, professionalName])

  const applyConditionToArea = useCallback(async (tooth: number, area: ToothArea, condition: ToothCondition) => {
    const previous = toothData[tooth] || emptyTooth()
    const next: ToothState = { whole: previous.whole, surfaces: { ...previous.surfaces } }
    const value = condition === "Sem Registros" ? undefined : condition
    if (area === "whole") {
      next.whole = value
      next.surfaces = {}
    } else if (value) {
      next.surfaces[area] = value
    } else {
      delete next.surfaces[area]
    }

    setToothData((current) => ({ ...current, [tooth]: next }))
    setSavingTooth(tooth)
    try {
      await saveState(tooth, next)
      await loadVersions()
    } catch (error) {
      setToothData((current) => ({ ...current, [tooth]: previous }))
      throw error
    } finally {
      setSavingTooth(null)
    }
  }, [loadVersions, saveState, toothData])

  const selectArea = (tooth: number, area: ToothArea) => {
    setSelectedTooth(tooth)
    setSelectedArea(area)
    const current = area === "whole" ? toothData[tooth]?.whole : toothData[tooth]?.surfaces[area]
    setProblem(current && current !== "Sem Registros" ? current : "")
  }

  const chooseProcedure = (item: CatalogItem) => {
    setSelectedProcedureId(item.id)
    setProblem(suggestedProblem(item.name))
    setProcedurePickerOpen(false)
    setProcedureSearch("")
  }

  const filteredCatalog = useMemo(() => {
    const query = procedureSearch.trim().toLocaleLowerCase("pt-BR")
    if (!query) return catalog
    return catalog.filter((item) => `${item.name} ${item.description || ""}`.toLocaleLowerCase("pt-BR").includes(query))
  }, [catalog, procedureSearch])

  const resetProcedureForm = () => {
    setSelectedProcedureId("")
    setProblem("")
    setNotes("")
    setShowNotes(false)
  }

  const saveNewProcedure = async () => {
    const parsedPrice = Number(newProcedure.price.replace(",", "."))
    if (newProcedure.name.trim().length < 2 || Number.isNaN(parsedPrice) || parsedPrice < 0) {
      toast.error("Informe o nome e um preço padrão válido.")
      return
    }
    if (newProcedure.favorite && favoriteCount >= 5) {
      toast.error("A clínica pode ter no máximo cinco opções rápidas.")
      return
    }
    setSavingProcedure(true)
    try {
      const body = await responseData(await fetch("/api/procedure-catalog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newProcedure.name.trim(),
          description: newProcedure.description.trim() || null,
          default_price: parsedPrice,
          is_favorite: newProcedure.favorite,
          is_active: true,
        }),
      }))
      setCatalog((current) => [...current, body.data].sort((a, b) => Number(b.is_favorite) - Number(a.is_favorite) || a.name.localeCompare(b.name)))
      chooseProcedure(body.data)
      setCatalogDialogOpen(false)
      setNewProcedure({ name: "", description: "", price: "", favorite: false })
      toast.success("Procedimento incluído no catálogo da clínica.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao cadastrar procedimento")
    } finally {
      setSavingProcedure(false)
    }
  }

  const addTreatment = async () => {
    const procedure = catalog.find((item) => item.id === selectedProcedureId)
    if (!patientId || !selectedTooth || !selectedArea) return toast.error("Selecione o dente e a região no odontograma.")
    if (!problem.trim()) return toast.error("Informe o problema encontrado.")
    if (!procedure) return toast.error("Escolha um procedimento do catálogo.")

    setSavingItem(true)
    try {
      const treatmentPayload = {
        procedure_id: procedure.id,
        appointment_id: appointmentId || null,
        tooth_number: selectedTooth,
        tooth_area: selectedArea,
        problem: problem.trim(),
        treatment_type: procedure.name,
        description: procedure.description,
        status: "planned" as const,
        cost: Number(procedure.default_price || 0),
        notes: notes.trim() || null,
        scheduled_date: today(),
        completed_date: null,
        result_condition: null,
        professional_name: professionalName || null,
      }
      const body = await responseData(await fetch("/api/treatments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...treatmentPayload, patient_id: patientId }),
      }))
      setTreatments((current) => [body.data, ...current])
      resetProcedureForm()
      await loadVersions()
      toast.success("Procedimento adicionado ao plano.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao adicionar procedimento")
    } finally {
      setSavingItem(false)
    }
  }

  const editTreatment = (item: TreatmentItem) => {
    setEditingTreatment(item)
    setEditPrice(Number(item.cost || 0).toFixed(2))
    setEditNotes(item.notes || "")
  }

  const saveTreatmentEdit = async () => {
    if (!editingTreatment) return
    const cost = Number(editPrice.replace(",", "."))
    if (Number.isNaN(cost) || cost < 0) return toast.error("Informe um valor válido.")
    setSavingEdit(true)
    try {
      const body = await responseData(await fetch(`/api/treatments/${editingTreatment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cost, notes: editNotes.trim() || null }),
      }))
      setTreatments((current) => current.map((item) => item.id === editingTreatment.id ? body.data : item))
      setEditingTreatment(null)
      toast.success("Procedimento atualizado.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível editar o procedimento")
    } finally {
      setSavingEdit(false)
    }
  }

  const removeTreatment = async (item: TreatmentItem) => {
    const isPlanned = item.status === "planned" || item.status === "in_progress"
    const action = isPlanned ? "remover" : "cancelar"
    if (!window.confirm(`Deseja ${action} ${item.treatment_type}?`)) return
    setRemovingItemId(item.id)
    try {
      if (isPlanned) {
        await responseData(await fetch(`/api/treatments/${item.id}`, { method: "DELETE" }))
        setTreatments((current) => current.filter((currentItem) => currentItem.id !== item.id))
      } else {
        const body = await responseData(await fetch(`/api/treatments/${item.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "cancelled" }),
        }))
        setTreatments((current) => current.map((currentItem) => currentItem.id === item.id ? body.data : currentItem))
      }
      toast.success(isPlanned ? "Procedimento removido." : "Procedimento cancelado.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível atualizar o procedimento")
    } finally {
      setRemovingItemId(null)
    }
  }

  const openCompletion = (item: TreatmentItem) => {
    setCompleteItem(item)
    setCompletionResult(suggestedResult(item.treatment_type))
  }

  const confirmCompletion = async () => {
    if (!completeItem || !completionResult) return toast.error("Confirme o resultado atual do dente.")
    setCompletingItem(true)
    try {
      const body = await responseData(await fetch(`/api/treatments/${completeItem.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "completed",
          completed_date: today(),
          result_condition: CONDITION_TO_DB[completionResult],
          professional_name: professionalName || null,
        }),
      }))
      setTreatments((current) => current.map((item) => item.id === completeItem.id ? body.data : item))
      if (completeItem.tooth_number && completeItem.tooth_area) {
        await applyConditionToArea(completeItem.tooth_number, completeItem.tooth_area, completionResult)
      }
      setCompleteItem(null)
      await loadVersions()
      toast.success("Tratamento concluído e estado atual do dente confirmado.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao concluir tratamento")
    } finally {
      setCompletingItem(false)
    }
  }

  const registeredCount = Object.values(toothData).filter((state) => state.whole || Object.keys(state.surfaces).length).length
  const selectedIndicators = selectedTooth && selectedArea
    ? [
        ...(selectedArea === "whole" ? [] : treatmentIndicators[selectedTooth]?.whole || []),
        ...(treatmentIndicators[selectedTooth]?.[selectedArea] || []),
      ]
    : []
  const selectedVersion = versions.find((version) => version.id === selectedVersionId) || versions[0]
  const snapshotRows = selectedVersion
    ? Array.isArray(selectedVersion.snapshot) ? selectedVersion.snapshot : selectedVersion.snapshot.teeth || []
    : []
  const historicalData = rowsToToothData(snapshotRows)
  const historicalTreatments = selectedVersion && !Array.isArray(selectedVersion.snapshot) ? selectedVersion.snapshot.treatments || [] : []
  const versionControls = <div className="inline-flex w-fit rounded-md border bg-muted/40 p-0.5">
    <Button size="sm" variant={viewMode === "current" ? "default" : "ghost"} onClick={() => setViewMode("current")}><Sparkles className="mr-1.5 h-3.5 w-3.5" />Atual</Button>
    <Button size="sm" variant={viewMode === "history" ? "default" : "ghost"} onClick={() => setViewMode("history")}><History className="mr-1.5 h-3.5 w-3.5" />Histórico ({versions.length})</Button>
  </div>

  return (
    <div className="space-y-3">
      {viewMode === "history" ? (
        <><div className="flex justify-end">{versionControls}</div><div className="grid gap-4 xl:grid-cols-[280px_1fr]">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Todas as versões</CardTitle></CardHeader>
            <CardContent className="max-h-[620px] space-y-2 overflow-y-auto">
              {versions.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma versão histórica disponível.</p>}
              {versions.map((version, index) => (
                <button key={version.id} type="button" onClick={() => setSelectedVersionId(version.id)} className={cn("w-full rounded-lg border p-3 text-left transition-colors hover:bg-muted/50", selectedVersion?.id === version.id && "border-primary bg-primary/5")}>
                  <div className="flex items-center justify-between"><span className="text-sm font-semibold">{versionLabel(version, versions)}</span>{index === 0 && <Badge>Mais recente</Badge>}</div>
                  <p className="mt-1 text-xs text-muted-foreground">{new Date(version.created_at).toLocaleString("pt-BR")}</p>
                  <p className="mt-1 truncate text-xs">{version.professional_name}</p>
                </button>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{selectedVersion ? versionLabel(selectedVersion, versions) : "Selecione uma versão"}</CardTitle>
              {selectedVersion && <p className="text-sm text-muted-foreground">{new Date(selectedVersion.created_at).toLocaleString("pt-BR")} · {selectedVersion.professional_name}</p>}
            </CardHeader>
            <CardContent className="space-y-5">
              <Tabs value={dentition} onValueChange={(value) => setDentition(value as typeof dentition)}><TabsList className="grid w-full max-w-sm grid-cols-2"><TabsTrigger value="permanent">Permanentes</TabsTrigger><TabsTrigger value="deciduous">Decíduos</TabsTrigger></TabsList></Tabs>
              <DentalChart selectedTooth={null} selectedArea={null} onAreaSelect={() => undefined} toothData={historicalData} dentition={dentition} readOnly />
              <div className="border-t pt-4">
                <p className="mb-2 text-sm font-semibold">Plano registrado nesta versão</p>
                {historicalTreatments.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum procedimento nesta versão.</p> : (
                  <div className="space-y-2">{historicalTreatments.map((item: TreatmentItem) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted/50 p-2 text-sm"><span>{item.treatment_type} · dente {item.tooth_number || "—"} · {item.tooth_area ? SURFACE_LABELS[item.tooth_area] : "região não informada"}</span><span>{money.format(Number(item.cost || 0))}</span></div>)}</div>
                )}
              </div>
            </CardContent>
          </Card>
        </div></>
      ) : (
        <>
          <Card className="overflow-hidden">
            <div className="border-b px-3 py-2 sm:px-4">
              <div className="flex min-h-8 flex-wrap items-center justify-between gap-2 text-sm">
                {selectedTooth && selectedArea ? <strong>Dente {selectedTooth} · {SURFACE_LABELS[selectedArea]}</strong> : <span className="text-muted-foreground">Selecione uma face, raiz ou o dente inteiro.</span>}
                {versionControls}
              </div>
              {selectedIndicators.length > 0 && <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><span>Procedimentos nesta região:</span>{selectedIndicators.map((indicator, index) => <span key={`${indicator.label}-${index}`} className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: indicator.color }} />{indicator.label}</span>)}</div>}
            </div>
            <CardContent className="p-2.5 sm:p-4">
              <Tabs value={dentition} onValueChange={(value) => { setDentition(value as typeof dentition); setSelectedTooth(null); setSelectedArea(null) }} className="mb-3">
                <TabsList className="mx-auto grid w-full max-w-sm grid-cols-2"><TabsTrigger value="permanent">Permanentes</TabsTrigger><TabsTrigger value="deciduous">Decíduos</TabsTrigger></TabsList>
              </Tabs>
              {isLoading ? <div className="flex h-56 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div> : <DentalChart selectedTooth={selectedTooth} selectedArea={selectedArea} onAreaSelect={selectArea} toothData={toothData} treatmentIndicators={treatmentIndicators} dentition={dentition} />}
              <p className="mt-3 text-center text-xs text-muted-foreground">{savingTooth ? `Salvando dente ${savingTooth}...` : `${registeredCount} dente${registeredCount === 1 ? "" : "s"} com registro clínico`}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-3 p-3 sm:px-4 sm:py-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <div className="min-w-0 flex-1 space-y-2">
                  <Label>Procedimento</Label>
                  <Button type="button" variant="outline" className="w-full justify-between font-normal" onClick={() => setProcedurePickerOpen(true)} disabled={!selectedTooth || !selectedArea}>
                    <span className="truncate">{catalog.find((item) => item.id === selectedProcedureId)?.name || "Selecionar procedimento"}</span>
                    <span className="text-muted-foreground">⌄</span>
                  </Button>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  {showNotes ? <Button type="button" variant="outline" size="sm" onClick={() => { setShowNotes(false); setNotes("") }}><X className="mr-1 h-3.5 w-3.5" />Ocultar observação</Button> : <Button type="button" variant="ghost" size="sm" onClick={() => setShowNotes(true)}>+ Adicionar observação</Button>}
                  <Button onClick={addTreatment} disabled={savingItem || !selectedTooth || !selectedArea || !selectedProcedureId}>{savingItem ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Salvando...</> : <><Plus className="mr-2 h-4 w-4" />Adicionar</>}</Button>
                </div>
              </div>
              {showNotes && <div className="space-y-2"><Label htmlFor="odontogram-notes">Observação</Label><Textarea id="odontogram-notes" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Detalhes clínicos ou do planejamento" /></div>}

              <div className="border-t pt-3">
                <div className="mb-3 flex items-center justify-between"><h3 className="font-semibold">Procedimentos {appointmentId ? "deste atendimento" : "do plano"}</h3><Badge variant="secondary">{encounterTreatments.length}</Badge></div>
                {encounterTreatments.length === 0 ? <div className="rounded-lg border border-dashed p-5 text-center text-sm text-muted-foreground">Nenhum procedimento adicionado.</div> : (
                  <div className="space-y-2">
                    {encounterTreatments.map((item) => (
                      <div key={item.id} className={cn("flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between", item.status === "planned" && "border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20")}>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{item.treatment_type}</p>{item.status === "planned" ? <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100"><Clock3 className="mr-1 h-3 w-3" />Pendente</Badge> : item.status === "completed" ? <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100"><CheckCircle2 className="mr-1 h-3 w-3" />Realizado</Badge> : <Badge variant="secondary">Cancelado</Badge>}</div>
                          <p className="mt-1 text-sm text-muted-foreground">Dente {item.tooth_number || "—"} · {item.tooth_area ? SURFACE_LABELS[item.tooth_area] : "região não informada"}</p>
                          {item.notes && <p className="mt-1 text-xs text-muted-foreground">{item.notes}</p>}
                        </div>
                        <div className="flex shrink-0 flex-wrap items-center gap-2">{item.status === "planned" && <Button size="sm" onClick={() => openCompletion(item)}><Check className="mr-1 h-4 w-4" />Concluir</Button>}<Button size="sm" variant="outline" onClick={() => editTreatment(item)}><Pencil className="mr-1 h-3.5 w-3.5" />Editar</Button><Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" disabled={removingItemId === item.id} onClick={() => removeTreatment(item)}>{removingItemId === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Trash2 className="mr-1 h-3.5 w-3.5" />{item.status === "planned" ? "Remover" : "Cancelar"}</>}</Button></div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between border-t pt-3 text-sm"><span className="text-muted-foreground">Total do plano</span><strong className="text-base text-primary">{money.format(encounterTotal)}</strong></div>
            </CardContent>
          </Card>
        </>
      )}

      <Dialog open={procedurePickerOpen} onOpenChange={(open) => { setProcedurePickerOpen(open); if (!open) setProcedureSearch("") }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Selecionar procedimento</DialogTitle><DialogDescription>Pesquise no catálogo da clínica ou cadastre um novo procedimento.</DialogDescription></DialogHeader>
          <div className="space-y-3 py-2">
            <Input value={procedureSearch} onChange={(event) => setProcedureSearch(event.target.value)} placeholder="Pesquisar procedimento" autoFocus />
            <div className="max-h-64 space-y-1 overflow-y-auto rounded-md border p-1">
              {filteredCatalog.length === 0 ? <p className="p-3 text-center text-sm text-muted-foreground">Nenhum procedimento encontrado.</p> : filteredCatalog.map((item) => <button key={item.id} type="button" onClick={() => chooseProcedure(item)} className="block w-full rounded px-3 py-2 text-left text-sm hover:bg-muted"><strong>{item.name}</strong>{item.description && <span className="ml-2 text-xs text-muted-foreground">{item.description}</span>}</button>)}
            </div>
            <Button type="button" variant="outline" className="w-full" onClick={() => { setProcedurePickerOpen(false); setCatalogDialogOpen(true) }}><Plus className="mr-2 h-4 w-4" />Cadastrar novo procedimento</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editingTreatment)} onOpenChange={(open) => { if (!open) setEditingTreatment(null) }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar procedimento</DialogTitle><DialogDescription>{editingTreatment ? `${editingTreatment.treatment_type} · dente ${editingTreatment.tooth_number || "—"}` : ""}</DialogDescription></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2"><Label htmlFor="edit-treatment-price">Valor</Label><Input id="edit-treatment-price" type="number" min="0" step="0.01" value={editPrice} onChange={(event) => setEditPrice(event.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="edit-treatment-notes">Observação</Label><Textarea id="edit-treatment-notes" value={editNotes} onChange={(event) => setEditNotes(event.target.value)} placeholder="Opcional" /></div>
          </div>
          <DialogFooter><Button type="button" variant="outline" onClick={() => setEditingTreatment(null)}>Cancelar</Button><Button type="button" onClick={saveTreatmentEdit} disabled={savingEdit}>{savingEdit ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar alteração"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={catalogDialogOpen} onOpenChange={setCatalogDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo procedimento</DialogTitle><DialogDescription>O procedimento ficará disponível no catálogo desta clínica e já será selecionado neste atendimento.</DialogDescription></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2"><Label htmlFor="new-procedure-name">Nome *</Label><Input id="new-procedure-name" value={newProcedure.name} onChange={(event) => setNewProcedure((current) => ({ ...current, name: event.target.value }))} placeholder="Ex.: Restauração em resina" /></div>
            <div className="space-y-2"><Label htmlFor="new-procedure-description">Descrição</Label><Textarea id="new-procedure-description" value={newProcedure.description} onChange={(event) => setNewProcedure((current) => ({ ...current, description: event.target.value }))} /></div>
            <div className="space-y-2"><Label htmlFor="new-procedure-price">Preço padrão *</Label><Input id="new-procedure-price" type="number" min="0" step="0.01" value={newProcedure.price} onChange={(event) => setNewProcedure((current) => ({ ...current, price: event.target.value }))} placeholder="0,00" /></div>
            <label className="flex items-center gap-2 text-sm"><Checkbox checked={newProcedure.favorite} disabled={favoriteCount >= 5} onCheckedChange={(checked) => setNewProcedure((current) => ({ ...current, favorite: checked === true }))} />Mostrar como opção rápida (máximo de cinco)</label>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setCatalogDialogOpen(false)}>Cancelar</Button><Button onClick={saveNewProcedure} disabled={savingProcedure}>{savingProcedure ? <Loader2 className="h-4 w-4 animate-spin" /> : "Cadastrar e usar"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(completeItem)} onOpenChange={(open) => { if (!open) setCompleteItem(null) }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Concluir tratamento</DialogTitle><DialogDescription>Confirme como ficou o dente. O estado atual será atualizado e a versão anterior continuará no histórico.</DialogDescription></DialogHeader>
          <div className="space-y-3 py-2">
            {completeItem && <div className="rounded-lg bg-muted p-3 text-sm"><strong>{completeItem.treatment_type}</strong><br />Dente {completeItem.tooth_number} · {completeItem.tooth_area ? SURFACE_LABELS[completeItem.tooth_area] : "região não informada"}</div>}
            <div className="space-y-2"><Label>Resultado atual *</Label><Select value={completionResult} onValueChange={(value) => setCompletionResult(value as ToothCondition)}><SelectTrigger><SelectValue placeholder="Selecione o resultado" /></SelectTrigger><SelectContent>{CONDITIONS.filter((item) => item.value !== "Sem Registros").map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setCompleteItem(null)}>Cancelar</Button><Button onClick={confirmCompletion} disabled={completingItem || !completionResult}>{completingItem ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmar conclusão"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
