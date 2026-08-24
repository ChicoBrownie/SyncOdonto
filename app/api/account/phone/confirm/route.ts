import { NextResponse } from "next/server"
import { getClinicScopedClient } from "@/lib/supabase/clinic-scope"
import { matchesPhoneOtp } from "@/lib/security/phone-otp"

export async function POST(request: Request) {
  const scoped = await getClinicScopedClient()
  if ("error" in scoped && scoped.error) return scoped.error
  const { supabase, user } = scoped as any
  const { requestId, code } = await request.json().catch(() => ({}))
  if (!requestId || !/^\d{6}$/.test(String(code || ""))) {
    return NextResponse.json({ error: "Digite o código de 6 dígitos." }, { status: 400 })
  }

  const { data: pending } = await supabase.from("phone_change_otps")
    .select("id, new_phone, token_hash, expires_at, attempts, consumed_at")
    .eq("id", requestId).eq("user_id", user.id).maybeSingle()
  if (!pending || pending.consumed_at) return NextResponse.json({ error: "Código inválido ou já utilizado." }, { status: 400 })
  if (new Date(pending.expires_at).getTime() <= Date.now()) return NextResponse.json({ error: "O código expirou. Solicite um novo." }, { status: 410 })
  if ((pending.attempts || 0) >= 5) return NextResponse.json({ error: "Número máximo de tentativas excedido." }, { status: 429 })

  if (!matchesPhoneOtp(pending.token_hash, pending.id, user.id, String(code))) {
    await supabase.from("phone_change_otps").update({ attempts: (pending.attempts || 0) + 1 }).eq("id", pending.id).eq("user_id", user.id)
    return NextResponse.json({ error: "Código inválido." }, { status: 400 })
  }

  const consumedAt = new Date().toISOString()
  const { data: claimed } = await supabase.from("phone_change_otps")
    .update({ consumed_at: consumedAt }).eq("id", pending.id).eq("user_id", user.id).is("consumed_at", null).select("id").maybeSingle()
  if (!claimed) return NextResponse.json({ error: "Código já utilizado." }, { status: 409 })

  const { error: updateError } = await supabase.from("profiles").update({ phone: pending.new_phone }).eq("id", user.id)
  if (updateError) {
    await supabase.from("phone_change_otps").update({ consumed_at: null }).eq("id", pending.id).eq("user_id", user.id)
    return NextResponse.json({ error: "Não foi possível atualizar o telefone." }, { status: 500 })
  }
  return NextResponse.json({ success: true, phone: pending.new_phone })
}
