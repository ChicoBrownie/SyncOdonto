import { NextResponse } from "next/server"
import { getClinicScopedClient } from "@/lib/supabase/clinic-scope"
import { z } from "zod"

export const draftColumns = "id, clinic_id, actor_user_id, patient_id, appointment_id, step, payload, revision, status, signed_document_id, clinical_revision, updated_at"
export async function encounterContext() {
  return getClinicScopedClient()
}
export async function readJson(request: Request) {
  // Bound clinical payloads before parsing, including a drawn signature.
  if (Number(request.headers.get("content-length")) > 2_500_000) throw new Error("Corpo muito grande.")
  const body = await request.text()
  if (body.length > 2_500_000) throw new Error("Corpo muito grande.")
  return JSON.parse(body) as unknown
}
export function apiError(error: unknown) {
  return NextResponse.json({ error: error instanceof z.ZodError ? "Dados inválidos: " + error.issues.map(i => i.path.join(".") + ": " + i.message).join("; ") : error instanceof Error ? error.message : "Não foi possível concluir." }, { status: 400 })
}
export function databaseError(error: { code?: string; message: string }) {
  const conflict = ["40001", "23505", "P0001"].includes(error.code || "")
  const missing = ["42P01", "42703", "PGRST202", "PGRST205"].includes(error.code || "")
  return NextResponse.json({ error: missing ? "O atendimento precisa da migração 014 e do esquema operacional. Solicite a atualização ao responsável pela clínica." : conflict ? error.message : "Não foi possível salvar no servidor. Tente novamente.", conflict: error.code === "40001" }, { status: missing ? 503 : conflict ? 409 : 500 })
}
