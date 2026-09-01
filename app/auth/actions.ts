"use server"

import { createClient } from "@/lib/supabase/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"
import { consumeRateLimit } from "@/lib/security/rate-limit"

function getSecurityClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function loginAction(email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase()
  try {
    const allowed = await consumeRateLimit(getSecurityClient(), `login:${normalizedEmail}`, 10, 15 * 60)
    if (!allowed) return { error: "Muitas tentativas. Aguarde 15 minutos e tente novamente." }
  } catch {
    return { error: "A validação de segurança está temporariamente indisponível." }
  }
  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithPassword({
    email: normalizedEmail,
    password,
  })

  if (error) {
    return { error: error.message }
  }

  return { success: true }
}

export async function signUpAction(
  email: string,
  password: string,
  fullName: string,
  firstName: string,
  lastName: string
) {
  const normalizedEmail = email.trim().toLowerCase()
  try {
    const allowed = await consumeRateLimit(getSecurityClient(), `signup:${normalizedEmail}`, 5, 60 * 60)
    if (!allowed) return { error: "Muitas tentativas de cadastro. Tente novamente mais tarde." }
  } catch {
    return { error: "A validação de segurança está temporariamente indisponível." }
  }
  const supabase = await createClient()

  const { error } = await supabase.auth.signUp({
    email: normalizedEmail,
    password,
    options: {
      data: {
        full_name: fullName,
        first_name: firstName,
        last_name: lastName,
      },
    },
  })

  if (error) {
    return { error: error.message }
  }

  return { success: true }
}
