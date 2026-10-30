import { NextResponse } from "next/server"
import sharp from "sharp"
import { getClinicScopedClient } from "@/lib/supabase/clinic-scope"
import { requirePermission } from "@/lib/permissions-server"

const BUCKET = "documentos-clinica"
const MAX_BYTES = 2 * 1024 * 1024

async function context() {
  const result = await getClinicScopedClient()
  if ("error" in result && result.error) return { error: result.error }
  const { supabase, ownerId, permissions } = result as Exclude<typeof result, { error: NextResponse }>
  const denied = requirePermission(permissions, "configuracoes")
  if (denied) return { error: denied }
  return { supabase, ownerId }
}

export async function GET() {
  const scoped = await context()
  if ("error" in scoped) return scoped.error
  const { supabase, ownerId } = scoped
  const { data: settings, error } = await supabase.from("clinic_settings").select("logo_url").eq("user_id", ownerId).maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const path = settings?.logo_url
  if (!path || !path.startsWith(`${ownerId}/branding/`)) return NextResponse.json({ error: "Logo não encontrada." }, { status: 404 })
  const { data, error: downloadError } = await supabase.storage.from(BUCKET).download(path)
  if (downloadError || !data) return NextResponse.json({ error: "Logo indisponível." }, { status: 404 })
  return new Response(await data.arrayBuffer(), { headers: { "Content-Type": "image/png", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } })
}

export async function POST(request: Request) {
  const scoped = await context()
  if ("error" in scoped) return scoped.error
  const { supabase, ownerId } = scoped
  if (Number(request.headers.get("content-length") || 0) > MAX_BYTES + 64 * 1024) {
    return NextResponse.json({ error: "A imagem deve ter até 2 MB." }, { status: 413 })
  }
  let form: FormData
  try { form = await request.formData() } catch {
    return NextResponse.json({ error: "Envio inválido." }, { status: 400 })
  }
  const file = form.get("logo")
  if (!(file instanceof File) || !["image/png", "image/jpeg"].includes(file.type) || !file.size || file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Envie uma imagem PNG ou JPEG de até 2 MB." }, { status: 400 })
  }
  let image: Buffer
  try {
    image = await sharp(Buffer.from(await file.arrayBuffer()), { limitInputPixels: 16_000_000 })
      .rotate().resize({ width: 1200, height: 600, fit: "inside", withoutEnlargement: true })
      .png().toBuffer()
  } catch {
    return NextResponse.json({ error: "A imagem enviada é inválida." }, { status: 400 })
  }
  const path = `${ownerId}/branding/logo-${crypto.randomUUID()}.png`
  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, image, { contentType: "image/png", upsert: false })
  if (uploadError) return NextResponse.json({ error: `Não foi possível enviar a logo: ${uploadError.message}` }, { status: 500 })
  const { data: existing, error: selectError } = await supabase.from("clinic_settings").select("logo_url").eq("user_id", ownerId).maybeSingle()
  if (selectError) {
    await supabase.storage.from(BUCKET).remove([path])
    return NextResponse.json({ error: selectError.message }, { status: 500 })
  }
  const query = existing
    ? supabase.from("clinic_settings").update({ logo_url: path }).eq("user_id", ownerId)
    : supabase.from("clinic_settings").insert({ user_id: ownerId, logo_url: path })
  const { error: saveError } = await query
  if (saveError) {
    await supabase.storage.from(BUCKET).remove([path])
    return NextResponse.json({ error: saveError.message }, { status: 500 })
  }
  if (existing?.logo_url?.startsWith(`${ownerId}/branding/`)) await supabase.storage.from(BUCKET).remove([existing.logo_url])
  return NextResponse.json({ logo_url: path })
}

export async function DELETE() {
  const scoped = await context()
  if ("error" in scoped) return scoped.error
  const { supabase, ownerId } = scoped
  const { data: existing, error } = await supabase.from("clinic_settings").select("logo_url").eq("user_id", ownerId).maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!existing?.logo_url) return NextResponse.json({ ok: true })
  const { error: saveError } = await supabase.from("clinic_settings").update({ logo_url: null }).eq("user_id", ownerId)
  if (saveError) return NextResponse.json({ error: saveError.message }, { status: 500 })
  if (existing.logo_url.startsWith(`${ownerId}/branding/`)) await supabase.storage.from(BUCKET).remove([existing.logo_url])
  return NextResponse.json({ ok: true })
}
