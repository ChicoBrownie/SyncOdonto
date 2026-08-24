"use client"

import { useMemo, useState } from "react"
import useSWR from "swr"
import { Download, ExternalLink, FileText, Link2, Loader2, Search } from "lucide-react"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

type DigitalDocument = { id: string; title: string; document_type: string; procedure?: string | null; description?: string | null; status?: "signed" | "pending" | "draft" | "archived"; signed?: boolean; storage_path?: string | null; file_url?: string | null; created_at: string; lead_name?: string | null; patient?: { id: string; full_name: string } | null }
const fetcher = async (url: string) => { const response = await fetch(url); const payload = await response.json(); if (!response.ok) throw new Error(payload.error); return payload }
const typeLabels: Record<string, string> = { consent: "Termo de Consentimento", budget: "Orçamento", certificate: "Atestado", external_report: "Laudo Externo", exam: "Exame", prescription: "Receita", other: "Outros", contract: "Contrato", receipt: "Recibo" }

export function DocumentList() {
  const { data, error, isLoading } = useSWR<{ data: DigitalDocument[] }>("/api/documents", fetcher)
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState<"all" | "signed" | "pending">("all")
  const [openingId, setOpeningId] = useState<string | null>(null)
  const documents = data?.data || []
  const filtered = useMemo(() => documents.filter((document) => {
    const currentStatus = document.status || (document.signed ? "signed" : "pending")
    const haystack = `${document.patient?.full_name || document.lead_name || ""} ${document.procedure || document.description || ""} ${document.title}`.toLocaleLowerCase("pt-BR")
    return (status === "all" || currentStatus === status) && haystack.includes(search.toLocaleLowerCase("pt-BR"))
  }), [documents, search, status])

  const openFile = async (document: DigitalDocument, download: boolean) => {
    setOpeningId(document.id)
    try {
      const response = await fetch(`/api/documents/${document.id}/signed-url`)
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || "Arquivo indisponível")
      if (download) {
        const fileResponse = await fetch(payload.data.url)
        const blob = await fileResponse.blob()
        const url = URL.createObjectURL(blob)
        const anchor = window.document.createElement("a")
        anchor.href = url
        anchor.download = `${document.title.replace(/[^a-z0-9_-]+/gi, "-")}.${document.file_url?.toLowerCase().endsWith(".pdf") || document.storage_path?.toLowerCase().endsWith(".pdf") ? "pdf" : "arquivo"}`
        anchor.click()
        setTimeout(() => URL.revokeObjectURL(url), 1000)
      } else window.open(payload.data.url, "_blank", "noopener,noreferrer")
    } catch (cause) { toast.error(cause instanceof Error ? cause.message : "Não foi possível abrir o arquivo") } finally { setOpeningId(null) }
  }

  const copyLink = async (document: DigitalDocument) => {
    setOpeningId(document.id)
    try {
      const response = await fetch(`/api/documents/${document.id}/signed-url`)
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || "Arquivo indisponível")
      await navigator.clipboard.writeText(payload.data.url)
      toast.success("Link temporário copiado (válido por 10 minutos).")
    } catch (cause) { toast.error(cause instanceof Error ? cause.message : "Não foi possível copiar o link") } finally { setOpeningId(null) }
  }

  return <Card><CardHeader><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><CardTitle className="text-base">Documentos Digitais</CardTitle><p className="text-sm text-muted-foreground">{filtered.length} de {documents.length} documentos</p></div>
    <div className="flex flex-col gap-2 sm:flex-row"><div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input placeholder="Buscar paciente ou procedimento..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" /></div><div className="flex gap-1">{([['all','Todos'],['signed','Assinado'],['pending','Pendente']] as const).map(([value,label]) => <Button key={value} size="sm" variant={status === value ? "default" : "outline"} onClick={() => setStatus(value)}>{label}</Button>)}</div></div>
  </CardHeader><CardContent>
    {isLoading ? <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin" /></div> : error ? <p className="py-8 text-center text-sm text-destructive">Não foi possível carregar os documentos.</p> : filtered.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">Nenhum documento encontrado.</p> :
    <div className="overflow-x-auto"><table className="w-full"><thead className="border-b"><tr>{["Tipo","Paciente/Contato","Procedimento","Data","Status","Ações"].map((heading) => <th key={heading} className="px-3 py-3 text-left text-sm font-semibold last:text-right">{heading}</th>)}</tr></thead><tbody>{filtered.map((document) => { const signed = (document.status || (document.signed ? "signed" : "pending")) === "signed"; const hasFile = Boolean(document.storage_path || document.file_url); return <tr key={document.id} className="border-b hover:bg-muted/30"><td className="px-3 py-4 text-sm"><span className="flex items-center gap-2"><FileText className="h-4 w-4 text-primary" />{typeLabels[document.document_type] || document.title}</span></td><td className="px-3 py-4 text-sm">{document.patient?.full_name || document.lead_name || "—"}</td><td className="px-3 py-4 text-sm text-muted-foreground">{document.procedure || document.description || "—"}</td><td className="px-3 py-4 text-sm text-muted-foreground">{new Date(document.created_at).toLocaleDateString("pt-BR")}</td><td className="px-3 py-4"><Badge className={signed ? "bg-success/10 text-success" : "bg-warning/10 text-warning"}>{signed ? "Assinado" : "Pendente"}</Badge></td><td className="px-3 py-4"><div className="flex justify-end gap-1"><Button title="Baixar" variant="ghost" size="icon" disabled={!hasFile || openingId === document.id} onClick={() => openFile(document, true)}><Download className="h-4 w-4" /></Button><Button title="Copiar link temporário" variant="ghost" size="icon" disabled={!hasFile || openingId === document.id} onClick={() => copyLink(document)}><Link2 className="h-4 w-4" /></Button><Button size="sm" disabled={!hasFile || openingId === document.id} onClick={() => openFile(document, false)}>{openingId === document.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <><ExternalLink className="mr-1 h-4 w-4" />Ver</>}</Button></div></td></tr>})}</tbody></table></div>}
  </CardContent></Card>
}
