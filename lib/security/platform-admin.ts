import { createClient as createServiceClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
import { createClient as createServerClient } from "@/lib/supabase/server"

export function getPlatformServiceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

/** Verifica o administrador da plataforma antes de usar o cliente de serviço. */
export async function getPlatformAdminContext() {
  const authClient = await createServerClient()
  const { data: { user }, error: authError } = await authClient.auth.getUser()

  if (authError || !user) {
    return { error: NextResponse.json({ error: "Não autenticado." }, { status: 401 }) }
  }

  const supabase = getPlatformServiceClient()
  const { data: admin, error } = await supabase
    .from("platform_admins")
    .select("user_id")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle()

  if (error || !admin) {
    return { error: NextResponse.json({ error: "Acesso restrito ao administrador." }, { status: 403 }) }
  }

  return { supabase, user }
}
