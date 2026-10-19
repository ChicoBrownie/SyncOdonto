import { NextResponse } from "next/server"
import { z } from "zod"
import { encounterPayloadSchema } from "@/lib/encounters/model"
import { proposalPrintHtml, recordPrintHtml, recordPrintSections } from "@/lib/encounters/print-html"
import { documentHeaders } from "@/lib/encounters/document-html"
import { databaseError, encounterContext } from "@/lib/encounters/server"
import { createSimplePdf } from "@/lib/documents/simple-pdf"
import { budgetContent } from "@/lib/encounters/model"

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await encounterContext()
  if (context.error) return context.error
  const { supabase, ownerId, user } = context
  const id = (await params).id
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "Atendimento inválido." }, { status: 400 })
  const kind = new URL(request.url).searchParams.get("kind")
  const asPdf = new URL(request.url).searchParams.get("format") === "pdf"
  if (kind !== "proposal" && kind !== "record") return NextResponse.json({ error: "Documento inválido." }, { status: 400 })

  const { data: draft, error: draftError } = await supabase.from("encounter_drafts").select("patient_id,payload,signed_document_id").eq("id", id).eq("clinic_id", ownerId).eq("actor_user_id", user.id).maybeSingle()
  if (draftError) return databaseError(draftError)
  if (!draft?.patient_id) return NextResponse.json({ error: "Selecione um paciente primeiro." }, { status: 404 })
  const payload = encounterPayloadSchema.safeParse(draft.payload)
  if (!payload.success) return NextResponse.json({ error: "Dados do atendimento inválidos." }, { status: 422 })

  const { data: patient, error: patientError } = await supabase.from("patients").select("full_name,date_of_birth,cpf,phone,email,allergies,medications,pre_existing_conditions").eq("id", draft.patient_id).eq("user_id", ownerId).maybeSingle()
  if (patientError) return databaseError(patientError)
  if (!patient) return NextResponse.json({ error: "Paciente indisponível." }, { status: 404 })
  if (kind === "proposal") {
    if (asPdf) return new Response(new Uint8Array(createSimplePdf("Proposta de tratamento", budgetContent(patient.full_name, payload.data) + "\n\nAssinatura: ____________________________________")), { headers: { "Content-Type": "application/pdf", "Content-Disposition": "attachment; filename=proposta-tratamento.pdf", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } })
    return new Response(proposalPrintHtml(patient.full_name, payload.data), { headers: documentHeaders })
  }

  const [anamneses, records, teeth, documents, signed] = await Promise.all([
    supabase.from("anamnesis_records").select("chief_complaint,answers,diagnosis,treatment_plan,additional_notes,created_at").eq("user_id", ownerId).eq("patient_id", draft.patient_id).order("created_at", { ascending: false }),
    supabase.from("medical_records").select("title,description,content,record_date,created_at").eq("user_id", ownerId).eq("patient_id", draft.patient_id).order("created_at", { ascending: false }),
    supabase.from("dental_charts").select("tooth_number,condition,notes").eq("user_id", ownerId).eq("patient_id", draft.patient_id).order("tooth_number"),
    supabase.from("documents").select("title,description,document_type").eq("user_id", ownerId).eq("patient_id", draft.patient_id).in("document_type", ["exam", "consent"]),
    draft.signed_document_id ? supabase.from("documents").select("content").eq("id", draft.signed_document_id).eq("user_id", ownerId).eq("encounter_id", id).eq("signed", true).maybeSingle() : Promise.resolve({ data: null, error: null }),
  ])
  for (const result of [anamneses, records, teeth, documents, signed]) if (result.error) return databaseError(result.error)
  const input = { patient, payload: payload.data, anamneses: anamneses.data || [], records: records.data || [], teeth: teeth.data || [], exams: (documents.data || []).filter(item => item.document_type === "exam"), consents: (documents.data || []).filter(item => item.document_type === "consent"), signedContent: signed.data?.content }
  if (asPdf) return new Response(new Uint8Array(createSimplePdf("Prontuário e orçamento", recordPrintSections(input).map(section => `${section.heading}\n${section.content}`).join("\n\n"))), { headers: { "Content-Type": "application/pdf", "Content-Disposition": "attachment; filename=prontuario-orcamento.pdf", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } })
  const html = recordPrintHtml(input)
  return new Response(html, { headers: documentHeaders })
}
