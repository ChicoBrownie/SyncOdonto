"use client"

import { useEffect, useMemo, useState } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { PatientCombobox, type PatientOption } from "./patient-combobox"
import { SignaturePad } from "./signature-pad"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

const termTemplates: Record<string, string> = {
  "Clareamento Dental": "Declaro que recebi orientações sobre benefícios, limitações, sensibilidade e cuidados relacionados ao clareamento dental.",
  "Implante Dentário": "Declaro que fui informado(a) sobre as etapas, alternativas, riscos cirúrgicos e cuidados do tratamento com implante dentário.",
  "Tratamento Ortodôntico": "Declaro que compreendi a duração estimada, necessidade de colaboração, higiene e possíveis intercorrências do tratamento ortodôntico.",
  "Cirurgia Oral": "Declaro que recebi explicações sobre o procedimento cirúrgico, anestesia, riscos, alternativas e cuidados pós-operatórios.",
  Personalizado: "",
}

export function ModalNovoTermo({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (open: boolean) => void; onCreated: () => void }) {
  const [patient, setPatient] = useState<PatientOption | null>(null)
  const [template, setTemplate] = useState("Clareamento Dental")
  const [customText, setCustomText] = useState("")
  const [clinicName, setClinicName] = useState("Clínica odontológica")
  const [signature, setSignature] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => { if (open) fetch("/api/documents/context").then((r) => r.json()).then((p) => setClinicName(p.data?.clinic_name || "Clínica odontológica")).catch(() => undefined) }, [open])
  const body = template === "Personalizado" ? customText : termTemplates[template]
  const preview = useMemo(() => `TERMO DE CONSENTIMENTO LIVRE E ESCLARECIDO\n\nPaciente: ${patient?.full_name || "[selecione o paciente]"}\nClínica: ${clinicName}\n\n${body}\n\nDeclaro que tive oportunidade de esclarecer dúvidas e concordo com o tratamento proposto.`, [patient, clinicName, body])

  const submit = async (signed: boolean) => {
    if (!patient) return toast.error("Selecione o paciente.")
    if (!body.trim()) return toast.error("Informe o texto do termo.")
    if (signed && !signature) return toast.error("Colete a assinatura antes de emitir como assinado.")
    setSaving(true)
    try {
      const response = await fetch("/api/documents", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ generate_pdf: true, patient_id: patient.id, title: `TCLE - ${template}`, document_type: "consent", procedure: template, description: body, content: preview, status: signed ? "signed" : "pending", signed, signature_data: signed ? signature : null }) })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || "Erro ao emitir termo")
      toast.success(signed ? "Termo assinado e emitido!" : "Termo salvo como pendente!")
      setPatient(null); setSignature(null); onOpenChange(false); onCreated()
    } catch (error) { toast.error(error instanceof Error ? error.message : "Erro ao emitir termo") } finally { setSaving(false) }
  }

  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
    <DialogHeader><DialogTitle>Novo Termo</DialogTitle><DialogDescription>Emita um TCLE sem sair da gestão centralizada.</DialogDescription></DialogHeader>
    <div className="grid gap-4">
      <div className="grid gap-2"><Label>Paciente</Label><PatientCombobox value={patient} onChange={setPatient} /></div>
      <div className="grid gap-2"><Label>Modelo</Label><Select value={template} onValueChange={setTemplate}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.keys(termTemplates).map((name) => <SelectItem key={name} value={name}>{name}</SelectItem>)}</SelectContent></Select></div>
      {template === "Personalizado" && <div className="grid gap-2"><Label>Texto personalizado</Label><Textarea rows={4} value={customText} onChange={(e) => setCustomText(e.target.value)} /></div>}
      <div className="grid gap-2"><Label>Pré-visualização</Label><pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-md border bg-muted/30 p-4 font-sans text-sm">{preview}</pre></div>
      <div className="grid gap-2"><Label>Assinatura imediata (opcional)</Label><SignaturePad onChange={setSignature} /></div>
    </div>
    <DialogFooter><Button variant="outline" disabled={saving} onClick={() => submit(false)}>Salvar pendente</Button><Button disabled={saving} onClick={() => submit(true)}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Assinar e emitir</Button></DialogFooter>
  </DialogContent></Dialog>
}
