"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { FileSignature, Plus, Loader2, CheckCircle2, Trash2 } from "lucide-react"
import useSWR from "swr"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SignaturePad } from "@/components/documents/signature-pad"
import { usePatient } from "@/lib/hooks/use-data"
import { toast } from "sonner"

interface ConsentFormProps {
  patientId: string
}

interface ConsentDocument {
  id: string
  signed: boolean
  signed_at: string | null
  description: string | null
  signature_data: string | null
  created_at: string
}

const TCLE_TEXT = `Declaro que fui devidamente informado(a) pelo(a) cirurgião(ã)-dentista responsável sobre o meu diagnóstico odontológico, os procedimentos propostos, seus riscos, benefícios, alternativas de tratamento e possíveis complicações. Tive a oportunidade de esclarecer minhas dúvidas e concordo, de forma livre e esclarecida, com a realização do(s) procedimento(s) odontológico(s) indicado(s), bem como com o uso das minhas informações clínicas para fins de registro em prontuário, conforme a legislação vigente.`

const fetcher = async (url: string) => {
  const res = await fetch(url)
  if (!res.ok) throw new Error("Erro ao buscar TCLE")
  return res.json()
}

const calculateAge = (birthDate: string | null) => {
  if (!birthDate) return null
  const today = new Date()
  const birth = new Date(birthDate)
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
  return age
}

export function ConsentForm({ patientId }: ConsentFormProps) {
  const { patient } = usePatient(patientId)
  const { data, isLoading, mutate } = useSWR(
    `/api/documents?patientId=${patientId}&documentType=consent`,
    fetcher
  )
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [guardianName, setGuardianName] = useState("")
  const [guardianCpf, setGuardianCpf] = useState("")
  const [signatureData, setSignatureData] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  const records: ConsentDocument[] = data?.data || []
  const age = calculateAge(patient?.date_of_birth || null)
  const isMinor = age !== null && age < 18

  const openDialog = () => {
    setGuardianName((patient as any)?.guardian_name || "")
    setGuardianCpf((patient as any)?.guardian_cpf || "")
    setSignatureData(null)
    setIsDialogOpen(true)
  }

  const handleSave = async () => {
    if (!signatureData) {
      toast.error("Colete a assinatura antes de salvar.")
      return
    }
    if (isMinor && (!guardianName.trim() || !guardianCpf.trim())) {
      toast.error("Paciente menor de idade: informe nome e CPF do responsável legal.")
      return
    }

    setIsSaving(true)
    try {
      if (isMinor) {
        await fetch(`/api/patients/${patientId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ guardian_name: guardianName, guardian_cpf: guardianCpf }),
        })
      }

      const res = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patient_id: patientId,
          document_type: "consent",
          title: "Termo de Consentimento Livre e Esclarecido",
          description: isMinor
            ? `Assinado pelo responsável legal: ${guardianName} (CPF: ${guardianCpf})`
            : `Assinado pelo(a) paciente: ${patient?.full_name || ""}`,
          signed: true,
          signed_at: new Date().toISOString(),
          signature_data: signatureData,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Erro ao salvar TCLE")
      }
      toast.success("TCLE assinado e salvo com sucesso!")
      mutate()
      setIsDialogOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar TCLE")
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/documents?id=${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Erro ao remover")
      toast.success("TCLE removido")
      mutate()
    } catch {
      toast.error("Erro ao remover TCLE")
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <FileSignature className="h-5 w-5 text-primary" />
          Termo de Consentimento (TCLE)
        </CardTitle>
        <Button variant="outline" size="sm" className="gap-1.5 bg-transparent" onClick={openDialog}>
          <Plus className="h-3.5 w-3.5" />
          Novo TCLE
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : records.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhum TCLE assinado para este paciente ainda.
          </p>
        ) : (
          records.map((doc) => (
            <div key={doc.id} className="rounded-lg border border-border p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  <div>
                    <p className="text-sm font-medium text-foreground">TCLE assinado</p>
                    {doc.description && <p className="text-xs text-muted-foreground">{doc.description}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="bg-success/10 text-success">
                    {doc.signed_at ? new Date(doc.signed_at).toLocaleDateString("pt-BR") : "-"}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                    onClick={() => setDeleteTarget(doc.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              {doc.signature_data && (
                <div className="rounded-md border border-border bg-white p-2">
                  <img src={doc.signature_data} alt="Assinatura" className="h-16 object-contain" />
                </div>
              )}
            </div>
          ))
        )}
      </CardContent>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] sm:w-full sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Termo de Consentimento Livre e Esclarecido</DialogTitle>
            <DialogDescription>
              Leia o termo com o paciente {isMinor ? "e o responsável legal" : ""} antes de coletar a assinatura.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm text-foreground max-h-40 overflow-y-auto">
              {TCLE_TEXT}
            </div>

            {isMinor && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-lg border border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/30 p-3">
                <div className="grid gap-2">
                  <Label>Nome do Responsável Legal *</Label>
                  <Input value={guardianName} onChange={(e) => setGuardianName(e.target.value)} placeholder="Nome completo" />
                </div>
                <div className="grid gap-2">
                  <Label>CPF do Responsável Legal *</Label>
                  <Input value={guardianCpf} onChange={(e) => setGuardianCpf(e.target.value)} placeholder="000.000.000-00" />
                </div>
              </div>
            )}

            <div className="grid gap-2">
              <Label>Assinatura {isMinor ? "do Responsável Legal" : "do Paciente"} *</Label>
              <SignaturePad onChange={setSignatureData} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" className="bg-transparent" onClick={() => setIsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isSaving ? "Salvando..." : "Confirmar Assinatura"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir TCLE assinado?</AlertDialogTitle>
            <AlertDialogDescription>
              Essa ação não pode ser desfeita. O termo e a assinatura serão removidos permanentemente.
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
