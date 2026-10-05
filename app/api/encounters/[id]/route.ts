import { NextResponse } from "next/server"
import { z } from "zod"
import { encounterPayloadSchema, steps } from "@/lib/encounters/model"
import { apiError, databaseError, draftColumns, encounterContext, readJson } from "@/lib/encounters/server"

type Context = { params: Promise<{ id: string }> }
export async function GET(_request: Request, { params }: Context) {
  const context = await encounterContext()
  if (context.error) return context.error
  const { supabase, ownerId, user } = context
  const { id } = await params
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "ID inválido." }, { status: 400 })
  const { data, error } = await supabase.from("encounter_drafts").select(draftColumns).eq("id", id).eq("clinic_id", ownerId).eq("actor_user_id", user.id).maybeSingle()
  if (error) return databaseError(error)
  if (!data) return NextResponse.json({ error: "Atendimento indisponível." }, { status: 404 })
  return NextResponse.json({ data }, { headers: { "Cache-Control": "no-store" } })
}
export async function PATCH(request: Request, { params }: Context) {
  const context = await encounterContext()
  if (context.error) return context.error
  const { supabase, ownerId, user } = context
  try {
    const id = z.string().uuid().parse((await params).id)
    const body = z.object({ revision: z.number().int().nonnegative(), step: z.enum(steps), payload: encounterPayloadSchema }).strict().parse(await readJson(request))
    const { data, error } = await supabase.rpc("save_encounter_draft", { p_id: id, p_clinic: ownerId, p_actor: user.id, p_revision: body.revision, p_step: body.step, p_payload: body.payload })
    if (error) return databaseError(error)
    if (!data) return NextResponse.json({ error: "Atendimento indisponível." }, { status: 404 })
    return NextResponse.json({ data })
  } catch (error) { return apiError(error) }
}
