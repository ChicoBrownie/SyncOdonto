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

  it("associa colunas de outro sistema e preserva perguntas próprias sem perder o nome", async () => {
    const sheets = await readSpreadsheet(
      new File(["codigo,nome,relato clinico,PET em casa\nP-1,Ana Exemplo,Tratamento anterior,Sim"], "pacientes.csv"),
      "patients",
      { patients: { "relato clinico": "clinical_notes" } },
    )
    const plan = buildImportPlan(sheets, "clinic-1", "Sistema Antigo")
    expect(plan.errors).toEqual([])
    expect(plan.records[0].data.content).toBe("Tratamento anterior")
    expect(plan.patients[0].data.notes).toContain("PET em casa: Sim")
    expect(sheets[0].unmapped).toEqual(["PET em casa"])
  })

  it("permite prévia e correção mesmo quando o nome do paciente tem outro cabeçalho", async () => {
    const file = new File(["codigo,identificacao da pessoa\nP-1,Ana Exemplo"], "pacientes.csv")
    const initial = await readSpreadsheet(file, "patients")
    expect(initial[0].unmapped).toContain("identificacao da pessoa")
    expect(buildImportPlan(initial, "clinic-1", "Origem").errors.length).toBeGreaterThan(0)
    const mapped = await readSpreadsheet(file, "patients", { patients: { "identificacao da pessoa": "full_name" } })
    expect(buildImportPlan(mapped, "clinic-1", "Origem").errors).toEqual([])
  })

  it("recusa quando duas colunas são associadas ao mesmo campo", async () => {
    await expect(readSpreadsheet(
      new File(["nome,outro nome\nAna,Outro"], "pacientes.csv"),
      "patients",
      { patients: { "outro nome": "full_name" } },
    )).rejects.toThrow("valores diferentes para o mesmo campo")
  })

  it("aceita ID e CPF como referências alternativas e colunas equivalentes de exame", async () => {
    const patients = await readSpreadsheet(new File(["id_paciente,nome,cpf,arquivo exame\nP-1,Ana Exemplo,12345678900,raio.pdf"], "pacientes.csv"), "patients")
    const records = await readSpreadsheet(new File(["id_prontuario,id_paciente,cpf,evolucao\nR-1,P-1,12345678900,Atendimento anterior"], "prontuarios.csv"), "records")
    const exams = await readSpreadsheet(new File(["id_exame,id_paciente,cpf,descricao,resultado,arquivo,arquivo exame\nE-1,P-1,12345678900,Radiografia,Sem alterações,raio.pdf,raio.pdf"], "exames.csv"), "exams")
    const plan = buildImportPlan([...patients, ...records, ...exams], "clinic-1", "Origem")
    expect(plan.errors).toEqual([])
    expect(plan.patients).toHaveLength(1)
    expect(plan.records).toHaveLength(1)
    expect(plan.exams).toHaveLength(1)
    expect(plan.records[0].patientId).toBe(plan.patients[0].id)
    expect(plan.exams[0].patientId).toBe(plan.patients[0].id)
    expect(plan.exams[0].data.description).toContain("resultado: Sem alterações")
  })

  it("recusa uma linha cujo ID e CPF apontam para pacientes diferentes", async () => {
    const patients = await readSpreadsheet(new File(["id_paciente,nome,cpf\nP-1,Ana Exemplo,12345678900\nP-2,Bia Exemplo,98765432100"], "pacientes.csv"), "patients")
    const records = await readSpreadsheet(new File(["id_paciente,cpf,evolucao\nP-1,98765432100,Atendimento"], "prontuarios.csv"), "records")
    expect(buildImportPlan([...patients, ...records], "clinic-1", "Origem").errors.join(" ")).toContain("pacientes diferentes")
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
