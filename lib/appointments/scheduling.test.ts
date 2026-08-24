import { describe, expect, it } from "vitest"

import { getLocalDate, getLocalMinutes, hasTimeConflict, parseMinutes } from "./scheduling"

describe("agendamento", () => {
  it("detecta sobreposição e permite horários adjacentes", () => {
    expect(hasTimeConflict("09:00", 60, "09:30", 30)).toBe(true)
    expect(hasTimeConflict("09:00", 60, "10:00", 30)).toBe(false)
  })

  it("valida horários", () => {
    expect(parseMinutes("08:45")).toBe(525)
    expect(Number.isNaN(parseMinutes("25:00"))).toBe(true)
  })

  it("calcula data e minutos no fuso da clínica", () => {
    const instant = new Date("2026-08-24T01:30:00.000Z")
    expect(getLocalDate(instant)).toBe("2026-08-23")
    expect(getLocalMinutes(instant)).toBe(22 * 60 + 30)
  })
})
