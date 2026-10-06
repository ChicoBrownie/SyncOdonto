import { describe, expect, it } from "vitest"
import ExcelJS from "exceljs"
import { parseCsv, readSpreadsheet } from "./spreadsheet"
import { buildImportPlan } from "./plan"

describe("importação de clínicas", () => {
  it("lê CSV com BOM, ponto e vírgula e texto entre aspas", () => {
    expect(parseCsv('\uFEFFid;nome;observacoes\nP-1;Ana Exemplo;"Dente 11; revisão"\n')).toEqual([
      ["id", "nome", "observacoes"], ["P-1", "Ana Exemplo", "Dente 11; revisão"],
    ])
  })

  it("conecta pacientes, prontuários e exames em abas Excel e preserva colunas adicionais", async () => {
    const workbook = new ExcelJS.Workbook()
    workbook.addWorksheet("Pacientes").addRows([["ID", "Nome", "CPF", "Convênio"], ["P-1", "Ana Exemplo", "12345678900", "Outro plano"]])
    workbook.addWorksheet("Prontuários").addRows([["ID", "ID paciente", "Conteúdo"], ["R-1", "P-1", "Tratamento anterior"]])
    workbook.addWorksheet("Exames").addRows([["ID", "ID paciente", "Exame", "Arquivo"], ["E-1", "P-1", "Radiografia", "raio-x.pdf"]])
    const bytes = await workbook.xlsx.writeBuffer()
    const file = new File([bytes as BlobPart], "exportacao.xlsx")
    const sheets = await readSpreadsheet(file, "patients")
    const first = buildImportPlan(sheets, "clinic-1", "Sistema Antigo")
    const retry = buildImportPlan(sheets, "clinic-1", "Sistema Antigo")
    expect(first.errors).toEqual([])
    expect(first.patients).toHaveLength(1)
    expect(first.records).toHaveLength(1)
    expect(first.exams).toHaveLength(1)
    expect(first.records[0].patientId).toBe(first.patients[0].id)
    expect(first.exams[0].fileName).toBe("raio-x.pdf")
    expect(first.patients[0].data.notes).toContain("Convênio: Outro plano")
    expect(retry.patients[0].id).toBe(first.patients[0].id)
    expect(retry.records[0].id).toBe(first.records[0].id)
  })

  it("recusa prontuário sem paciente correspondente", async () => {
    const patients = await readSpreadsheet(new File(["id,nome\nP-1,Ana Exemplo"], "pacientes.csv"), "patients")
    const records = await readSpreadsheet(new File(["id,id paciente,conteudo\nR-1,P-2,Outro paciente"], "prontuarios.csv"), "records")
    const plan = buildImportPlan([...patients, ...records], "clinic-1", "Origem")
    expect(plan.errors.join(" ")).toContain("não encontrado")
    expect(plan.records).toHaveLength(0)
  })

  it("recusa CPF repetido mesmo com IDs de origem distintos", async () => {
    const sheets = await readSpreadsheet(new File(["id,nome,cpf\nP-1,Ana Exemplo,12345678900\nP-2,Ana Exemplo,12345678900"], "pacientes.csv"), "patients")
    const plan = buildImportPlan(sheets, "clinic-1", "Origem")
    expect(plan.errors.join(" ")).toContain("CPF repetido")
  })

  it("não ignora abas com dados desconhecidos", async () => {
    const workbook = new ExcelJS.Workbook()
    workbook.addWorksheet("Pacientes").addRows([["nome"], ["Ana Exemplo"]])
    workbook.addWorksheet("Dados adicionais").addRows([["informação"], ["valor"]])
    const bytes = await workbook.xlsx.writeBuffer()
    await expect(readSpreadsheet(new File([bytes as BlobPart], "dados.xlsx"), "patients")).rejects.toThrow("não foi reconhecida")
  })
})
