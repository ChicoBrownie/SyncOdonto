import { NextResponse } from "next/server"
import { getClinicScopedClient } from "@/lib/supabase/clinic-scope"
import { recordAuditEvent } from "@/lib/security/audit"
import { consumeRateLimit } from "@/lib/security/rate-limit"
import { buildImportPlan, type ImportPlan } from "@/lib/imports/plan"
import { readSpreadsheet, type ImportKind, type ImportSheet } from "@/lib/imports/spreadsheet"

export const runtime = "nodejs"

const MAX_ROWS = 1000
const MAX_EXAM_FILE = 5 * 1024 * 1024
const MAX_TOTAL = 4 * 1024 * 1024
const BUCKET = "documentos-clinica"

type ExistingPatient = { id: string; full_name: string; cpf: string | null; user_id: string }
type Db = Extract<Awaited<ReturnType<typeof getClinicScopedClient>>, { supabase: unknown }>["supabase"]

function simpleError(error: string, status = 400) { return NextResponse.json({ error }, { status }) }

function getFile(form: FormData, field: string): File | null {
  const value = form.get(field)
  return value instanceof File && value.size ? value : null
}

function normalizeName(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/\s+/g, " ")
}

async function readExistingPatients(supabase: Db, ownerId: string): Promise<ExistingPatient[]> {
  const all: ExistingPatient[] = []
  for (let start = 0; start < 100000; start += 1000) {
    const { data, error } = await supabase.from("patients").select("id,full_name,cpf,user_id").eq("user_id", ownerId).range(start, start + 999)
    if (error) throw new Error("Não foi possível conferir os pacientes existentes.")
    all.push(...(data || []))
    if ((data || []).length < 1000) return all
  }
  throw new Error("A clínica possui muitos pacientes para esta versão do importador.")
}

function reconcile(plan: ImportPlan, existing: ExistingPatient[]) {
  const byId = new Map(existing.map(patient => [patient.id, patient]))
  const byCpf = new Map(existing.filter(patient => patient.cpf).map(patient => [patient.cpf!.replace(/\D/g, ""), patient]))
  const remap = new Map<string, string>()
  let duplicates = 0
  for (const patient of plan.patients) {
    const cpf = String(patient.data.cpf || "").replace(/\D/g, "")
    const match = byId.get(patient.id) || (cpf ? byCpf.get(cpf) : undefined)
    if (match) {
      if (normalizeName(match.full_name) !== normalizeName(String(patient.data.full_name))) {
        plan.errors.push(`Pacientes, linha ${patient.line}: CPF já cadastrado com outro nome. Confira antes de importar.`)
      } else { remap.set(patient.id, match.id); duplicates++ }
    }
  }
  for (const item of [...plan.records, ...plan.exams]) {
    const actualId = remap.get(item.patientId)
    if (actualId) { item.patientId = actualId; item.data.patient_id = actualId }
  }
  return { duplicates, remap }
}

function fileKind(file: File, bytes: Uint8Array): string | null {
  const extension = file.name.toLowerCase().split(".").pop()
  if (extension === "pdf" && new TextDecoder().decode(bytes.slice(0, 5)) === "%PDF-") return "application/pdf"
  if (extension === "png" && [137,80,78,71,13,10,26,10].every((value, index) => bytes[index] === value)) return "image/png"
  if ((extension === "jpg" || extension === "jpeg") && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg"
  return null
}

async function existingIds(supabase: Db, table: "medical_records" | "documents", ids: string[], ownerId: string) {
  const found = new Set<string>()
  for (let i = 0; i < ids.length; i += 100) {
    const { data, error } = await supabase.from(table).select("id,user_id").in("id", ids.slice(i, i + 100))
    if (error) throw new Error(`Não foi possível conferir duplicatas em ${table}.`)
    for (const item of data || []) {
      if (item.user_id !== ownerId) throw new Error("Conflito de identificação entre clínicas.")
      found.add(item.id)
    }
  }
  return found
}

export async function POST(request: Request) {
  const access = await getClinicScopedClient()
  if ("error" in access && access.error) return access.error
  const { supabase, ownerId, user, accessRole } = access as Extract<typeof access, { supabase: unknown }>
  if (accessRole !== "gestor") return simpleError("Somente o gestor da clínica pode importar dados.", 403)
  if (!(await consumeRateLimit(supabase, `clinic-import:${ownerId}:${user.id}`, 10, 60))) return simpleError("Muitas tentativas de importação. Aguarde um minuto.", 429)

  let form: FormData
  try { form = await request.formData() } catch { return simpleError("Envio inválido.") }
  const sourceName = String(form.get("source_name") || "").trim()
  const mode = String(form.get("mode") || "preview")
  if (sourceName.length < 2 || sourceName.length > 100) return simpleError("Informe o nome do sistema de origem (2 a 100 caracteres).")
  if (mode !== "preview" && mode !== "commit") return simpleError("Operação inválida.")
  const primary = getFile(form, "patients")
  if (!primary) return simpleError("Selecione a planilha de pacientes.")
  const others = (["records", "exams"] as ImportKind[]).map(kind => ({ kind, file: getFile(form, kind) })).filter((item): item is { kind: ImportKind; file: File } => Boolean(item.file))
  const examFiles = form.getAll("exam_files").filter((item): item is File => item instanceof File && item.size > 0)
  const totalSize = primary.size + others.reduce((sum, item) => sum + item.file.size, 0) + examFiles.reduce((sum, file) => sum + file.size, 0)
  if (totalSize > MAX_TOTAL) return simpleError("O envio completo deve ter no máximo 4 MB. Divida a importação em lotes.")
  if (examFiles.some(file => file.size > MAX_EXAM_FILE)) return simpleError("Cada arquivo de exame pode ter no máximo 5 MB.")

  const saved = { patients: 0, records: 0, exams: 0 }
  try {
    const sheets: ImportSheet[] = await readSpreadsheet(primary, "patients")
    for (const { kind, file } of others) {
      if (sheets.some(sheet => sheet.kind === kind)) throw new Error(`A aba de ${kind} foi enviada duas vezes.`)
      const parsed = (await readSpreadsheet(file, kind)).filter(sheet => sheet.kind === kind)
      if (!parsed.length) throw new Error(`${file.name}: nenhuma aba de ${kind} encontrada.`)
      sheets.push(...parsed)
    }
    if (sheets.filter(sheet => sheet.kind === "patients").length !== 1) throw new Error("Inclua exatamente uma aba de pacientes.")
    if (sheets.some(sheet => sheet.rows.length > MAX_ROWS)) throw new Error(`Máximo de ${MAX_ROWS} linhas por aba.`)
    const plan = buildImportPlan(sheets, ownerId, sourceName)
    if (plan.records.length + plan.exams.length > 2000) throw new Error("Máximo de 2.000 prontuários e exames por lote.")
    const names = new Map<string, File>()
    for (const file of examFiles) {
      const name = file.name.toLowerCase()
      if (names.has(name)) throw new Error(`Arquivo de exame repetido: ${file.name}`)
      names.set(name, file)
    }
    for (const exam of plan.exams) if (exam.fileName && !names.has(exam.fileName.toLowerCase())) plan.errors.push(`Exames, linha ${exam.line}: arquivo ${exam.fileName} não foi selecionado.`)
    for (const file of examFiles) {
      if (!plan.exams.some(exam => exam.fileName?.toLowerCase() === file.name.toLowerCase())) plan.errors.push(`Arquivo ${file.name} não está referenciado na planilha.`)
      const bytes = new Uint8Array(await file.slice(0, 132).arrayBuffer())
      if (!fileKind(file, bytes)) plan.errors.push(`Arquivo ${file.name}: tipo não aceito. Use PDF, PNG ou JPG.`)
    }
    const existing = await readExistingPatients(supabase, ownerId)
    const { duplicates, remap } = reconcile(plan, existing)
    const duplicateRecords = await existingIds(supabase, "medical_records", plan.records.map(item => item.id), ownerId)
    const duplicateExams = await existingIds(supabase, "documents", plan.exams.map(item => item.id), ownerId)
    const summary = {
      patients: plan.patients.length, newPatients: plan.patients.length - duplicates, duplicatePatients: duplicates,
      records: plan.records.length, newRecords: plan.records.length - duplicateRecords.size,
      exams: plan.exams.length, newExams: plan.exams.length - duplicateExams.size,
      examsWithoutFiles: plan.exams.filter(exam => !exam.fileName).length,
      samplePatients: plan.patients.slice(0, 5).map(patient => ({ name: String(patient.data.full_name), cpf: String(patient.data.cpf || ""), existing: remap.has(patient.id) })),
      sampleRecords: plan.records.slice(0, 5).map(record => String(record.data.title)),
      sampleExams: plan.exams.slice(0, 5).map(exam => ({ title: String(exam.data.title), hasFile: Boolean(exam.fileName) })),
      unmapped: plan.unmapped, errors: plan.errors.slice(0, 100),
    }
    if (mode === "preview" || plan.errors.length) return NextResponse.json({ summary, canImport: plan.errors.length === 0 })

    const newPatients = plan.patients.filter(patient => !remap.has(patient.id))
    for (let i = 0; i < newPatients.length; i += 100) {
      const batch = newPatients.slice(i, i + 100)
      const { error } = await supabase.from("patients").insert(batch.map(patient => ({ id: patient.id, user_id: ownerId, ...patient.data })))
      if (error) throw new Error(`Falha ao salvar pacientes a partir da linha ${batch[0].line}: ${error.message}`)
      saved.patients += batch.length
    }
    const newRecords = plan.records.filter(record => !duplicateRecords.has(record.id))
    for (let i = 0; i < newRecords.length; i += 100) {
      const batch = newRecords.slice(i, i + 100)
      const { error } = await supabase.from("medical_records").insert(batch.map(record => ({ id: record.id, user_id: ownerId, ...record.data })))
      if (error) throw new Error(`Falha ao salvar prontuários a partir da linha ${batch[0].line}: ${error.message}`)
      saved.records += batch.length
    }
    const metadataExams = plan.exams.filter(exam => !duplicateExams.has(exam.id) && !exam.fileName)
    for (let i = 0; i < metadataExams.length; i += 100) {
      const batch = metadataExams.slice(i, i + 100)
      const { error } = await supabase.from("documents").insert(batch.map(exam => ({ id: exam.id, user_id: ownerId, ...exam.data })))
      if (error) throw new Error(`Falha ao salvar exames a partir da linha ${batch[0].line}: ${error.message}`)
      saved.exams += batch.length
    }
    for (const exam of plan.exams) {
      if (duplicateExams.has(exam.id) || !exam.fileName) continue
      let storagePath: string | null = null, fileType: string | null = null, fileSize: number | null = null
      if (exam.fileName) {
        const file = names.get(exam.fileName.toLowerCase())!
        const bytes = new Uint8Array(await file.arrayBuffer())
        fileType = fileKind(file, bytes)
        if (!fileType) throw new Error(`Arquivo ${file.name} inválido.`)
        fileSize = file.size
        storagePath = `${ownerId}/imports/${exam.id}.${file.name.split(".").pop()!.toLowerCase()}`
        const { error } = await supabase.storage.from(BUCKET).upload(storagePath, bytes, { contentType: fileType, upsert: true })
        if (error) throw new Error(`Falha ao enviar ${file.name}: ${error.message}`)
      }
      const { error } = await supabase.from("documents").insert({ id: exam.id, user_id: ownerId, ...exam.data, storage_path: storagePath, file_url: storagePath, file_type: fileType, file_size: fileSize })
      if (error) throw new Error(`Falha ao salvar exame da linha ${exam.line}: ${error.message}`)
      saved.exams++
    }
    await recordAuditEvent({ supabase, clinicId: ownerId, actorUserId: user.id, action: "clinic.imported", entityType: "patients", metadata: { source: sourceName, saved } })
    return NextResponse.json({ summary, saved })
  } catch (error) {
    if (saved.patients || saved.records || saved.exams) await recordAuditEvent({ supabase, clinicId: ownerId, actorUserId: user.id, action: "clinic.import_partial", entityType: "patients", metadata: { source: sourceName, saved } })
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível importar os dados.", saved }, { status: 400 })
  }
}
