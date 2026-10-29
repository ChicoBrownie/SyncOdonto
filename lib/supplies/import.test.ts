import { describe, expect, it } from "vitest"
import ExcelJS from "exceljs"
import { parseSupplyMatrix, readSupplySpreadsheet } from "./import"

describe("importação de insumos", () => {
  it("aceita cabeçalhos comuns e quantidades decimais em CSV", async () => {
    const csv = "Material;Unidade;Quantidade utilizável;Mínimo;Essencial;Fornecedor principal;Prazo principal\nLuvas descartáveis;caixa;12,5;3;Sim;Fornecedor Teste;7\n"
    const file = new File([csv], "materiais.csv", { type: "text/csv" })
    const result = await readSupplySpreadsheet(file)
    expect(result.errors).toEqual([])
    expect(result.rows[0]).toMatchObject({ name: "Luvas descartáveis", unit: "caixa", usable_quantity: 12.5, minimum_quantity: 3, is_critical: true, primary_lead_days: 7 })
  })

  it("lê Excel e impede valores ou nomes repetidos inválidos antes da gravação", async () => {
    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet("Materiais")
    sheet.addRow(["Material", "Saldo", "Mínimo"])
    sheet.addRow(["Anestésico", 10, 2])
    sheet.addRow(["anestesico", 5, 1])
    sheet.addRow(["Máscara", -2, 1])
    const buffer = await workbook.xlsx.writeBuffer()
    const result = await readSupplySpreadsheet(new File([buffer as BlobPart], "materiais.xlsx"))
    expect(result.rows).toHaveLength(1)
    expect(result.errors).toHaveLength(2)
    expect(result.errors[0]).toContain("repetido")
    expect(result.errors[1]).toContain("Quantidade")
  })

  it("exige a coluna de material", () => {
    expect(() => parseSupplyMatrix([{ line: 1, cells: ["Unidade"] }, { line: 2, cells: ["caixa"] }])).toThrow("coluna Material")
  })

  it("aponta colunas não reconhecidas para revisão", () => {
    const result = parseSupplyMatrix([{ line: 1, cells: ["Material", "Quantidade utilizável conferida", "Código antigo"] }, { line: 2, cells: ["Luva", "20", "L-01"] }])
    expect(result.rows[0].usable_quantity).toBe(20)
    expect(result.rows[0].is_critical).toBe(false)
    expect(result.unmapped).toEqual(["Código antigo"])
  })

  it("não interpreta 1.000 como uma unidade durante a migração", () => {
    const result = parseSupplyMatrix([{ line: 1, cells: ["Material", "Saldo"] }, { line: 2, cells: ["Luvas", "1.000"] }])
    expect(result.rows).toEqual([])
    expect(result.errors[0]).toContain("ambígua")
  })
})
