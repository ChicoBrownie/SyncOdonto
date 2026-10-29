"use client"

import { useState } from "react"
import Link from "next/link"
import { FileText, Images, Loader2, Send } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { AttachedExams } from "@/components/medical-records/attached-exams"

export function CompletedEncounterActions({ encounterId, patientId, signed }: { encounterId: string; patientId: string | null; signed: boolean }) {
  const [busy, setBusy] = useState<"record" | "proposal" | null>(null)
  const [showExams, setShowExams] = useState(false)

  async function share(kind: "record" | "proposal") {
    setBusy(kind)
    try {
      const response = await fetch(`/api/encounters/${encounterId}/print?kind=${kind}&format=pdf`, { cache: "no-store" })
      if (!response.ok) throw new Error("Não foi possível preparar o documento.")
      const name = kind === "record" ? "prontuario.pdf" : "orcamento.pdf"
      const file = new File([await response.blob()], name, { type: "application/pdf" })
      if (navigator.canShare?.({ files: [file] }) && navigator.share) {
        await navigator.share({ files: [file], title: kind === "record" ? "Prontuário" : "Orçamento" })
      } else {
        const url = URL.createObjectURL(file)
        const link = document.createElement("a")
        link.href = url
        link.download = name
        link.click()
        window.setTimeout(() => URL.revokeObjectURL(url), 30_000)
        toast.info("PDF baixado. Você pode anexá-lo ao e-mail do paciente.")
      }
    } catch (error) {
      if (error instanceof Error && error.name !== "AbortError") toast.error(error.message)
    } finally {
      setBusy(null)
    }
  }

  return <>
    <div className="space-y-2 rounded-xl border p-4">
      <p className="text-sm font-medium">Documentos para o paciente</p>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" disabled={busy !== null} onClick={() => void share("record")}>
          {busy === "record" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />} Compartilhar prontuário
        </Button>
        <Button variant="outline" size="sm" disabled={busy !== null} onClick={() => void share("proposal")}>
          {busy === "proposal" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />} Compartilhar orçamento
        </Button>
        {signed && <Button asChild variant="outline" size="sm"><Link href={`/api/encounters/${encounterId}/document?format=html`} target="_blank"><FileText className="mr-2 h-4 w-4" />Ver proposta assinada</Link></Button>}
        {patientId && <Button variant="outline" size="sm" onClick={() => setShowExams(true)}><Images className="mr-2 h-4 w-4" />Fotos e exames</Button>}
      </div>
    </div>
    <Dialog open={showExams} onOpenChange={setShowExams}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle>Fotos e exames do paciente</DialogTitle></DialogHeader>
        {patientId && <AttachedExams patientId={patientId} />}
      </DialogContent>
    </Dialog>
  </>
}
