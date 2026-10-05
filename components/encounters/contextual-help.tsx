"use client"
import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import useSWR from "swr"
import { HelpCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { encounterRequest } from "@/lib/encounters/client"

export type GuideStep = { selector: string; title: string; description: string }
export function ContextualHelp({ area, steps }: { area: string; steps: GuideStep[] }) {
  const { data, mutate } = useSWR("/api/encounter-guides", encounterRequest)
  const [index, setIndex] = useState<number | null>(null)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const [host, setHost] = useState<HTMLDivElement | null>(null)
  const card = useRef<HTMLDivElement>(null)
  const help = useRef<HTMLButtonElement>(null)
  const shown = useRef(new Set<string>())
  const [bottom, setBottom] = useState(16)
  useEffect(() => {
    const node = document.createElement("div"); document.body.appendChild(node); setHost(node)
    return () => node.remove()
  }, [])
  useEffect(() => { setIndex(null) }, [area])
  useEffect(() => {
    if (!data || shown.current.has(area)) return
    shown.current.add(area)
    if (!data.data.some((visit: { area: string }) => visit.area === area)) setIndex(0)
  }, [area, data])
  useEffect(() => {
    if (index === null || !host) return
    const target = document.querySelector<HTMLElement>(steps[index]?.selector)
    target?.scrollIntoView({ block: "center", behavior: "instant" })
    const measure = () => {
      setRect(target?.getBoundingClientRect() || null)
      const viewport = window.visualViewport
      setBottom(viewport ? Math.max(16, window.innerHeight - viewport.height - viewport.offsetTop + 16) : 16)
    }
    measure()
    const focus = requestAnimationFrame(() => card.current?.focus())
    const siblings = [...document.body.children].filter(node => node !== host && node instanceof HTMLElement) as HTMLElement[]
    const oldInert = siblings.map(node => node.inert)
    siblings.forEach(node => { node.inert = true })
    window.addEventListener("resize", measure); document.addEventListener("scroll", measure, true)
    window.visualViewport?.addEventListener("resize", measure); window.visualViewport?.addEventListener("scroll", measure)
    return () => {
      cancelAnimationFrame(focus); siblings.forEach((node, i) => { node.inert = oldInert[i] })
      window.removeEventListener("resize", measure); document.removeEventListener("scroll", measure, true)
      window.visualViewport?.removeEventListener("resize", measure); window.visualViewport?.removeEventListener("scroll", measure)
    }
  }, [index, steps, host])
  const close = async () => {
    setIndex(null); requestAnimationFrame(() => help.current?.focus())
    try { await encounterRequest("/api/encounter-guides", { method: "POST", body: JSON.stringify({ area }) }); await mutate() } catch { /* Help remains reopenable even if saving this preference fails. */ }
  }
  const step = index === null ? null : steps[index]
  return <>
    <Button ref={help} type="button" variant="outline" className="min-h-11" onClick={() => setIndex(0)}><HelpCircle className="mr-2 h-4 w-4" />Ajuda</Button>
    {host && step && createPortal(<div className="fixed inset-0 z-[100]">
      <svg aria-hidden="true" className="absolute inset-0 h-full w-full"><defs><mask id="guide-hole"><rect width="100%" height="100%" fill="white" />{rect && <rect x={Math.max(0, rect.left - 4)} y={Math.max(0, rect.top - 4)} width={rect.width + 8} height={rect.height + 8} rx="10" fill="black" />}</mask></defs><rect width="100%" height="100%" fill="rgba(0,0,0,.72)" mask="url(#guide-hole)" />{rect && <rect x={rect.left - 4} y={rect.top - 4} width={rect.width + 8} height={rect.height + 8} rx="10" fill="none" stroke="#38bdf8" strokeWidth="3" />}</svg>
      <div ref={card} role="dialog" aria-modal="true" aria-labelledby="guide-title" aria-describedby="guide-description" tabIndex={-1} className="absolute left-3 right-3 mx-auto max-h-[45dvh] max-w-md overflow-y-auto rounded-xl border bg-card p-5 shadow-2xl" style={{ bottom }} onKeyDown={event => {
        if (event.key === "Escape") { event.preventDefault(); void close() }
        if (event.key === "Tab") {
          const controls = card.current?.querySelectorAll<HTMLButtonElement>("button")
          if (!controls?.length) return
          if (event.shiftKey && (document.activeElement === controls[0] || document.activeElement === card.current)) { event.preventDefault(); controls[controls.length - 1].focus() }
          else if (!event.shiftKey && document.activeElement === controls[controls.length - 1]) { event.preventDefault(); controls[0].focus() }
        }
      }}><p className="text-xs text-muted-foreground">{(index || 0) + 1} de {steps.length}</p><h2 id="guide-title" className="mt-1 text-lg font-semibold">{step.title}</h2><p id="guide-description" className="mt-2 text-sm">{step.description}</p><div className="mt-4 flex justify-between gap-2"><Button variant="ghost" className="min-h-11" onClick={() => void close()}>Pular guia</Button><Button className="min-h-11" onClick={() => index! + 1 < steps.length ? setIndex(index! + 1) : void close()}>{index! + 1 < steps.length ? "Próximo" : "Entendi"}</Button></div></div>
    </div>, host)}
  </>
}
