import { NextResponse } from "next/server"
import { getClinicScopedClient } from "@/lib/supabase/clinic-scope"
import { resend } from "@/lib/email/resend"
import { consumeRateLimit } from "@/lib/security/rate-limit"
import { recordAuditEvent } from "@/lib/security/audit"

const STORAGE_BUCKET = "documentos-clinica"
const LINK_TTL_SECONDS = 60 * 60 * 24

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]!)
}

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const result = await getClinicScopedClient()
  if ("error" in result && result.error) return result.error
  const { supabase, ownerId, user } = result as any
  const { id } = await params

  if (!process.env.RESEND_API_KEY) return NextResponse.json({ error: "O serviço de e-mail ainda não foi configurado." }, { status: 503 })
  if (!(await consumeRateLimit(supabase, `document:email:${ownerId}:${user.id}`, 20, 3600))) {
    return NextResponse.json({ error: "Limite de envios atingido. Tente novamente mais tarde." }, { status: 429 })
  }

  const { data: document, error } = await supabase
    .from("documents")
    .select("id, title, description, storage_path, file_url, patient:patients(id, full_name, email)")
    .eq("id", id)
    .eq("user_id", ownerId)
    .maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!document) return NextResponse.json({ error: "Documento não encontrado." }, { status: 404 })

  const patient = Array.isArray(document.patient) ? document.patient[0] : document.patient
  if (!patient?.email) return NextResponse.json({ error: "Este paciente não possui e-mail cadastrado." }, { status: 400 })
  const path = document.storage_path || (document.file_url?.startsWith("http") ? null : document.file_url)
  let fileUrl = document.file_url?.startsWith("http") ? document.file_url : null
  if (path) {
    const { data, error: signedError } = await supabase.storage.from(STORAGE_BUCKET).createSignedUrl(path, LINK_TTL_SECONDS)
    if (signedError) return NextResponse.json({ error: "Não foi possível preparar o arquivo para envio." }, { status: 500 })
    fileUrl = data.signedUrl
  }
  if (!fileUrl) return NextResponse.json({ error: "Este registro não possui arquivo para enviar." }, { status: 400 })

  const patientName = escapeHtml(patient.full_name || "Paciente")
  const title = escapeHtml(document.title || "Documento odontológico")
  const { error: emailError } = await resend.emails.send({
    from: process.env.EMAIL_FROM || "SyncOdonto <onboarding@resend.dev>",
    to: patient.email,
    subject: `${document.title || "Documento odontológico"} — SyncOdonto`,
    html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:24px;color:#172033"><h2>${title}</h2><p>Olá, ${patientName}.</p><p>Sua clínica disponibilizou um arquivo do seu atendimento odontológico.</p><p style="margin:28px 0"><a href="${fileUrl}" style="background:#0ea5e9;color:white;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:700">Visualizar arquivo</a></p><p style="font-size:13px;color:#64748b">Por segurança, este link expira em 24 horas. Não encaminhe este e-mail a terceiros.</p><p style="font-size:12px;color:#64748b">Mensagem enviada pelo SyncOdonto.</p></div>`,
  })
  if (emailError) return NextResponse.json({ error: `Falha no envio: ${emailError.message}` }, { status: 502 })

  await recordAuditEvent({ supabase, clinicId: ownerId, actorUserId: user.id, action: "document.emailed", entityType: "documents", entityId: id, metadata: { patient_id: patient.id } })
  return NextResponse.json({ message: `Exame enviado para ${patient.email}.` })
}
