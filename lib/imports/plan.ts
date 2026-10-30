import { createHash } from "node:crypto"
import { documentInputSchema, medicalRecordInputSchema, patientInputSchema } from "@/lib/validation/api-schemas"
import type { ImportSheet } from "./spreadsheet"

export type PlannedPatient = { id: string; key: string; sourceId: string | null; data: Record<string, unknown>; line: number }
export type PlannedRecord = { id: string; patientId: string; data: Record<string, unknown>; line: number }
export type PlannedExam = { id: string; patientId: string; fileName: string | null; data: Record<string, unknown>; line: number }
export type ImportPlan = { patients: PlannedPatient[]; records: PlannedRecord[]; exams: PlannedExam[]; unmapped: Record<string, string[]>; errors: string[] }

export function stableId(...parts: string[]): string {
  const hex = createHash("sha256").update(JSON.stringify(parts)).digest("hex")
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`
}

const digits = (value: string) => value.replace(/\D/g, "")
const normalized = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/\s+/g, " ")

function date(value: string): string | null {
  if (!value) return null
  const candidate = /^(\d{2})\/(\d{2})\/(\d{4})$/.test(value) ? value.replace(/^(\d{2})\/(\d{2})\/(\d{4})$/, "$3-$2-$1") : value
  if (!/^\d{4}-\d{2}-\d{2}$/.test(candidate) || new Date(`${candidate}T12:00:00Z`).toISOString().slice(0, 10) !== candidate) throw new Error(`Data inválida: ${value}`)
  return candidate
}

function extrasText(extras: Record<string, string>) {
  return Object.entries(extras).map(([key, value]) => `${key}: ${value}`).join("\n")
}

function validated<T>(schema: { safeParse: (value: unknown) => { success: boolean; data?: T; error?: { issues: { path: (string | number)[]; message: string }[] } } }, value: unknown): T {
  const result = schema.safeParse(value)
  if (!result.success) throw new Error(result.error?.issues.map(issue => `${issue.path.join(".")}: ${issue.message}`).join("; ") || "Dados inválidos")
  return result.data as T
}

export function buildImportPlan(sheets: ImportSheet[], clinicId: string, sourceName: string): ImportPlan {
  const plan: ImportPlan = { patients: [], records: [], exams: [], unmapped: {}, errors: [] }
  const refs = new Map<string, string>()
  const patientNames = new Map<string, string | null>()
  const seen = new Set<string>()
  const seenCpf = new Set<string>()
  const source = normalized(sourceName)
  const hasRecordSheet = sheets.some(sheet => sheet.kind === "records")
  const hasExamSheet = sheets.some(sheet => sheet.kind === "exams")
  for (const sheet of sheets) plan.unmapped[sheet.kind] = sheet.unmapped

  for (const sheet of sheets.filter(sheet => sheet.kind === "patients")) {
    for (const row of sheet.rows) {
      try {
        const v = row.values
        const cpf = digits(v.cpf || "")
        const key = v.source_id ? `id:${v.source_id}` : cpf ? `cpf:${cpf}` : v.email ? `email:${normalized(v.email)}:${normalized(v.full_name || "")}` : `person:${normalized(v.full_name || "")}:${v.date_of_birth || ""}:${digits(v.phone || "")}`
        if (seen.has(key)) throw new Error("Paciente repetido na planilha")
        if (cpf && seenCpf.has(cpf)) throw new Error("CPF repetido na planilha")
        seen.add(key)
        if (cpf) seenCpf.add(cpf)
        const id = stableId(clinicId, source, "patient", key)
        const extra = extrasText(row.extras)
        const embeddedRecord = [
          v.inline_record_id && `ID do prontuário na origem: ${v.inline_record_id}`,
          v.inline_record_date && `Data do atendimento: ${date(v.inline_record_date)}`,
          v.inline_record_doctor && `Profissional: ${v.inline_record_doctor}`,
          v.inline_record_procedure && `Procedimento: ${v.inline_record_procedure}`,
          v.clinical_notes,
        ].filter(Boolean).join("\n")
        const embeddedExam = [
          v.inline_exam_id && `ID do exame na origem: ${v.inline_exam_id}`,
          v.inline_exam_date && `Data do exame: ${date(v.inline_exam_date)}`,
          v.inline_exam_type && `Tipo: ${v.inline_exam_type}`,
          v.inline_exam_description,
          v.inline_exam_result && `Resultado: ${v.inline_exam_result}`,
        ].filter(Boolean).join("\n")
        const notes = [
          v.insurance && `Convênio: ${v.insurance}`,
          v.notes,
          v.source_id && `ID no sistema de origem: ${v.source_id}`,
          hasRecordSheet && embeddedRecord && `Atendimento na origem:\n${embeddedRecord}`,
          hasExamSheet && embeddedExam && `Exame na origem:\n${embeddedExam}`,
          extra && `Dados adicionais da origem:\n${extra}`,
        ].filter(Boolean).join("\n\n") || null
        const data = validated(patientInputSchema, {
          full_name: v.full_name,
          email: v.email || null,
          phone: v.phone || null,
          date_of_birth: date(v.date_of_birth || ""),
          gender: v.gender || null,
          cpf: v.cpf || null,
          address: v.address || null,
          allergies: v.allergies || null,
          pre_existing_conditions: v.pre_existing_conditions || null,
          medications: v.medications || null,
          notes,
        }) as Record<string, unknown>
        plan.patients.push({ id, key, sourceId: v.source_id || null, data, line: row.line })
        if (v.source_id) refs.set(v.source_id, id)
        if (cpf) refs.set(cpf, id)
        const nameKey = normalized(v.full_name || "")
        if (nameKey) patientNames.set(nameKey, patientNames.has(nameKey) ? null : id)
        if (embeddedRecord && !hasRecordSheet) {
          const title = v.inline_record_procedure || "Histórico clínico importado"
          const recordData = validated(medicalRecordInputSchema, { patient_id: id, record_type: "other", title, content: embeddedRecord }) as Record<string, unknown>
          plan.records.push({ id: stableId(clinicId, source, "inline-record", key, embeddedRecord), patientId: id, data: recordData, line: row.line })
        }
        if ((embeddedExam || v.exam_title || v.exam_file) && !hasExamSheet) {
          const title = v.exam_title || v.inline_exam_type || v.exam_file || "Exame importado"
          const examContent = [embeddedExam, v.exam_file && `Arquivo na origem: ${v.exam_file}`].filter(Boolean).join("\n\n")
          const examData = validated(documentInputSchema, { patient_id: id, title, document_type: "exam", description: examContent || "Exame importado", status: "archived" }) as Record<string, unknown>
          plan.exams.push({ id: stableId(clinicId, source, "inline-exam", key, title, examContent), patientId: id, data: examData, fileName: v.exam_file || null, line: row.line })
        }
      } catch (error) { plan.errors.push(`Pacientes, linha ${row.line}: ${error instanceof Error ? error.message : "dados inválidos"}`) }
    }
  }

  for (const sheet of sheets.filter(sheet => sheet.kind !== "patients")) {
    for (const row of sheet.rows) {
      try {
        const v = row.values
        const matches = new Set((row.references?.length ? row.references : [v.patient_ref]).filter(Boolean).map(ref => refs.get(ref) || refs.get(digits(ref)) || patientNames.get(normalized(ref))).filter((id): id is string => Boolean(id)))
        if (matches.size > 1) throw new Error("ID e CPF indicam pacientes diferentes na planilha")
        const patientId = matches.values().next().value
        if (!patientId) throw new Error("ID, CPF ou nome do paciente não encontrado de forma única na planilha de pacientes")
        const extra = extrasText(row.extras)
        if (sheet.kind === "records") {
          const content = [v.source_id && `ID no sistema de origem: ${v.source_id}`, v.record_type && `Tipo na origem: ${v.record_type}`, v.record_date && `Data na origem: ${date(v.record_date)}`, v.doctor_name && `Profissional na origem: ${v.doctor_name}`, v.content, extra && `Dados adicionais da origem:\n${extra}`].filter(Boolean).join("\n\n")
          if (!content) throw new Error("Prontuário sem conteúdo")
          const knownTypes = new Set(["anamnesis", "clinical_exam", "treatment", "prescription", "certificate", "referral", "evolution", "other"])
          const recordType = knownTypes.has(v.record_type) ? v.record_type : "other"
          const data = validated(medicalRecordInputSchema, { patient_id: patientId, record_type: recordType, title: v.title || "Prontuário importado", content }) as Record<string, unknown>
          plan.records.push({ id: stableId(clinicId, source, "record", patientId, v.source_id || JSON.stringify(data)), patientId, data, line: row.line })
        } else {
          const title = v.title || v.exam_type || v.file_name
          const description = [v.source_id && `ID no sistema de origem: ${v.source_id}`, v.exam_date && `Data do exame: ${date(v.exam_date)}`, v.exam_type && `Tipo: ${v.exam_type}`, v.description, v.file_name && `Arquivo na origem: ${v.file_name}`, extra && `Dados adicionais da origem:\n${extra}`].filter(Boolean).join("\n\n") || null
          const data = validated(documentInputSchema, { patient_id: patientId, title, document_type: "exam", description, status: "archived" }) as Record<string, unknown>
          plan.exams.push({ id: stableId(clinicId, source, "exam", patientId, v.source_id || JSON.stringify(data) + (v.file_name || "")), patientId, data, fileName: v.file_name || null, line: row.line })
        }
      } catch (error) { plan.errors.push(`${sheet.kind === "records" ? "Prontuários" : "Exames"}, linha ${row.line}: ${error instanceof Error ? error.message : "dados inválidos"}`) }
    }
  }
  for (const [kind, items] of [["Prontuários", plan.records], ["Exames", plan.exams]] as const) {
    const ids = new Set<string>()
    for (const item of items) {
      if (ids.has(item.id)) plan.errors.push(`${kind}, linha ${item.line}: item repetido na planilha.`)
      ids.add(item.id)
    }
  }
  if (!plan.patients.length) plan.errors.push("Nenhum paciente válido encontrado.")
  return plan
}
