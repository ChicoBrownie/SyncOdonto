"use client"

import { useState, useCallback } from "react"
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
  ArrowLeft, FileText,
  Activity, Loader2, AlertCircle, Check, Printer,
} from "lucide-react"
import { AttachedExams } from "./attached-exams"
import { MedicalInformation } from "./medical-information"
import { AnamnesisSection } from "./anamnesis-section"
import { ConsentForm } from "./consent-form"
import { PrintableRecord } from "./printable-record"
import { DentalChartView } from "@/components/dental-chart/dental-chart-view"
import { type ToothCondition, DB_TO_CONDITION } from "@/components/dental-chart/dental-chart"
import { usePatient, updateAppointment } from "@/lib/hooks/use-data"
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

interface MedicalRecordViewProps {
  patientId: string
}

export function MedicalRecordView({ patientId }: MedicalRecordViewProps) {
  const { patient, isLoading } = usePatient(patientId)
  const { data: appointments, mutate: mutateAppointments } = useSWR(
    `/api/appointments?patient_id=${patientId}`,
    listFetcher
  )

  // Mesmas URLs que AnamnesisSection / AttachedExams usam internamente —
  // por isso o rawFetcher, e o unwrap de ".data" é feito aqui embaixo manualmente.
  const { data: anamnesesRes } = useSWR(`/api/anamnesis?patientId=${patientId}`, rawFetcher)
  const { data: clinicalRecordsRes } = useSWR(`/api/medical-records?patientId=${patientId}`, rawFetcher)
  const { data: examsRes } = useSWR(`/api/documents?patient_id=${patientId}&document_type=exam`, rawFetcher)
  const { data: dentalChartRes } = useSWR(`/api/dental-charts?patientId=${patientId}`, rawFetcher)
  const { data: consentsRes } = useSWR(`/api/documents?patient_id=${patientId}&document_type=consent`, rawFetcher)

  const anamneses = Array.isArray(anamnesesRes?.data) ? anamnesesRes.data : []
  const clinicalRecords = Array.isArray(clinicalRecordsRes?.data) ? clinicalRecordsRes.data : []
  const exams = Array.isArray(examsRes?.data) ? examsRes.data : []
  const dentalChartRows = Array.isArray(dentalChartRes?.data) ? dentalChartRes.data : []
  const toothData: Record<number, ToothCondition> = {}
  for (const row of dentalChartRows) {
    const firstRegionCondition = Object.values(row.surface_conditions || {})[0]
    const uiCondition = DB_TO_CONDITION[row.condition] || DB_TO_CONDITION[String(firstRegionCondition || "")]
    if (uiCondition) toothData[row.tooth_number] = uiCondition
  }
  const consents = Array.isArray(consentsRes?.data) ? consentsRes.data : []

  // Consulta "Em Andamento" deste paciente
  const activeAppointment = appointments?.find((a: any) => a.status === "Em Andamento") ?? null

  // ── Estado do modal de encerramento ──────────────────────────────────────
  const [closeOpen, setCloseOpen] = useState(false)
  const [closeModalCost, setCloseModalCost] = useState("")
  const [odontogramTotal, setOdontogramTotal] = useState(0)
  const [isClosing, setIsClosing] = useState(false)
  const [closeModalError, setCloseModalError] = useState<string | null>(null)

  const openCloseModal = useCallback(() => {
    setCloseModalCost(odontogramTotal > 0 ? odontogramTotal.toFixed(2) : activeAppointment?.cost?.toString() || "")
    setCloseModalError(null)
    setCloseOpen(true)
  }, [activeAppointment, odontogramTotal])

  const handleCloseFinish = async () => {
    if (!activeAppointment) return
    const amount = parseFloat(closeModalCost)
    if (!closeModalCost || isNaN(amount) || amount <= 0) {
      setCloseModalError("Informe o valor da consulta para continuar.")
      return
    }
    setCloseModalError(null)
    setIsClosing(true)
    try {
      await updateAppointment(activeAppointment.id, {
        status: "Concluída",
        cost: amount,
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
    <div className="space-y-4">

      {/* ── Modal de encerramento ─────────────────────────────────────────── */}
      <Dialog open={closeOpen} onOpenChange={(open) => { if (!open) { setCloseOpen(false); setCloseModalError(null) } }}>
        <DialogContent className="w-[calc(100vw-2rem)] sm:w-full sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Encerrar consulta</DialogTitle>
            <DialogDescription>
              Confira o total devido por <strong>{patient.full_name}</strong>. A forma de pagamento será escolhida no Financeiro, no momento do recebimento.
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
              <Label>{odontogramTotal > 0 ? "Total dos procedimentos (R$)" : "Valor cobrado (R$) *"}</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="0,00"
                value={closeModalCost}
                onChange={(e) => { setCloseModalCost(e.target.value); setCloseModalError(null) }}
                readOnly={odontogramTotal > 0}
                autoFocus
              />
            </div>

            <p className="text-xs text-muted-foreground">
              O valor será lançado em <strong>Contas a receber</strong>. Nenhum pagamento será registrado até a equipe clicar em “Receber”.
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

      {/* Cabeçalho clínico compacto */}
      <div className="flex flex-col gap-3 border-b pb-3 sm:flex-row sm:items-center sm:justify-between sm:pb-4">
        <div className="flex min-w-0 items-center gap-3">
          <Link href="/pacientes" className="hidden sm:block"><Button variant="ghost" size="icon" aria-label="Voltar para pacientes"><ArrowLeft className="h-5 w-5" /></Button></Link>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary sm:h-11 sm:w-11">
                {getInitials(patient.full_name)}
          </div>
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2">
                  <h1 className="truncate text-lg font-semibold text-foreground sm:text-xl">{patient.full_name}</h1>
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
            <p className="text-sm text-muted-foreground">
                  {age ? `${age} anos` : ""} {patient.gender ? `- ${patient.gender}` : ""}
            </p>
          </div>
          {activeAppointment && <Badge className="hidden bg-amber-100 text-amber-800 hover:bg-amber-100 md:inline-flex">Consulta em andamento</Badge>}
        </div>
        <div className="flex shrink-0 justify-end gap-2">
          {activeAppointment && <Button size="sm" onClick={openCloseModal}><Check className="mr-1.5 h-3.5 w-3.5" />Encerrar</Button>}
          <Button variant="outline" size="icon" className="bg-transparent" onClick={() => window.print()} aria-label="Imprimir prontuário"><Printer className="h-4 w-4" /></Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="prontuario" className="space-y-6">
        <TabsList className="w-full justify-start bg-muted/50 p-1">
          <TabsTrigger value="prontuario" className="gap-2">
            <FileText className="h-4 w-4" />
            <span>Prontuário</span>
          </TabsTrigger>
          <TabsTrigger value="odontograma" className="gap-2">
            <Activity className="h-4 w-4" />
            <span>Odontograma</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="prontuario" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <AnamnesisSection patientId={patientId} />
            <MedicalInformation patientId={patientId} />
            <AttachedExams patientId={patientId} />
            <ConsentForm patientId={patientId} />
          </div>
        </TabsContent>

        <TabsContent value="odontograma" className="space-y-6">
          <DentalChartView
            patientId={patientId}
            appointmentId={activeAppointment?.id || null}
            professionalName={activeAppointment?.doctor_name || null}
            onTreatmentTotalChange={setOdontogramTotal}
          />
        </TabsContent>

      </Tabs>

      <PrintableRecord
        patient={patient}
        age={age}
        anamneses={anamneses}
        clinicalRecords={clinicalRecords}
        exams={exams}
        toothData={toothData}
        consents={consents}
      />
    </div>
  )
}
