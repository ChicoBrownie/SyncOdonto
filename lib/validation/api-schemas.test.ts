import { describe, expect, it } from "vitest"

import { anamnesisInputSchema, appointmentInputSchema, dentalChartInputSchema, documentInputSchema, medicalRecordInputSchema, parseInput, patientInputSchema, staffCreateSchema } from "./api-schemas"

describe("esquemas das APIs", () => {
  it("remove campos desconhecidos de pacientes", () => {
    const parsed = parseInput(patientInputSchema, { full_name: "Maria Silva", user_id: "outra-clinica", campo_interno: true })
    expect(parsed.data).toEqual({ full_name: "Maria Silva" })
  })

  it("rejeita horários e IDs inválidos", () => {
    const parsed = parseInput(appointmentInputSchema, { patient_id: "invalido", date: "2026-08-25", time: "29:00", procedure_type: "Consulta", doctor_name: "Dra. Ana" })
    expect(parsed.data).toBeNull()
  })

  it("não permite criar outro gestor pela API de equipe", () => {
    const parsed = parseInput(staffCreateSchema, { full_name: "Novo Gestor", access_role: "gestor" })
    expect(parsed.data).toBeNull()
  })

  it("valida prontuário e anamnese associados a paciente", () => {
    const patientId = "6cf937ae-ee8c-4856-bcf7-4f4d0ac58122"
    expect(medicalRecordInputSchema.safeParse({ patient_id: patientId, record_type: "Procedimento", title: "Evolução" }).success).toBe(true)
    expect(anamnesisInputSchema.safeParse({ patient_id: patientId, answers: [{ question: "Possui alergia?", answer: "nao" }] }).success).toBe(true)
  })

  it("rejeita dente inválido e condição desconhecida", () => {
    const patient_id = "6cf937ae-ee8c-4856-bcf7-4f4d0ac58122"
    expect(dentalChartInputSchema.safeParse({ patient_id, tooth_number: 99, condition: "healthy" }).success).toBe(false)
    expect(dentalChartInputSchema.safeParse({ patient_id, tooth_number: 11, condition: "desconhecida" }).success).toBe(false)
  })

  it("aceita condições independentes nas cinco faces do dente", () => {
    const patient_id = "6cf937ae-ee8c-4856-bcf7-4f4d0ac58122"
    const parsed = dentalChartInputSchema.safeParse({
      patient_id,
      tooth_number: 26,
      condition: null,
      surface_conditions: { mesial: "caries", occlusal: "filled" },
      notes: null,
    })
    expect(parsed.success).toBe(true)
    expect(dentalChartInputSchema.safeParse({ patient_id, tooth_number: 26, condition: null, surface_conditions: { raiz: "caries" } }).success).toBe(false)
  })

  it("preserva a assinatura enviada em um documento válido", () => {
    const parsed = documentInputSchema.safeParse({ title: "Termo", document_type: "consent", signed: true, signature_data: "data:image/png;base64,AAAA" })
    expect(parsed.success && parsed.data.signature_data).toContain("data:image/png")
  })
})
