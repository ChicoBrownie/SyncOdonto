import { describe, expect, it } from "vitest"

import { isClinicManager, stripImmutableTenantFields } from "./request-data"

describe("stripImmutableTenantFields", () => {
  it("impede a troca de clínica e de identificadores pelo corpo da requisição", () => {
    expect(stripImmutableTenantFields({
      id: "registro-alheio",
      user_id: "clinica-alheia",
      created_at: "ontem",
      updated_at: "hoje",
      status: "Concluída",
    })).toEqual({ status: "Concluída" })
  })
})

describe("isClinicManager", () => {
  it("autoriza somente o gestor", () => {
    expect(isClinicManager("gestor")).toBe(true)
    expect(isClinicManager("dentista")).toBe(false)
    expect(isClinicManager("recepcionista")).toBe(false)
    expect(isClinicManager(undefined)).toBe(false)
  })
})
