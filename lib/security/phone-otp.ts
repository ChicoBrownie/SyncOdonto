import { createHmac, timingSafeEqual } from "node:crypto"

const secret = () => process.env.PHONE_OTP_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || ""

export function hashPhoneOtp(id: string, userId: string, otp: string) {
  if (!secret()) throw new Error("PHONE_OTP_SECRET não configurado")
  return createHmac("sha256", secret()).update(`${id}:${userId}:${otp}`).digest("hex")
}

export function matchesPhoneOtp(expectedHash: string, id: string, userId: string, otp: string) {
  const actual = Buffer.from(hashPhoneOtp(id, userId, otp), "hex")
  const expected = Buffer.from(expectedHash, "hex")
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

export function normalizeBrazilianPhone(value: string) {
  const digits = value.replace(/\D/g, "")
  return digits.length === 10 || digits.length === 11 ? digits : null
}
