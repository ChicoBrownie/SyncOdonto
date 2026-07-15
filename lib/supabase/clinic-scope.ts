import { createClient } from "@/lib/supabase/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

export async function getClinicScopedClient() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
    }

    const serviceClient = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: staff } = await serviceClient
      .from("clinic_staff")
      .select("user_id, access_role")
      .eq("auth_user_id", user.id)
      .maybeSingle()

    const ownerId = staff?.user_id ?? user.id
    const accessRole = staff?.access_role ?? "gestor"

    return { supabase, user, ownerId, accessRole }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Internal server error"
    if (message.includes("Supabase nao esta configurado")) {
      return { error: NextResponse.json({ error: "Supabase nao esta configurado. Conecte a integracao no painel lateral." }, { status: 503 }) }
    }
    return { error: NextResponse.json({ error: message }, { status: 500 }) }
  }
}
