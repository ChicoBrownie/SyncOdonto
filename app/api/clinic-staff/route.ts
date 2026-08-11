import { NextResponse } from "next/server"
import { getClinicScopedClient } from "@/lib/supabase/clinic-scope"
import { createClient } from "@supabase/supabase-js"
import { generateTempPassword } from "@/lib/utils/generate-password"
import { sendStaffCredentialsEmail } from "@/lib/email/send-staff-credentials"

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET() {
  const result = await getClinicScopedClient()
  if ("error" in result && result.error) return result.error
  const { supabase, ownerId } = result as any

  const { data, error } = await supabase
    .from("clinic_staff")
    .select("*")
    .eq("user_id", ownerId)
    .order("created_at", { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(request: Request) {
  const result = await getClinicScopedClient()
  if ("error" in result && result.error) return result.error
  const { supabase, user, ownerId } = result as any

  const body = await request.json()
  const { full_name, role, specialty, email, phone, access_role, password: providedPassword } = body

  if (!full_name?.trim()) {
    return NextResponse.json({ error: "Nome é obrigatório" }, { status: 400 })
  }

  let auth_user_id = null
  let invite_sent_at = null
  let emailWarning: string | null = null
  // Sempre devolvida na resposta pro gestor poder ver/copiar,
  // já que o envio por e-mail (sandbox Resend) não é garantido.
  let tempPasswordToReturn: string | null = null
  let emailDelivered = false

  if (email?.trim() && access_role && access_role !== "gestor") {
    const adminClient = getServiceClient()
    const tempPassword = providedPassword?.trim() || generateTempPassword()

    const { data: createData, error: createError } = await adminClient.auth.admin.createUser({
      email: email.trim(),
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        full_name: full_name.trim(),
        access_role,
        invited_by: user.id,
        must_change_password: true,
      },
    })

    if (createError) {
      // Se o usuário já existe, segue sem erro (só vincula depois)
      if (!createError.message.includes("already been registered")) {
        return NextResponse.json({ error: `Erro ao criar usuário: ${createError.message}` }, { status: 500 })
      }
      const { data: existingUsers } = await adminClient.auth.admin.listUsers()
      const existingUser = existingUsers?.users?.find((u) => u.email === email.trim())
      if (existingUser) auth_user_id = existingUser.id
    } else {
      auth_user_id = createData?.user?.id || null
      invite_sent_at = new Date().toISOString()
      tempPasswordToReturn = tempPassword

      try {
        await sendStaffCredentialsEmail({
          to: email.trim(),
          fullName: full_name.trim(),
          password: tempPassword,
          accessRole: access_role,
        })
        emailDelivered = true
      } catch (emailError) {
        console.error("Falha ao enviar e-mail de credenciais:", emailError)
        // Não bloqueia a criação do funcionário — só avisa o gestor
        emailWarning = "O e-mail de credenciais não pôde ser enviado. Copie a senha abaixo e informe ao funcionário manualmente."
      }
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
      user_id: ownerId,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    data,
    invite_sent: !!invite_sent_at,
    email_delivered: emailDelivered,
    temp_password: tempPasswordToReturn,
    warning: emailWarning,
  })
}

export async function PUT(request: Request) {
  const result = await getClinicScopedClient()
  if ("error" in result && result.error) return result.error
  const { supabase, ownerId } = result as any

  const body = await request.json()
  const { id, ...updates } = body

  const { data, error } = await supabase
    .from("clinic_staff")
    .update(updates)
    .eq("id", id)
    .eq("user_id", ownerId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function DELETE(request: Request) {
  const result = await getClinicScopedClient()
  if ("error" in result && result.error) return result.error
  const { supabase, ownerId } = result as any

  const { searchParams } = new URL(request.url)
  const id = searchParams.get("id")
  if (!id) return NextResponse.json({ error: "ID obrigatório" }, { status: 400 })

  const { error } = await supabase
    .from("clinic_staff")
    .delete()
    .eq("id", id)
    .eq("user_id", ownerId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
