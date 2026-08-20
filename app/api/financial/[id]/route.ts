import { getClinicScopedClient } from "@/lib/supabase/clinic-scope"
import { requirePermission } from "@/lib/permissions-server"
import { NextResponse } from "next/server"

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await getClinicScopedClient()
  if ("error" in result && result.error) return result.error
  const { supabase, ownerId, permissions } = result as any

  const denied = requirePermission(permissions, "financeiro")
  if (denied) return denied

  const { id } = await params

  const body = await request.json()

  const { data, error } = await supabase
    .from("financial_transactions")
    .update(body)
    .eq("id", id)
    .eq("user_id", ownerId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
