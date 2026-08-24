import { NextResponse } from "next/server"
import { getClinicScopedClient } from "@/lib/supabase/clinic-scope"
import { createClient } from "@supabase/supabase-js"
import { generateTempPassword } from "@/lib/utils/generate-password"
import { sendStaffCredentialsEmail } from "@/lib/email/send-staff-credentials"
import { isClinicManager, stripImmutableTenantFields } from "@/lib/security/request-data"

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

  // O gestor "dono" da clínica nunca tem uma linha própria em clinic_staff —
  // ele existe só como usuário de Auth. Sem isso, ele nunca aparecia na lista
  // de "Membros da Equipe", mesmo sendo o administrador do sistema.
  // Aqui montamos uma entrada "virtual" pra ele, só pra exibição — não é uma
  // linha real da tabela, então o front não deve permitir editar/excluir.
  const adminClient = getServiceClient()
  const { data: ownerAuth } = await adminClient.auth.admin.getUserById(ownerId)
  const ownerUser = ownerAuth?.user

  const ownerEntry = ownerUser
    ? {
        id: `owner-${ownerId}`,
        full_name: ownerUser.user_metadata?.full_name || ownerUser.email || "Gestor da Clínica",
        role: "Gestor",
        specialty: null,
        email: ownerUser.email || null,
        phone: null,
        access_role: "gestor",
        permissions: null,
        is_active: true,
        invite_sent_at: null,
        auth_user_id: ownerUser.id,
        user_id: ownerId,
        virtual: true,
      }
    : null

  const fullList = ownerEntry ? [ownerEntry, ...(data || [])] : data || []

  return NextResponse.json({ data: fullList })
}

export async function POST(request: Request) {
  const result = await getClinicScopedClient()
  if ("error" in result && result.error) return result.error
  const { supabase, user, ownerId, accessRole } = result as any

  if (!isClinicManager(accessRole)) {
    return NextResponse.json({ error: "Apenas o gestor da clínica pode adicionar membros." }, { status: 403 })
  }

  const body = await request.json()
  const { full_name, role, specialty, email, phone, access_role, permissions, password: providedPassword } = body

  if (!full_name?.trim()) {
    return NextResponse.json({ error: "Nome é obrigatório" }, { status: 400 })
  }

  let auth_user_id = null
  let invite_sent_at = null
  let emailWarning: string | null = null
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

    // Checagem de texto tolerante: versões diferentes do Supabase retornam
    // mensagens ligeiramente diferentes ("already been registered",
    // "User already registered", etc). Antes a checagem era exata demais
    // e podia cair no erro genérico abaixo sem motivo.
    const alreadyRegistered =
      createError?.message?.toLowerCase().includes("already") &&
      createError?.message?.toLowerCase().includes("regist")

    if (createError && !alreadyRegistered) {
      return NextResponse.json({ error: `Erro ao criar usuário: ${createError.message}` }, { status: 500 })
    }

    if (createError && alreadyRegistered) {
      // Cenário comum: a linha de clinic_staff foi apagada manualmente do
      // banco (ex: direto no painel do Supabase), mas o usuário de Auth
      // continua existindo. Antes o código só reaproveitava o ID e seguia
      // em frente, sem gerar senha nova nem reenviar convite — parecia que
      // "nada acontecia" ou dava erro guardado ao tentar convidar de novo.
      // Agora resetamos a senha e reenviamos o convite normalmente.
      const { data: existingUsers, error: listError } = await adminClient.auth.admin.listUsers()
      const existingUser = existingUsers?.users?.find((u) => u.email === email.trim())

      if (listError || !existingUser) {
        return NextResponse.json(
          { error: "Este e-mail já está cadastrado no sistema de autenticação, mas não foi possível localizar a conta para reenviar o convite. Contate o suporte." },
          { status: 500 }
        )
      }

      auth_user_id = existingUser.id

      const { error: updateError } = await adminClient.auth.admin.updateUserById(existingUser.id, {
        password: tempPassword,
        user_metadata: {
          full_name: full_name.trim(),
          access_role,
          invited_by: user.id,
          must_change_password: true,
        },
      })

      if (updateError) {
        return NextResponse.json(
          { error: `Não foi possível resetar a senha da conta existente: ${updateError.message}` },
          { status: 500 }
        )
      }

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
        emailWarning = "O e-mail de credenciais não pôde ser enviado. Copie a senha abaixo e informe ao funcionário manualmente."
      }
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
      permissions: access_role === "gestor" ? null : permissions || null,
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
  const { supabase, ownerId, accessRole } = result as any

  if (!isClinicManager(accessRole)) {
    return NextResponse.json({ error: "Apenas o gestor da clínica pode alterar membros." }, { status: 403 })
  }

  const body = await request.json()
  const { id } = body
  const updates = stripImmutableTenantFields(body)
  delete updates.auth_user_id

  if (typeof id === "string" && id.startsWith("owner-")) {
    return NextResponse.json({ error: "O gestor principal não pode ser editado por aqui." }, { status: 400 })
  }

  if (updates.access_role === "gestor") {
    updates.permissions = null
  }

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
  const { supabase, ownerId, accessRole } = result as any

  // Reforço no servidor: mesmo que o botão de excluir esteja escondido na UI
  // para quem não é gestor, sem essa checagem aqui qualquer funcionário
  // conseguiria apagar colegas chamando a rota diretamente (Postman, DevTools etc).
  if (accessRole !== "gestor") {
    return NextResponse.json(
      { error: "Apenas o gestor da clínica pode remover membros da equipe." },
      { status: 403 }
    )
  }

  const { searchParams } = new URL(request.url)
  const id = searchParams.get("id")
  if (!id) return NextResponse.json({ error: "ID obrigatório" }, { status: 400 })

  if (id.startsWith("owner-")) {
    return NextResponse.json({ error: "O gestor principal não pode ser removido." }, { status: 400 })
  }

  const { data, error } = await supabase
    .from("clinic_staff")
    .delete()
    .eq("id", id)
    .eq("user_id", ownerId)
    .select()

  if (error) {
    if (error.code === "23503") {
      return NextResponse.json(
        {
          error:
            "Não é possível remover este membro: existem consultas, prontuários ou lançamentos financeiros vinculados a ele. Desative o membro em vez de excluir, ou transfira esses registros antes.",
        },
        { status: 409 }
      )
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!data || data.length === 0) {
    return NextResponse.json(
      { error: "Membro não encontrado (ele pode já ter sido removido)." },
      { status: 404 }
    )
  }

  return NextResponse.json({ success: true })
}
