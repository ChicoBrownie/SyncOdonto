"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { prepareDocumentFile } from "@/lib/documents/client-file"
import { PatientCombobox, type PatientOption } from "./patient-combobox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const categories = { certificate: "Atestado", external_report: "Laudo Externo", exam: "Exame", prescription: "Receita", other: "Outros" }

export function ModalNovoDocumento({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (open: boolean) => void; onCreated: () => void }) {
  const [patient, setPatient] = useState<PatientOption | null>(null)
  const [category, setCategory] = useState<keyof typeof categories>("certificate")
  const [file, setFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    if (!patient || !file) return toast.error("Selecione o paciente e o arquivo.")
    setSaving(true)
    let uploadedPath: string | null = null
    try {
      const prepared = await prepareDocumentFile(file)
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Sessão expirada.")
      const extension = prepared.name.split(".").pop()?.toLowerCase() || "bin"
      uploadedPath = `${user.id}/${patient.id}/${crypto.randomUUID()}.${extension}`
      const { error: uploadError } = await supabase.storage.from("documentos-clinica").upload(uploadedPath, prepared, { contentType: prepared.type })
      if (uploadError) throw uploadError

      const response = await fetch("/api/documents", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patient_id: patient.id, title: categories[category], document_type: category, status: "signed", signed: true, storage_path: uploadedPath, file_url: uploadedPath, file_type: prepared.type, file_size: prepared.size }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || "Erro ao registrar documento")
      toast.success("Documento enviado com sucesso!")
      setPatient(null); setFile(null); onOpenChange(false); onCreated()
    } catch (error) {
      if (uploadedPath) await createClient().storage.from("documentos-clinica").remove([uploadedPath])
      toast.error(error instanceof Error ? error.message : "Erro ao enviar documento")
    } finally { setSaving(false) }
  }

  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent>
    <DialogHeader><DialogTitle>Novo Documento</DialogTitle><DialogDescription>Envie um documento avulso para a ficha do paciente.</DialogDescription></DialogHeader>
    <div className="grid gap-4 py-2">
      <div className="grid gap-2"><Label>Paciente</Label><PatientCombobox value={patient} onChange={setPatient} /></div>
      <div className="grid gap-2"><Label>Categoria</Label><Select value={category} onValueChange={(v) => setCategory(v as keyof typeof categories)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(categories).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div>
      <div className="grid gap-2"><Label>Arquivo</Label><Input type="file" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" onChange={(e) => setFile(e.target.files?.[0] || null)} /><p className="text-xs text-muted-foreground">PDF, PNG ou JPG, até 15 MB. Imagens grandes são comprimidas antes do envio.</p></div>
    </div>
    <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button><Button disabled={saving} onClick={submit}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Enviar</Button></DialogFooter>
  </DialogContent></Dialog>
}
