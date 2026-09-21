"use client"

import { Check } from "lucide-react"

import { cn } from "@/lib/utils"

export type ToothCondition =
  | "Ígido"
  | "Restaurado"
  | "Cárie"
  | "Canal tratado"
  | "Coroa"
  | "Fratura"
  | "Sem Registros"
  | "Ausente"
  | "Implante"

export type DentalSurface = "vestibular" | "lingual" | "mesial" | "distal" | "occlusal"
export type ToothRegion = DentalSurface | "root"
export type ToothArea = ToothRegion | "whole"
export type ToothState = { whole?: ToothCondition; surfaces: Partial<Record<ToothRegion, ToothCondition>> }
export type ToothTreatmentIndicator = { color: string; label: string }
export type ToothTreatmentIndicators = Record<number, Partial<Record<ToothArea, ToothTreatmentIndicator[]>>>

export const SURFACE_LABELS: Record<ToothArea, string> = {
  whole: "Dente inteiro",
  root: "Raiz",
  vestibular: "Vestibular",
  lingual: "Lingual / palatina",
  mesial: "Mesial",
  distal: "Distal",
  occlusal: "Oclusal / incisal",
}

export const CONDITIONS: { value: ToothCondition; label: string; color: string; dotColor: string; hex: string }[] = [
  { value: "Sem Registros", label: "Sem registro", color: "bg-muted border-border", dotColor: "bg-slate-400", hex: "#ffffff" },
  { value: "Ígido", label: "Ígido", color: "bg-emerald-500 border-emerald-500", dotColor: "bg-emerald-500", hex: "#22c55e" },
  { value: "Cárie", label: "Cárie", color: "bg-amber-500 border-amber-500", dotColor: "bg-amber-500", hex: "#f59e0b" },
  { value: "Restaurado", label: "Restaurado", color: "bg-cyan-600 border-cyan-600", dotColor: "bg-cyan-600", hex: "#0891b2" },
  { value: "Canal tratado", label: "Canal tratado", color: "bg-rose-600 border-rose-600", dotColor: "bg-rose-600", hex: "#e11d48" },
  { value: "Coroa", label: "Coroa", color: "bg-indigo-500 border-indigo-500", dotColor: "bg-indigo-500", hex: "#6366f1" },
  { value: "Fratura", label: "Fratura", color: "bg-orange-700 border-orange-700", dotColor: "bg-orange-700", hex: "#c2410c" },
  { value: "Ausente", label: "Ausente", color: "bg-zinc-400 border-zinc-400", dotColor: "bg-zinc-400", hex: "#a1a1aa" },
  { value: "Implante", label: "Implante", color: "bg-violet-500 border-violet-500", dotColor: "bg-violet-500", hex: "#8b5cf6" },
]

export const CONDITION_TO_DB: Record<ToothCondition, string | null> = {
  "Sem Registros": null,
  "Ígido": "healthy",
  "Restaurado": "filled",
  "Cárie": "caries",
  "Canal tratado": "root_canal",
  "Coroa": "crown",
  "Fratura": "fracture",
  "Ausente": "absent",
  "Implante": "implant",
}

export const DB_TO_CONDITION: Record<string, ToothCondition> = {
  healthy: "Ígido",
  filled: "Restaurado",
  caries: "Cárie",
  root_canal: "Canal tratado",
  crown: "Coroa",
  fracture: "Fratura",
  absent: "Ausente",
  extracted: "Ausente",
  implant: "Implante",
}

interface DentalChartProps {
  selectedTooth: number | null
  selectedArea?: ToothArea | null
  onAreaSelect: (tooth: number, area: ToothArea) => void
  toothData: Record<number, ToothState>
  treatmentIndicators?: ToothTreatmentIndicators
  multiSelectMode?: boolean
  selectedTeeth?: Set<number>
  onToggleToothSelection?: (tooth: number) => void
  dentition: "permanent" | "deciduous"
  readOnly?: boolean
}

function conditionHex(condition?: ToothCondition) {
  if (["Cárie", "Fratura"].includes(condition || "")) return "#f59e0b"
  if (["Restaurado", "Canal tratado", "Coroa", "Ausente", "Implante"].includes(condition || "")) return "#22c55e"
  return "#ffffff"
}

function ToothDiagram({ number, state, indicators = {}, selected, selectedArea, multiSelectMode, checked, upper, readOnly, mobileExpanded = false, onSelect }: {
  number: number
  state?: ToothState
  indicators?: Partial<Record<ToothArea, ToothTreatmentIndicator[]>>
  selected: boolean
  selectedArea?: ToothArea | null
  multiSelectMode: boolean
  checked: boolean
  upper: boolean
  readOnly: boolean
  mobileExpanded?: boolean
  onSelect: (area: ToothArea) => void
}) {
  const indicatorColors = (area: ToothArea) => {
    const values = area === "whole"
      ? indicators.whole || []
      : [...(indicators.whole || []), ...(indicators[area] || [])]
    return values.map((item) => item.color)
  }
  const patternId = (area: ToothArea) => `tooth-${number}-${area}-treatments`
  const fill = (surface: ToothRegion) => {
    const colors = indicatorColors(surface)
    if (colors.length === 1) return colors[0]
    if (colors.length > 1) return `url(#${patternId(surface)})`
    return conditionHex(state?.surfaces[surface] || state?.whole)
  }
  const select = (area: ToothArea) => {
    if (!readOnly) onSelect(multiSelectMode ? "whole" : area)
  }
  const keyboard = (event: React.KeyboardEvent, area: ToothArea) => {
    if (!readOnly && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault()
      select(area)
    }
  }
  const areaClass = (area: ToothArea) => cn(
    "stroke-slate-400 transition-all focus:outline-none",
    !readOnly && "cursor-pointer hover:brightness-90",
    selected && selectedArea === area && "stroke-primary stroke-[2.8]",
  )

  const quadrant = Math.floor(number / 10)
  const mesialOnRight = [1, 4, 5, 8].includes(quadrant)
  const leftSurface: DentalSurface = mesialOnRight ? "distal" : "mesial"
  const rightSurface: DentalSurface = mesialOnRight ? "mesial" : "distal"
  const crownTop = upper ? 32 : 3
  const crownBottom = crownTop + 40
  const innerTop = crownTop + 11
  const innerBottom = crownBottom - 11
  const rootPath = upper
    ? "M13 32 C15 24 15 13 20 3 C22 0 24 0 26 3 C31 13 31 24 33 32 Z"
    : "M13 43 C15 51 15 62 20 72 C22 76 24 76 26 72 C31 62 31 51 33 43 Z"

  return (
    <div className={cn("relative flex flex-col items-center", mobileExpanded ? "w-10" : "w-5 sm:w-9 lg:w-[52px]", checked && "scale-105")}>
      <button
        type="button"
        disabled={readOnly}
        onClick={() => select("whole")}
        className={cn(
          "mb-0.5 rounded font-semibold leading-3 focus:outline-none focus:ring-2 focus:ring-primary/50",
          mobileExpanded ? "px-1 py-0.5 text-[10px]" : "px-0 py-0 text-[8px] sm:px-1 sm:py-0.5 sm:text-[10px] lg:px-1.5 lg:text-[11px]",
          !readOnly && "hover:bg-accent",
          selected && selectedArea === "whole" && "bg-primary text-primary-foreground",
        )}
        title={`Dente ${number} inteiro`}
        aria-label={`Selecionar dente ${number} inteiro`}
      >
        {number}
      </button>
      <svg viewBox="0 0 46 76" className={mobileExpanded ? "h-[66px] w-10" : "h-[33px] w-5 sm:h-14 sm:w-9 lg:h-[76px] lg:w-[46px]"} role="group" aria-label={`Dente ${number}: cinco faces da coroa e raiz`}>
        <defs>
          {(["root", "vestibular", "lingual", "mesial", "distal", "occlusal"] as ToothRegion[]).map((area) => {
            const colors = indicatorColors(area)
            if (colors.length < 2) return null
            return <pattern key={area} id={patternId(area)} patternUnits="userSpaceOnUse" width={colors.length * 6} height="6">
              {colors.map((color, index) => <rect key={`${color}-${index}`} x={index * 6} y="0" width="6" height="6" fill={color} />)}
            </pattern>
          })}
        </defs>
        <path tabIndex={readOnly ? -1 : 0} role="button" aria-label={`${SURFACE_LABELS.root} do dente ${number}`} onClick={() => select("root")} onKeyDown={(event) => keyboard(event, "root")} className={areaClass("root")} fill={fill("root")} d={rootPath} />
        <path tabIndex={readOnly ? -1 : 0} role="button" aria-label={`${SURFACE_LABELS.vestibular} do dente ${number}`} onClick={() => select("vestibular")} onKeyDown={(event) => keyboard(event, "vestibular")} className={areaClass("vestibular")} fill={fill("vestibular")} d={`M3 ${crownTop} H43 L33 ${innerTop} H13 Z`} />
        <path tabIndex={readOnly ? -1 : 0} role="button" aria-label={`${SURFACE_LABELS.lingual} do dente ${number}`} onClick={() => select("lingual")} onKeyDown={(event) => keyboard(event, "lingual")} className={areaClass("lingual")} fill={fill("lingual")} d={`M3 ${crownBottom} H43 L33 ${innerBottom} H13 Z`} />
        <path tabIndex={readOnly ? -1 : 0} role="button" aria-label={`${SURFACE_LABELS[leftSurface]} do dente ${number}`} onClick={() => select(leftSurface)} onKeyDown={(event) => keyboard(event, leftSurface)} className={areaClass(leftSurface)} fill={fill(leftSurface)} d={`M3 ${crownTop} L13 ${innerTop} V${innerBottom} L3 ${crownBottom} Z`} />
        <path tabIndex={readOnly ? -1 : 0} role="button" aria-label={`${SURFACE_LABELS[rightSurface]} do dente ${number}`} onClick={() => select(rightSurface)} onKeyDown={(event) => keyboard(event, rightSurface)} className={areaClass(rightSurface)} fill={fill(rightSurface)} d={`M43 ${crownTop} L33 ${innerTop} V${innerBottom} L43 ${crownBottom} Z`} />
        <rect tabIndex={readOnly ? -1 : 0} role="button" aria-label={`${SURFACE_LABELS.occlusal} do dente ${number}`} onClick={() => select("occlusal")} onKeyDown={(event) => keyboard(event, "occlusal")} className={areaClass("occlusal")} fill={fill("occlusal")} x="13" y={innerTop} width="20" height={innerBottom - innerTop} rx="3" />
        <text x="23" y={upper ? 23 : 61} textAnchor="middle" className="pointer-events-none fill-slate-500 text-[7px] font-bold">R</text>
      </svg>
      {checked && <span className={cn("absolute -right-0.5 flex items-center justify-center rounded-full bg-primary text-primary-foreground", mobileExpanded ? "top-4 h-4 w-4" : "top-3 h-3 w-3 sm:top-4 sm:h-4 sm:w-4")}><Check className={mobileExpanded ? "h-2.5 w-2.5" : "h-2 w-2 sm:h-2.5 sm:w-2.5"} /></span>}
    </div>
  )
}

export function DentalChart({ selectedTooth, selectedArea, onAreaSelect, toothData, treatmentIndicators, multiSelectMode = false, selectedTeeth, onToggleToothSelection, dentition, readOnly = false }: DentalChartProps) {
  const rows = dentition === "permanent"
    ? [[18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28], [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38]]
    : [[55, 54, 53, 52, 51, 61, 62, 63, 64, 65], [85, 84, 83, 82, 81, 71, 72, 73, 74, 75]]

  // No celular, separar cada arcada em lados mantém cada dente em uma área de
  // toque confortável. Mostrar 16 dentes em uma única linha os deixava pequenos
  // demais para o uso clínico.
  const mobileRows = dentition === "permanent"
    ? [
        { label: "Superior · lado esquerdo", numbers: [18, 17, 16, 15, 14, 13, 12, 11], upper: true },
        { label: "Superior · lado direito", numbers: [21, 22, 23, 24, 25, 26, 27, 28], upper: true },
        { label: "Inferior · lado esquerdo", numbers: [48, 47, 46, 45, 44, 43, 42, 41], upper: false },
        { label: "Inferior · lado direito", numbers: [31, 32, 33, 34, 35, 36, 37, 38], upper: false },
      ]
    : [
        { label: "Superior · lado esquerdo", numbers: [55, 54, 53, 52, 51], upper: true },
        { label: "Superior · lado direito", numbers: [61, 62, 63, 64, 65], upper: true },
        { label: "Inferior · lado esquerdo", numbers: [85, 84, 83, 82, 81], upper: false },
        { label: "Inferior · lado direito", numbers: [71, 72, 73, 74, 75], upper: false },
      ]

  const renderTooth = (number: number, upper: boolean, mobileExpanded = false) => (
    <ToothDiagram
      key={number}
      number={number}
      state={toothData[number]}
      indicators={treatmentIndicators?.[number]}
      selected={selectedTooth === number}
      selectedArea={selectedArea}
      multiSelectMode={multiSelectMode}
      checked={selectedTeeth?.has(number) ?? false}
      upper={upper}
      readOnly={readOnly}
      mobileExpanded={mobileExpanded}
      onSelect={(area) => multiSelectMode ? onToggleToothSelection?.(number) : onAreaSelect(number, area)}
    />
  )

  return (
    <div className="pb-1 sm:pb-2">
      <div className="space-y-4 sm:hidden">
        {mobileRows.map((row) => (
          <div key={row.label}>
            <p className="mb-1.5 text-center text-[10px] font-medium text-muted-foreground">{row.label}</p>
            <div className="flex justify-center">
              {row.numbers.map((number) => renderTooth(number, row.upper, true))}
            </div>
          </div>
        ))}
      </div>

      <div className="hidden space-y-7 sm:block">
        {rows.map((numbers, rowIndex) => (
          <div key={rowIndex} className={cn("mx-auto", dentition === "permanent" ? "min-w-[590px] lg:min-w-[920px]" : "min-w-[380px] lg:min-w-[590px]")}>
          <p className="mb-1 text-center text-[9px] font-medium text-muted-foreground sm:mb-2 sm:text-xs">{rowIndex === 0 ? "Arcada superior" : "Arcada inferior"}</p>
          <div className="mx-auto flex justify-center gap-x-0 sm:gap-x-1">
            {numbers.map((number, index) => (
              <div key={number} className={cn("flex items-center", index === numbers.length / 2 && "ml-1 border-l border-dashed border-border pl-1 sm:ml-3 sm:pl-3")}>
                {renderTooth(number, rowIndex === 0)}
              </div>
            ))}
          </div>
        </div>
      ))}
      </div>
    </div>
  )
}
