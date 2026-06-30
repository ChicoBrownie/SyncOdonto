"use client"

import { cn } from "@/lib/utils"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"

export type ToothCondition = "Saudável" | "Restaurado" | "Atenção/Cárie" | "Tratamento Canal" | "Sem Registros" | "Ausente" | "Implante"

export const CONDITIONS: { value: ToothCondition; label: string; color: string; dotColor: string }[] = [
  { value: "Sem Registros", label: "Sem Registro", color: "bg-muted hover:bg-muted/80 border-border", dotColor: "bg-muted-foreground" },
  { value: "Saudável", label: "Saudavel", color: "bg-success hover:bg-success/80 border-success", dotColor: "bg-success" },
  { value: "Restaurado", label: "Restaurado", color: "bg-primary hover:bg-primary/80 border-primary", dotColor: "bg-primary" },
  { value: "Atenção/Cárie", label: "Carie", color: "bg-warning hover:bg-warning/80 border-warning", dotColor: "bg-warning" },
  { value: "Tratamento Canal", label: "Tratamento de Canal", color: "bg-danger hover:bg-danger/80 border-danger", dotColor: "bg-danger" },
  { value: "Ausente", label: "Ausente", color: "bg-zinc-400 hover:bg-zinc-400/80 border-zinc-400", dotColor: "bg-zinc-400" },
  { value: "Implante", label: "Implante", color: "bg-violet-500 hover:bg-violet-400/80 border-violet-500", dotColor: "bg-violet-500" },
]

interface DentalChartProps {
  selectedTooth: number | null
  onToothSelect: (tooth: number) => void
  toothData: Record<number, ToothCondition>
  onConditionChange: (tooth: number, condition: ToothCondition) => void
}

const getToothColor = (condition: ToothCondition) => {
  return CONDITIONS.find(c => c.value === condition)?.color || CONDITIONS[0].color
}

export function DentalChart({ selectedTooth, onToothSelect, toothData, onConditionChange }: DentalChartProps) {
  const upperTeeth = [
    [18, 17, 16, 15, 14, 13, 12, 11],
    [21, 22, 23, 24, 25, 26, 27, 28],
  ]

  const lowerTeeth = [
    [48, 47, 46, 45, 44, 43, 42, 41],
    [31, 32, 33, 34, 35, 36, 37, 38],
  ]

  const renderTooth = (toothNumber: number) => {
    const condition = toothData[toothNumber] || "none"
    const isSelected = selectedTooth === toothNumber
    const isMissing = condition === "missing"

    return (
      <Popover key={toothNumber}>
        <PopoverTrigger asChild>
          <button
            onClick={() => onToothSelect(toothNumber)}
            className={cn(
              "relative flex h-11 w-11 sm:h-13 sm:w-13 items-center justify-center rounded-lg border-2 transition-all hover:scale-105 focus:outline-none focus:ring-2 focus:ring-primary/50",
              isSelected && "ring-2 ring-primary ring-offset-2 ring-offset-background",
              isMissing && "opacity-50 line-through",
              getToothColor(condition),
            )}
          >
            <span className={cn(
              "text-xs font-bold",
              condition === "none" ? "text-muted-foreground" : "text-foreground",
              isSelected && "text-foreground",
            )}>
              {toothNumber}
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-52 p-2" align="center" side="bottom">
          <p className="text-xs font-semibold text-foreground mb-2 px-1">Dente {toothNumber}</p>
          <div className="flex flex-col gap-0.5">
            {CONDITIONS.map(c => (
              <Button
                key={c.value}
                variant="ghost"
                size="sm"
                className={cn(
                  "justify-start gap-2 h-8 text-xs font-medium",
                  condition === c.value && "bg-accent"
                )}
                onClick={() => onConditionChange(toothNumber, c.value)}
              >
                <div className={cn("h-3 w-3 rounded-full shrink-0", c.dotColor)} />
                {c.label}
              </Button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    )
  }

  return (
    <div className="space-y-6">
      {/* Upper Teeth */}
      <div>
        <div className="mb-3 text-center">
          <span className="text-sm font-medium text-muted-foreground">Arcada Superior</span>
        </div>
        <div className="flex justify-center gap-6 sm:gap-8">
          <div className="flex gap-1 sm:gap-1.5">{upperTeeth[0].map(renderTooth)}</div>
          <div className="flex gap-1 sm:gap-1.5">{upperTeeth[1].map(renderTooth)}</div>
        </div>
      </div>

      <div className="h-px bg-border" />

      {/* Lower Teeth */}
      <div>
        <div className="flex justify-center gap-6 sm:gap-8">
          <div className="flex gap-1 sm:gap-1.5">{lowerTeeth[0].map(renderTooth)}</div>
          <div className="flex gap-1 sm:gap-1.5">{lowerTeeth[1].map(renderTooth)}</div>
        </div>
        <div className="mt-3 text-center">
          <span className="text-sm font-medium text-muted-foreground">Arcada Inferior</span>
        </div>
      </div>
    </div>
  )
}
