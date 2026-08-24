export async function verifyRecaptcha(token: string, expectedAction: string) {
  const secret = process.env.RECAPTCHA_SECRET_KEY
  if (!secret) return { ok: false as const, status: 503, error: "reCAPTCHA não configurado no servidor." }
  if (!token) return { ok: false as const, status: 403, error: "Validação anti-robô ausente." }

  const body = new URLSearchParams({ secret, response: token })
  const response = await fetch("https://www.google.com/recaptcha/api/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  })
  if (!response.ok) return { ok: false as const, status: 502, error: "Não foi possível validar o reCAPTCHA." }

  const result = await response.json()
  if (!result.success || Number(result.score) < 0.5 || result.action !== expectedAction) {
    return { ok: false as const, status: 403, error: "Solicitação rejeitada pela proteção anti-robô." }
  }
  return { ok: true as const }
}
