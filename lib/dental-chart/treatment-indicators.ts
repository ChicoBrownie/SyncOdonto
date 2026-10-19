import type { ToothArea, ToothTreatmentIndicators } from "@/components/dental-chart/dental-chart"

type TreatmentForIndicator = {
  tooth_number: number | null
  tooth_area: ToothArea | null
  tooth_areas?: ToothArea[] | null
  treatment_type: string
  status: "planned" | "in_progress" | "completed" | "cancelled"
  created_at: string
}

const plannedColors = ["#f59e0b", "#ef4444", "#92400e"]

export function buildTreatmentIndicators(treatments: TreatmentForIndicator[]): ToothTreatmentIndicators {
  const mapped: ToothTreatmentIndicators = {}
  const plannedByArea = new Map<string, number>()

  treatments
    .filter((item) => item.status !== "cancelled" && item.tooth_number && (item.tooth_areas?.length || item.tooth_area))
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .forEach((item) => {
      const tooth = item.tooth_number as number
      const areas = item.tooth_areas?.length ? item.tooth_areas : [item.tooth_area as ToothArea]
      const visibleAreas = areas.includes("whole") ? ["whole" as ToothArea] : [...new Set(areas)]
      if (!mapped[tooth]) mapped[tooth] = {}

      for (const area of visibleAreas) {
        const key = `${tooth}-${area}`
        const plannedPosition = plannedByArea.get(key) || 0
        if (item.status !== "completed") plannedByArea.set(key, plannedPosition + 1)
        const color = item.status === "completed" ? "#22c55e" : plannedColors[Math.min(plannedPosition, plannedColors.length - 1)]
        const indicators = mapped[tooth][area] || []
        indicators.push({ color, label: `${item.treatment_type} — ${item.status === "completed" ? "realizado" : "planejado"}` })
        mapped[tooth][area] = indicators
      }
    })

  return mapped
}
