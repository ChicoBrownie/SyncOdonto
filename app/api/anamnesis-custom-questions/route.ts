import { NextResponse } from "next/server"
import { z } from "zod"
import { getClinicScopedClient } from "@/lib/supabase/clinic-scope"

const questionSchema = z.object({ question: z.string().trim().min(1).max(500) }).strict()
const deleteSchema = z.object({ id: z.string().uuid() }).strict()

export async function GET() {
  const result = await getClinicScopedClient()
  if ("error" in result && result.error) return result.error
  const { supabase, ownerId, user } = result as any
  const { data, error } = await supabase.from("anamnesis_custom_questions").select("id, question").eq("clinic_id", ownerId).eq("actor_user_id", user.id).order("created_at", { ascending: true })
  if (error) return NextResponse.json({ error: "Não foi possível carregar as perguntas personalizadas. Verifique a migração 017." }, { status: 503 })
  return NextResponse.json({ data })
}

export async function POST(request: Request) {
  const result = await getClinicScopedClient()
  if ("error" in result && result.error) return result.error
  const { supabase, ownerId, user } = result as any
  const parsed = questionSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Informe uma pergunta com até 500 caracteres." }, { status: 400 })
  const { count, error: countError } = await supabase.from("anamnesis_custom_questions").select("id", { count: "exact", head: true }).eq("clinic_id", ownerId).eq("actor_user_id", user.id)
  if (countError) return NextResponse.json({ error: "Não foi possível salvar o modelo. Verifique a migração 017." }, { status: 503 })
  if ((count || 0) >= 100) return NextResponse.json({ error: "Limite de 100 perguntas personalizadas." }, { status: 400 })
  const { data, error } = await supabase.from("anamnesis_custom_questions").upsert({ clinic_id: ownerId, actor_user_id: user.id, question: parsed.data.question }, { onConflict: "clinic_id,actor_user_id,question" }).select("id, question").single()
  if (error) return NextResponse.json({ error: "Não foi possível salvar a pergunta personalizada." }, { status: 500 })
  return NextResponse.json({ data })
}

export async function DELETE(request: Request) {
  const result = await getClinicScopedClient()
  if ("error" in result && result.error) return result.error
  const { supabase, ownerId, user } = result as any
  const parsed = deleteSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Pergunta inválida." }, { status: 400 })
  const { error } = await supabase.from("anamnesis_custom_questions").delete().eq("id", parsed.data.id).eq("clinic_id", ownerId).eq("actor_user_id", user.id)
  if (error) return NextResponse.json({ error: "Não foi possível excluir a pergunta." }, { status: 500 })
  return NextResponse.json({ success: true })
}
