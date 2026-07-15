import { NextResponse } from "next/server"
import { getAuthenticatedClient } from "@/lib/supabase/api-helper"
import { createClient } from "@supabase/supabase-js"

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET() {
  const result = await getAuthenticatedClient()
  if ("error" in result && result.error) return result.error
  const { supabase, user } = result as any

  const { data: ownStaff } = await getServiceClient()
    .from("clinic_staff").select("user_id").eq("auth_user_id", user.id).maybeSingle()
  const ownerId = ownStaff?.user_id || user.id

  const { data, error } = await supabase
    .from("clinic_staff")
    .select("*")
    .eq("user_id", ownerId)
    .order("created_at", { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(request: Request) {
  const result = await getAuthenticatedClient()
  if ("error" in result && result.error) return result.error
  const { supabase, user } = result as any

  const body = await request.json()
  const { full_name, role, specialty, email, phone, access_role } = body

  if (!full_name?.trim()) {
    return NextResponse.json({ error: "Nome é obrigatório" }, { status: 400 })
  }

  // Se tiver email e access_role, envia convite via Supabase Auth
  let auth_user_id = null
  let invite_sent_at = null

  if (email?.trim() && access_role && access_role !== "gestor") {
    const adminClient = getServiceClient()

    // Busca a URL do site para o redirect do convite
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://syncodonto.netlify.app"

    const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(
      email.trim(),
      {
        redirectTo: `${siteUrl}/auth/callback`,
        data: {
          full_name: full_name.trim(),
          access_role,
          invited_by: user.id,
        },
      }
    )

    if (inviteError) {
      // Se o usuário já existe, continua sem erro
      if (!inviteError.message.includes("already been registered")) {
        return NextResponse.json({ error: `Erro ao enviar convite: ${inviteError.message}` }, { status: 500 })
      }
      // Busca o user_id do usuário já existente
      const { data: existingUsers } = await adminClient.auth.admin.listUsers()
      const existingUser = existingUsers?.users?.find(u => u.email === email.trim())
      if (existingUser) auth_user_id = existingUser.id
    } else {
      auth_user_id = inviteData?.user?.id || null
      invite_sent_at = new Date().toISOString()
    }
  }

  const { data, error } = await supabase
    .from("clinic_staff")
    .insert({
      full_name: full_name.trim(),
      role: role || "Dentista",
      specialty: specialty || null,
      email: email?.trim() || null,
      phone: phone?.trim() || null,
      access_role: access_role || "dentista",
      auth_user_id,
      invite_sent_at,
      user_id: user.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data, invite_sent: !!invite_sent_at })
}

export async function PUT(request: Request) {
  const result = await getAuthenticatedClient()
  if ("error" in result && result.error) return result.error
  const { supabase, user } = result as any

  const body = await request.json()
  const { id, ...updates } = body

  const { data, error } = await supabase
    .from("clinic_staff")
    .update(updates)
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function DELETE(request: Request) {
  const result = await getAuthenticatedClient()
  if ("error" in result && result.error) return result.error
  const { supabase, user } = result as any

  const { searchParams } = new URL(request.url)
  const id = searchParams.get("id")
  if (!id) return NextResponse.json({ error: "ID obrigatório" }, { status: 400 })

  const { error } = await supabase
    .from("clinic_staff")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
