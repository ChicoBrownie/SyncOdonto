import ExcelJS from "exceljs"
import { cellText, checkXlsxArchive, normalizeHeader, parseCsv } from "@/lib/imports/spreadsheet"

export type SupplyImportRow = {
  line: number
  name: string
  unit: string
  usable_quantity: number
  minimum_quantity: number
  is_critical: boolean
  primary_supplier: string | null
  primary_lead_days: number | null
  backup_supplier: string | null
  backup_lead_days: number | null
}

const aliases: Record<Exclude<keyof SupplyImportRow, "line">, string[]> = {
  name: ["material", "nome", "insumo", "produto"],
  unit: ["unidade", "unidade de controle", "medida"],
  usable_quantity: ["quantidade", "quantidade utilizavel", "quantidade utilizavel conferida", "saldo", "saldo conferido", "estoque"],
  minimum_quantity: ["minimo", "minimo manual", "quantidade minima", "estoque minimo"],
  is_critical: ["essencial", "critico", "falta afeta atendimento", "falta pode afetar atendimento"],
  primary_supplier: ["fornecedor", "fornecedor principal"],
  primary_lead_days: ["prazo", "prazo principal", "prazo dias", "prazo em dias", "prazo informado em dias corridos"],
  backup_supplier: ["fornecedor alternativo", "fornecedor reserva"],
  backup_lead_days: ["prazo alternativo", "prazo alternativo dias", "prazo alternativo em dias"],
}

function quantity(value: string, label: string, line: number) {
  const input = value.trim()
  if (!input) return 0
  if (!/^\d+(?:[.,]\d{1,3})?$/.test(input)) throw new Error(`Linha ${line}: ${label} deve ser um número sem separador de milhar, com até 3 casas decimais.`)
  if (/^[1-9]\d*\.\d{3}$/.test(input)) throw new Error(`Linha ${line}: ${label} é ambígua. Use 1000 para mil ou vírgula para decimais.`)
  const parsed = Number(input.replace(",", "."))
  if (parsed > 1_000_000) throw new Error(`Linha ${line}: ${label} excede o limite de 1.000.000.`)
  return parsed
}

function days(value: string, label: string, line: number) {
  if (!value.trim()) return null
  if (!/^\d{1,3}$/.test(value.trim()) || Number(value) > 365) throw new Error(`Linha ${line}: ${label} deve estar entre 0 e 365 dias.`)
  return Number(value)
}

export function parseSupplyMatrix(matrix: { line: number; cells: string[] }[]) {
  if (matrix.length < 2) throw new Error("A planilha precisa de cabeçalho e ao menos um material.")
  const lookup = new Map(Object.entries(aliases).flatMap(([field, names]) => names.map(name => [normalizeHeader(name), field] as const)))
  const fields = matrix[0].cells.map(header => lookup.get(normalizeHeader(header)))
  const unmapped = matrix[0].cells.filter((header, index) => header.trim() && !fields[index])
  if (!fields.includes("name")) throw new Error("Inclua uma coluna Material.")
  const mapped = fields.filter(Boolean)
  if (new Set(mapped).size !== mapped.length) throw new Error("Há colunas equivalentes duplicadas na planilha.")
  const errors: string[] = []
  const seen = new Set<string>()
  const rows: SupplyImportRow[] = []
  for (const source of matrix.slice(1)) {
    if (!source.cells.some(value => value.trim())) continue
    const values = Object.fromEntries(fields.map((field, index) => [field, source.cells[index]?.trim() || ""]).filter(([field]) => field)) as Record<string, string>
    try {
      const name = (values.name || "").trim()
      const unit = (values.unit || "unidade").trim()
      if (name.length < 2 || name.length > 160) throw new Error("informe um nome de material entre 2 e 160 caracteres.")
      if (unit.length > 40) throw new Error("a unidade deve ter até 40 caracteres.")
      const key = normalizeHeader(name)
      if (seen.has(key)) throw new Error("material repetido na planilha.")
      const critical = normalizeHeader(values.is_critical || "nao")
      if (!["sim", "nao", "1", "0", "true", "false", "yes", "no"].includes(critical)) throw new Error("Essencial deve ser Sim ou Não.")
      const primarySupplier = values.primary_supplier || null
      const backupSupplier = values.backup_supplier || null
      if (primarySupplier && (primarySupplier.length < 2 || primarySupplier.length > 160)) throw new Error("fornecedor principal deve ter entre 2 e 160 caracteres.")
      if (backupSupplier && (backupSupplier.length < 2 || backupSupplier.length > 160)) throw new Error("fornecedor alternativo deve ter entre 2 e 160 caracteres.")
      const row = {
        line: source.line, name, unit,
        usable_quantity: quantity(values.usable_quantity || "", "Quantidade", source.line),
        minimum_quantity: quantity(values.minimum_quantity || "", "Mínimo", source.line),
        is_critical: ["sim", "1", "true", "yes"].includes(critical),
        primary_supplier: primarySupplier,
        primary_lead_days: days(values.primary_lead_days || "", "Prazo principal", source.line),
        backup_supplier: backupSupplier,
        backup_lead_days: days(values.backup_lead_days || "", "Prazo alternativo", source.line),
      }
      seen.add(key)
      rows.push(row)
    } catch (error) { errors.push(`Linha ${source.line}: ${error instanceof Error ? error.message.replace(/^Linha \d+: /, "") : "dados inválidos."}`) }
  }
  if (!rows.length && !errors.length) throw new Error("Nenhum material encontrado na planilha.")
  return { rows, errors, unmapped }
}

export async function readSupplySpreadsheet(file: File) {
  if (file.size > 2 * 1024 * 1024) throw new Error("O arquivo deve ter no máximo 2 MB.")
  const name = file.name.toLowerCase()
  let matrix: { line: number; cells: string[] }[]
  if (name.endsWith(".csv")) matrix = parseCsv(await file.text()).map((cells, index) => ({ line: index + 1, cells }))
  else if (name.endsWith(".xlsx")) {
    const bytes = new Uint8Array(await file.arrayBuffer())
    checkXlsxArchive(bytes)
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(Buffer.from(bytes) as unknown as Parameters<typeof workbook.xlsx.load>[0])
    const sheet = workbook.worksheets[0]
    if (!sheet) throw new Error("A planilha não contém abas.")
    matrix = []
    sheet.eachRow({ includeEmpty: false }, row => {
      if (row.cellCount > 20) throw new Error("A planilha deve ter no máximo 20 colunas.")
      matrix.push({ line: row.number, cells: Array.from({ length: row.cellCount }, (_, index) => cellText(row.getCell(index + 1).value)) })
      if (matrix.length > 501) throw new Error("Importe até 500 materiais por vez.")
    })
  } else throw new Error("Use um arquivo CSV UTF-8 ou Excel .xlsx.")
  if (matrix.length > 501) throw new Error("Importe até 500 materiais por vez.")
  return parseSupplyMatrix(matrix)
}
