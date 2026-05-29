import { getAuthenticatedClient } from "@/lib/supabase/api-helper"
import { NextResponse } from "next/server"

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await getAuthenticatedClient()
  if ("error" in result && result.error) return result.error
  const { supabase, user } = result as any
  const { id } = await params

  const body = await request.json()

  const { data, error } = await supabase
    .from("financial_transactions")
    .update(body)
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
