import { budgetContent, type EncounterPayload } from "./model"

const escape = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!)

function page(title: string, sections: { heading: string; content: string }[]) {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escape(title)}</title><style>body{font:16px/1.5 system-ui,sans-serif;color:#17212b;max-width:800px;margin:0 auto;padding:24px;overflow-wrap:anywhere}pre{white-space:pre-wrap;font:inherit}section{break-inside:avoid;margin-top:28px}h1{font-size:24px}h2{font-size:18px;border-bottom:1px solid #aaa}.hint{font-size:14px;color:#555}@media print{body{padding:0}.hint{display:none}}@page{margin:20mm}</style></head><body><p class="hint">Use a opção Imprimir do navegador para imprimir ou salvar em PDF.</p><h1>${escape(title)}</h1>${sections.map(section => `<section><h2>${escape(section.heading)}</h2><pre>${escape(section.content)}</pre></section>`).join("")}</body></html>`
}

export function proposalPrintHtml(name: string, payload: EncounterPayload) {
  return page(`Proposta de tratamento — ${name}`, [{ heading: "Orçamento para assinatura", content: budgetContent(name, payload) + "\n\nAssinatura: ____________________________________" }])
}

type Patient = { full_name: string; date_of_birth?: string | null; cpf?: string | null; phone?: string | null; email?: string | null; allergies?: string | null; medications?: string | null; pre_existing_conditions?: string | null }
type Anamnesis = { chief_complaint?: string | null; answers?: { question: string; answer: string | null; observation?: string | null }[] | null; diagnosis?: string | null; treatment_plan?: string | null; additional_notes?: string | null; created_at?: string | null }
type ClinicalRecord = { title?: string | null; description?: string | null; content?: string | null; record_date?: string | null; created_at?: string | null }
type Tooth = { tooth_number: number; condition?: string | null; notes?: string | null }
type Exam = { title?: string | null; description?: string | null }

export function recordPrintSections(input: { patient: Patient; payload: EncounterPayload; anamneses: Anamnesis[]; records: ClinicalRecord[]; teeth: Tooth[]; exams: Exam[]; consents: Exam[]; signedContent?: string | null }) {
  const { patient, payload } = input
  const sections = [
    { heading: "Paciente", content: [`Nome: ${patient.full_name}`, `Nascimento: ${patient.date_of_birth || "Não informado"}`, `CPF: ${patient.cpf || "Não informado"}`, `Telefone: ${patient.phone || "Não informado"}`, `E-mail: ${patient.email || "Não informado"}`, `Alergias: ${patient.allergies || "Não registradas"}`, `Medicamentos: ${patient.medications || "Não registrados"}`, `Condições preexistentes: ${patient.pre_existing_conditions || "Não registradas"}`].join("\n") },
    { heading: "Anamnese deste atendimento", content: [`Queixa: ${payload.anamnesis.chief_complaint || "Não registrada"}`, ...payload.anamnesis.answers.map(answer => `${answer.question}: ${answer.answer || "Não respondida"}${answer.observation ? ` — ${answer.observation}` : ""}`), `Diagnóstico: ${payload.anamnesis.diagnosis || "Não registrado"}`, `Plano de tratamento: ${payload.anamnesis.treatment_plan || "Não registrado"}`, `Outras observações: ${payload.anamnesis.additional_notes || "Não registradas"}`].join("\n") },
    { heading: "Notas deste atendimento", content: [`Observações clínicas: ${payload.clinical_notes || "Não registradas"}`, `Planejamento: ${payload.planning || "Não registrado"}`].join("\n") },
    { heading: "Anamneses anteriores", content: input.anamneses.length ? input.anamneses.map(record => [`Data: ${record.created_at?.slice(0, 10) || "Não informada"}`, `Queixa: ${record.chief_complaint || "Não registrada"}`, ...(record.answers || []).map(answer => `${answer.question}: ${answer.answer || "Não respondida"}${answer.observation ? ` — ${answer.observation}` : ""}`), `Diagnóstico: ${record.diagnosis || "Não registrado"}`, `Plano: ${record.treatment_plan || "Não registrado"}`].join("\n")).join("\n\n") : "Nenhuma anamnese anterior." },
    { heading: "Registros clínicos", content: input.records.length ? input.records.map(record => `${record.record_date || record.created_at?.slice(0, 10) || "Sem data"} — ${record.title || "Registro"}\n${record.description || record.content || ""}`).join("\n\n") : "Nenhum registro clínico." },
    { heading: "Odontograma", content: input.teeth.length ? input.teeth.map(tooth => `Dente ${tooth.tooth_number}: ${tooth.condition || "Sem condição registrada"}${tooth.notes ? ` — ${tooth.notes}` : ""}`).join("\n") : "Nenhum dente registrado." },
    { heading: "Exames anexados", content: input.exams.length ? input.exams.map(exam => `${exam.title || "Exame"}${exam.description ? ` — ${exam.description}` : ""}`).join("\n") : "Nenhum exame anexado." },
    { heading: "Termos de consentimento", content: input.consents.length ? input.consents.map(consent => `${consent.title || "Termo"}${consent.description ? ` — ${consent.description}` : ""}`).join("\n") : "Nenhum termo registrado." },
    { heading: "Orçamento", content: input.signedContent || budgetContent(patient.full_name, payload) },
  ]
  return sections
}

export function recordPrintHtml(input: Parameters<typeof recordPrintSections>[0]) {
  return page(`Prontuário e orçamento — ${input.patient.full_name}`, recordPrintSections(input))
}
