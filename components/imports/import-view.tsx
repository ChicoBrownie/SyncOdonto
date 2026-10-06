"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ArrowLeft, FileSpreadsheet, Upload } from "lucide-react"
import useSWR from "swr"

type Summary = {
  patients: number; newPatients: number; duplicatePatients: number
  records: number; newRecords: number; exams: number; newExams: number
  examsWithoutFiles: number; unmapped: Record<string, string[]>; errors: string[]
  samplePatients: { name: string; cpf: string; existing: boolean }[]
  sampleRecords: string[]; sampleExams: { title: string; hasFile: boolean }[]
}
type Result = { summary: Summary; canImport?: boolean; saved?: { patients: number; records: number; exams: number } }

export function ImportView() {
  const { data: access } = useSWR("/api/auth/check-access", (url: string) => fetch(url).then(response => response.json()))
  const [sourceName, setSourceName] = useState("")
  const [patients, setPatients] = useState<File | null>(null)
  const [records, setRecords] = useState<File | null>(null)
  const [exams, setExams] = useState<File | null>(null)
  const [examFiles, setExamFiles] = useState<File[]>([])
  const [result, setResult] = useState<Result | null>(null)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  const reset = () => { setResult(null); setError("") }
  async function submit(mode: "preview" | "commit") {
    if (!patients || !sourceName.trim()) { setError("Informe o sistema de origem e selecione a planilha de pacientes."); return }
    setBusy(true); setError("")
    try {
      const data = new FormData()
      data.set("source_name", sourceName.trim())
      data.set("mode", mode)
      data.set("patients", patients)
      if (records) data.set("records", records)
      if (exams) data.set("exams", exams)
      examFiles.forEach(file => data.append("exam_files", file))
      const response = await fetch("/api/imports", { method: "POST", body: data })
      const body = await response.json()
      if (!response.ok) {
        const partial = body.saved && Object.values(body.saved as Record<string, number>).some(value => value > 0)
        throw new Error(`${body.error || "Não foi possível importar os dados."}${partial ? ` Já foram salvos ${body.saved.patients} paciente(s), ${body.saved.records} prontuário(s) e ${body.saved.exams} exame(s).` : ""}`)
      }
      setResult(body)
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível importar os dados.") }
    finally { setBusy(false) }
  }

  if (access && access.access_role !== "gestor") return <Alert variant="destructive"><AlertDescription>Somente o gestor da clínica pode importar dados.</AlertDescription></Alert>

  return <div className="mx-auto max-w-3xl space-y-6 pb-16">
    <Link href="/pacientes" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Voltar aos pacientes</Link>
    <div><h1 className="text-3xl font-bold">Importar dados da clínica</h1><p className="mt-2 text-muted-foreground">Traga pacientes, prontuários e exames de outro sistema. A importação está disponível para o gestor da clínica.</p></div>
    <Alert><FileSpreadsheet className="size-4" /><AlertDescription>Use arquivos CSV (UTF-8) ou Excel (.xlsx). A planilha principal deve conter os pacientes. Uma planilha Excel também pode ter abas chamadas Pacientes, Prontuários e Exames. Confira a prévia antes de gravar. Cada envio aceita até 4 MB e 1.000 linhas por aba; para lotes seguintes, mantenha o mesmo nome do sistema de origem.</AlertDescription></Alert>
    <Card><CardHeader><CardTitle className="text-lg">1. Selecione os dados</CardTitle></CardHeader><CardContent className="space-y-5">
      <label className="block space-y-2 text-sm font-medium">Nome do sistema de origem
        <Input value={sourceName} maxLength={100} placeholder="Ex.: sistema anterior da clínica" onChange={event => { setSourceName(event.target.value); reset() }} />
      </label>
      <label className="block space-y-2 text-sm font-medium">Pacientes (obrigatório)
        <Input type="file" accept=".csv,.xlsx" onChange={event => { setPatients(event.target.files?.[0] || null); reset() }} />
      </label>
      <label className="block space-y-2 text-sm font-medium">Prontuários (se estiverem em outro arquivo)
        <Input type="file" accept=".csv,.xlsx" onChange={event => { setRecords(event.target.files?.[0] || null); reset() }} />
      </label>
      <label className="block space-y-2 text-sm font-medium">Exames (se estiverem em outro arquivo)
        <Input type="file" accept=".csv,.xlsx" onChange={event => { setExams(event.target.files?.[0] || null); reset() }} />
      </label>
      <label className="block space-y-2 text-sm font-medium">Arquivos dos exames (opcional)
        <Input type="file" accept=".pdf,.png,.jpg,.jpeg" multiple onChange={event => { setExamFiles(Array.from(event.target.files || [])); reset() }} />
        <span className="block font-normal text-muted-foreground">O nome de cada arquivo deve ser igual ao indicado na coluna “arquivo” ou “arquivo exame”. Um CSV sozinho traz apenas os dados escritos, não o arquivo de imagem/PDF.</span>
      </label>
      <div className="flex flex-wrap gap-3 text-sm"><a className="text-primary underline" href="/modelos-importacao/pacientes.csv" download>Modelo de pacientes</a><a className="text-primary underline" href="/modelos-importacao/prontuarios.csv" download>Modelo de prontuários</a><a className="text-primary underline" href="/modelos-importacao/exames.csv" download>Modelo de exames</a></div>
      <Button disabled={busy || !patients || sourceName.trim().length < 2} onClick={() => void submit("preview")}>{busy ? "Conferindo…" : "Conferir dados"}</Button>
    </CardContent></Card>
    {error && <Alert variant="destructive"><AlertDescription>{error} Se alguma linha já tiver sido salva, confira a prévia e tente novamente; os itens importados são reconhecidos.</AlertDescription></Alert>}
    {result && <Card><CardHeader><CardTitle className="text-lg">2. Confira a prévia</CardTitle></CardHeader><CardContent className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border p-4"><strong className="block text-2xl">{result.summary.newPatients}</strong><span className="text-sm text-muted-foreground">pacientes novos</span><p className="text-xs text-muted-foreground">{result.summary.duplicatePatients} já cadastrados</p></div>
        <div className="rounded-lg border p-4"><strong className="block text-2xl">{result.summary.newRecords}</strong><span className="text-sm text-muted-foreground">prontuários novos</span></div>
        <div className="rounded-lg border p-4"><strong className="block text-2xl">{result.summary.newExams}</strong><span className="text-sm text-muted-foreground">exames novos</span></div>
      </div>
      {result.summary.examsWithoutFiles > 0 && <p className="text-sm text-amber-700">{result.summary.examsWithoutFiles} exame(s) têm apenas descrição, sem arquivo associado.</p>}
      <div className="rounded-lg border p-4 text-sm"><strong>Amostra para conferir</strong>
        <ul className="mt-2 space-y-1">{result.summary.samplePatients.map((patient, index) => <li key={index}>{patient.name}{patient.cpf ? ` · CPF ${patient.cpf}` : ""} · {patient.existing ? "já cadastrado" : "novo"}</li>)}</ul>
        {result.summary.sampleRecords.length > 0 && <p className="mt-2">Prontuários: {result.summary.sampleRecords.join(", ")}</p>}
        {result.summary.sampleExams.length > 0 && <p className="mt-2">Exames: {result.summary.sampleExams.map(exam => `${exam.title}${exam.hasFile ? " (com arquivo)" : " (sem arquivo)"}`).join(", ")}</p>}
      </div>
      {Object.entries(result.summary.unmapped).filter(([, columns]) => columns.length).map(([kind, columns]) => <p key={kind} className="text-sm">Colunas adicionais em {kind}: {columns.join(", ")}. Os valores serão preservados nas observações.</p>)}
      {result.summary.errors.length > 0 && <div className="rounded-lg border border-destructive p-4 text-sm"><strong>Corrija a planilha antes de importar:</strong><ul className="mt-2 list-disc space-y-1 pl-5">{result.summary.errors.map((item, index) => <li key={index}>{item}</li>)}</ul></div>}
      {result.saved ? <Alert><Upload className="size-4" /><AlertDescription>Importação concluída: {result.saved.patients} paciente(s), {result.saved.records} prontuário(s) e {result.saved.exams} exame(s) adicionados. <Link className="underline" href="/pacientes">Ver pacientes</Link>.</AlertDescription></Alert> : <Button disabled={busy || !result.canImport} onClick={() => void submit("commit")}>{busy ? "Importando…" : "Confirmar importação"}</Button>}
    </CardContent></Card>}
  </div>
}
