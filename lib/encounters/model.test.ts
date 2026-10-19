import { describe, expect, it } from "vitest"
import { applyBudgetGroupDiscount, emptyPayload, encounterPayloadSchema, budgetTotal, budgetContent, formatBudgetRegion, mergeTreatments } from "./model"
import { documentHtml } from "./document-html"
describe("proposta e rascunho", () => {
  it("preserva cadastro incompleto e respostas pendentes sem aceitar campos de outra clínica", () => {
    const payload = emptyPayload()
    payload.registration.full_name = "Pessoa Fictícia"
    payload.anamnesis.answers = [{ question: "Exemplo?", answer: null, observation: "Confirmar depois" }]
    expect(encounterPayloadSchema.parse(payload)).toEqual(payload)
    expect(encounterPayloadSchema.safeParse({ ...payload, clinic_id: "outra" }).success).toBe(false)
  })
  it("aceita rascunhos antigos sem e-mail e mantém o contato opcional", () => {
    const payload = emptyPayload()
    const registration = { full_name: "Pessoa Fictícia", date_of_birth: "1990-01-01", cpf: "123.456.789-01", phone: "" }
    expect(encounterPayloadSchema.parse({ ...payload, registration }).registration.email).toBe("")
    expect(encounterPayloadSchema.safeParse({ ...payload, registration: { ...registration, email: "inválido" } }).success).toBe(false)
  })
  it("importa dentes e regiões sem duplicar itens nem sobrescrever preço revisado", () => {
    const source = { id: "11111111-1111-4111-8111-111111111111", treatment_type: "Exemplo", tooth_number: 26, tooth_areas: ["mesial", "distal"], cost: 200, status: "planned" }
    const imported = mergeTreatments([], [source, { ...source, id: "cancelado", status: "cancelled" }])
    imported[0].unitValue = 180
    expect(mergeTreatments(imported, [source])).toEqual(imported)
    expect(imported[0].region).toBe("Dente 26 · Mesial, Distal")
  })
  it("resume o dente inteiro e mantém as faces quando falta alguma região", () => {
    const complete = "Dente 11 · mesial, vestibular, occlusal, distal, lingual, root"
    const partial = "Dente 11 · mesial, vestibular, occlusal, distal, lingual"
    expect(formatBudgetRegion(complete)).toBe("Dente 11")
    expect(formatBudgetRegion("Dente 31 · whole")).toBe("Dente 31")
    expect(formatBudgetRegion(partial)).toBe("Dente 11 · Mesial, Vestibular, Oclusal / incisal, Distal, Lingual / palatina")
    const imported = mergeTreatments([], [{ id: "33333333-3333-4333-8333-333333333333", treatment_type: "Extração", tooth_number: 11, tooth_areas: ["mesial", "vestibular", "occlusal", "distal", "lingual", "root"], cost: 50, status: "planned" }])
    expect(imported[0].region).toBe("Dente 11")
    const payload = emptyPayload()
    payload.budget.items = [{ source_id: null, procedure: "Extração", region: complete, unitValue: 50, discount: 0 }]
    expect(budgetContent("Pessoa Fictícia", payload)).toContain("Extração | Dente 11 |")
    expect(budgetContent("Pessoa Fictícia", payload)).not.toContain("occlusal")
  })
  it("calcula centavos e apresenta os valores da proposta completa", () => {
    const payload = emptyPayload()
    payload.budget.items = [{ source_id: null, procedure: "Fictício", region: "26", unitValue: 200.10, discount: 20.05 }]
    expect(budgetTotal(payload.budget.items)).toBe(180.05)
    expect(budgetContent("Pessoa Fictícia", payload)).toContain("180,05")
  })
  it("distribui o desconto do grupo sem alterar outros procedimentos nem ultrapassar seus valores", () => {
    const items = [
      { source_id: null, procedure: "Extração", region: "Dente 11", unitValue: 50, discount: 0 },
      { source_id: null, procedure: "Restauração", region: "Dente 21", unitValue: 80, discount: 0 },
      { source_id: null, procedure: "Extração", region: "Dente 31", unitValue: 50, discount: 0 },
    ]
    const discounted = applyBudgetGroupDiscount(items, [0, 2], 25.01)
    expect(discounted[0].discount + discounted[2].discount).toBeCloseTo(25.01)
    expect(discounted[1]).toBe(items[1])
    expect(budgetTotal(discounted)).toBe(154.99)
    expect(applyBudgetGroupDiscount(discounted, [0, 2], 500).filter(item => item.procedure === "Extração").every(item => item.discount === item.unitValue)).toBe(true)
  })
  it("imprime texto completo e assinatura sem executar conteúdo clínico", () => {
    const html = documentHtml({ title: "<script>exemplo</script>", content: "<img>\n".repeat(100), signature_data: "javascript:exemplo", signed_at: "2026-10-05T12:00:00Z", encounter_revision: 4, snapshot_hash: "ficticio" })
    expect(html).not.toContain("<script>"); expect(html).not.toContain("javascript:")
    expect(html.match(/&lt;img&gt;/g)).toHaveLength(100)
    expect(html).toContain("Versão do orçamento: 4")
  })
})
