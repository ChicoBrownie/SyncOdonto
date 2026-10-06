"use client"
import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import useSWR from "swr"
import { Calendar, Play, RotateCcw, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { encounterRequest, resumeKey } from "@/lib/encounters/client"
import { stepLabels, type EncounterStep } from "@/lib/encounters/model"

type Summary = { id: string; step: EncounterStep; updated_at: string; patient: { full_name: string } | null }
export function EncounterGlobalControls() {
  const pathname = usePathname()
  const inEditor = /^\/atendimento\/[^/]+/.test(pathname)
  const [offset, setOffset] = useState(0)
  const { data, error, isLoading } = useSWR(inEditor ? null : offset ? `${resumeKey}?offset=${offset}` : resumeKey, encounterRequest, { refreshInterval: 15_000, revalidateOnFocus: true })
  const [dismissed, setDismissed] = useState(false)
  const [open, setOpen] = useState(false)
  const drafts: Summary[] = data?.data || []
  const count = data?.count ?? drafts.length
  const onEncounter = pathname.startsWith("/atendimento")
  if (inEditor) return null
  return <>
    <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-card px-4 py-2 lg:px-6" data-guide="encounter-entry">
      <Button asChild className="min-h-11"><Link href="/atendimento"><Play className="mr-2 h-4 w-4" />Iniciar atendimento</Link></Button>
      <Button variant="outline" className="min-h-11" onClick={() => setOpen(true)} disabled={isLoading || (!count && !error)}><RotateCcw className="mr-2 h-4 w-4" />Retomar atendimento{count > 1 ? ` (${count})` : ""}</Button>
    </div>
    {drafts.length > 0 && !dismissed && !onEncounter && <div role="status" className="flex flex-wrap items-center justify-between gap-2 border-b bg-primary/5 px-4 py-2 text-sm">
      <span>Há atendimento em aberto. Deseja continuar de onde parou?</span>
      <div className="flex gap-2"><Button size="sm" onClick={() => setOpen(true)}>Retomar</Button><Button size="sm" variant="ghost" onClick={() => setDismissed(true)}>Agora não</Button></div>
    </div>}
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[80dvh] overflow-y-auto"><DialogHeader><DialogTitle>Retomar atendimento</DialogTitle><DialogDescription>Seus rascunhos ficam no servidor. Fechar este aviso não apaga nada.</DialogDescription></DialogHeader>
      {error && <p role="alert" className="text-sm text-destructive">Não foi possível consultar os rascunhos. {error.message}</p>}
      {!error && !drafts.length && <p>Nenhum atendimento em aberto.</p>}
      {drafts.map(draft => <Link key={draft.id} onClick={() => setOpen(false)} href={`/atendimento/${draft.id}`} className="block rounded-lg border p-4 hover:bg-muted focus-visible:outline-primary"><p className="font-semibold">{draft.patient?.full_name || "Cadastro em andamento"}</p><p className="text-sm text-muted-foreground">{stepLabels[draft.step]} · {new Date(draft.updated_at).toLocaleString("pt-BR", { timeZone: "America/Fortaleza" })}</p></Link>)}
      <div className="flex justify-between gap-2">{offset > 0 && <Button variant="outline" onClick={() => setOffset(Math.max(0, offset - 5))}>Anteriores</Button>}{offset + 5 < count && <Button variant="outline" onClick={() => setOffset(offset + 5)}>Próximos atendimentos</Button>}</div>
    </DialogContent></Dialog>
  </>
}
export function ClinicalMobileNav() {
  const pathname = usePathname()
  return <nav aria-label="Navegação clínica no celular" className="clinical-mobile-nav grid grid-cols-3 border-t bg-card lg:hidden">
    {[{ href: "/agenda", label: "Agenda", Icon: Calendar }, { href: "/atendimento", label: "Atendimento", Icon: Play }, { href: "/pacientes", label: "Pacientes", Icon: Users }].map(({ href, label, Icon }) => <Link key={href} href={href} aria-current={pathname.startsWith(href) ? "page" : undefined} className="flex min-h-14 flex-col items-center justify-center gap-1 text-xs aria-[current=page]:bg-primary/10 aria-[current=page]:text-primary"><Icon className="h-5 w-5" />{label}</Link>)}
  </nav>
}
