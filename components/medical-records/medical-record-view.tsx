"use client"

import { useState, useCallback } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Phone, Mail, Calendar, User, ArrowLeft, FileText,
  MapPin, TrendingUp, Brain, Loader2, AlertCircle, Check, Stethoscope, Printer,
} from "lucide-react"
import { AttachedExams } from "./attached-exams"
import { ClinicalHistory } from "./clinical-history"
import { MedicalInformation } from "./medical-information"
import { AnamnesisSection } from "./anamnesis-section"
import { PrintableRecord } from "./printable-record"
import { DentalChartView } from "@/components/dental-chart/dental-chart-view"
import { CariesIndexChart } from "@/components/progress/caries-index-chart"
import { PeriodontalHealthChart } from "@/components/progress/periodontal-health-chart"
import { ComparisonChart } from "@/components/progress/comparison-chart"
import { PatientAIAnalysis } from "./patient-ai-analysis"
import { usePatient, updateAppointment, createFinancialTransaction } from "@/lib/hooks/use-data"
import useSWR from "swr"
import Link from "next/link"
import { toast } from "sonner"

// Fetcher que já devolve o array pronto — usado só pra endpoints que NÃO
// são consumidos por nenhum outro componente na mesma tela (evita conflito de cache do SWR).
const listFetcher = (url: string) => fetch(url).then(r => r.json()).then(d => d.data || [])

// Fetcher "cru" — devolve o JSON exatamente como a API manda ({ data: [...] }).
// Precisa ser esse mesmo formato aqui porque /api/anamnesis, /api/medical-records e
// /api/documents também são chamados dentro de AnamnesisSection, ClinicalHistory e
// AttachedExams com a MESMA URL. O SWR compartilha cache por URL — se os fetchers
// devolvessem formatos diferentes pra mesma chave, um dos dois lados quebra.
const rawFetcher = (url: string) => fetch(url).then(r => r.json())

const PAYMENT_METHODS = ["Espécie", "Cartão Débito", "Cartão Crédito", "Pix"]

interface MedicalRecordViewProps {
  patientId: string
}

export function MedicalRecordView({ patientId }: MedicalRecordViewProps) {
  const { patient, isLoading } = usePatient(patientId)
  const { data: treatments } = useSWR(`/api/treatments?patient_id=${patientId}`, listFetcher)
  const { data: appointments, mutate: mutateAppointments } = useSWR(
    `/api/appointments?patient_id=${patientId}`,
    listFetcher
  )

  // Mesmas URLs que AnamnesisSection / ClinicalHistory / AttachedExams usam internamente —
  // por isso o rawFetcher, e o unwrap de ".data" é feito aqui embaixo manualmente.
  const { data: anamnesesRes } = useSWR(`/api/anamnesis?patientId=${patientId}`, rawFetcher)
  const { data: clinicalRecordsRes } = useSWR(`/api/medical-records?patientId=${patientId}`, rawFetcher)
  const { data: examsRes } = useSWR(`/api/documents?patient_id=${patientId}&document_type=exam`, rawFetcher)

  const anamneses = Array.isArray(anamnesesRes?.data) ? anamnesesRes.data : []
  const clinicalRecords = Array.isArray(clinicalRecordsRes?.data) ? clinicalRecordsRes.data : []
  const exams = Array.isArray(examsRes?.data) ? examsRes.data : []

  // Consulta "Em Andamento" deste paciente
  const activeAppointment = appointments?.find((a: any) => a.status === "Em Andamento") ?? null

  // ── Estado do modal de encerramento ──────────────────────────────────────
  const [closeOpen, setCloseOpen] = useState(false)
  const [closeModalCost, setCloseModalCost] = useState("")
  const [closeModalPayment, setCloseModalPayment] = useState("")
  const [isClosing, setIsClosing] = useState(false)
  const [closeModalError, setCloseModalError] = useState<string | null>(null)

  const openCloseModal = useCallback(() => {
    setCloseModalCost(activeAppointment?.cost?.toString() || "")
    setCloseModalPayment(activeAppointment?.payment_method || "")
    setCloseModalError(null)
    setCloseOpen(true)
  }, [activeAppointment])

  const handleCloseFinish = async () => {
    if (!activeAppointment) return
    const amount = parseFloat(closeModalCost)
    if (!closeModalCost || isNaN(amount) || amount <= 0) {
      setCloseModalError("Informe o valor da consulta para continuar.")
      return
    }
    if (!closeModalPayment) {
      setCloseModalError("Selecione a forma de pagamento.")
      return
    }
    setCloseModalError(null)
    setIsClosing(true)
    try {
      await updateAppointment(activeAppointment.id, {
        status: "Concluída",
        cost: amount,
        payment_method: closeModalPayment,
      } as any)

      await createFinancialTransaction({
        patient_id: patientId,
        description: `Consulta - ${activeAppointment.procedure_type || "Consulta"} (${patient?.full_name || ""})`,
        amount,
        payment_method: closeModalPayment,
        type: "income",
        status: "pending",
        verification_status: "pending_verification",
        source_appointment_id: activeAppointment.id,
      } as any)

      toast.success("Consulta encerrada e lançada no financeiro!")
      mutateAppointments()
      setCloseOpen(false)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao encerrar consulta"
      setCloseModalError(message)
      toast.error(message)
    } finally {
      setIsClosing(false)
    }
  }

  // ── Dados de progresso ────────────────────────────────────────────────────
  const treatmentsByMonth = (() => {
    if (!treatments || treatments.length === 0) return []
    const months: Record<string, { total: number; concluidos: number }> = {}
    for (const t of treatments) {
      const date = t.scheduled_date || t.created_at
      if (!date) continue
      const d = new Date(date)
      const key = `${d.toLocaleString("pt-BR", { month: "short" })}/${String(d.getFullYear()).slice(2)}`
      if (!months[key]) months[key] = { total: 0, concluidos: 0 }
      months[key].total++
      if (t.status === "Concluido") months[key].concluidos++
    }
    return Object.entries(months).map(([month, v]) => ({ month, ...v }))
  })()

  const statusChartData = (() => {
    if (!treatments || treatments.length === 0) return []
    const counts: Record<string, number> = {}
    for (const t of treatments) {
      counts[t.status] = (counts[t.status] || 0) + 1
    }
    const colorMap: Record<string, string> = {
      "Concluido": "#22c55e",
      "Em Andamento": "#3b82f6",
      "Agendado": "#eab308",
      "Cancelado": "#ef4444",
    }
    return Object.entries(counts).map(([name, value]) => ({
      name, value, color: colorMap[name] || "#94a3b8",
    }))
  })()

  const completedAppointments = appointments?.filter((a: any) => a.status === "Concluída").length || 0
  const completedTreatments = treatments?.filter((t: any) => t.status === "Concluido").length || 0
  const totalTreatments = treatments?.length || 0

  const getInitials = (name: string) =>
    name.split(" ").map((n) => n[0]).join("").substring(0, 2).toUpperCase()

  const calculateAge = (dateOfBirth: string | null) => {
    if (!dateOfBirth) return null
    const today = new Date()
    const birth = new Date(dateOfBirth)
    let age = today.getFullYear() - birth.getFullYear()
    const m = today.getMonth() - birth.getMonth()
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
    return age
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  if (!patient) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/pacientes">
            <Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button>
          </Link>
          <h1 className="text-2xl font-bold text-foreground">Paciente não encontrado</h1>
        </div>
      </div>
    )
  }

  const age = calculateAge(patient.date_of_birth)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/pacientes">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-foreground">Prontuário Eletrônico</h1>
          <p className="text-muted-foreground">Histórico clínico completo e ferramentas integradas</p>
        </div>
      </div>

      {/* ── Banner de atendimento em andamento ───────────────────────────── */}
      {activeAppointment && (
        <div className="flex items-center justify-between gap-4 rounded-lg border border-yellow-300 bg-yellow-50 dark:border-yellow-700 dark:bg-yellow-950/30 px-4 py-3">
          <div className="flex items-center gap-3">
            <Stethoscope className="h-5 w-5 text-yellow-600 dark:text-yellow-400 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-yellow-800 dark:text-yellow-300">
                Consulta em andamento
              </p>
              <p className="text-xs text-yellow-700 dark:text-yellow-400">
                {activeAppointment.procedure_type || "Consulta"} ·{" "}
                {activeAppointment.time?.substring(0, 5) || "--:--"}
                {activeAppointment.doctor_name ? ` · Dr(a). ${activeAppointment.doctor_name}` : ""}
              </p>
            </div>
          </div>
          <Button
            size="sm"
            className="shrink-0 bg-yellow-600 text-white hover:bg-yellow-700 dark:bg-yellow-500 dark:hover:bg-yellow-600"
            onClick={openCloseModal}
          >
            <Check className="mr-1.5 h-3.5 w-3.5" />
            Encerrar consulta
          </Button>
        </div>
      )}

      {/* ── Modal de encerramento ─────────────────────────────────────────── */}
      <Dialog open={closeOpen} onOpenChange={(open) => { if (!open) { setCloseOpen(false); setCloseModalError(null) } }}>
        <DialogContent className="w-[calc(100vw-2rem)] sm:w-full sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Encerrar consulta</DialogTitle>
            <DialogDescription>
              Confirme o pagamento de <strong>{patient.full_name}</strong> para encerrar o atendimento e lançar no financeiro.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            {closeModalError && (
              <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{closeModalError}</span>
              </div>
            )}

            <div className="grid gap-2">
              <Label>Valor cobrado (R$) *</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="0,00"
                value={closeModalCost}
                onChange={(e) => { setCloseModalCost(e.target.value); setCloseModalError(null) }}
                autoFocus
              />
            </div>

            <div className="grid gap-2">
              <Label>Forma de pagamento *</Label>
              <Select value={closeModalPayment} onValueChange={(v) => { setCloseModalPayment(v); setCloseModalError(null) }}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <p className="text-xs text-muted-foreground">
              O valor será lançado no <strong>Financeiro</strong> como pendente de verificação no Fechamento de Caixa.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setCloseOpen(false); setCloseModalError(null) }}>
              Cancelar
            </Button>
            <Button
              className="bg-success text-white hover:bg-success/90"
              onClick={handleCloseFinish}
              disabled={isClosing}
            >
              {isClosing
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Encerrando...</>
                : <><Check className="mr-2 h-4 w-4" />Encerrar e lançar</>
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Patient Info Card */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary text-xl font-semibold">
                {getInitials(patient.full_name)}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <h2 className="text-2xl font-semibold text-foreground">{patient.full_name}</h2>
                  <Badge
                    variant={(patient.status as string) === "Ativo" ? "default" : "secondary"}
                    className={
                      (patient.status as string) === "Ativo"
                        ? "bg-success/10 text-success"
                        : (patient.status as string) === "Em Tratamento"
                          ? "bg-blue-500/10 text-blue-600"
                          : ""
                    }
                  >
                    {patient.status}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {age ? `${age} anos` : ""} {patient.gender ? `- ${patient.gender}` : ""}
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  {patient.phone && (
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span className="text-foreground">{patient.phone}</span>
                    </div>
                  )}
                  {patient.email && (
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span className="text-foreground">{patient.email}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-sm">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">
                      Cadastro: {new Date(patient.created_at).toLocaleDateString("pt-BR")}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="gap-2 bg-transparent"
                onClick={() => window.print()}
              >
                <Printer className="h-4 w-4" />
                <span className="hidden sm:inline">Imprimir Prontuário</span>
              </Button>
              <Link href="/pacientes">
                <Button variant="outline" className="bg-transparent">Voltar</Button>
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="prontuario" className="space-y-6">
        <TabsList className="w-full justify-start bg-muted/50 p-1">
          <TabsTrigger value="prontuario" className="gap-2">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Prontuário</span>
          </TabsTrigger>
          <TabsTrigger value="mapa" className="gap-2">
            <MapPin className="h-4 w-4" />
            <span className="hidden sm:inline">Mapa Odontológico</span>
          </TabsTrigger>
          <TabsTrigger value="progresso" className="gap-2">
            <TrendingUp className="h-4 w-4" />
            <span className="hidden sm:inline">Progresso</span>
          </TabsTrigger>
          <TabsTrigger value="ia" className="gap-2">
            <Brain className="h-4 w-4" />
            <span className="hidden sm:inline">Análise IA</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="prontuario" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <MedicalInformation patientId={patientId} />
            <AttachedExams patientId={patientId} />
          </div>
          <AnamnesisSection patientId={patientId} />
          <ClinicalHistory patientId={patientId} />
        </TabsContent>

        <TabsContent value="mapa" className="space-y-6">
          <DentalChartView patientId={patientId} />
        </TabsContent>

        <TabsContent value="progresso" className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardContent className="p-6">
                <p className="text-sm text-muted-foreground">Total de Tratamentos</p>
                <p className="mt-2 text-3xl font-bold text-foreground">{totalTreatments}</p>
                <p className="mt-1 text-xs text-muted-foreground">Registrados no sistema</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <p className="text-sm text-muted-foreground">Tratamentos Concluídos</p>
                <p className="mt-2 text-3xl font-bold text-foreground">{completedTreatments}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {totalTreatments > 0 ? `${Math.round((completedTreatments / totalTreatments) * 100)}% de conclusão` : "Nenhum ainda"}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <Calendar className="h-4 w-4" />Consultas Realizadas
                </p>
                <p className="mt-2 text-3xl font-bold text-foreground">{completedAppointments}</p>
                <p className="mt-1 text-xs text-muted-foreground">Concluídas</p>
              </CardContent>
            </Card>
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <CariesIndexChart data={treatmentsByMonth} />
            <PeriodontalHealthChart data={statusChartData} />
          </div>
          <ComparisonChart treatments={treatments || []} />
        </TabsContent>

        <TabsContent value="ia" className="space-y-6">
          <PatientAIAnalysis patientId={patientId} />
        </TabsContent>
      </Tabs>

      <PrintableRecord
        patient={patient}
        age={age}
        anamneses={anamneses}
        clinicalRecords={clinicalRecords}
        exams={exams}
      />
    </div>
  )
}
