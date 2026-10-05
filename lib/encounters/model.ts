import { z } from "zod"

export const steps = ["patient", "anamnesis", "chart", "budget", "signature", "financial"] as const
export type EncounterStep = typeof steps[number]
export const stepLabels: Record<EncounterStep, string> = {
  patient: "Paciente", anamnesis: "Saúde e alertas", chart: "Odontograma",
  budget: "Orçamento", signature: "Assinatura", financial: "Financeiro",
}
const text = (max: number) => z.string().max(max)
export const budgetItemSchema = z.object({
  source_id: z.string().uuid().nullable(), procedure: text(200), region: text(300),
  unitValue: z.number().finite().min(0).max(100_000_000),
  discount: z.number().finite().min(0).max(100_000_000),
}).strict()
export const encounterPayloadSchema = z.object({
  registration: z.object({ full_name: text(160), date_of_birth: text(10), cpf: text(14), phone: text(20) }).strict(),
  scheduling: z.boolean(),
  appointment_choice: z.string().uuid().nullable(),
  appointment: z.object({ doctor_name: text(160), date: text(10), time: text(8), duration_minutes: z.number().int().min(5).max(720) }).strict(),
  anamnesis: z.object({
    chief_complaint: text(5000), answers: z.array(z.object({ question: text(500).min(1), answer: z.enum(["sim", "nao"]).nullable(), observation: text(2000) }).strict()).max(100),
    additional_notes: text(10_000), diagnosis: text(10_000), treatment_plan: text(20_000),
  }).strict(),
  clinical_notes: text(20_000), planning: text(20_000),
  chart_form: z.object({ tooth: z.number().int().min(11).max(85).nullable(), areas: z.array(text(20)).max(6), procedure_id: z.string().uuid().or(z.literal("")), problem: text(500), notes: text(5000) }).strict(),
  budget: z.object({ items: z.array(budgetItemSchema).max(100), payment_method: text(80) }).strict(),
  settlement_amount: z.number().finite().min(0).max(100_000_000),
}).strict()
export type EncounterPayload = z.infer<typeof encounterPayloadSchema>
export type BudgetItem = z.infer<typeof budgetItemSchema>
export type EncounterDraft = {
  id: string; clinic_id: string; actor_user_id: string; patient_id: string | null; appointment_id: string | null;
  step: EncounterStep; payload: EncounterPayload; revision: number;
  status: "active" | "completed" | "discarded"; signed_document_id: string | null;
  clinical_revision: number | null; updated_at: string;
  patient?: { id: string; full_name: string } | null;
}
export function emptyPayload(): EncounterPayload {
  return {
    registration: { full_name: "", date_of_birth: "", cpf: "", phone: "" },
    scheduling: false,
    appointment_choice: null,
    appointment: { doctor_name: "", date: "", time: "", duration_minutes: 60 },
    anamnesis: { chief_complaint: "", answers: [], additional_notes: "", diagnosis: "", treatment_plan: "" },
    clinical_notes: "", planning: "", chart_form: { tooth: null, areas: [], procedure_id: "", problem: "", notes: "" },
    budget: { items: [], payment_method: "A combinar" }, settlement_amount: 0,
  }
}
export function budgetTotal(items: BudgetItem[]) {
  return Math.round(items.reduce((sum, item) => sum + Math.max(0, item.unitValue - item.discount), 0) * 100) / 100
}
export function budgetContent(name: string, payload: EncounterPayload) {
  const money = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
  return ["PROPOSTA DE TRATAMENTO", `Paciente: ${name}`,
    ...payload.budget.items.map((item, i) => `${i + 1}. ${item.procedure} | ${item.region || "Geral"} | ${money(item.unitValue)} | desconto ${money(item.discount)}`),
    `Total: ${money(budgetTotal(payload.budget.items))}`, `Pagamento previsto: ${payload.budget.payment_method}`,
    "Declaro que li e concordo com esta proposta de tratamento e seus valores.",
  ].join("\n")
}
export function mergeTreatments(items: BudgetItem[], treatments: { id: string; treatment_type: string; tooth_number: number | null; tooth_area?: string | null; tooth_areas?: string[] | null; cost: number | null; status: string }[]) {
  const included = new Set(items.map((item) => item.source_id))
  return [...items, ...treatments.filter((item) => item.status !== "cancelled" && !included.has(item.id)).map((item) => ({
    source_id: item.id, procedure: item.treatment_type,
    region: [item.tooth_number ? `Dente ${item.tooth_number}` : "Geral", (item.tooth_areas || (item.tooth_area ? [item.tooth_area] : [])).join(", ")].filter(Boolean).join(" · "),
    unitValue: Number(item.cost || 0), discount: 0,
  }))]
}
