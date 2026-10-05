import { NextResponse } from "next/server"
import { z } from "zod"
import { encounterContext, databaseError } from "@/lib/encounters/server"
import { documentHtml, documentHeaders } from "@/lib/encounters/document-html"
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await encounterContext()
  if (context.error) return context.error
  const { supabase, ownerId, user } = context
  const { id } = await params
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "ID inválido." }, { status: 400 })
  const { data: draft, error } = await supabase.from("encounter_drafts").select("signed_document_id").eq("id", id).eq("clinic_id", ownerId).eq("actor_user_id", user.id).maybeSingle()
  if (error) return databaseError(error)
  if (!draft?.signed_document_id) return NextResponse.json({ error: "Documento indisponível." }, { status: 404 })
  const { data, error: documentError } = await supabase.from("documents").select("id,title,content,signature_data,signed_at,encounter_revision,snapshot_hash").eq("id", draft.signed_document_id).eq("user_id", ownerId).eq("encounter_id", id).eq("signed", true).maybeSingle()
  if (documentError) return databaseError(documentError)
  if (!data) return NextResponse.json({ error: "Documento indisponível." }, { status: 404 })
  if (new URL(request.url).searchParams.get("format") === "html") return new Response(documentHtml(data), { headers: documentHeaders })
  return NextResponse.json({ data }, { headers: { "Cache-Control": "no-store" } })
}
