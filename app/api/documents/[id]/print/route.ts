import { NextResponse } from "next/server"
import { encounterContext, databaseError } from "@/lib/encounters/server"
import { documentHtml, documentHeaders } from "@/lib/encounters/document-html"
import { budgetPrintHtml } from "@/lib/documents/budget-document"
import { downloadClinicLogo } from "@/lib/documents/clinic-logo"
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await encounterContext()
  if (context.error) return context.error
  const { data, error } = await context.supabase.from("documents").select("title,content,description,document_type,items,payment_method,created_at,lead_name,patient:patients(full_name,email),signature_data,signed_at,encounter_revision,snapshot_hash,encounter_id,signed").eq("id", (await params).id).eq("user_id", context.ownerId).maybeSingle()
  if (error) return databaseError(error)
  if (!data) return NextResponse.json({ error: "Documento indisponível." }, { status: 404 })
  if (data.document_type === "budget" && !data.encounter_id) {
    const { data: clinic, error: clinicError } = await context.supabase.from("clinic_settings").select("clinic_name,address,phone,email,logo_url").eq("user_id", context.ownerId).maybeSingle()
    if (clinicError) return databaseError(clinicError)
    const patient = Array.isArray(data.patient) ? data.patient[0] : data.patient
    const logo = await downloadClinicLogo(context.supabase, context.ownerId, clinic?.logo_url)
    return new Response(budgetPrintHtml({ ...data, patient }, clinic || {}, logo ? `data:image/png;base64,${logo.toString("base64")}` : undefined), { headers: { ...documentHeaders, "Content-Security-Policy": `${documentHeaders["Content-Security-Policy"]}; script-src 'self'` } })
  }
  if (!data.encounter_id || !data.signed) return NextResponse.json({ error: "Documento indisponível." }, { status: 404 })
  return new Response(documentHtml(data), { headers: documentHeaders })
}
