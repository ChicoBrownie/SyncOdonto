import { resend } from "./resend"

export async function sendPhoneOtpEmail(to: string, otp: string) {
  const { error } = await resend.emails.send({
    from: process.env.EMAIL_FROM || "SyncOdonto <onboarding@resend.dev>",
    to,
    subject: "Código para confirmar seu novo telefone",
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px;color:#172033">
        <h2>Confirmação de segurança</h2>
        <p>Recebemos uma solicitação para alterar o telefone da sua conta SyncOdonto.</p>
        <p style="font-size:32px;font-weight:700;letter-spacing:8px;text-align:center;background:#f1f5f9;padding:20px;border-radius:8px">${otp}</p>
        <p>Este código expira em 10 minutos. Não compartilhe o código com ninguém.</p>
        <p style="font-size:12px;color:#64748b">Se você não fez esta solicitação, ignore este e-mail. Seu telefone atual não foi alterado.</p>
      </div>`,
  })
  if (error) throw new Error(error.message)
}
