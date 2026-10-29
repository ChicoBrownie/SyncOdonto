"use client"

import { useState } from "react"
import { Download, Loader2, Upload } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type Preview = {
  newCount: number
  skippedCount: number
  errors: string[]
  unmapped: string[]
  rows: { line: number; name: string; unit: string; usable_quantity: number; status: "existing" | "new" }[]
  importedCount?: number
}

export function SupplyImportDialog({ open, onOpenChange, onImported }: { open: boolean; onOpenChange: (open: boolean) => void; onImported: () => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [busy, setBusy] = useState(false)
  const close = () => { if (!busy) { onOpenChange(false); setFile(null); setPreview(null) } }

  const submit = async (mode: "preview" | "commit") => {
    if (!file) return toast.error("Selecione uma planilha.")
    setBusy(true)
    try {
      const form = new FormData()
      form.set("file", file)
      form.set("mode", mode)
      const response = await fetch("/api/supplies/import", { method: "POST", body: form })
      const payload = await response.json()
      if (payload.data) setPreview(payload.data)
      if (!response.ok) throw new Error(payload.error || "Não foi possível importar a planilha.")
      if (mode === "commit") {
        toast.success(`${payload.data.importedCount} material(is) importado(s). ${payload.data.skippedCount} já cadastrado(s).`)
        onImported()
        onOpenChange(false)
        setFile(null)
        setPreview(null)
      }
    } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível ler a planilha.") } finally { setBusy(false) }
  }

  return <Dialog open={open} onOpenChange={next => { if (!next) close() }}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
    <DialogHeader><DialogTitle>Importar materiais</DialogTitle><DialogDescription>Envie CSV UTF-8 ou Excel .xlsx. Confira a prévia antes de salvar.</DialogDescription></DialogHeader>
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/20 p-3 text-sm"><span>Uma linha por material. Inclua saldo, mínimo e fornecedores se tiver esses dados.</span><Button asChild type="button" size="sm" variant="outline"><a href="/api/supplies/import" download><Download className="mr-1.5 h-4 w-4" />Baixar modelo CSV</a></Button></div>
      <div className="space-y-2"><Label htmlFor="supply-import-file">Planilha de materiais</Label><Input id="supply-import-file" type="file" disabled={busy} accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={event => { setFile(event.target.files?.[0] || null); setPreview(null) }} /><p className="text-xs text-muted-foreground">Até 500 materiais e 2 MB. Materiais já cadastrados ou arquivados são ignorados; pedidos e regras de consumo continuam no cadastro individual.</p></div>
      {preview && <div className="space-y-3 rounded-lg border p-3"><p className="font-medium">Prévia: {preview.newCount} novo(s) · {preview.skippedCount} já cadastrado(s) · {preview.errors.length} erro(s)</p>
        {preview.unmapped.length > 0 && <p className="rounded-md bg-amber-50 p-2 text-sm text-amber-900">Colunas não usadas: {preview.unmapped.join(", ")}. Confira antes de importar.</p>}
        {preview.errors.length > 0 && <div role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive"><p className="font-medium">Corrija a planilha antes de importar:</p><ul className="mt-1 list-disc pl-5">{preview.errors.slice(0, 8).map((error, index) => <li key={index}>{error}</li>)}</ul>{preview.errors.length > 8 && <p className="mt-1">Mais {preview.errors.length - 8} erro(s).</p>}</div>}
        <div className="max-h-52 overflow-y-auto text-sm">{preview.rows.map(row => <div key={row.line} className="flex items-center justify-between gap-3 border-t py-2"><span className="min-w-0 truncate">{row.name} · {row.usable_quantity} {row.unit}</span><span className={row.status === "existing" ? "shrink-0 text-muted-foreground" : "shrink-0 text-primary"}>{row.status === "existing" ? "Já cadastrado" : "Novo"}</span></div>)}</div>
      </div>}
    </div>
    <DialogFooter><Button type="button" variant="outline" disabled={busy} onClick={close}>Cancelar</Button>{!preview ? <Button type="button" disabled={!file || busy} onClick={() => void submit("preview")}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}Ver prévia</Button> : <Button type="button" disabled={busy || preview.errors.length > 0 || preview.newCount === 0} onClick={() => void submit("commit")}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Importar {preview.newCount} material(is)</Button>}</DialogFooter>
  </DialogContent></Dialog>
}
