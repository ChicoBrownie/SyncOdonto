import { NextResponse } from "next/server"
import { createHash } from "node:crypto"
import { z } from "zod"
import { budgetContent, budgetTotal, encounterPayloadSchema } from "@/lib/encounters/model"
import { apiError, databaseError, draftColumns, encounterContext, readJson } from "@/lib/encounters/server"
import { appointmentInputSchema, patientInputSchema } from "@/lib/validation/api-schemas"
import { recordAuditEvent } from "@/lib/security/audit"

const actionSchema = z.object({
  revision: z.number().int().nonnegative(),
  action: z.enum(["choose_patient", "register", "start", "schedule", "publish", "sign", "complete", "discard"]),
  patient_id: z.string().uuid().optional(), appointment_id: z.string().uuid().nullable().optional(),
  signature: z.string().max(2_000_000).regex(/^data:image\/png;base64,[A-Za-z0-9+/=]+$/).optional(),
  confirmed: z.boolean().optional(),
}).strict()

const actionFailure: Record<z.infer<typeof actionSchema>["action"], string> = {
  choose_patient: "Não foi possível vincular o paciente. Tente novamente.",
  register: "Não foi possível cadastrar o paciente. Tente novamente.",
  start: "Não foi possível iniciar a consulta. Tente novamente.",
  schedule: "Não foi possível agendar a consulta. Tente novamente.",
  publish: "Não foi possível registrar a ficha clínica. Tente novamente.",
  sign: "Não foi possível confirmar a assinatura. Tente novamente.",
  complete: "Não foi possível concluir a consulta. Tente novamente.",
  discard: "Não foi possível descartar o rascunho. Tente novamente.",
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await encounterContext()
  if (context.error) return context.error
  const { supabase, ownerId, user } = context
  try {
    const id = z.string().uuid().parse((await params).id)
    const body = actionSchema.parse(await readJson(request))
    const { data: draft, error } = await supabase.from("encounter_drafts").select(draftColumns).eq("id", id).eq("clinic_id", ownerId).eq("actor_user_id", user.id).maybeSingle()
    if (error) return databaseError(error)
    if (!draft) return NextResponse.json({ error: "Atendimento indisponível." }, { status: 404 })
    if (["sign", "complete", "discard"].includes(body.action) && !body.confirmed) return NextResponse.json({ error: "Confirmação explícita obrigatória." }, { status: 400 })
    // Completed actions can be retried after a lost response without creating artifacts.
    if ((body.action === "sign" && draft.signed_document_id) || (body.action === "complete" && draft.status === "completed") || (body.action === "discard" && draft.status === "discarded")) return NextResponse.json({ data: draft })
    const payload = encounterPayloadSchema.parse(draft.payload)
    const input: Record<string, unknown> = {}
    if (body.action === "choose_patient") input.patient_id = z.string().uuid().parse(body.patient_id)
    if (body.action === "register" && !draft.patient_id) {
      patientInputSchema.extend({ date_of_birth: z.string().date(), cpf: z.string().regex(/^\d{11}$|^\d{3}\.\d{3}\.\d{3}-\d{2}$/) }).parse(payload.registration)
      if (payload.registration.date_of_birth > new Date().toISOString().slice(0, 10)) throw new Error("Data de nascimento não pode estar no futuro.")
    }
    if (["start", "schedule"].includes(body.action)) {
      if (body.appointment_id) input.appointment_id = body.appointment_id
      if (!body.appointment_id && !draft.appointment_id) appointmentInputSchema.parse({ ...payload.appointment, patient_id: draft.patient_id, procedure_type: "Consulta" })
    }
    if (body.action === "sign") {
      if (!draft.appointment_id) throw new Error("Inicie a consulta na etapa Paciente antes de assinar a proposta.")
      if (!body.signature) throw new Error("Colete a assinatura da pessoa após a leitura da proposta.")
      if (!payload.budget.items.length || payload.budget.items.some(item => !item.procedure.trim() || item.unitValue <= 0 || item.discount > item.unitValue) || budgetTotal(payload.budget.items) <= 0) throw new Error("Revise os procedimentos, valores e descontos da proposta.")
      const { data: patient, error: patientError } = await supabase.from("patients").select("full_name").eq("id", draft.patient_id).eq("user_id", ownerId).maybeSingle()
      if (patientError) return databaseError(patientError)
      if (!patient) return NextResponse.json({ error: "Paciente indisponível nesta clínica." }, { status: 403 })
      input.signature = body.signature
      input.title = `Orçamento - ${patient.full_name}`.slice(0, 200)
      input.content = budgetContent(patient.full_name, payload)
      input.total = budgetTotal(payload.budget.items)
      input.hash = createHash("sha256").update(JSON.stringify({ patient_id: draft.patient_id, revision: draft.revision, budget: payload.budget, content: input.content })).digest("hex")
    }
    if (body.action === "complete" && payload.settlement_amount <= 0) throw new Error("Confirme um valor positivo da consulta.")
    const { data, error: actionError } = await supabase.rpc("perform_encounter_action", { p_id: id, p_clinic: ownerId, p_actor: user.id, p_revision: body.revision, p_action: body.action, p_input: input })
    if (actionError) {
      // Record only the action and SQLSTATE; Supabase error details may contain patient data.
      console.error("[encounters] action failed", {
        action: body.action,
        code: /^[A-Z0-9]{5}$/.test(actionError.code || "") ? actionError.code : "unknown",
      })
      return databaseError(actionError, actionFailure[body.action])
    }
    if (!data) return NextResponse.json({ error: "Atendimento indisponível." }, { status: 404 })
    await recordAuditEvent({ supabase, clinicId: ownerId, actorUserId: user.id, action: `encounter.${body.action}`, entityType: "encounter_drafts", entityId: id, metadata: { revision: data.revision, patient_id: data.patient_id, document_id: data.signed_document_id } })
    return NextResponse.json({ data })
  } catch (error) { return apiError(error) }
}
