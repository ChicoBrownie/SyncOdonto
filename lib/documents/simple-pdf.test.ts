import { describe, expect, it } from "vitest"
import { createSimplePdf } from "./simple-pdf"

describe("geração local de documentos", () => {
  it("produz um PDF válido e não vazio", () => {
    const pdf = createSimplePdf("Atestado odontológico", "Paciente fictício apto para teste.")
    expect(pdf.byteLength).toBeGreaterThan(100)
    expect(new TextDecoder().decode(pdf.slice(0, 8))).toContain("%PDF")
  })
})
