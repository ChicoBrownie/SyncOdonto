"use client"
import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import useSWR from "swr"
import { Calendar, Play, RotateCcw, DollarSign, Settings, MoreHorizontal, FileText, Users, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { encounterRequest, resumeKey } from "@/lib/encounters/client"
import { stepLabels, type EncounterStep } from "@/lib/encounters/model"
import { toast } from "sonner"

type Summary = { id: string; step: EncounterStep; revision: number; updated_at: string; patient: { full_name: string } | null }
export function EncounterGlobalControls() {
  const pathname = usePathname()
  const inEditor = /^\/atendimento\/[^/]+/.test(pathname)
  const [offset, setOffset] = useState(0)
  const { data, error, isLoading, mutate } = useSWR(inEditor ? null : offset ? `${resumeKey}?offset=${offset}` : resumeKey, encounterRequest, { refreshInterval: 15_000, revalidateOnFocus: true })
  const [open, setOpen] = useState(false)
  const [dismissedCount, setDismissedCount] = useState<number | null>(null)
  const drafts: Summary[] = data?.data || []
  const count = data?.count ?? drafts.length
  useEffect(() => { setDismissedCount(Number(window.sessionStorage.getItem("syncodonto-resume-dismissed") || 0)) }, [])
  useEffect(() => {
    if (isLoading || dismissedCount === null || count >= dismissedCount) return
    window.sessionStorage.setItem("syncodonto-resume-dismissed", String(count))
    setDismissedCount(count)
  }, [count, dismissedCount, isLoading])
  const [discarding, setDiscarding] = useState<string | null>(null)
  async function discard(draft: Summary) {
    if (!window.confirm(`Descartar o rascunho de ${draft.patient?.full_name || "cadastro em andamento"}? Os dados já confirmados serão preservados.`)) return
    setDiscarding(draft.id)
    try {
      await encounterRequest(`/api/encounters/${draft.id}/actions`, { method: "POST", body: JSON.stringify({ action: "discard", revision: draft.revision, confirmed: true }) })
      await mutate()
      if (offset > 0 && drafts.length === 1) setOffset(Math.max(0, offset - 5))
      toast.success("Rascunho descartado.")
    } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível descartar.") }
    finally { setDiscarding(null) }
  }
  if (inEditor) return null
  return <>
    {!isLoading && dismissedCount !== null && count > dismissedCount && <div className="fixed bottom-24 left-4 z-40 flex max-w-[calc(100vw-2rem)] items-start gap-2 rounded-2xl border border-primary/25 bg-card p-2 shadow-xl lg:bottom-6 lg:left-72" data-guide="encounter-entry">
      <Button variant="ghost" className="min-h-11 gap-2 text-primary" onClick={() => setOpen(true)}><RotateCcw className="h-4 w-4" />Retomar atendimento{count > 1 ? ` (${count})` : ""}</Button>
      <Button type="button" size="icon" variant="ghost" className="h-8 w-8 shrink-0" aria-label="Fechar aviso de atendimentos" onClick={() => { window.sessionStorage.setItem("syncodonto-resume-dismissed", String(count)); setDismissedCount(count) }}><X className="h-4 w-4" /></Button>
    </div>}
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[80dvh] overflow-y-auto"><DialogHeader><DialogTitle>Retomar atendimento</DialogTitle><DialogDescription>Seus rascunhos ficam no servidor. Fechar este aviso não apaga nada.</DialogDescription></DialogHeader>
      {error && <p role="alert" className="text-sm text-destructive">Não foi possível consultar os rascunhos. {error.message}</p>}
      {!error && !drafts.length && <p>Nenhum atendimento em aberto.</p>}
      {drafts.map(draft => <div key={draft.id} className="flex items-center gap-2 rounded-lg border p-3"><Link onClick={() => setOpen(false)} href={`/atendimento/${draft.id}`} className="min-w-0 flex-1 rounded p-1 hover:bg-muted focus-visible:outline-primary"><p className="font-semibold">{draft.patient?.full_name || "Cadastro em andamento"}</p><p className="text-sm text-muted-foreground">{stepLabels[draft.step]} · {new Date(draft.updated_at).toLocaleString("pt-BR", { timeZone: "America/Fortaleza" })}</p></Link><Button type="button" variant="ghost" className="shrink-0" disabled={discarding !== null} onClick={() => void discard(draft)}>Descartar</Button></div>)}
      <div className="flex justify-between gap-2">{offset > 0 && <Button variant="outline" onClick={() => setOffset(Math.max(0, offset - 5))}>Anteriores</Button>}{offset + 5 < count && <Button variant="outline" onClick={() => setOffset(offset + 5)}>Próximos atendimentos</Button>}</div>
    </DialogContent></Dialog>
  </>
}
export function ClinicalMobileNav() {
  const pathname = usePathname()
  const items = [{ href: "/agenda", label: "Agenda", Icon: Calendar }, { href: "/atendimento", label: "Atendimento", Icon: Play }, { href: "/financeiro", label: "Financeiro", Icon: DollarSign }, { href: "/configuracoes", label: "Ajustes", Icon: Settings }]
  return <nav aria-label="Navegação clínica no celular" className="clinical-mobile-nav grid grid-cols-5 border-t bg-card lg:hidden">
    {items.map(({ href, label, Icon }) => <Link key={href} href={href} aria-current={pathname.startsWith(href) ? "page" : undefined} className="flex min-h-14 flex-col items-center justify-center gap-1 px-0.5 text-[10px] aria-[current=page]:bg-primary/10 aria-[current=page]:text-primary"><Icon className="h-5 w-5" />{label}</Link>)}
    <DropdownMenu><DropdownMenuTrigger className="flex min-h-14 flex-col items-center justify-center gap-1 text-[10px] aria-expanded:bg-primary/10"><MoreHorizontal className="h-5 w-5" />Mais</DropdownMenuTrigger><DropdownMenuContent align="end" side="top"><DropdownMenuItem asChild><Link href="/relatorios"><FileText className="mr-2 h-4 w-4" />Relatórios</Link></DropdownMenuItem><DropdownMenuItem asChild><Link href="/gestao-clinica"><Users className="mr-2 h-4 w-4" />Equipe</Link></DropdownMenuItem><DropdownMenuItem asChild><Link href="/pacientes"><Users className="mr-2 h-4 w-4" />Pacientes</Link></DropdownMenuItem></DropdownMenuContent></DropdownMenu>
  </nav>
}
