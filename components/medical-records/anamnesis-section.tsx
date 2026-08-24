"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ClipboardList, Plus, Loader2, Trash2, ChevronDown, ChevronUp } from "lucide-react"
import useSWR from "swr"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"

interface AnamnesisSectionProps {
  patientId: string
}

interface AnamnesisAnswer {
  question: string
  answer: "sim" | "nao" | null
  observation: string
}

interface AnamnesisRecord {
  id: string
  chief_complaint: string | null
  answers: AnamnesisAnswer[]
  additional_notes: string | null
  dentist_name: string | null
  diagnosis: string | null
  treatment_plan: string | null
  created_at: string
}

const QUESTION_GROUPS: { group: string; questions: string[] }[] = [
  {
    group: "Saúde Geral",
    questions: [
      "Está em tratamento médico atualmente?",
      "Já foi hospitalizado ou passou por cirurgia?",
      "Tem alergia a medicamento, alimento ou material odontológico?",
      "Tem problemas cardíacos (sopro, arritmia, hipertensão)?",
      "Tem diabetes?",
      "Tem problemas de coagulação ou já teve sangramento excessivo?",
      "Tem hepatite ou outra doença infecciosa?",
      "Está gestante ou amamentando?",
      "Faz uso de anticoagulantes ou bisfosfonatos?",
      "Tem histórico de convulsões ou epilepsia?",
      "Tem problemas renais?",
      "Há histórico de doenças na família (cardíacas, diabetes, hemorrágicas, câncer)?",
    ],
  },
  {
    group: "Hábitos",
    questions: [
      "É fumante?",
      "Consome bebida alcoólica com frequência?",
    ],
  },
  {
    group: "Histórico Odontológico",
    questions: [
      "Já teve reação alérgica a anestesia odontológica?",
      "Já fez uso de anestesia odontológica anteriormente? Houve alguma intercorrência?",
      "Sente dor, sensibilidade ou sangramento na gengiva?",
      "Range ou aperta os dentes (bruxismo)?",
    ],
  },
  {
    group: "Higiene e Dieta",
    questions: [
      "Escova os dentes pelo menos 2 vezes ao dia?",
      "Usa fio dental regularmente?",
      "Consome alimentos ou bebidas açucaradas com frequência?",
    ],
  },
]

const buildEmptyAnswers = (): AnamnesisAnswer[] =>
  QUESTION_GROUPS.flatMap((g) => g.questions).map((q) => ({
    question: q,
    answer: null,
    observation: "",
  }))

const fetcher = async (url: string) => {
  const res = await fetch(url)
  if (!res.ok) throw new Error("Erro ao buscar anamneses")
  return res.json()
}

export function AnamnesisSection({ patientId }: AnamnesisSectionProps) {
  const { data, isLoading, mutate } = useSWR(`/api/anamnesis?patientId=${patientId}`, fetcher)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const [chiefComplaint, setChiefComplaint] = useState("")
  const [dentistName, setDentistName] = useState("")
  const [answers, setAnswers] = useState<AnamnesisAnswer[]>(buildEmptyAnswers())
  const [additionalNotes, setAdditionalNotes] = useState("")
  const [diagnosis, setDiagnosis] = useState("")
  const [treatmentPlan, setTreatmentPlan] = useState("")
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  const records: AnamnesisRecord[] = data?.data || []

  const openNewAnamnesis = () => {
    setChiefComplaint("")
    setDentistName("")
    setAnswers(buildEmptyAnswers())
    setAdditionalNotes("")
    setDiagnosis("")
    setTreatmentPlan("")
    setIsDialogOpen(true)
  }

  const setAnswer = (question: string, answer: "sim" | "nao") => {
    setAnswers((prev) =>
      prev.map((a) => (a.question === question ? { ...a, answer } : a))
    )
  }

  const setObservation = (question: string, observation: string) => {
    setAnswers((prev) =>
      prev.map((a) => (a.question === question ? { ...a, observation } : a))
    )
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const res = await fetch("/api/anamnesis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patient_id: patientId,
          chief_complaint: chiefComplaint || null,
          dentist_name: dentistName || null,
          answers,
          additional_notes: additionalNotes || null,
          diagnosis: diagnosis || null,
          treatment_plan: treatmentPlan || null,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Erro ao salvar anamnese")
      }
      toast.success("Anamnese registrada com sucesso!")
      mutate()
      setIsDialogOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar anamnese")
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/anamnesis?id=${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Erro ao remover")
      toast.success("Anamnese removida")
      mutate()
    } catch {
      toast.error("Erro ao remover anamnese")
    }
  }

  const positiveCount = (record: AnamnesisRecord) =>
    record.answers?.filter((a) => a.answer === "sim").length || 0

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <ClipboardList className="h-5 w-5 text-primary" />
          Anamnese
        </CardTitle>
        <Button variant="outline" size="sm" className="gap-1.5 bg-transparent" onClick={openNewAnamnesis}>
          <Plus className="h-3.5 w-3.5" />
          Nova Anamnese
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : records.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhuma anamnese registrada. Clique em &quot;Nova Anamnese&quot; para iniciar o primeiro atendimento.
          </p>
        ) : (
          records.map((record) => {
            const isExpanded = expandedId === record.id
            const alerts = positiveCount(record)
            return (
              <div key={record.id} className="rounded-lg border border-border">
                <div
                  className="flex items-center justify-between p-3 cursor-pointer"
                  onClick={() => setExpandedId(isExpanded ? null : record.id)}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground truncate">
                        {record.chief_complaint || "Anamnese"}
                      </p>
                      {alerts > 0 && (
                        <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                          {alerts} alerta{alerts !== 1 ? "s" : ""}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {new Date(record.created_at).toLocaleDateString("pt-BR")}
                      {record.dentist_name ? ` · Dr(a). ${record.dentist_name}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                      onClick={(e) => { e.stopPropagation(); setDeleteTarget(record.id) }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                    {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-border p-3 space-y-3">
                    {record.answers?.filter((a) => a.answer === "sim").length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-foreground mb-1.5">Pontos de atenção</p>
                        <div className="space-y-1.5">
                          {record.answers.filter((a) => a.answer === "sim").map((a) => (
                            <div key={a.question} className="text-xs rounded-md bg-destructive/5 border border-destructive/20 p-2">
                              <p className="text-foreground font-medium">{a.question}</p>
                              {a.observation && <p className="text-muted-foreground mt-0.5">{a.observation}</p>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {record.diagnosis && (
                      <div>
                        <p className="text-xs font-medium text-foreground mb-1">Diagnóstico</p>
                        <p className="text-sm text-muted-foreground">{record.diagnosis}</p>
                      </div>
                    )}
                    {record.treatment_plan && (
                      <div>
                        <p className="text-xs font-medium text-foreground mb-1">Plano de Tratamento</p>
                        <p className="text-sm text-muted-foreground">{record.treatment_plan}</p>
                      </div>
                    )}
                    {record.additional_notes && (
                      <div>
                        <p className="text-xs font-medium text-foreground mb-1">Observações gerais</p>
                        <p className="text-sm text-muted-foreground">{record.additional_notes}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
      </CardContent>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nova Anamnese</DialogTitle>
            <DialogDescription>Registre a anamnese deste atendimento. Fica salva no histórico do paciente.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Queixa Principal</Label>
                <Input
                  value={chiefComplaint}
                  onChange={(e) => setChiefComplaint(e.target.value)}
                  placeholder="Ex: Dor no dente 26"
                />
              </div>
              <div className="grid gap-2">
                <Label>Profissional</Label>
                <Input
                  value={dentistName}
                  onChange={(e) => setDentistName(e.target.value)}
                  placeholder="Dr(a). Nome"
                />
              </div>
            </div>

            {QUESTION_GROUPS.map((group) => (
              <div key={group.group} className="space-y-3">
                <p className="text-sm font-semibold text-foreground">{group.group}</p>
                {group.questions.map((question) => {
                  const current = answers.find((a) => a.question === question)
                  return (
                    <div key={question} className="rounded-lg border border-border p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm text-foreground">{question}</p>
                        <div className="flex gap-1 shrink-0">
                          <Button
                            type="button"
                            size="sm"
                            variant={current?.answer === "sim" ? "default" : "outline"}
                            className={current?.answer === "sim" ? "bg-destructive hover:bg-destructive/90" : "bg-transparent"}
                            onClick={() => setAnswer(question, "sim")}
                          >
                            Sim
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant={current?.answer === "nao" ? "default" : "outline"}
                            className={current?.answer !== "sim" && current?.answer === "nao" ? "" : "bg-transparent"}
                            onClick={() => setAnswer(question, "nao")}
                          >
                            Não
                          </Button>
                        </div>
                      </div>
                      {current?.answer === "sim" && (
                        <Input
                          value={current.observation}
                          onChange={(e) => setObservation(question, e.target.value)}
                          placeholder="Observação (opcional)"
                          className="text-sm"
                        />
                      )}
                    </div>
                  )
                })}
              </div>
            ))}

            <div className="grid gap-2">
              <Label>Diagnóstico</Label>
              <Textarea
                value={diagnosis}
                onChange={(e) => setDiagnosis(e.target.value)}
                placeholder="Diagnóstico definitivo ou presuntivo..."
                rows={2}
              />
            </div>

            <div className="grid gap-2">
              <Label>Plano de Tratamento</Label>
              <Textarea
                value={treatmentPlan}
                onChange={(e) => setTreatmentPlan(e.target.value)}
                placeholder="Plano de tratamento proposto/aprovado..."
                rows={2}
              />
            </div>

            <div className="grid gap-2">
              <Label>Observações Gerais</Label>
              <Textarea
                value={additionalNotes}
                onChange={(e) => setAdditionalNotes(e.target.value)}
                placeholder="Qualquer outra informação relevante..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" className="bg-transparent" onClick={() => setIsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isSaving ? "Salvando..." : "Salvar Anamnese"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir anamnese?</AlertDialogTitle>
            <AlertDialogDescription>
              Essa ação não pode ser desfeita. A anamnese será removida permanentemente do histórico do paciente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => { if (deleteTarget) handleDelete(deleteTarget); setDeleteTarget(null) }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
