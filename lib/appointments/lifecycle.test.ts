import { describe, expect, it } from "vitest"
import { shouldCreateFinancialPending, validateAppointmentTransition } from "./lifecycle"

describe("ciclo da consulta e lançamento financeiro", () => {
  it("permite iniciar somente consultas disponíveis", () => {
    expect(validateAppointmentTransition("Confirmada", "Em Andamento")).toBeNull()
    expect(validateAppointmentTransition("Cancelada", "Em Andamento")).toContain("não está disponível")
  })

  it("permite concluir somente uma consulta em andamento", () => {
    expect(validateAppointmentTransition("Em Andamento", "Concluída")).toBeNull()
    expect(validateAppointmentTransition("Confirmada", "Concluída")).toContain("em andamento")
  })

  it("gera uma pendência somente na primeira conclusão", () => {
    expect(shouldCreateFinancialPending("Em Andamento", "Concluída")).toBe(true)
    expect(shouldCreateFinancialPending("Concluída", "Concluída")).toBe(false)
  })
})
