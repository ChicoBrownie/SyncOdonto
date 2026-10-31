import { describe, expect, it } from "vitest"
import { getWeekGridHours, isWithinWorkingHours, type WorkingHours } from "./working-hours"

const dates = Array.from({ length: 7 }, (_, index) => new Date(2026, 9, 26 + index))
const hours: WorkingHours = {
  start: "08:00",
  end: "18:00",
  days: {
    monday: { start: "08:00", end: "23:00", closed: false },
    tuesday: { start: "08:00", end: "23:00", closed: false },
    wednesday: { start: "08:00", end: "23:00", closed: false },
    thursday: { start: "08:00", end: "23:00", closed: false },
    friday: { start: "08:00", end: "23:00", closed: false },
    saturday: { start: "08:00", end: "12:00", closed: false },
    sunday: { start: "08:00", end: "18:00", closed: true },
  },
}

describe("horários da agenda semanal", () => {
  it("usa o horário de cada dia mesmo quando o horário geral está desatualizado", () => {
    expect(getWeekGridHours(dates, [], hours)).toEqual({ firstHour: 8, lastHour: 23 })
    expect(isWithinWorkingHours(dates[0], 22 * 60 + 45, 15, hours)).toBe(true)
    expect(isWithinWorkingHours(dates[0], 23 * 60, 15, hours)).toBe(false)
    expect(isWithinWorkingHours(dates[5], 11 * 60 + 45, 15, hours)).toBe(true)
    expect(isWithinWorkingHours(dates[5], 12 * 60, 15, hours)).toBe(false)
    expect(isWithinWorkingHours(dates[6], 9 * 60, 15, hours)).toBe(false)
  })

  it("mantém visíveis consultas existentes fora do expediente", () => {
    expect(getWeekGridHours(dates, [{ time: "07:30", duration_minutes: 30 }, { time: "23:15", duration_minutes: 45 }], hours))
      .toEqual({ firstHour: 7, lastHour: 24 })
  })
})
