"use client"
import { useState } from "react"
import Link from "next/link"
import useSWR from "swr"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DentalChartView } from "@/components/dental-chart/dental-chart-view"
import { AttachedExams } from "@/components/medical-records/attached-exams"
import { QUESTION_GROUPS } from "@/components/medical-records/anamnesis-section"
import { SignaturePad } from "@/components/documents/signature-pad"
import { PatientCombobox, type PatientOption } from "@/components/documents/patient-combobox"
import { usePatient } from "@/lib/hooks/use-data"
import { useEncounter } from "@/lib/encounters/use-encounter"
import { encounterRequest } from "@/lib/encounters/client"
import { budgetContent, budgetTotal, mergeTreatments, stepLabels, steps, type EncounterStep, type BudgetItem } from "@/lib/encounters/model"
import { ContextualHelp, type GuideStep } from "./contextual-help"
import { operationalNow } from "./encounter-entry"

const money = (amount: number) => amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
const QUICK_QUESTIONS = [
  "Tem alergia a medicamento, alimento ou material odontológico?",
  "Usa algum medicamento atualmente?",
  "Está em tratamento médico atualmente?",
  "Tem problemas de coagulação ou já teve sangramento excessivo?",
  "Já teve reação alérgica a anestesia odontológica?",
] as const
const quickQuestionSet = new Set<string>(QUICK_QUESTIONS)
const guides: Record<EncounterStep, GuideStep[]> = {
  patient: [{ selector: "[data-guide='patient-fields']", title: "Confirme o paciente", description: "Busque um cadastro ou complete nome, nascimento e CPF. Os campos são salvos durante a edição." }, { selector: "[data-guide='primary-action']", title: "Atender ou agendar", description: "Escolha uma consulta existente para reaproveitar o horário. Atender agora inicia a consulta; agendar reserva o horário informado." }],
  anamnesis: [{ selector: "[data-guide='anamnesis-fields']", title: "Saúde antes dos procedimentos", description: "Registre a queixa e as respostas. Alergias, medicamentos e respostas positivas continuam visíveis nas próximas etapas." }, { selector: "[data-guide='primary-action']", title: "Continue quando estiver pronta", description: "O rascunho salva durante a edição. Você pode voltar ou abrir outra função pelo seletor de etapa." }],
  chart: [{ selector: "[data-guide='chart-fields']", title: "Dentes e procedimentos", description: "Selecione dentes e regiões e use o catálogo da clínica. Os procedimentos adicionados serão aproveitados no orçamento." }, { selector: "[data-guide='exam-access']", title: "Exames a qualquer momento", description: "Abra os exames quando chegarem, mesmo durante outra etapa. Ao fechar, você continua neste ponto." }],
  budget: [{ selector: "[data-guide='budget-fields']", title: "Revise a proposta", description: "Importe os procedimentos deste atendimento. Confira dentes, regiões, valores e descontos antes de apresentar a proposta." }],
  signature: [{ selector: "[data-guide='document-preview']", title: "Esta é a proposta a assinar", description: "Mostre o texto completo e os valores ao paciente. A assinatura fica vinculada a esta versão, que não poderá ser alterada." }, { selector: "[data-guide='signature-pad']", title: "Assine na tela", description: "A pessoa pode assinar com o dedo. Confirme a concordância antes de tocar em Assinar proposta. O sistema registra uma assinatura desenhada, sem certificação digital." }],
  financial: [{ selector: "[data-guide='financial-fields']", title: "Confirme o valor desta consulta", description: "A proposta pode incluir várias sessões. Revise o valor a cobrar nesta consulta antes de confirmar o encerramento. Uma pendência será enviada ao financeiro." }],
}
type AppointmentOption = { id: string; date: string; time: string; status: string; doctor_name: string; cost: number | null }
type SignedDocument = { id: string; content: string; signature_data: string; encounter_revision: number; snapshot_hash: string; signed_at: string }

export function EncounterEditor({ id }: { id: string }) {
  const { draft, saveState, message, actionMessage, busy, update, go, flush, action, reload } = useEncounter(id)
  const { patient, error: patientError } = usePatient(draft?.patient_id || null)
  const { data: appointmentRes, error: appointmentError } = useSWR(draft?.patient_id ? `/api/appointments?patientId=${draft.patient_id}` : null, encounterRequest)
  const { data: anamnesisRes, error: anamnesisError } = useSWR(draft?.patient_id ? `/api/anamnesis?patientId=${draft.patient_id}` : null, encounterRequest)
  const { data: access } = useSWR("/api/auth/check-access", encounterRequest)
  const { data: signed } = useSWR(draft?.signed_document_id ? `/api/encounters/${id}/document` : null, encounterRequest)
  const document = signed?.data as SignedDocument | undefined
  const [selectedPatient, setSelectedPatient] = useState<PatientOption | null>(null)
  const [exams, setExams] = useState(false)
  const [signature, setSignature] = useState<string | null>(null)
  const [agreement, setAgreement] = useState(false)
  const [confirm, setConfirm] = useState<"complete" | "discard" | "reload" | null>(null)
  const [importing, setImporting] = useState(false)
  const run = async (name: string, input: Record<string, unknown> = {}) => {
    try { const result = await action(name, input); if (result) { toast.success(name === "complete" ? "Consulta concluída. Pendência enviada ao financeiro." : name === "sign" ? "Proposta assinada. Confira o valor da consulta." : name === "schedule" ? "Horário agendado. O atendimento continua disponível para retomar." : name === "publish" ? "Registro confirmado no prontuário." : "Alteração confirmada."); setSignature(null); setAgreement(false); setConfirm(null) } return result }
    catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível concluir."); return null }
  }
  const changeStep = async (step: EncounterStep) => {
    if (step !== "signature") { setSignature(null); setAgreement(false) }
    try { await go(step) } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível salvar.") }
  }
  if (!draft) return <div role="status" className="space-y-3"><p>{saveState === "loading" ? "Carregando atendimento…" : message}</p>{saveState !== "loading" && <Button onClick={() => void reload()}>Tentar novamente</Button>}</div>
  if (draft.status !== "active") return <section className="mx-auto max-w-xl space-y-4"><h1 className="text-2xl font-bold">{draft.status === "completed" ? "Atendimento concluído" : "Rascunho descartado"}</h1><p>{draft.status === "completed" ? "Os registros clínicos e a proposta assinada foram preservados. A cobrança está vinculada à consulta." : "O descarte foi solicitado explicitamente. Cadastros, consultas e registros já confirmados foram preservados."}</p>{draft.status === "completed" && access?.permissions?.financeiro && <Button asChild><Link href={`/financeiro?appointmentId=${draft.appointment_id}`}>Conferir cobrança e registrar recebimento</Link></Button>}{draft.signed_document_id && <Button asChild variant="outline"><Link href={`/api/encounters/${id}/document?format=html`} target="_blank">Ver proposta assinada</Link></Button>}<Button asChild variant="outline"><Link href="/atendimento">Iniciar outro atendimento</Link></Button></section>
  const p = draft.payload
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
  for (const answer of [...priorAnswers, ...p.anamnesis.answers]) if (answer.answer === "sim") {
    const alert = `${answer.question}${answer.observation ? ` — ${answer.observation}` : ""}`
    if (!alerts.includes(alert)) alerts.push(alert)
  }
  const preview = budgetContent(patient?.full_name || "Paciente", p)
  const total = budgetTotal(p.budget.items)
  const editItem = (index: number, field: keyof BudgetItem, value: string | number) => update(v => ({ ...v, budget: { ...v.budget, items: v.budget.items.map((item, i) => i === index ? { ...item, [field]: value } : item) } }))
  const questionInput = (question: string) => {
    const answer = p.anamnesis.answers.find(item => item.question === question) || { question, answer: null, observation: "" }
    const change = (patch: Partial<typeof answer>) => update(value => {
      const previous = value.anamnesis.answers.find(item => item.question === question) || { question, answer: null, observation: "" }
      return { ...value, anamnesis: { ...value.anamnesis, answers: [...value.anamnesis.answers.filter(item => item.question !== question), { ...previous, ...patch }] } }
    })
    return <div key={question} className="space-y-2 border-t pt-3"><p className="text-sm">{question}</p><div className="flex flex-wrap gap-2"><Button type="button" aria-pressed={answer.answer === "sim"} className="min-h-11" variant={answer.answer === "sim" ? "default" : "outline"} onClick={() => change({ answer: "sim" })}>Sim</Button><Button type="button" aria-pressed={answer.answer === "nao"} className="min-h-11" variant={answer.answer === "nao" ? "default" : "outline"} onClick={() => change({ answer: "nao" })}>Não</Button><Button type="button" className="min-h-11" variant="ghost" onClick={() => change({ answer: null })}>Depois</Button></div><Input aria-label={`Detalhes: ${question}`} placeholder="Detalhes, medicamentos ou observação" value={answer.observation} onChange={event => change({ observation: event.target.value })} /></div>
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
  const primaryLabel = step === "patient" ? !draft.patient_id ? selectedPatient ? "Usar este paciente" : "Cadastrar e continuar" : scheduling ? "Confirmar agendamento" : active?.status === "Em Andamento" ? "Continuar atendimento" : "Atender agora" : step === "signature" ? draft.signed_document_id ? "Ir para o financeiro" : "Assinar proposta" : step === "financial" ? "Concluir e encaminhar cobrança" : `Continuar: ${stepLabels[next[step]].toLowerCase()}`
  async function primary() {
    if (step === "patient") {
      if (!draft!.patient_id && !selectedPatient) {
        if (p.registration.full_name.trim().length < 2) return toast.error("Informe o nome completo do paciente.")
        if (!p.registration.date_of_birth) return toast.error("Informe a data de nascimento.")
        if (!/^\d{11}$|^\d{3}\.\d{3}\.\d{3}-\d{2}$/.test(p.registration.cpf)) return toast.error("Informe o CPF com 11 dígitos.")
      }
      if (draft!.patient_id && !appointmentId && !draft!.appointment_id && p.appointment.doctor_name.trim().length < 2) return toast.error("Informe o profissional responsável.")
      if (draft!.patient_id && !scheduling && !appointmentId && !draft!.appointment_id) update(v => ({ ...v, appointment: { ...v.appointment, ...operationalNow() } }))
      if (!draft!.patient_id) await run(selectedPatient ? "choose_patient" : "register", selectedPatient ? { patient_id: selectedPatient.id } : {})
      else if (active?.status === "Em Andamento") await changeStep("anamnesis")
      else await run(scheduling ? "schedule" : "start", appointmentId ? { appointment_id: appointmentId } : {})
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
  return <section className="encounter-editor mx-auto max-w-4xl space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><div className="min-w-0"><p className="text-sm text-muted-foreground">Atendimento em andamento</p><h1 className="break-words text-2xl font-bold">{patient?.full_name || "Identificar paciente"}</h1></div><ContextualHelp key={step} area={`encounter-${step}`} steps={guides[step]} /></div>
    {(patientError || anamnesisError) && <p role="alert" className="rounded-lg border border-destructive p-3 text-sm text-destructive">Não foi possível consultar todos os dados de saúde e alertas do paciente. Confira a conexão e o prontuário antes de continuar os procedimentos.</p>}
    <div className="space-y-2" aria-live="polite"><p className={saveState === "error" || saveState === "conflict" ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>{saveState === "saving" ? "Salvando…" : saveState === "saved" ? "Rascunho salvo" : saveState === "conflict" ? "Outra aba alterou este atendimento. Sua edição não foi enviada." : saveState === "error" ? "Não foi possível salvar. Mantenha esta tela aberta e tente novamente." : "Carregando…"}</p>{message && <p role="alert" className="text-sm text-destructive">{message}</p>}{actionMessage && <p role="alert" className="text-sm text-destructive">{actionMessage}</p>}{saveState === "error" && <Button variant="outline" onClick={() => void flush().catch(() => undefined)}>Tentar salvar novamente</Button>}{saveState === "conflict" && <Button variant="outline" onClick={() => setConfirm("reload")}>Revisar versão salva</Button>}</div>
    <div className="flex flex-wrap items-end gap-2"><div className="min-w-0 flex-1"><Label htmlFor="encounter-step">Ir diretamente para uma etapa</Label><select id="encounter-step" className="mt-1 min-h-11 w-full rounded-md border bg-background px-3" value={step} disabled={locked} onChange={event => void changeStep(event.target.value as EncounterStep)}>{steps.map((s, index) => <option key={s} value={s} disabled={!draft.patient_id && s !== "patient"}>{index + 1}. {stepLabels[s]}</option>)}</select></div>{draft.patient_id && <Button data-guide="exam-access" variant="outline" className="min-h-11" onClick={() => setExams(true)}>Exames</Button>}</div>
    {alerts.length > 0 && step !== "patient" && <aside aria-label="Alertas clínicos" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-950"><p className="font-semibold">Atenção clínica</p><ul className="mt-1 list-disc space-y-1 pl-5 text-sm">{alerts.map(alert => <li key={alert}>{alert}</li>)}</ul></aside>}
    <fieldset disabled={locked} className="min-w-0 space-y-4 rounded-xl border bg-card p-4 sm:p-5">
      <legend className="px-2 font-semibold">{stepLabels[step]}</legend>
      {step === "signature" && active?.status !== "Em Andamento" && !draft.signed_document_id && <p className="text-sm text-destructive">Inicie a consulta na etapa Paciente antes de coletar e confirmar a assinatura.</p>}
      {step === "patient" && <div data-guide="patient-fields" className="space-y-4">
        {!draft.patient_id ? <><Label>Paciente já cadastrado</Label><PatientCombobox value={selectedPatient} onChange={setSelectedPatient} />{!selectedPatient && <div className="grid gap-3 sm:grid-cols-2">{([{ key: "full_name", label: "Nome completo *", type: "text" }, { key: "date_of_birth", label: "Data de nascimento *", type: "date" }, { key: "cpf", label: "CPF *", type: "text" }, { key: "phone", label: "Telefone (opcional)", type: "tel" }] as const).map(field => <div key={field.key} className="space-y-1"><Label htmlFor={field.key}>{field.label}</Label><Input id={field.key} type={field.type} inputMode={field.key === "cpf" ? "numeric" : undefined} value={p.registration[field.key]} onChange={event => update(v => ({ ...v, registration: { ...v.registration, [field.key]: event.target.value } }))} /></div>)}</div>}</> : <>
          <p>Paciente identificado. {active ? `Consulta: ${active.date} às ${active.time.slice(0, 5)} · ${active.doctor_name}` : "Escolha atender agora ou agendar horário."}</p>
          {appointmentError && <p role="alert" className="text-destructive">Não foi possível consultar os horários. Tente novamente antes de iniciar.</p>}
          {!draft.appointment_id && available.length > 0 && <div className="space-y-1"><Label htmlFor="existing-appointment">Aproveitar consulta já agendada</Label><select id="existing-appointment" className="min-h-11 w-full rounded-md border bg-background px-3" value={appointmentId} onChange={event => setAppointmentId(event.target.value)}><option value="">Novo horário</option>{available.map(a => <option key={a.id} value={a.id}>{a.date} · {a.time.slice(0, 5)} · {a.doctor_name} · {a.status}</option>)}</select></div>}
          {!appointmentId && !draft.appointment_id && <div className="grid gap-3 sm:grid-cols-2"><div className="space-y-1 sm:col-span-2"><Label htmlFor="professional">Profissional responsável *</Label><Input id="professional" value={p.appointment.doctor_name} onChange={event => update(v => ({ ...v, appointment: { ...v.appointment, doctor_name: event.target.value } }))} /></div><div><Label htmlFor="appointment-date">Data *</Label><Input id="appointment-date" type="date" value={p.appointment.date} onChange={event => update(v => ({ ...v, appointment: { ...v.appointment, date: event.target.value } }))} /></div><div><Label htmlFor="appointment-time">Horário *</Label><Input id="appointment-time" type="time" value={p.appointment.time} onChange={event => update(v => ({ ...v, appointment: { ...v.appointment, time: event.target.value } }))} /></div><div><Label htmlFor="duration">Duração em minutos</Label><Input id="duration" type="number" min={5} max={720} value={p.appointment.duration_minutes} onChange={event => update(v => ({ ...v, appointment: { ...v.appointment, duration_minutes: Number(event.target.value) } }))} /></div></div>}
          {draft.appointment_id && active?.status !== "Em Andamento" && <p className="text-sm text-muted-foreground">Horário reservado. Toque em Atender agora quando o atendimento começar.</p>}
        </>}
      </div>}
      {step === "anamnesis" && <div data-guide="anamnesis-fields" className="space-y-4"><div><Label htmlFor="complaint">O que trouxe o paciente hoje?</Label><Textarea id="complaint" value={p.anamnesis.chief_complaint} onChange={event => update(v => ({ ...v, anamnesis: { ...v.anamnesis, chief_complaint: event.target.value } }))} /></div>
        <section aria-labelledby="quick-history-title" className="space-y-3 rounded-lg border border-primary/30 bg-primary/5 p-3"><div><h2 id="quick-history-title" className="font-semibold">Cinco perguntas iniciais</h2><p className="text-xs text-muted-foreground">Registre o que já souber. As demais perguntas continuam logo abaixo.</p></div>{QUICK_QUESTIONS.map(questionInput)}</section>
        {QUESTION_GROUPS.map(group => <details key={group.group} className="rounded-lg border p-3"><summary className="min-h-11 cursor-pointer font-semibold">{group.group}</summary><div className="space-y-3">{group.questions.filter(question => !quickQuestionSet.has(question)).map(questionInput)}</div></details>)}
        {([{ key: "additional_notes", label: "Outros medicamentos e alertas" }, { key: "diagnosis", label: "Diagnóstico" }, { key: "treatment_plan", label: "Plano de tratamento" }] as const).map(field => <div key={field.key}><Label htmlFor={field.key}>{field.label}</Label><Textarea id={field.key} value={p.anamnesis[field.key]} onChange={event => update(v => ({ ...v, anamnesis: { ...v.anamnesis, [field.key]: event.target.value } }))} /></div>)}
        <Button variant="outline" disabled={locked || busy} onClick={() => void run("publish")}>{busy ? "Confirmando registro…" : "Confirmar registro no prontuário"}</Button><p className="text-xs text-muted-foreground">Respostas não informadas ficam como pendentes no rascunho.</p>
      </div>}
      {step === "chart" && draft.patient_id && <div data-guide="chart-fields" className="space-y-4">{!draft.appointment_id && <p className="text-sm text-destructive">Inicie a consulta na etapa Paciente para vincular os procedimentos deste atendimento.</p>}<DentalChartView patientId={draft.patient_id} appointmentId={draft.appointment_id} professionalName={active?.doctor_name || p.appointment.doctor_name} encounterForm={p.chart_form} onEncounterFormChange={form => update(v => ({ ...v, chart_form: form }))} /><div><Label htmlFor="clinical-notes">Observações clínicas</Label><Textarea id="clinical-notes" value={p.clinical_notes} onChange={event => update(v => ({ ...v, clinical_notes: event.target.value }))} /></div><div><Label htmlFor="planning">Planejamento e próximos cuidados</Label><Textarea id="planning" value={p.planning} onChange={event => update(v => ({ ...v, planning: event.target.value }))} /></div></div>}
      {step === "budget" && <div data-guide="budget-fields" className="space-y-4">{draft.signed_document_id ? <p>Esta proposta já foi assinada. Seus valores e itens estão preservados.</p> : <><Button variant="outline" disabled={importing} onClick={() => void importTreatments()}>{importing ? "Buscando procedimentos…" : "Trazer procedimentos do odontograma"}</Button>{p.budget.items.map((item, index) => <div key={item.source_id || `manual-${index}`} className="grid gap-3 rounded-lg border p-3 sm:grid-cols-2"><div><Label htmlFor={`procedure-${index}`}>Procedimento</Label><Input id={`procedure-${index}`} value={item.procedure} onChange={event => editItem(index, "procedure", event.target.value)} /></div><div><Label htmlFor={`region-${index}`}>Dente ou região</Label><Input id={`region-${index}`} value={item.region} onChange={event => editItem(index, "region", event.target.value)} /></div><div><Label htmlFor={`value-${index}`}>Valor (R$)</Label><Input id={`value-${index}`} type="number" inputMode="decimal" min={0} step="0.01" value={item.unitValue} onChange={event => editItem(index, "unitValue", Number(event.target.value))} /></div><div><Label htmlFor={`discount-${index}`}>Desconto (R$)</Label><Input id={`discount-${index}`} type="number" inputMode="decimal" min={0} max={item.unitValue} step="0.01" value={item.discount} onChange={event => editItem(index, "discount", Number(event.target.value))} /></div><Button variant="ghost" className="min-h-11 sm:col-span-2" onClick={() => update(v => ({ ...v, budget: { ...v.budget, items: v.budget.items.filter((_, i) => i !== index) } }))}>Remover item</Button></div>)}<Button variant="outline" className="min-h-11" onClick={() => update(v => ({ ...v, budget: { ...v.budget, items: [...v.budget.items, { source_id: null, procedure: "", region: "", unitValue: 0, discount: 0 }] } }))}>Adicionar item</Button><div><Label htmlFor="payment">Pagamento previsto</Label><select id="payment" className="min-h-11 w-full rounded-md border bg-background px-3" value={p.budget.payment_method} onChange={event => update(v => ({ ...v, budget: { ...v.budget, payment_method: event.target.value } }))}>{["A combinar", "Pix", "Cartão de crédito", "Cartão de débito", "Dinheiro", "Parcelado"].map(method => <option key={method}>{method}</option>)}</select></div></>}<p className="text-xl font-semibold">Total da proposta: {money(total)}</p></div>}
      {step === "signature" && <div className="space-y-4"><div data-guide="document-preview"><p className="mb-2 font-medium">{document ? `Proposta assinada · versão ${document.encounter_revision}` : `Proposta de tratamento · versão salva ${draft.revision}`}</p><pre className="max-h-80 overflow-y-auto whitespace-pre-wrap break-words rounded-lg border bg-muted/30 p-3 font-sans text-sm">{document?.content || preview}</pre></div>{draft.signed_document_id ? <><p>Assinada em {document ? new Date(document.signed_at).toLocaleString("pt-BR", { timeZone: "America/Fortaleza" }) : "…"}.</p><Button asChild variant="outline"><Link target="_blank" href={`/api/encounters/${id}/document?format=html`}>Abrir proposta assinada para imprimir</Link></Button></> : <><div data-guide="signature-pad"><SignaturePad key={`${id}-${step}`} onChange={setSignature} /><p className="mt-2 text-xs text-muted-foreground">Assinatura desenhada na tela. Não é certificação digital.</p></div><label className="flex min-h-11 items-start gap-3 rounded-lg border p-3"><input type="checkbox" className="mt-1 h-5 w-5 shrink-0" checked={agreement} onChange={event => setAgreement(event.target.checked)} /><span className="text-sm">O paciente leu esta proposta, pôde esclarecer dúvidas e confirma sua concordância com o texto e os valores.</span></label></>}</div>}
      {step === "financial" && <div data-guide="financial-fields" className="space-y-4">{!draft.signed_document_id && <p className="text-destructive">A proposta precisa ser assinada antes do encaminhamento.</p>}{active?.status !== "Em Andamento" && active?.status !== "Concluída" && <p className="text-destructive">Inicie a consulta na etapa Paciente.</p>}<p>A proposta totaliza {money(total)}. Confirme quanto deve ser cobrado <strong>nesta consulta</strong>. O recebimento será registrado pelo financeiro no fluxo atual.</p><div><Label htmlFor="settlement">Valor desta consulta (R$)</Label><Input id="settlement" type="number" inputMode="decimal" min="0.01" step="0.01" value={p.settlement_amount} onChange={event => update(v => ({ ...v, settlement_amount: Number(event.target.value) }))} /></div><p className="text-sm text-muted-foreground">O encerramento também confirma no prontuário as últimas observações e respostas deste atendimento.</p>{access?.permissions?.financeiro === false && <p className="text-sm">Após o encaminhamento, uma pessoa com acesso ao financeiro poderá registrar o recebimento.</p>}</div>}
    </fieldset>
    <div className="encounter-actions sticky bottom-0 z-20 grid gap-2 rounded-xl border bg-card/95 p-3 shadow-lg backdrop-blur"><Button data-guide="primary-action" className="min-h-12 w-full whitespace-normal" disabled={locked || busy || importing || (step === "signature" && !draft.signed_document_id && (!signature || !agreement || !patient || !draft.appointment_id || active?.status !== "Em Andamento")) || (step === "financial" && (!draft.signed_document_id || !draft.appointment_id))} onClick={() => void primary()}>{busy ? "Confirmando…" : primaryLabel}</Button>{step === "patient" && draft.patient_id && !draft.appointment_id ? <div className="grid grid-cols-2 gap-2"><Button variant="outline" className="min-h-11" disabled={locked || busy} onClick={() => { setScheduling(!scheduling); if (!scheduling) { const now = operationalNow(); update(v => ({ ...v, appointment: { ...v.appointment, ...now } })) } }}>{scheduling ? "Atender agora" : "Agendar horário"}</Button><Button variant="ghost" className="min-h-11" disabled={locked || busy} onClick={() => void changeStep("anamnesis")}>Preparar ficha</Button></div> : step !== "patient" && <Button variant="outline" className="min-h-11" disabled={locked || busy} onClick={() => void changeStep(steps[Math.max(0, steps.indexOf(step) - 1)])}>Voltar</Button>}</div>
    <Dialog open={exams} onOpenChange={setExams}><DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-3xl"><DialogHeader><DialogTitle>Exames do paciente</DialogTitle><DialogDescription>Adicione exames sem reiniciar o atendimento. Feche para voltar à mesma etapa.</DialogDescription></DialogHeader>{draft.patient_id && <AttachedExams patientId={draft.patient_id} />}</DialogContent></Dialog>
    <Dialog open={confirm !== null} onOpenChange={open => { if (!open) setConfirm(null) }}><DialogContent><DialogHeader><DialogTitle>{confirm === "complete" ? "Confirmar encerramento e cobrança" : confirm === "reload" ? "Usar a versão salva no servidor?" : "Descartar este rascunho?"}</DialogTitle><DialogDescription>{confirm === "complete" ? `Uma única pendência de ${money(p.settlement_amount)} será vinculada à consulta. O recebimento ainda precisará ser registrado no financeiro.` : confirm === "reload" ? "Os campos que não foram salvos nesta aba serão substituídos pela versão mais recente. Confira e copie o que precisar antes de continuar." : "Os campos do rascunho serão apagados. Cadastros, consultas e registros já confirmados serão preservados."}</DialogDescription></DialogHeader><Button disabled={busy} className="min-h-12" onClick={() => { if (confirm === "reload") { setConfirm(null); setSignature(null); setAgreement(false); void reload() } else if (confirm) void run(confirm, { confirmed: true }) }}>{confirm === "complete" ? "Confirmar e encaminhar cobrança" : confirm === "reload" ? "Carregar versão salva" : "Confirmar descarte"}</Button><Button variant="outline" className="min-h-11" disabled={busy} onClick={() => setConfirm(null)}>Voltar sem confirmar</Button></DialogContent></Dialog>
  </section>
}
