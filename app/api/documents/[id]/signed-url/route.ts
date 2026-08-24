import { NextResponse } from "next/server"
import { getClinicScopedClient } from "@/lib/supabase/clinic-scope"

const STORAGE_BUCKET = "documentos-clinica"
const SIGNED_URL_TTL_SECONDS = 60 * 10

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const result = await getClinicScopedClient()
  if ("error" in result && result.error) return result.error
  const { supabase, ownerId } = result as any
  const { id } = await params

  const { data: document, error } = await supabase.from("documents").select("storage_path, file_url, title").eq("id", id).eq("user_id", ownerId).maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!document) return NextResponse.json({ error: "Documento não encontrado" }, { status: 404 })
  const path = document.storage_path || (document.file_url?.startsWith("http") ? null : document.file_url)
  if (!path) {
    if (document.file_url?.startsWith("http")) return NextResponse.json({ data: { url: document.file_url, title: document.title } })
    return NextResponse.json({ error: "Documento ainda não possui arquivo" }, { status: 404 })
  }
  const { data, error: signedError } = await supabase.storage.from(STORAGE_BUCKET).createSignedUrl(path, SIGNED_URL_TTL_SECONDS)
  if (signedError) return NextResponse.json({ error: signedError.message }, { status: 500 })
  return NextResponse.json({ data: { url: data.signedUrl, title: document.title, expiresIn: SIGNED_URL_TTL_SECONDS } })
}
