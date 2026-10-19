"use client"
import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Cloud, Check, Ellipsis, Loader2 } from "lucide-react"
import useSWR from "swr"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DentalChartView } from "@/components/dental-chart/dental-chart-view"
import { AttachedExams } from "@/components/medical-records/attached-exams"
import { QUESTION_GROUPS } from "@/components/medical-records/anamnesis-section"
import { SignaturePad } from "@/components/documents/signature-pad"
import { PatientCombobox, type PatientOption } from "@/components/documents/patient-combobox"
import { usePatient } from "@/lib/hooks/use-data"
import { useEncounter } from "@/lib/encounters/use-encounter"
import { encounterRequest } from "@/lib/encounters/client"
import { applyBudgetGroupDiscount, budgetContent, budgetTotal, mergeTreatments, stepLabels, steps, type EncounterStep } from "@/lib/encounters/model"
import { ContextualHelp, type GuideStep } from "./contextual-help"
import { BudgetSection } from "./budget-section"
import { operationalNow } from "./encounter-entry"
import { capitalizeWords, formatCpf, patientSearchPrefill } from "@/lib/encounters/patient-input"
import { emailProposalUrl, whatsappProposalUrl } from "@/lib/encounters/sharing"

const money = (amount: number) => amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
const guides: Record<EncounterStep, GuideStep[]> = {
  patient: [{ selector: "[data-guide='patient-fields']", title: "Confirme o paciente", description: "Busque um cadastro ou complete nome, nascimento e CPF. Os campos são salvos durante a edição." }, { selector: "[data-guide='primary-action']", title: "Atender ou agendar", description: "Escolha uma consulta existente para reaproveitar o horário. Atender agora inicia a consulta; agendar reserva o horário informado." }],
  anamnesis: [{ selector: "[data-guide='anamnesis-fields']", title: "Saúde antes dos procedimentos", description: "Registre a queixa e as respostas. Alergias, medicamentos e respostas positivas continuam visíveis nas próximas etapas." }, { selector: "[data-guide='primary-action']", title: "Continue quando estiver pronta", description: "O rascunho salva durante a edição. Use os botões ao fim do formulário para continuar ou voltar." }],
  chart: [{ selector: "[data-guide='chart-diagram']", title: "Faces do dente", description: "Exemplo do dente 11: toque nas regiões que receberão o procedimento. Para uma extração, selecione todas as faces e a raiz, ou toque no número para escolher o dente inteiro.", example: "tooth-surfaces" }, { selector: "[data-guide='encounter-options']", title: "Exames a qualquer momento", description: "Abra as opções para adicionar exames sem sair do atendimento." }],
  budget: [{ selector: "[data-guide='budget-fields']", title: "Revise a proposta", description: "Importe os procedimentos deste atendimento. Confira dentes, regiões, valores e descontos antes de apresentar a proposta." }],
  signature: [{ selector: "[data-guide='document-preview']", title: "Esta é a proposta a assinar", description: "Mostre o texto completo e os valores ao paciente. A assinatura fica vinculada a esta versão, que não poderá ser alterada." }, { selector: "[data-guide='signature-pad']", title: "Assine na tela", description: "A pessoa pode assinar com o dedo. Confirme a concordância antes de tocar em Assinar proposta. O sistema registra uma assinatura desenhada, sem certificação digital." }],
  financial: [{ selector: "[data-guide='financial-fields']", title: "Confirme o valor desta consulta", description: "A proposta pode incluir várias sessões. Revise o valor a cobrar nesta consulta antes de confirmar o encerramento. Uma pendência será enviada ao financeiro." }],
}
type AppointmentOption = { id: string; date: string; time: string; status: string; doctor_name: string; cost: number | null }
type SignedDocument = { id: string; content: string; signature_data: string; encounter_revision: number; snapshot_hash: string; signed_at: string }
const registrationFields = [
  { key: "full_name", label: "Nome completo", type: "text" },
  { key: "date_of_birth", label: "Data de nascimento", type: "date" },
  { key: "cpf", label: "CPF", type: "text" },
  { key: "phone", label: "Telefone (opcional)", type: "tel" },
  { key: "email", label: "E-mail (opcional)", type: "email" },
] as const

export function EncounterEditor({ id }: { id: string }) {
  const router = useRouter()
  const { draft, saveState, message, actionMessage, busy, update, go, flush, action, reload } = useEncounter(id)
  const { patient, error: patientError } = usePatient(draft?.patient_id || null)
  const { data: appointmentRes, error: appointmentError, mutate: reloadAppointments } = useSWR(draft?.patient_id ? `/api/appointments?patientId=${draft.patient_id}` : null, encounterRequest)
  const { data: anamnesisRes, error: anamnesisError } = useSWR(draft?.patient_id ? `/api/anamnesis?patientId=${draft.patient_id}` : null, encounterRequest)
  const { data: access } = useSWR("/api/auth/check-access", encounterRequest)
  const { data: staffRes } = useSWR("/api/clinic-staff", encounterRequest)
  const { data: customTemplatesRes, mutate: reloadCustomTemplates } = useSWR("/api/anamnesis-custom-questions", encounterRequest, { shouldRetryOnError: false })
  const { data: signed } = useSWR(draft?.signed_document_id ? `/api/encounters/${id}/document` : null, encounterRequest)
  const document = signed?.data as SignedDocument | undefined
  const [selectedPatient, setSelectedPatient] = useState<PatientOption | null>(null)
  const [registrationStage, setRegistrationStage] = useState(0)
  const [patientChoice, setPatientChoice] = useState<"schedule" | "now" | null>(null)
  const [exams, setExams] = useState(false)
  const [govHelp, setGovHelp] = useState(false)
  const [shareKind, setShareKind] = useState<"proposal" | "record" | null>(null)
  const [shareFile, setShareFile] = useState<File | null>(null)
  const [signature, setSignature] = useState<string | null>(null)
  const [agreement, setAgreement] = useState(false)
  const [confirm, setConfirm] = useState<"complete" | "discard" | "reload" | null>(null)
  const [importing, setImporting] = useState(false)
  const [customQuestion, setCustomQuestion] = useState("")
  const professionals = ((staffRes?.data || []) as { full_name: string; access_role: string; is_active: boolean }[]).filter(member => member.is_active && member.access_role === "dentista")
  const soleProfessional = professionals.length === 1 ? professionals[0].full_name : null
  useEffect(() => { if (draft?.patient_id && !draft.appointment_id && draft.payload.scheduling) setPatientChoice("schedule") }, [draft?.patient_id, draft?.appointment_id, draft?.payload.scheduling])
  useEffect(() => {
    if (draft?.patient_id && !draft.appointment_id && soleProfessional && draft.payload.appointment.doctor_name !== soleProfessional) {
      update(value => ({ ...value, appointment: { ...value.appointment, doctor_name: soleProfessional } }))
    }
  }, [draft?.patient_id, draft?.appointment_id, draft?.payload.appointment.doctor_name, soleProfessional, update])
  const run = async (name: string, input: Record<string, unknown> = {}) => {
    try { const result = await action(name, input); if (result) { if (name === "start" || name === "schedule") void reloadAppointments(); toast.success(name === "complete" ? "Consulta concluída. Pendência enviada ao financeiro." : name === "sign" ? "Proposta assinada. Confira o valor da consulta." : name === "schedule" ? "Horário agendado. Confira na agenda." : name === "publish" ? "Registro confirmado no prontuário." : name === "start" ? "Consulta iniciada." : "Alteração confirmada."); setSignature(null); setAgreement(false); setConfirm(null) } return result }
    catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível concluir."); return null }
  }
  const changeStep = async (step: EncounterStep) => {
    if (step !== "signature") { setSignature(null); setAgreement(false) }
    try { await go(step) } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível salvar.") }
  }
  if (!draft) return <div role="status" className="space-y-3"><p>{saveState === "loading" ? "Carregando atendimento…" : message}</p>{saveState !== "loading" && <Button onClick={() => void reload()}>Tentar novamente</Button>}</div>
  if (draft.status !== "active") return <section className="mx-auto max-w-xl space-y-4"><h1 className="text-2xl font-bold">{draft.status === "completed" ? "Atendimento concluído" : "Rascunho descartado"}</h1><p>{draft.status === "completed" ? "Os registros clínicos e a proposta assinada foram preservados. A cobrança está vinculada à consulta." : "O descarte foi solicitado explicitamente. Cadastros, consultas e registros já confirmados foram preservados."}</p>{draft.status === "completed" && access?.permissions?.financeiro && <Button asChild><Link href={`/financeiro?appointmentId=${draft.appointment_id}`}>Conferir cobrança e registrar recebimento</Link></Button>}{draft.signed_document_id && <Button asChild variant="outline"><Link href={`/api/encounters/${id}/document?format=html`} target="_blank">Ver proposta assinada</Link></Button>}<Button asChild variant="outline"><Link href="/atendimento">Iniciar outro atendimento</Link></Button></section>
  const p = { ...draft.payload, registration: { ...draft.payload.registration, email: draft.payload.registration.email || "" } }
  const scheduling = p.scheduling
  const setScheduling = (value: boolean) => update(v => ({ ...v, scheduling: value }))
  const appointmentId = p.appointment_choice || ""
  const setAppointmentId = (value: string) => update(v => ({ ...v, appointment_choice: value || null }))
  const step = draft.step
  const appointments: AppointmentOption[] = appointmentRes?.data || []
  const available = appointments.filter(a => ["Pendente", "Confirmada", "Aguardando", "Em Andamento"].includes(a.status))
  const active = appointments.find(a => a.id === draft.appointment_id)
  const locked = busy || saveState === "conflict" || saveState === "loading"
  const alerts = [patient?.allergies && `Alergias: ${patient.allergies}`, patient?.medications && `Medicamentos: ${patient.medications}`, patient?.pre_existing_conditions && `Condições: ${patient.pre_existing_conditions}`].filter(Boolean) as string[]
  const priorAnswers = anamnesisRes?.data?.[0]?.answers || []
  const standardQuestions = new Set(QUESTION_GROUPS.flatMap(group => group.questions))
  const customTemplates = (customTemplatesRes?.data || []) as { id: string; question: string }[]
  const customQuestions = Array.from(new Set([...customTemplates.map(item => item.question), ...p.anamnesis.answers.filter(item => !standardQuestions.has(item.question)).map(item => item.question)]))
  for (const answer of [...priorAnswers, ...p.anamnesis.answers]) if (answer.answer === "sim") {
    const alert = `${answer.question}${answer.observation ? ` — ${answer.observation}` : ""}`
    if (!alerts.includes(alert)) alerts.push(alert)
  }
  const preview = budgetContent(patient?.full_name || "Paciente", p)
  const total = budgetTotal(p.budget.items)
  const proposalText = document?.content || preview
  const emailUrl = emailProposalUrl(patient?.email || "", proposalText)
  const whatsappUrl = whatsappProposalUrl(patient?.phone || "", proposalText)
  async function openPrintable(kind: "proposal" | "record" | "signed") {
    const tab = window.open("", "_blank")
    try {
      if (kind !== "signed") await flush()
      const url = kind === "signed" ? `/api/encounters/${id}/document?format=html` : `/api/encounters/${id}/print?kind=${kind}`
      if (tab) tab.location.href = url
      else window.location.href = url
    } catch (error) {
      tab?.close()
      toast.error(error instanceof Error ? error.message : "Salve o atendimento antes de imprimir.")
    }
  }
  async function pdfFile(kind: "proposal" | "record") {
    await flush()
    const response = await fetch(`/api/encounters/${id}/print?kind=${kind}&format=pdf`, { cache: "no-store" })
    if (!response.ok) throw new Error("Não foi possível preparar o PDF.")
    return new File([await response.blob()], kind === "proposal" ? "proposta-tratamento.pdf" : "prontuario-orcamento.pdf", { type: "application/pdf" })
  }
  function saveFile(file: File) {
    const url = URL.createObjectURL(file)
    const link = window.document.createElement("a")
    link.href = url
    link.download = file.name
    window.document.body.appendChild(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 30_000)
  }
  async function downloadPdf(kind: "proposal" | "record") {
    try { saveFile(await pdfFile(kind)) }
    catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível salvar o PDF.") }
  }
  function prepareShare(kind: "proposal" | "record") {
    setShareKind(kind)
    setShareFile(null)
    void pdfFile(kind).then(setShareFile).catch(error => { setShareKind(null); toast.error(error instanceof Error ? error.message : "Não foi possível preparar o PDF.") })
  }
  function shareReadyFile() {
    if (!shareFile || !shareKind) return
    if (navigator.canShare?.({ files: [shareFile] })) {
      void navigator.share({ files: [shareFile], title: shareKind === "proposal" ? "Proposta de tratamento" : "Prontuário e orçamento" }).catch(error => {
        if (!(error instanceof DOMException && error.name === "AbortError")) toast.error("Não foi possível compartilhar. Baixe o PDF e anexe manualmente.")
      })
    } else { saveFile(shareFile); toast.info("PDF salvo. Anexe o arquivo na mensagem ou no e-mail ao paciente.") }
  }
  const questionInput = (question: string) => {
    const answer = p.anamnesis.answers.find(item => item.question === question) || { question, answer: null, observation: "" }
    const change = (patch: Partial<typeof answer>) => update(value => {
      const previous = value.anamnesis.answers.find(item => item.question === question) || { question, answer: null, observation: "" }
      return { ...value, anamnesis: { ...value.anamnesis, answers: [...value.anamnesis.answers.filter(item => item.question !== question), { ...previous, ...patch }] } }
    })
    return <div key={question} className="space-y-2 border-t pt-3"><p className="text-sm">{question}</p><div className="flex flex-wrap gap-2"><Button type="button" aria-pressed={answer.answer === "sim"} className="min-h-11" variant={answer.answer === "sim" ? "default" : "outline"} onClick={() => change({ answer: "sim" })}>Sim</Button><Button type="button" aria-pressed={answer.answer === "nao"} className="min-h-11" variant={answer.answer === "nao" ? "default" : "outline"} onClick={() => change({ answer: "nao" })}>Não</Button><Button type="button" className="min-h-11" variant="ghost" onClick={() => change({ answer: null })}>Depois</Button></div><Input aria-label={`Detalhes: ${question}`} placeholder="Detalhes, medicamentos ou observação" value={answer.observation} onChange={event => change({ observation: event.target.value })} /></div>
  }
  async function addCustomQuestion() {
    const question = customQuestion.trim()
    if (!question || question.length > 500 || standardQuestions.has(question) || customQuestions.includes(question)) return toast.error("Informe uma pergunta nova com até 500 caracteres.")
    if (p.anamnesis.answers.length >= 100) return toast.error("Limite de 100 respostas nesta anamnese.")
    update(v => ({ ...v, anamnesis: { ...v.anamnesis, answers: [...v.anamnesis.answers, { question, answer: null, observation: "" }] } }))
    setCustomQuestion("")
    try { await encounterRequest("/api/anamnesis-custom-questions", { method: "POST", body: JSON.stringify({ question }) }); await reloadCustomTemplates() }
    catch (error) { toast.error(error instanceof Error ? `${error.message} A pergunta permanece neste atendimento.` : "A pergunta permanece apenas neste atendimento.") }
  }
  async function removeCustomQuestion(question: string) {
    const template = customTemplates.find(item => item.question === question)
    if (template) {
      try { await encounterRequest("/api/anamnesis-custom-questions", { method: "DELETE", body: JSON.stringify({ id: template.id }) }); await reloadCustomTemplates() }
      catch (error) { return toast.error(error instanceof Error ? error.message : "Não foi possível remover a pergunta do modelo.") }
    }
    update(v => ({ ...v, anamnesis: { ...v.anamnesis, answers: v.anamnesis.answers.filter(answer => answer.question !== question) } }))
  }
  async function importTreatments() {
    setImporting(true)
    try {
      await flush()
      const { data } = await encounterRequest(`/api/treatments?patientId=${draft!.patient_id}`)
      const treatments = data.filter((item: { appointment_id: string | null; status: string }) => (draft!.appointment_id && item.appointment_id === draft!.appointment_id) || (!item.appointment_id && item.status === "planned"))
      if (!treatments.length) return toast.info("Adicione os procedimentos no odontograma desta consulta. Também pode incluir um item manualmente.")
      update(v => ({ ...v, budget: { ...v.budget, items: mergeTreatments(v.budget.items, treatments) } }))
    } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível importar.") }
    finally { setImporting(false) }
  }
  const next: Record<EncounterStep, EncounterStep> = { patient: "anamnesis", anamnesis: "chart", chart: "budget", budget: "signature", signature: "financial", financial: "financial" }
  const primaryLabel = step === "patient" ? !draft.patient_id ? selectedPatient ? "Usar este paciente" : "Cadastrar e continuar" : active?.status === "Em Andamento" ? "Continuar atendimento" : draft.appointment_id ? "Iniciar consulta neste horário" : patientChoice === "schedule" ? "Confirmar agendamento" : "Iniciar consulta agora" : step === "anamnesis" && !draft.appointment_id ? "Iniciar consulta e abrir odontograma" : step === "signature" ? draft.signed_document_id ? "Ir para o financeiro" : "Assinar proposta" : step === "financial" ? "Concluir" : "Continuar"
  async function primary() {
    if (step === "patient") {
      if (!draft!.patient_id && !selectedPatient) {
        if (registrationStage < registrationFields.length - 1) {
          const field = registrationFields[registrationStage]
          const value = p.registration[field.key].trim()
          if (field.key === "full_name" && value.length < 2) return toast.error("Informe o nome completo.")
          if (field.key === "date_of_birth" && !value) return toast.error("Informe a data de nascimento.")
          if (field.key === "cpf" && value.replace(/\D/g, "").length !== 11) return toast.error("Informe o CPF com 11 dígitos.")
          setRegistrationStage(stage => stage + 1)
          return
        }
        if (p.registration.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.registration.email.trim())) return toast.error("Confira o e-mail informado.")
        if (p.registration.full_name.trim().length < 2) return toast.error("Informe o nome completo do paciente.")
        if (!p.registration.date_of_birth) return toast.error("Informe a data de nascimento.")
        if (!/^\d{11}$|^\d{3}\.\d{3}\.\d{3}-\d{2}$/.test(p.registration.cpf)) return toast.error("Informe o CPF com 11 dígitos.")
      }
      if (draft!.patient_id && !appointmentId && !draft!.appointment_id && patientChoice && p.appointment.doctor_name.trim().length < 2) return toast.error("Informe o profissional responsável.")
      if (draft!.patient_id && !scheduling && !appointmentId && !draft!.appointment_id) update(v => ({ ...v, appointment: { ...v.appointment, ...operationalNow() } }))
      if (!draft!.patient_id) await run(selectedPatient ? "choose_patient" : "register", selectedPatient ? { patient_id: selectedPatient.id } : {})
      else if (active?.status === "Em Andamento") await changeStep("anamnesis")
      else if (draft!.appointment_id || appointmentId || patientChoice) { const result = await run(draft!.appointment_id ? "start" : scheduling ? "schedule" : "start", appointmentId ? { appointment_id: appointmentId } : {}); if (result && scheduling && result.appointment_id) router.replace(`/agenda?date=${encodeURIComponent(result.payload.appointment.date)}&appointmentId=${encodeURIComponent(result.appointment_id)}`) }
    } else if (step === "anamnesis") {
      if (!draft!.appointment_id || active?.status !== "Em Andamento") {
        if (!draft!.appointment_id && p.appointment.doctor_name.trim().length < 2) return toast.error("Informe o profissional responsável.")
        if (!draft!.appointment_id) update(value => ({ ...value, appointment: { ...value.appointment, ...operationalNow() } }))
        const started = await run("start", draft!.appointment_id ? { appointment_id: draft!.appointment_id } : {})
        if (!started) return
      }
      const hasAnamnesis = Boolean(p.anamnesis.chief_complaint.trim() || p.anamnesis.answers.some(answer => answer.answer !== null || answer.observation.trim()) || p.anamnesis.additional_notes.trim() || p.anamnesis.diagnosis.trim() || p.anamnesis.treatment_plan.trim())
      if (hasAnamnesis && !await run("publish")) return
      await changeStep("chart")
    } else if (step === "signature") {
      if (draft!.signed_document_id) return changeStep("financial")
      if (!signature || !agreement) return toast.error("Colete a assinatura e confirme a concordância com a proposta.")
      await run("sign", { signature, confirmed: true })
    } else if (step === "financial") setConfirm("complete")
    else {
      await changeStep(next[step])
      // Import only missing treatments; existing prices and manual edits stay intact.
      if (step === "chart" && !draft!.signed_document_id && !p.budget.items.length) await importTreatments()
    }
  }
  return <section className={`encounter-editor mx-auto min-w-0 ${step === "chart" ? "w-full max-w-none space-y-4" : "max-w-4xl space-y-2"}`}>
    <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><div className="flex items-center gap-2"><p className="text-sm text-muted-foreground">{stepLabels[step]}</p><div aria-live="polite" className="flex items-center text-muted-foreground" title={saveState === "saved" ? "Atendimento salvo" : saveState === "saving" ? "Salvando atendimento" : "Salvamento indisponível"}>{saveState === "saved" ? <span className="relative"><Cloud className="size-5" /><Check className="absolute -bottom-1 -right-1 size-3 rounded-full bg-card" /></span> : saveState === "saving" || saveState === "loading" ? <span className="relative"><Cloud className="size-5" /><Loader2 className="absolute -bottom-1 -right-1 size-3 animate-spin rounded-full bg-card" /></span> : <Cloud className="size-5" />}<span className="sr-only">{saveState === "saved" ? "Atendimento salvo" : saveState === "saving" ? "Salvando atendimento" : "Salvamento indisponível"}</span></div></div><h1 className="break-words text-2xl font-bold">{patient?.full_name || selectedPatient?.full_name || p.registration.full_name || "Identificar paciente"}</h1></div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild><Button data-guide="encounter-options" type="button" variant="outline" size="icon" className="shrink-0" aria-label="Opções do atendimento"><Ellipsis className="size-5" /></Button></DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="max-w-[min(90vw,22rem)]">
          {draft.patient_id && <DropdownMenuItem onSelect={() => setExams(true)}>Adicionar exames</DropdownMenuItem>}
          {draft.patient_id && <DropdownMenuItem disabled={!p.budget.items.length} onSelect={() => void openPrintable(draft.signed_document_id ? "signed" : "proposal")}>Imprimir proposta{draft.signed_document_id ? " assinada" : ""}</DropdownMenuItem>}
          {draft.patient_id && <DropdownMenuItem disabled={!p.budget.items.length} onSelect={() => setGovHelp(true)}>Preparar PDF para assinar no gov.br</DropdownMenuItem>}
          {draft.patient_id && <DropdownMenuItem disabled={!p.budget.items.length} onSelect={() => void openPrintable("record")}>Imprimir prontuário com orçamento</DropdownMenuItem>}
          {draft.patient_id && <DropdownMenuItem disabled={!p.budget.items.length} onSelect={() => prepareShare("proposal")}>Compartilhar PDF da proposta sem assinatura</DropdownMenuItem>}
          {draft.patient_id && <DropdownMenuItem disabled={!p.budget.items.length} onSelect={() => prepareShare("record")}>Compartilhar PDF do prontuário e orçamento</DropdownMenuItem>}
          {draft.patient_id && <DropdownMenuItem disabled={!whatsappUrl || !p.budget.items.length} onSelect={() => { if (whatsappUrl) window.open(whatsappUrl, "_blank", "noopener,noreferrer") }}>Enviar texto por WhatsApp{!whatsappUrl ? " (sem telefone)" : ""}</DropdownMenuItem>}
          {draft.patient_id && <DropdownMenuItem disabled={!emailUrl || !p.budget.items.length} onSelect={() => { if (emailUrl) window.location.href = emailUrl }}>Enviar texto por e-mail{!emailUrl ? " (sem e-mail)" : ""}</DropdownMenuItem>}
          <DropdownMenuItem onSelect={() => setConfirm("discard")}>Descartar rascunho</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ContextualHelp key={step} area={`encounter-${step}`} steps={guides[step]} autoOpen={false} />
    </div>
    {(patientError || anamnesisError) && <p role="alert" className="rounded-lg border border-destructive p-3 text-sm text-destructive">Não foi possível consultar todos os dados de saúde e alertas do paciente. Confira a conexão e o prontuário antes de continuar os procedimentos.</p>}
    {(message || actionMessage || saveState === "error" || saveState === "conflict") && <div role="alert" className="space-y-2 text-sm text-destructive"><p>{saveState === "error" ? "Não foi possível salvar. Mantenha esta tela aberta e tente novamente." : saveState === "conflict" ? "Outra aba alterou este atendimento. Sua edição não foi enviada." : actionMessage || message}</p>{saveState === "error" && <Button variant="outline" onClick={() => void flush().catch(() => undefined)}>Tentar salvar novamente</Button>}{saveState === "conflict" && <Button variant="outline" onClick={() => setConfirm("reload")}>Revisar versão salva</Button>}</div>}
    {alerts.length > 0 && step !== "patient" && step !== "chart" && <aside aria-label="Alertas clínicos" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-950"><p className="font-semibold">Atenção clínica</p><ul className="mt-1 list-disc space-y-1 pl-5 text-sm">{alerts.map(alert => <li key={alert}>{alert}</li>)}</ul></aside>}
    <fieldset disabled={locked} aria-label={step === "budget" || step === "signature" ? stepLabels[step] : undefined} className={step === "chart" ? "min-w-0 space-y-4" : "min-w-0 space-y-4 rounded-xl border bg-card p-4 sm:p-5"}>
      {step !== "chart" && step !== "budget" && step !== "signature" && <legend className="px-2 font-semibold">{stepLabels[step]}</legend>}
      {step === "signature" && !draft.appointment_id && !draft.signed_document_id && <p className="text-sm text-destructive">Inicie a consulta na etapa Paciente antes de coletar e confirmar a assinatura.</p>}
      {step === "signature" && draft.appointment_id && active && active.status !== "Em Andamento" && !draft.signed_document_id && <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950"><span>Esta consulta ainda está agendada. Inicie-a antes de confirmar a assinatura.</span><Button type="button" size="sm" onClick={() => void run("start")}>Iniciar consulta</Button></div>}
      {step === "patient" && <div data-guide="patient-fields" className="space-y-4">
        {!draft.patient_id ? <>
          {!p.registration.full_name && !p.registration.cpf && <div className="space-y-2"><Label>Buscar paciente cadastrado</Label><PatientCombobox value={selectedPatient} onChange={setSelectedPatient} inline onCreateNew={query => { setSelectedPatient(null); setRegistrationStage(0); update(value => ({ ...value, registration: { ...value.registration, ...patientSearchPrefill(query) } })) }} /></div>}
          {!selectedPatient && <div className="space-y-4"><p className="text-sm text-muted-foreground">Novo paciente · informação {registrationStage + 1} de {registrationFields.length}</p>{(() => { const field = registrationFields[registrationStage]; return <div className="space-y-1"><Label htmlFor={field.key}>{field.label}{field.key !== "phone" && field.key !== "email" ? " *" : ""}</Label><Input id={field.key} type={field.type} inputMode={field.key === "cpf" ? "numeric" : undefined} autoCapitalize={field.key === "full_name" ? "words" : undefined} autoComplete={field.key === "full_name" ? "name" : field.key === "email" ? "email" : field.key === "phone" ? "tel" : undefined} maxLength={field.key === "cpf" ? 14 : field.key === "email" ? 254 : undefined} value={field.key === "cpf" ? formatCpf(p.registration[field.key]) : p.registration[field.key]} onChange={event => update(value => ({ ...value, registration: { ...value.registration, [field.key]: field.key === "cpf" ? formatCpf(event.target.value) : event.target.value } }))} onBlur={field.key === "full_name" ? () => update(value => ({ ...value, registration: { ...value.registration, full_name: capitalizeWords(value.registration.full_name) } })) : undefined} /></div> })()}</div>}
        </> : <>
          {!draft.appointment_id && <><div className="grid grid-cols-2 gap-2"><Button type="button" variant={patientChoice === "schedule" ? "default" : "outline"} className="min-h-12 whitespace-normal" aria-pressed={patientChoice === "schedule"} onClick={() => { setPatientChoice("schedule"); setAppointmentId(""); setScheduling(true) }}>Agendar horário</Button><Button type="button" variant={patientChoice === "now" ? "default" : "outline"} className="min-h-12 whitespace-normal" aria-pressed={patientChoice === "now"} onClick={() => { setPatientChoice("now"); setScheduling(false); update(value => ({ ...value, appointment: { ...value.appointment, ...operationalNow() } })) }}>Atender agora</Button></div>
          {patientChoice && <div className="space-y-4 pt-2">
            {appointmentError && <p role="alert" className="text-destructive">Não foi possível consultar os horários.</p>}
            {patientChoice === "now" && available.length > 0 && <div className="space-y-1"><Label htmlFor="existing-appointment">Aproveitar consulta já agendada</Label><select id="existing-appointment" className="min-h-11 w-full rounded-md border bg-background px-3" value={appointmentId} onChange={event => setAppointmentId(event.target.value)}><option value="">Novo horário</option>{available.map(a => <option key={a.id} value={a.id}>{a.date} · {a.time.slice(0, 5)} · {a.doctor_name} · {a.status}</option>)}</select></div>}
            {!appointmentId && <div className="grid gap-3 sm:grid-cols-2">
              {professionals.length > 1 && <div className="space-y-1 sm:col-span-2"><Label htmlFor="professional-choice">Dentista *</Label><select id="professional-choice" className="min-h-11 w-full rounded-md border bg-background px-3" value={p.appointment.doctor_name} onChange={event => update(value => ({ ...value, appointment: { ...value.appointment, doctor_name: event.target.value } }))}><option value="">Selecione o dentista</option>{professionals.map(member => <option key={member.full_name} value={member.full_name}>{member.full_name}</option>)}</select></div>}
              {professionals.length === 0 && <div className="space-y-1 sm:col-span-2"><Label htmlFor="professional">Profissional responsável *</Label><Input id="professional" value={p.appointment.doctor_name} onChange={event => update(value => ({ ...value, appointment: { ...value.appointment, doctor_name: event.target.value } }))} onBlur={() => update(value => ({ ...value, appointment: { ...value.appointment, doctor_name: capitalizeWords(value.appointment.doctor_name) } }))} /></div>}
              {patientChoice === "schedule" && <><div><Label htmlFor="appointment-date">Data *</Label><Input id="appointment-date" type="date" value={p.appointment.date} onChange={event => update(v => ({ ...v, appointment: { ...v.appointment, date: event.target.value } }))} /></div><div><Label htmlFor="appointment-time">Horário *</Label><Input id="appointment-time" type="time" value={p.appointment.time} onChange={event => update(v => ({ ...v, appointment: { ...v.appointment, time: event.target.value } }))} /></div><div><Label htmlFor="duration">Duração em minutos</Label><Input id="duration" type="number" min={5} max={720} value={p.appointment.duration_minutes} onChange={event => update(v => ({ ...v, appointment: { ...v.appointment, duration_minutes: Number(event.target.value) } }))} /></div></>}
            </div>}
          </div>}</>}
          {draft.appointment_id && <p className="text-sm text-muted-foreground">{active ? `Consulta de ${active.date} às ${active.time.slice(0, 5)}.` : "Consulta vinculada ao atendimento."}</p>}
        </>}
      </div>}
      {step === "anamnesis" && <div data-guide="anamnesis-fields" className="space-y-4">{!draft.appointment_id && !soleProfessional && <div className="space-y-1"><Label htmlFor="anamnesis-professional">Profissional responsável *</Label>{professionals.length ? <select id="anamnesis-professional" className="min-h-11 w-full rounded-md border bg-background px-3" value={p.appointment.doctor_name} onChange={event => update(value => ({ ...value, appointment: { ...value.appointment, doctor_name: event.target.value } }))}><option value="">Selecione o dentista</option>{professionals.map(member => <option key={member.full_name} value={member.full_name}>{member.full_name}</option>)}</select> : <Input id="anamnesis-professional" value={p.appointment.doctor_name} onChange={event => update(value => ({ ...value, appointment: { ...value.appointment, doctor_name: event.target.value } }))} />}</div>}<div><Label htmlFor="complaint">O que trouxe o paciente hoje?</Label><Textarea id="complaint" value={p.anamnesis.chief_complaint} onChange={event => update(v => ({ ...v, anamnesis: { ...v.anamnesis, chief_complaint: event.target.value } }))} /></div>
        <details className="rounded-lg border p-3"><summary className="min-h-11 cursor-pointer font-semibold">Perguntas personalizadas</summary><div className="space-y-3">{customQuestions.map(question => <div key={question} className="flex items-start gap-2"><div className="min-w-0 flex-1">{questionInput(question)}</div><Button type="button" variant="ghost" onClick={() => void removeCustomQuestion(question)}>Remover</Button></div>)}<div className="flex gap-2"><Input aria-label="Nova pergunta personalizada" placeholder="Escreva uma pergunta" maxLength={500} value={customQuestion} onChange={event => setCustomQuestion(event.target.value)} /><Button type="button" variant="outline" onClick={() => void addCustomQuestion()}>Adicionar</Button></div></div></details>
        {QUESTION_GROUPS.map(group => <details key={group.group} className="rounded-lg border p-3"><summary className="min-h-11 cursor-pointer font-semibold">{group.group}</summary><div className="space-y-3">{group.questions.map(questionInput)}</div></details>)}
        <details className="rounded-lg border p-3"><summary className="min-h-11 cursor-pointer font-semibold">Diagnóstico e planejamento</summary><div className="space-y-3">{([{ key: "additional_notes", label: "Outros medicamentos e alertas" }, { key: "diagnosis", label: "Diagnóstico" }, { key: "treatment_plan", label: "Plano de tratamento" }] as const).map(field => <div key={field.key}><Label htmlFor={field.key}>{field.label}</Label><Textarea id={field.key} value={p.anamnesis[field.key]} onChange={event => update(v => ({ ...v, anamnesis: { ...v.anamnesis, [field.key]: event.target.value } }))} /></div>)}</div></details>
      </div>}
      {step === "chart" && draft.patient_id && <div data-guide="chart-fields" className="space-y-4">{!draft.appointment_id && <p className="text-sm text-destructive">Inicie a consulta na etapa Paciente para vincular os procedimentos deste atendimento.</p>}<DentalChartView patientId={draft.patient_id} appointmentId={draft.appointment_id} professionalName={active?.doctor_name || p.appointment.doctor_name} encounterForm={p.chart_form} onEncounterFormChange={form => update(v => ({ ...v, chart_form: form }))} hideHistory /></div>}
      {step === "budget" && <BudgetSection
        items={p.budget.items}
        paymentMethod={p.budget.payment_method}
        signed={Boolean(draft.signed_document_id)}
        importing={importing}
        onImport={() => void importTreatments()}
        onDiscount={(indices, value) => update(v => ({ ...v, budget: { ...v.budget, items: applyBudgetGroupDiscount(v.budget.items, indices, value) } }))}
        onRemove={indices => update(v => ({ ...v, budget: { ...v.budget, items: v.budget.items.filter((_, index) => !indices.includes(index)) } }))}
        onPaymentChange={value => update(v => ({ ...v, budget: { ...v.budget, payment_method: value } }))}
      />}
      {step === "signature" && <div className="space-y-4"><div data-guide="document-preview"><p className="mb-2 font-medium">{document ? "Proposta assinada" : "Proposta de tratamento"}</p><pre className="max-h-80 overflow-y-auto whitespace-pre-wrap break-words rounded-lg border bg-muted/30 p-3 font-sans text-sm">{document?.content || preview}</pre></div>{draft.signed_document_id ? <><p>Assinada em {document ? new Date(document.signed_at).toLocaleString("pt-BR", { timeZone: "America/Fortaleza" }) : "…"}.</p><Button asChild variant="outline"><Link target="_blank" href={`/api/encounters/${id}/document?format=html`}>Abrir proposta assinada para imprimir</Link></Button></> : <><div data-guide="signature-pad"><SignaturePad key={`${id}-${step}`} onChange={setSignature} /><p className="mt-2 text-xs text-muted-foreground">Assinatura desenhada na tela. Não é certificação digital.</p></div><label className="flex min-h-11 items-start gap-3 rounded-lg border p-3"><input type="checkbox" className="mt-1 h-5 w-5 shrink-0" checked={agreement} onChange={event => setAgreement(event.target.checked)} /><span className="text-sm">O paciente leu esta proposta, pôde esclarecer dúvidas e confirma sua concordância com o texto e os valores.</span></label></>}</div>}
      {step === "financial" && <div data-guide="financial-fields" className="space-y-4">{!draft.signed_document_id && <p className="text-destructive">A proposta precisa ser assinada antes do encaminhamento.</p>}{active?.status !== "Em Andamento" && active?.status !== "Concluída" && <p className="text-destructive">Inicie a consulta na etapa Paciente.</p>}<p>A proposta totaliza {money(total)}. Confirme quanto deve ser cobrado <strong>nesta consulta</strong>. O recebimento será registrado pelo financeiro no fluxo atual.</p><div><Label htmlFor="settlement">Valor desta consulta (R$)</Label><Input id="settlement" type="number" inputMode="decimal" min="0.01" step="0.01" value={p.settlement_amount} onChange={event => update(v => ({ ...v, settlement_amount: Number(event.target.value) }))} /></div><p className="text-sm text-muted-foreground">O encerramento também confirma no prontuário as últimas observações e respostas deste atendimento.</p>{access?.permissions?.financeiro === false && <p className="text-sm">Após o encaminhamento, uma pessoa com acesso ao financeiro poderá registrar o recebimento.</p>}</div>}
    </fieldset>
    {(step !== "patient" || !draft.patient_id || Boolean(draft.appointment_id) || Boolean(patientChoice)) && <div className="encounter-actions flex flex-row gap-2 rounded-xl border bg-card p-3">
      {(step !== "patient" || (!draft.patient_id && registrationStage > 0) || (draft.patient_id && patientChoice)) && <Button type="button" className="min-h-12 min-w-0 flex-1 sm:min-w-28 sm:flex-none" disabled={locked || busy} onClick={() => { if (step !== "patient") void changeStep(steps[Math.max(0, steps.indexOf(step) - 1)]); else if (!draft.patient_id) setRegistrationStage(stage => stage - 1); else { setPatientChoice(null); setAppointmentId(""); setScheduling(false) } }}>Voltar</Button>}
      <Button data-guide="primary-action" className="min-h-12 min-w-0 flex-1 whitespace-normal" disabled={locked || busy || importing || (step === "signature" && !draft.signed_document_id && (!signature || !agreement || !patient || !draft.appointment_id)) || (step === "financial" && (!draft.signed_document_id || !draft.appointment_id))} onClick={() => void primary()}>{busy ? "Confirmando…" : step === "patient" && !draft.patient_id && !selectedPatient && registrationStage < registrationFields.length - 1 ? "Próxima informação" : primaryLabel}</Button>
    </div>}
    <Dialog open={shareKind !== null} onOpenChange={open => { if (!open) { setShareKind(null); setShareFile(null) } }}><DialogContent><DialogHeader><DialogTitle>Compartilhar {shareKind === "record" ? "prontuário e orçamento" : "proposta"}</DialogTitle><DialogDescription>Revise o destinatário e o arquivo antes de enviar. No celular, escolha o aplicativo de mensagens ou e-mail. Se o compartilhamento de arquivos não estiver disponível, o PDF será baixado para você anexar.{shareKind === "proposal" && draft.signed_document_id ? " Este PDF não inclui a assinatura desenhada; use Imprimir proposta assinada para obter a cópia assinada." : ""}</DialogDescription></DialogHeader><Button disabled={!shareFile} onClick={shareReadyFile}>{shareFile ? "Compartilhar PDF" : "Preparando PDF…"}</Button>{shareFile && <Button variant="outline" onClick={() => saveFile(shareFile)}>Baixar PDF</Button>}</DialogContent></Dialog>
    <Dialog open={govHelp} onOpenChange={setGovHelp}><DialogContent><DialogHeader><DialogTitle>Assinatura pelo gov.br</DialogTitle><DialogDescription>Salve a proposta em PDF e envie o arquivo ao paciente. Ele pode assinar com a conta gov.br no portal oficial e devolver o PDF assinado à clínica. Depois, anexe o PDF devolvido aos documentos do paciente. A assinatura acontece fora do SyncOdonto.</DialogDescription></DialogHeader><div className="flex flex-col gap-2"><Button onClick={() => void downloadPdf("proposal")}>Baixar proposta em PDF</Button><Button asChild variant="outline"><a href="https://assinador.iti.br/" target="_blank" rel="noopener noreferrer">Abrir portal de assinatura gov.br</a></Button></div></DialogContent></Dialog>
    <Dialog open={exams} onOpenChange={setExams}><DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-3xl"><DialogHeader><DialogTitle>Exames do paciente</DialogTitle><DialogDescription>Adicione exames sem reiniciar o atendimento. Feche para voltar à mesma etapa.</DialogDescription></DialogHeader>{draft.patient_id && <AttachedExams patientId={draft.patient_id} />}</DialogContent></Dialog>
    <Dialog open={confirm !== null} onOpenChange={open => { if (!open) setConfirm(null) }}><DialogContent><DialogHeader><DialogTitle>{confirm === "complete" ? "Confirmar encerramento e cobrança" : confirm === "reload" ? "Usar a versão salva no servidor?" : "Descartar este rascunho?"}</DialogTitle><DialogDescription>{confirm === "complete" ? `Uma única pendência de ${money(p.settlement_amount)} será vinculada à consulta. O recebimento ainda precisará ser registrado no financeiro.` : confirm === "reload" ? "Os campos que não foram salvos nesta aba serão substituídos pela versão mais recente. Confira e copie o que precisar antes de continuar." : "Os campos do rascunho serão apagados. Cadastros, consultas e registros já confirmados serão preservados."}</DialogDescription></DialogHeader><Button disabled={busy} className="min-h-12" onClick={() => { if (confirm === "reload") { setConfirm(null); setSignature(null); setAgreement(false); void reload() } else if (confirm) void run(confirm, { confirmed: true }) }}>{confirm === "complete" ? "Confirmar e encaminhar cobrança" : confirm === "reload" ? "Carregar versão salva" : "Confirmar descarte"}</Button><Button variant="outline" className="min-h-11" disabled={busy} onClick={() => setConfirm(null)}>Voltar sem confirmar</Button></DialogContent></Dialog>
  </section>
}
