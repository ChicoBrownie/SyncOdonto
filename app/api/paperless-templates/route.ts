import { NextResponse } from "next/server"
import { getClinicScopedClient } from "@/lib/supabase/clinic-scope"
import { DEFAULT_TEMPLATES, TEMPLATE_TYPES, type TemplateType } from "@/lib/documents/template-defaults"
import { requirePermission } from "@/lib/permissions-server"

export async function GET() {
  const result = await getClinicScopedClient()
  if ("error" in result && result.error) return result.error
  const { supabase, ownerId, permissions } = result as any
  const denied = requirePermission(permissions, "configuracoes")
  if (denied) return denied
  const { data, error } = await supabase.from("paperless_templates").select("template_type, content, questions").eq("user_id", ownerId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const saved = new Map((data || []).map((row: any) => [row.template_type, row]))
  const templates = TEMPLATE_TYPES.map((type) => {
    const custom = saved.get(type) as any
    return custom ? { ...DEFAULT_TEMPLATES[type], content: custom.content, questions: custom.questions || [], customized: true } : DEFAULT_TEMPLATES[type]
  })
  return NextResponse.json({ data: templates })
}

export async function PUT(request: Request) {
  const result = await getClinicScopedClient()
  if ("error" in result && result.error) return result.error
  const { supabase, ownerId, permissions } = result as any
  const denied = requirePermission(permissions, "configuracoes")
  if (denied) return denied
  const body = await request.json()
  const type = body.type as TemplateType
  if (!TEMPLATE_TYPES.includes(type) || typeof body.content !== "string" || body.content.length > 20_000) return NextResponse.json({ error: "Modelo inválido" }, { status: 400 })
  const questions = type === "anamnesis" && Array.isArray(body.questions)
    ? body.questions.slice(0, 100).map((question: any) => ({
        id: typeof question.id === "string" ? question.id.slice(0, 100) : crypto.randomUUID(),
        text: typeof question.text === "string" ? question.text.trim().slice(0, 500) : "",
        answerType: question.answerType === "text" ? "text" : "yes_no",
        required: Boolean(question.required),
      })).filter((question: { text: string }) => question.text)
    : []
  const { data, error } = await supabase.from("paperless_templates").upsert({ user_id: ownerId, template_type: type, content: body.content, questions, updated_at: new Date().toISOString() }, { onConflict: "user_id,template_type" }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function DELETE(request: Request) {
  const result = await getClinicScopedClient()
  if ("error" in result && result.error) return result.error
  const { supabase, ownerId, permissions } = result as any
  const denied = requirePermission(permissions, "configuracoes")
  if (denied) return denied
  const type = new URL(request.url).searchParams.get("type") as TemplateType
  if (!TEMPLATE_TYPES.includes(type)) return NextResponse.json({ error: "Tipo inválido" }, { status: 400 })
  const { error } = await supabase.from("paperless_templates").delete().eq("user_id", ownerId).eq("template_type", type)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: DEFAULT_TEMPLATES[type] })
}
