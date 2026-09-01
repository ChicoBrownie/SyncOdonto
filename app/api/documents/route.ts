import { getClinicScopedClient } from "@/lib/supabase/clinic-scope"
import { NextResponse } from "next/server"
import { createSimplePdf } from "@/lib/documents/simple-pdf"
import { documentInputSchema, parseInput } from "@/lib/validation/api-schemas"
import { consumeRateLimit } from "@/lib/security/rate-limit"
import { recordAuditEvent } from "@/lib/security/audit"

const STORAGE_BUCKET = "documentos-clinica"

export async function GET(request: Request) {
  const result = await getClinicScopedClient()
  if ("error" in result && result.error) return result.error
  const { supabase, ownerId } = result as any

  const { searchParams } = new URL(request.url)
  const patientId = searchParams.get("patientId") || searchParams.get("patient_id")
  const documentType = searchParams.get("documentType") || searchParams.get("document_type")

  let query = supabase
    .from("documents")
    .select(`*, patient:patients(id, full_name)`)
    .eq("user_id", ownerId)
    .order("created_at", { ascending: false })

  if (patientId) query = query.eq("patient_id", patientId)
  if (documentType && documentType !== "all") query = query.eq("document_type", documentType)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(request: Request) {
  const result = await getClinicScopedClient()
  if ("error" in result && result.error) return result.error
  const { supabase, ownerId, user } = result as any

  const parsed = parseInput(documentInputSchema, await request.json())
  if (!parsed.data) return NextResponse.json({ error: parsed.error }, { status: 400 })
  const body = parsed.data

  if (!(await consumeRateLimit(supabase, `documents:create:${ownerId}:${user.id}`, 60, 60))) {
    return NextResponse.json({ error: "Muitos documentos em pouco tempo. Tente novamente em um minuto." }, { status: 429 })
  }

  if (!body.title || !body.document_type) {
    return NextResponse.json({ error: "Título e tipo do documento são obrigatórios" }, { status: 400 })
  }

  if (body.patient_id) {
    const { data: patient } = await supabase.from("patients").select("id").eq("id", body.patient_id).eq("user_id", ownerId).maybeSingle()
    if (!patient) return NextResponse.json({ error: "Paciente não pertence à clínica" }, { status: 403 })
  }

  let storagePath = body.storage_path || null
  if (storagePath && !storagePath.startsWith(`${user.id}/`)) {
    return NextResponse.json({ error: "Caminho de arquivo inválido" }, { status: 403 })
  }
  if (body.generate_pdf) {
    const documentId = crypto.randomUUID()
    storagePath = `${ownerId}/generated/${documentId}.pdf`
    const pdf = createSimplePdf(body.title, body.content || body.description || "")
    const { error: uploadError } = await supabase.storage.from(STORAGE_BUCKET).upload(storagePath, pdf, { contentType: "application/pdf", upsert: false })
    if (uploadError) return NextResponse.json({ error: `Erro ao gerar PDF: ${uploadError.message}` }, { status: 500 })
  }

  const allowed = {
    patient_id: body.patient_id || null,
    title: body.title,
    document_type: body.document_type,
    description: body.description || null,
    procedure: body.procedure || null,
    status: body.status || (body.signed ? "signed" : "pending"),
    signed: Boolean(body.signed),
    signed_at: body.signed ? new Date().toISOString() : null,
    signature_data: body.signature_data || null,
    content: body.content || null,
    storage_path: storagePath,
    file_url: storagePath,
    file_type: body.generate_pdf ? "application/pdf" : body.file_type || null,
    file_size: body.file_size || null,
    lead_name: body.lead_name || null,
    lead_phone: body.lead_phone || null,
    items: body.items || null,
    total_amount: body.total_amount ?? null,
    payment_method: body.payment_method || null,
  }

  const { data, error } = await supabase
    .from("documents")
    .insert({ ...allowed, user_id: ownerId })
    .select()
    .single()

  if (error) {
    if (body.generate_pdf && storagePath) await supabase.storage.from(STORAGE_BUCKET).remove([storagePath])
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  await recordAuditEvent({ supabase, clinicId: ownerId, actorUserId: user.id, action: "document.created", entityType: "documents", entityId: data.id, metadata: { document_type: data.document_type, patient_id: data.patient_id } })
  return NextResponse.json({ data })
}

export async function DELETE(request: Request) {
  const result = await getClinicScopedClient()
  if ("error" in result && result.error) return result.error
  const { supabase, ownerId, user } = result as any

  const { searchParams } = new URL(request.url)
  const id = searchParams.get("id")

  if (!id) return NextResponse.json({ error: "ID obrigatorio" }, { status: 400 })

  const { error } = await supabase
    .from("documents")
    .delete()
    .eq("id", id)
    .eq("user_id", ownerId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await recordAuditEvent({ supabase, clinicId: ownerId, actorUserId: user.id, action: "document.deleted", entityType: "documents", entityId: id })
  return NextResponse.json({ success: true })
}
