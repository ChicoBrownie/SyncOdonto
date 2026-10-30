import { describe, expect, it } from "vitest"
import { budgetItems, budgetPlainText, budgetPrintHtml, budgetTotal } from "./budget-document"
import { createBudgetPdf } from "./budget-pdf"
import sharp from "sharp"
import { writeFileSync } from "node:fs"

const document = {
  created_at: "2026-10-29T12:00:00Z",
  patient: { full_name: "Paciente Teste", email: "paciente@example.com" },
  payment_method: "Entrada R$ 800,00 + 3x de R$ 415,33 (última R$ 415,34)",
  description: "Validade de 30 dias",
  items: [
    { procedure: "Exodontia", region: "Dentes 38, 48", dentist: "Dra. Karine", unitValue: 1000, discount: 100 },
    { procedure: "Restauração", region: "Dente 16", unitValue: 200, discount: 0 },
  ],
}

describe("orçamento para impressão e e-mail", () => {
  it("calcula os itens validados em centavos", () => {
    const items = budgetItems(document.items)
    expect(budgetTotal(items)).toBe(1100)
    expect(budgetItems([{ procedure: "Inválido", unitValue: 10, discount: 20 }])).toEqual([])
  })

  it("inclui dados da clínica, pagamento e assinatura no PDF enviado", () => {
    const text = budgetPlainText(document, { clinic_name: "Clínica Teste", phone: "(89) 99999-9999" })
    expect(text).toContain("Clínica Teste")
    expect(text).toContain("Dentes 38, 48")
    expect(text).toContain("Total: R$ 1.100,00")
    expect(text).toContain("Entrada R$ 800,00")
    expect(text).toContain("Assinatura do paciente")
  })

  it("escapa dados fornecidos pelo usuário na versão de impressão", () => {
    const html = budgetPrintHtml({ ...document, description: "<script>alert(1)</script>" }, { clinic_name: "Clínica <Teste>" })
    expect(html).toContain("Clínica &lt;Teste&gt;")
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;")
    expect(html).not.toContain("<script>alert(1)</script>")
  })

  it("inclui logo e seções do modelo no PDF e na impressão", async () => {
    const logo = await sharp({ create: { width: 120, height: 40, channels: 4, background: "#008a8a" } }).png().toBuffer()
    const pdf = await createBudgetPdf(document, { clinic_name: "Clínica Teste", logo_url: "logo.png" }, logo)
    const source = pdf.toString("latin1")
    expect(source.startsWith("%PDF-1.4")).toBe(true)
    expect(source).toContain("/Subtype /Image")
    expect(source).toContain("Forma de Pagamento")
    expect(source).toContain("Assinatura do paciente")
    const html = budgetPrintHtml(document, { clinic_name: "Clínica Teste" }, `data:image/png;base64,${logo.toString("base64")}`)
    expect(html).toContain('alt="Logo da clínica"')
    expect(html).toContain("Dentista")
    if (process.env.BUDGET_PDF_PREVIEW) writeFileSync(process.env.BUDGET_PDF_PREVIEW, pdf)
  })

  it("continua orçamentos extensos em novas páginas", async () => {
    const pdf = await createBudgetPdf({ ...document, items: Array.from({ length: 35 }, (_, index) => ({ procedure: `Procedimento ${index + 1}`, region: "Dentes 16 e 17", dentist: "Dra. Karine", unitValue: 100, discount: 0 })) }, {})
    expect((pdf.toString("latin1").match(/\/Type \/Page \/Parent/g) || []).length).toBeGreaterThan(1)
  })
})
