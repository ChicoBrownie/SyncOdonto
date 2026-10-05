import { NextResponse } from "next/server"
import { encounterContext, databaseError } from "@/lib/encounters/server"
import { documentHtml, documentHeaders } from "@/lib/encounters/document-html"
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await encounterContext()
  if (context.error) return context.error
  const { data, error } = await context.supabase.from("documents").select("title,content,signature_data,signed_at,encounter_revision,snapshot_hash").eq("id", (await params).id).eq("user_id", context.ownerId).not("encounter_id", "is", null).eq("signed", true).maybeSingle()
  if (error) return databaseError(error)
  if (!data) return NextResponse.json({ error: "Documento indisponível." }, { status: 404 })
  return new Response(documentHtml(data), { headers: documentHeaders })
}
