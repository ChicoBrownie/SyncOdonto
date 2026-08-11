import { resend } from "./resend"

type SendStaffCredentialsParams = {
  to: string
  fullName: string
  password: string
  accessRole: string
  clinicName?: string
}

export async function sendStaffCredentialsEmail({
  to,
  fullName,
  password,
  accessRole,
  clinicName = "SyncOdonto",
}: SendStaffCredentialsParams) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://syncodonto.netlify.app"
  const loginUrl = `${siteUrl}/auth/login`
  const roleLabel = accessRole === "dentista" ? "Dentista" : accessRole === "recepcionista" ? "Recepcionista" : accessRole

  const html = `
  <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; color: #1a1a1a;">
    <h2 style="color: #0f172a;">Bem-vindo(a) ao ${clinicName}</h2>
    <p>Olá, ${fullName}!</p>
    <p>Uma conta foi criada para você na plataforma ${clinicName} com o perfil de <strong>${roleLabel}</strong>.</p>
    <div style="background: #f4f4f5; border-radius: 8px; padding: 16px; margin: 20px 0;">
      <p style="margin: 0 0 8px;"><strong>Login:</strong> ${to}</p>
      <p style="margin: 0;"><strong>Senha provisória:</strong> ${password}</p>
    </div>
    <p>Por segurança, você vai precisar trocar essa senha assim que fizer o primeiro login.</p>
    <a href="${loginUrl}" style="display:inline-block; background:#0f172a; color:#fff; padding:10px 20px; border-radius:6px; text-decoration:none; margin-top:12px;">Acessar plataforma</a>
    <p style="margin-top: 24px; font-size: 12px; color: #666;">Se você não esperava este e-mail, ignore ou fale com a gestão da clínica.</p>
  </div>
  `

  const { data, error } = await resend.emails.send({
    from: process.env.EMAIL_FROM || "SyncOdonto <onboarding@resend.dev>",
    to,
    subject: `Seu acesso ao ${clinicName}`,
    html,
  })

  if (error) throw new Error(`Falha ao enviar e-mail: ${error.message}`)
  return data
}