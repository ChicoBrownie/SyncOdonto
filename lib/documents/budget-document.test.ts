import { describe, expect, it } from "vitest"
import { budgetItems, budgetPlainText, budgetPrintHtml, budgetTotal } from "./budget-document"

const document = {
  created_at: "2026-10-29T12:00:00Z",
  patient: { full_name: "Paciente Teste", email: "paciente@example.com" },
  payment_method: "Entrada R$ 800,00 + 3x de R$ 415,33 (última R$ 415,34)",
  description: "Validade de 30 dias",
  items: [
    { procedure: "Exodontia", region: "Dentes 38, 48", unitValue: 1000, discount: 100 },
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
})
