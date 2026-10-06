import { describe, expect, it } from "vitest"
import { emptyPayload, encounterPayloadSchema, budgetTotal, budgetContent, mergeTreatments } from "./model"
import { documentHtml } from "./document-html"
describe("proposta e rascunho", () => {
  it("preserva cadastro incompleto e respostas pendentes sem aceitar campos de outra clínica", () => {
    const payload = emptyPayload()
    payload.registration.full_name = "Pessoa Fictícia"
    payload.anamnesis.answers = [{ question: "Exemplo?", answer: null, observation: "Confirmar depois" }]
    expect(encounterPayloadSchema.parse(payload)).toEqual(payload)
    expect(encounterPayloadSchema.safeParse({ ...payload, clinic_id: "outra" }).success).toBe(false)
  })
  it("importa dentes e regiões sem duplicar itens nem sobrescrever preço revisado", () => {
    const source = { id: "11111111-1111-4111-8111-111111111111", treatment_type: "Exemplo", tooth_number: 26, tooth_areas: ["mesial", "distal"], cost: 200, status: "planned" }
    const imported = mergeTreatments([], [source, { ...source, id: "cancelado", status: "cancelled" }])
    imported[0].unitValue = 180
    expect(mergeTreatments(imported, [source])).toEqual(imported)
    expect(imported[0].region).toContain("26"); expect(imported[0].region).toContain("mesial, distal")
  })
  it("calcula centavos e apresenta os valores da proposta completa", () => {
    const payload = emptyPayload()
    payload.budget.items = [{ source_id: null, procedure: "Fictício", region: "26", unitValue: 200.10, discount: 20.05 }]
    expect(budgetTotal(payload.budget.items)).toBe(180.05)
    expect(budgetContent("Pessoa Fictícia", payload)).toContain("180,05")
  })
  it("imprime texto completo e assinatura sem executar conteúdo clínico", () => {
    const html = documentHtml({ title: "<script>exemplo</script>", content: "<img>\n".repeat(100), signature_data: "javascript:exemplo", signed_at: "2026-10-05T12:00:00Z", encounter_revision: 4, snapshot_hash: "ficticio" })
    expect(html).not.toContain("<script>"); expect(html).not.toContain("javascript:")
    expect(html.match(/&lt;img&gt;/g)).toHaveLength(100)
    expect(html).toContain("Versão do orçamento: 4")
  })
})
