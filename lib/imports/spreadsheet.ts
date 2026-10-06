import ExcelJS from "exceljs"

export type ImportKind = "patients" | "records" | "exams"
export type ImportRow = { line: number; values: Record<string, string>; extras: Record<string, string> }
export type ImportSheet = { kind: ImportKind; rows: ImportRow[]; unmapped: string[] }

const aliases: Record<ImportKind, Record<string, string[]>> = {
  patients: {
    source_id: ["id", "id paciente", "id_paciente", "codigo", "codigo paciente", "patient id", "external id"],
    full_name: ["nome", "nome completo", "nome paciente", "paciente", "full name", "name"],
    email: ["e-mail", "email", "correio eletronico"],
    phone: ["telefone", "celular", "whatsapp", "fone", "phone"],
    date_of_birth: ["data nascimento", "data de nascimento", "nascimento", "birth date", "date of birth"],
    gender: ["sexo", "genero", "gender"],
    cpf: ["cpf", "documento", "cpf paciente"],
    address: ["endereco", "endereco completo", "logradouro", "address"],
    allergies: ["alergias", "alergia", "allergies"],
    pre_existing_conditions: ["doencas", "condicoes preexistentes", "condicoes medicas", "pre existing conditions"],
    medications: ["medicamentos", "medicacoes", "medications"],
    notes: ["observacoes", "observacao", "notas", "notes"],
    clinical_notes: ["prontuario", "historico clinico", "anamnese", "clinical notes", "medical history"],
    exam_title: ["exame", "titulo exame", "exam title"],
    exam_file: ["arquivo exame", "arquivo do exame", "exam file"],
  },
  records: {
    source_id: ["id", "id prontuario", "codigo", "record id"],
    patient_ref: ["id paciente", "id_paciente", "codigo paciente", "paciente id", "patient id", "cpf paciente", "cpf", "patient ref"],
    title: ["titulo", "titulo prontuario", "title"],
    content: ["conteudo", "descricao", "detalhes clinicos", "evolucao", "prontuario", "anamnese", "content"],
    record_type: ["tipo", "tipo registro", "record type"],
    record_date: ["data", "data registro", "record date"],
    doctor_name: ["profissional", "dentista", "doctor", "doctor name"],
  },
  exams: {
    source_id: ["id", "id exame", "codigo", "exam id"],
    patient_ref: ["id paciente", "id_paciente", "codigo paciente", "paciente id", "patient id", "cpf paciente", "cpf", "patient ref"],
    title: ["titulo", "nome exame", "exame", "title"],
    exam_type: ["tipo", "tipo exame", "exam type"],
    description: ["descricao", "observacoes", "laudo", "resultado", "description"],
    file_name: ["arquivo", "nome arquivo", "arquivo exame", "file", "file name"],
  },
}

export function normalizeHeader(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[_\-.]+/g, " ").replace(/\s+/g, " ").trim()
}

function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return ""
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  if (typeof value === "object") {
    if ("formula" in value || "sharedFormula" in value) throw new Error("Fórmulas não são aceitas. Exporte os valores calculados.")
    if ("text" in value) return String(value.text).trim()
    if ("richText" in value) return value.richText.map(part => part.text).join("").trim()
    if ("error" in value) throw new Error("A planilha contém uma célula com erro.")
  }
  return String(value).trim()
}

export function parseCsv(text: string): string[][] {
  const source = text.replace(/^\uFEFF/, "")
  if (source.includes("\uFFFD")) throw new Error("O CSV não está em UTF-8. Salve-o novamente como CSV UTF-8.")
  const first = source.split(/\r?\n/, 1)[0] || ""
  const delimiter = (first.match(/;/g) || []).length > (first.match(/,/g) || []).length ? ";" : ","
  const rows: string[][] = []
  let row: string[] = [], cell = "", quoted = false
  for (let i = 0; i < source.length; i++) {
    const char = source[i]
    if (char === '"') {
      if (quoted && source[i + 1] === '"') { cell += '"'; i++ }
      else if (!quoted && cell === "" || quoted) quoted = !quoted
      else cell += char
    } else if (char === delimiter && !quoted) { row.push(cell.trim()); cell = "" }
    else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && source[i + 1] === "\n") i++
      row.push(cell.trim()); if (row.some(Boolean)) rows.push(row)
      if (rows.length > 1001) throw new Error("Máximo de 1.000 linhas por aba.")
      row = []; cell = ""
    } else cell += char
  }
  if (quoted) throw new Error("CSV com aspas não fechadas.")
  row.push(cell.trim()); if (row.some(Boolean)) rows.push(row)
  if (rows.length > 1001) throw new Error("Máximo de 1.000 linhas por aba.")
  return rows
}

function checkXlsxArchive(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  if (bytes.length < 22 || view.getUint32(0, true) !== 0x04034b50) throw new Error("Arquivo Excel inválido.")
  let end = -1
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (view.getUint32(i, true) === 0x06054b50) { end = i; break }
  }
  if (end < 0) throw new Error("Arquivo Excel incompleto.")
  const count = view.getUint16(end + 10, true)
  const size = view.getUint32(end + 12, true)
  let offset = view.getUint32(end + 16, true)
  if (count > 200 || offset + size > end) throw new Error("Arquivo Excel excede os limites de segurança.")
  let total = 0
  for (let i = 0; i < count; i++) {
    if (offset + 46 > bytes.length || view.getUint32(offset, true) !== 0x02014b50) throw new Error("Arquivo Excel inválido.")
    const flags = view.getUint16(offset + 8, true)
    const compressed = view.getUint32(offset + 20, true)
    const uncompressed = view.getUint32(offset + 24, true)
    if (flags & 1 || compressed === 0xffffffff || uncompressed === 0xffffffff || uncompressed > 10 * 1024 * 1024) throw new Error("Arquivo Excel excede os limites de segurança.")
    total += uncompressed
    if (total > 30 * 1024 * 1024) throw new Error("Arquivo Excel excede os limites de segurança.")
    offset += 46 + view.getUint16(offset + 28, true) + view.getUint16(offset + 30, true) + view.getUint16(offset + 32, true)
  }
  if (offset !== view.getUint32(end + 16, true) + size) throw new Error("Arquivo Excel inválido.")
}

function mapRows(kind: ImportKind, matrix: string[][]): ImportSheet {
  if (matrix.length < 2) throw new Error(`A aba de ${kind} precisa de cabeçalho e pelo menos uma linha.`)
  const headers = matrix[0].map(header => header.trim())
  const nonEmptyHeaders = headers.map(normalizeHeader).filter(Boolean)
  if (new Set(nonEmptyHeaders).size !== nonEmptyHeaders.length) throw new Error(`A aba de ${kind} tem cabeçalhos duplicados.`)
  const lookup = new Map(Object.entries(aliases[kind]).flatMap(([field, names]) => names.map(name => [normalizeHeader(name), field] as const)))
  const fields = headers.map(header => lookup.get(normalizeHeader(header)))
  const mapped = fields.filter(Boolean)
  if (new Set(mapped).size !== mapped.length) throw new Error(`A aba de ${kind} tem colunas equivalentes duplicadas.`)
  if (kind === "patients" && !mapped.includes("full_name")) throw new Error("A planilha de pacientes precisa de uma coluna Nome.")
  if (kind !== "patients" && !mapped.includes("patient_ref")) throw new Error(`A aba de ${kind} precisa de uma coluna ID paciente ou CPF paciente.`)
  const rows = matrix.slice(1).filter(row => row.some(Boolean)).map((row, index) => {
    const values: Record<string, string> = {}, extras: Record<string, string> = {}
    headers.forEach((header, column) => {
      const value = (row[column] || "").trim()
      if (!value) return
      if (fields[column]) values[fields[column]!] = value
      else if (header) extras[header] = value
    })
    return { line: index + 2, values, extras }
  })
  return { kind, rows, unmapped: headers.filter((header, index) => header && !fields[index]) }
}

function inferKind(name: string): ImportKind | null {
  const normal = normalizeHeader(name)
  if (/pacient|patient/.test(normal)) return "patients"
  if (/prontu|registro|record|evoluc/.test(normal)) return "records"
  if (/exame|exam/.test(normal)) return "exams"
  return null
}

export async function readSpreadsheet(file: File, fallback: ImportKind): Promise<ImportSheet[]> {
  if (file.size > 10 * 1024 * 1024) throw new Error(`${file.name}: máximo de 10 MB por planilha.`)
  const name = file.name.toLowerCase()
  if (name.endsWith(".csv")) return [mapRows(fallback, parseCsv(await file.text()))]
  if (!name.endsWith(".xlsx")) throw new Error(`${file.name}: use CSV ou Excel .xlsx.`)
  const bytes = new Uint8Array(await file.arrayBuffer())
  checkXlsxArchive(bytes)
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(Buffer.from(bytes) as unknown as Parameters<typeof workbook.xlsx.load>[0])
  const sheets: ImportSheet[] = []
  workbook.eachSheet((sheet, index) => {
    const kind = inferKind(sheet.name) || (index === 1 ? fallback : null)
    if (!kind) {
      if (sheet.actualRowCount > 0) throw new Error(`A aba "${sheet.name}" não foi reconhecida. Renomeie para Pacientes, Prontuários ou Exames.`)
      return
    }
    const matrix: string[][] = []
    sheet.eachRow({ includeEmpty: false }, row => {
      const cells: string[] = []
      for (let column = 1; column <= row.cellCount; column++) cells.push(cellText(row.getCell(column).value))
      matrix.push(cells)
      if (matrix.length > 1001) throw new Error("Máximo de 1.000 linhas por aba.")
    })
    if (matrix.length) sheets.push(mapRows(kind, matrix))
  })
  if (!sheets.length) throw new Error(`${file.name}: nenhuma aba com dados reconhecida.`)
  return sheets
}
