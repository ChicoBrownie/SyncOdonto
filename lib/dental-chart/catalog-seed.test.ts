import { describe, expect, it } from "vitest"
import { DEFAULT_PROCEDURES } from "./default-procedures"
import { defaultProcedureId, missingDefaultProcedureRows } from "./catalog-seed"

const clinicId = "58db435f-83d4-4cc5-a00f-87978e3be5d1"

describe("catálogo inicial de procedimentos", () => {
  it("cria 100 opções distintas para uma clínica nova, sem preços inventados", () => {
    const rows = missingDefaultProcedureRows(clinicId, [])
    expect(rows).toHaveLength(100)
    expect(new Set(rows.map(row => row.name)).size).toBe(100)
    expect(rows.every(row => row.default_price === 0 && row.user_id === clinicId)).toBe(true)
  })

  it("completa o catálogo antigo sem duplicar os cinco itens originais", () => {
    const existing = DEFAULT_PROCEDURES.slice(0, 5).map((name, index) => ({ id: String(index), name }))
    const rows = missingDefaultProcedureRows(clinicId, existing)
    expect(rows).toHaveLength(95)
    expect(rows.some(row => row.name === "Consulta odontológica")).toBe(false)
  })

  it("respeita um procedimento inicial renomeado pela clínica", () => {
    const original = "Radiografia periapical"
    const existing = [
      ...DEFAULT_PROCEDURES.slice(0, 5).map((name, index) => ({ id: String(index), name })),
      { id: defaultProcedureId(clinicId, original), name: "Raio X periapical personalizado" },
    ]
    expect(missingDefaultProcedureRows(clinicId, existing).some(row => row.name === original)).toBe(false)
  })
})
