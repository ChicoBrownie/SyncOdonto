"use client"

import { cn } from "@/lib/utils"
import { Check } from "lucide-react"

export type ToothCondition = "Saudável" | "Restaurado" | "Atenção/Cárie" | "Tratamento Canal" | "Sem Registros" | "Ausente" | "Implante"
export type DentalSurface = "vestibular" | "lingual" | "mesial" | "distal" | "occlusal"
export type ToothArea = DentalSurface | "whole"
export type ToothState = { whole?: ToothCondition; surfaces: Partial<Record<DentalSurface, ToothCondition>> }

export const SURFACE_LABELS: Record<ToothArea, string> = {
  whole: "Dente inteiro", vestibular: "Vestibular", lingual: "Lingual / palatina",
  mesial: "Mesial", distal: "Distal", occlusal: "Oclusal / incisal",
}

export const CONDITIONS: { value: ToothCondition; label: string; color: string; dotColor: string; hex: string }[] = [
  { value: "Sem Registros", label: "Sem registro", color: "bg-muted border-border", dotColor: "bg-slate-400", hex: "#ffffff" },
  { value: "Saudável", label: "Saudável", color: "bg-success border-success", dotColor: "bg-emerald-500", hex: "#22c55e" },
  { value: "Restaurado", label: "Restaurado", color: "bg-primary border-primary", dotColor: "bg-cyan-600", hex: "#0891b2" },
  { value: "Atenção/Cárie", label: "Cárie / atenção", color: "bg-warning border-warning", dotColor: "bg-amber-500", hex: "#f59e0b" },
  { value: "Tratamento Canal", label: "Tratamento de canal", color: "bg-danger border-danger", dotColor: "bg-red-600", hex: "#dc2626" },
  { value: "Ausente", label: "Ausente", color: "bg-zinc-400 border-zinc-400", dotColor: "bg-zinc-400", hex: "#a1a1aa" },
  { value: "Implante", label: "Implante", color: "bg-violet-500 border-violet-500", dotColor: "bg-violet-500", hex: "#8b5cf6" },
]

export const CONDITION_TO_DB: Record<ToothCondition, string | null> = {
  "Sem Registros": null, "Saudável": "healthy", "Restaurado": "filled",
  "Atenção/Cárie": "caries", "Tratamento Canal": "root_canal", "Ausente": "absent", "Implante": "implant",
}

export const DB_TO_CONDITION: Record<string, ToothCondition> = {
  healthy: "Saudável", filled: "Restaurado", caries: "Atenção/Cárie",
  root_canal: "Tratamento Canal", absent: "Ausente", implant: "Implante",
}

const SURFACES: DentalSurface[] = ["vestibular", "lingual", "mesial", "distal", "occlusal"]

interface DentalChartProps {
  selectedTooth: number | null
  selectedArea?: ToothArea | null
  onAreaSelect: (tooth: number, area: ToothArea) => void
  toothData: Record<number, ToothState>
  multiSelectMode?: boolean
  selectedTeeth?: Set<number>
  onToggleToothSelection?: (tooth: number) => void
  dentition: "permanent" | "deciduous"
}

function conditionHex(condition?: ToothCondition) {
  return CONDITIONS.find((item) => item.value === condition)?.hex || "#ffffff"
}

function ToothDiagram({ number, state, selected, selectedArea, multiSelectMode, checked, onSelect }: {
  number: number; state?: ToothState; selected: boolean; selectedArea?: ToothArea | null
  multiSelectMode: boolean; checked: boolean; onSelect: (area: ToothArea) => void
}) {
  const fill = (surface: DentalSurface) => conditionHex(state?.surfaces[surface] || state?.whole)
  const areaClass = (surface: DentalSurface) => cn(
    "cursor-pointer stroke-slate-400 transition-all hover:brightness-90 focus:outline-none",
    selected && selectedArea === surface && "stroke-primary stroke-[2.5]",
  )
  const select = (area: ToothArea) => onSelect(multiSelectMode ? "whole" : area)
  const quadrant = Math.floor(number / 10)
  const mesialOnRight = [1, 4, 5, 8].includes(quadrant)
  const leftSurface: DentalSurface = mesialOnRight ? "distal" : "mesial"
  const rightSurface: DentalSurface = mesialOnRight ? "mesial" : "distal"
  const keyboard = (event: React.KeyboardEvent, area: ToothArea) => {
    if (event.key === "Enter" || event.key === " ") { event.preventDefault(); select(area) }
  }

  return (
    <div className={cn("relative flex w-12 flex-col items-center", checked && "scale-105")}>
      <button type="button" onClick={() => select("whole")} className={cn(
        "mb-0.5 rounded px-1 text-[11px] font-semibold hover:bg-accent focus:outline-none focus:ring-2 focus:ring-primary/50",
        selected && selectedArea === "whole" && "bg-primary text-primary-foreground",
      )} aria-label={`Selecionar dente ${number} inteiro`}>{number}</button>
      <svg viewBox="0 0 46 46" className="h-11 w-11" role="group" aria-label={`Dente ${number} dividido em cinco faces`}>
        <path tabIndex={0} role="button" aria-label={`${SURFACE_LABELS.vestibular} do dente ${number}`} onClick={() => select("vestibular")} onKeyDown={(e) => keyboard(e, "vestibular")} className={areaClass("vestibular")} fill={fill("vestibular")} d="M3 3 H43 L33 14 H13 Z" />
        <path tabIndex={0} role="button" aria-label={`${SURFACE_LABELS.lingual} do dente ${number}`} onClick={() => select("lingual")} onKeyDown={(e) => keyboard(e, "lingual")} className={areaClass("lingual")} fill={fill("lingual")} d="M3 43 H43 L33 32 H13 Z" />
        <path tabIndex={0} role="button" aria-label={`${SURFACE_LABELS[leftSurface]} do dente ${number}`} onClick={() => select(leftSurface)} onKeyDown={(e) => keyboard(e, leftSurface)} className={areaClass(leftSurface)} fill={fill(leftSurface)} d="M3 3 L13 14 V32 L3 43 Z" />
        <path tabIndex={0} role="button" aria-label={`${SURFACE_LABELS[rightSurface]} do dente ${number}`} onClick={() => select(rightSurface)} onKeyDown={(e) => keyboard(e, rightSurface)} className={areaClass(rightSurface)} fill={fill(rightSurface)} d="M43 3 L33 14 V32 L43 43 Z" />
        <rect tabIndex={0} role="button" aria-label={`${SURFACE_LABELS.occlusal} do dente ${number}`} onClick={() => select("occlusal")} onKeyDown={(e) => keyboard(e, "occlusal")} className={areaClass("occlusal")} fill={fill("occlusal")} x="13" y="14" width="20" height="18" rx="3" />
      </svg>
      {checked && <span className="absolute -right-0.5 top-3 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground"><Check className="h-2.5 w-2.5" /></span>}
    </div>
  )
}

export function DentalChart({ selectedTooth, selectedArea, onAreaSelect, toothData, multiSelectMode = false, selectedTeeth, onToggleToothSelection, dentition }: DentalChartProps) {
  const rows = dentition === "permanent"
    ? [[18,17,16,15,14,13,12,11,21,22,23,24,25,26,27,28], [48,47,46,45,44,43,42,41,31,32,33,34,35,36,37,38]]
    : [[55,54,53,52,51,61,62,63,64,65], [85,84,83,82,81,71,72,73,74,75]]

  return <div className="space-y-7">
    {rows.map((numbers, rowIndex) => <div key={rowIndex}>
      <p className="mb-3 text-center text-xs font-medium text-muted-foreground">{rowIndex === 0 ? "Arcada superior" : "Arcada inferior"}</p>
      <div className="mx-auto flex max-w-5xl flex-wrap justify-center gap-x-1 gap-y-3 sm:gap-x-2">
        {numbers.map((number, index) => <div key={number} className={cn("flex items-center", index === numbers.length / 2 && "ml-3 border-l border-dashed border-border pl-3 sm:ml-5 sm:pl-5")}>
          <ToothDiagram number={number} state={toothData[number]} selected={selectedTooth === number} selectedArea={selectedArea} multiSelectMode={multiSelectMode} checked={selectedTeeth?.has(number) ?? false} onSelect={(area) => multiSelectMode ? onToggleToothSelection?.(number) : onAreaSelect(number, area)} />
        </div>)}
      </div>
    </div>)}
    <div className="flex flex-wrap justify-center gap-x-5 gap-y-2 border-t pt-4 text-[11px] text-muted-foreground">
      {SURFACES.map((surface) => <span key={surface}><strong className="text-foreground">{SURFACE_LABELS[surface]}:</strong> clique na região do desenho</span>)}
    </div>
  </div>
}
