import { describe, expect, it } from "vitest"
import { convertDocumentsToImpact } from "./calculate-sustainability-metrics"

describe("convertDocumentsToImpact", () => {
  it("inclui os insumos de impressão evitados na estimativa", () => {
    const impact = convertDocumentsToImpact(2)
    expect(impact.documents).toBe(2)
    expect(impact.sheets).toBe(6)
    expect(impact.inkMl).toBeCloseTo(0.3)
    expect(impact.cartridgeEquivalents).toBeCloseTo(0.0375)
  })
})
