import { randomInt, randomUUID } from "node:crypto"
import { NextResponse } from "next/server"
import { getClinicScopedClient } from "@/lib/supabase/clinic-scope"
import { verifyRecaptcha } from "@/lib/security/recaptcha"
import { hashPhoneOtp, normalizeBrazilianPhone } from "@/lib/security/phone-otp"
import { sendPhoneOtpEmail } from "@/lib/email/send-phone-otp"

export async function POST(request: Request) {
  const scoped = await getClinicScopedClient()
  if ("error" in scoped && scoped.error) return scoped.error
  const { supabase, user } = scoped as any
  const { phone, recaptchaToken } = await request.json().catch(() => ({}))

  const captcha = await verifyRecaptcha(recaptchaToken, "request_phone_change")
  if (!captcha.ok) return NextResponse.json({ error: captcha.error }, { status: captcha.status })

  const normalizedPhone = normalizeBrazilianPhone(String(phone || ""))
  if (!normalizedPhone) return NextResponse.json({ error: "Informe um celular válido com DDD." }, { status: 400 })
  if (!user.email) return NextResponse.json({ error: "Sua conta não possui um e-mail válido." }, { status: 400 })

  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
  const ip = forwarded || request.headers.get("x-real-ip") || "unknown"
  const id = randomUUID()
  const otp = randomInt(100000, 1000000).toString()
  const expiresAt = new Date(Date.now() + 10 * 60_000).toISOString()
  const { data: accepted, error: insertError } = await supabase.rpc("create_phone_change_otp", {
    p_id: id, p_user_id: user.id, p_new_phone: normalizedPhone,
    p_token_hash: hashPhoneOtp(id, user.id, otp), p_expires_at: expiresAt, p_requester_ip: ip,
  })
  if (insertError) return NextResponse.json({ error: "Não foi possível criar o código de confirmação." }, { status: 500 })
  if (!accepted) return NextResponse.json({ error: "Limite de 3 códigos em 5 minutos atingido. Tente novamente mais tarde." }, { status: 429 })

  try {
    await sendPhoneOtpEmail(user.email, otp)
  } catch {
    await supabase.from("phone_change_otps").delete().eq("id", id).eq("user_id", user.id)
    return NextResponse.json({ error: "Não foi possível enviar o e-mail de confirmação." }, { status: 502 })
  }

  return NextResponse.json({ requestId: id, expiresAt, emailHint: user.email.replace(/(^.).*(@.*$)/, "$1***$2") })
}
