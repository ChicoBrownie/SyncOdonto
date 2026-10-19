import { describe, expect, it } from "vitest"
import { emptyPayload } from "./model"
import { proposalPrintHtml, recordPrintHtml, recordPrintSections } from "./print-html"
import { emailProposalUrl, whatsappProposalUrl } from "./sharing"

describe("arquivos e contatos do atendimento", () => {
  it("protege o HTML e inclui orçamento e dados clínicos no prontuário", () => {
    const payload = emptyPayload()
    payload.anamnesis.chief_complaint = "Dor no dente 11"
    payload.budget.items = [{ source_id: null, procedure: "Extração", region: "Dente 11", unitValue: 50, discount: 0 }]
    const patient = { full_name: "Pessoa <script>alert(1)</script>", email: "paciente@example.com" }
    const input = { patient, payload, anamneses: [], records: [], teeth: [{ tooth_number: 11, condition: "Cárie" }], exams: [], consents: [] }
    const proposal = proposalPrintHtml(patient.full_name, payload)
    const record = recordPrintHtml(input)
    expect(proposal).not.toContain("<script>")
    expect(record).toContain("Dor no dente 11")
    expect(record).toContain("Extração")
    expect(recordPrintSections(input).some(section => section.heading === "Orçamento")).toBe(true)
  })
  it("só prepara endereços de contato válidos", () => {
    expect(whatsappProposalUrl("(85) 99999-1234", "Proposta")).toContain("https://wa.me/5585999991234")
    expect(whatsappProposalUrl("123", "Proposta")).toBeNull()
    expect(emailProposalUrl("paciente@example.com", "Proposta")).toContain("mailto:")
    expect(emailProposalUrl("inválido", "Proposta")).toBeNull()
  })
})
