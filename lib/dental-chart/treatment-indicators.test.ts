import { describe, expect, it } from "vitest"

import { buildTreatmentIndicators } from "./treatment-indicators"

describe("cores dos procedimentos no odontograma", () => {
  it("colore todas as faces e a raiz de um procedimento único", () => {
    const areas = ["mesial", "vestibular", "occlusal", "distal", "lingual", "root"] as const
    const indicators = buildTreatmentIndicators([{
      tooth_number: 11,
      tooth_area: "mesial",
      tooth_areas: [...areas],
      treatment_type: "Extração dentária",
      status: "planned",
      created_at: "2026-10-16T10:00:00Z",
    }])

    for (const area of areas) {
      expect(indicators[11][area]).toEqual([{ color: "#f59e0b", label: "Extração dentária — planejado" }])
    }
  })

  it("mantém compatibilidade com um registro antigo de uma face e com o dente inteiro", () => {
    const indicators = buildTreatmentIndicators([
      { tooth_number: 12, tooth_area: "mesial", treatment_type: "Restauração", status: "planned", created_at: "2026-10-16T10:00:00Z" },
      { tooth_number: 11, tooth_area: "whole", tooth_areas: ["whole", "root"], treatment_type: "Extração", status: "planned", created_at: "2026-10-16T10:01:00Z" },
    ])

    expect(indicators[12].mesial?.[0].color).toBe("#f59e0b")
    expect(indicators[11].whole?.[0].color).toBe("#f59e0b")
    expect(indicators[11].root).toBeUndefined()
  })
})
