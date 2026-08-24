import { createClient } from "@/lib/supabase/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
import { getEffectivePermissions } from "@/lib/permissions"

export async function getClinicScopedClient() {
  try {
    const authClient = await createClient()
    const { data: { user }, error: authError } = await authClient.auth.getUser()

    if (authError || !user) {
      return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
    }

    const serviceClient = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: staff } = await serviceClient
      .from("clinic_staff")
      .select("user_id, access_role, permissions, is_active")
      .eq("auth_user_id", user.id)
      .maybeSingle()

    if (staff?.is_active === false) {
      return { error: NextResponse.json({ error: "Acesso desativado pelo gestor da clínica." }, { status: 403 }) }
    }

    const ownerId = staff?.user_id ?? user.id
    const accessRole = staff
      ? staff.access_role === "gestor" || staff.access_role === "dentista" || staff.access_role === "recepcionista"
        ? staff.access_role
        : "recepcionista"
      : "gestor"
    
    const permissions = getEffectivePermissions(accessRole, staff?.permissions as any)

    return { supabase: serviceClient, user, ownerId, accessRole, permissions }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Internal server error"
    if (message.includes("Supabase nao esta configurado")) {
      return { error: NextResponse.json({ error: "Supabase nao esta configurado. Conecte a integracao no painel lateral." }, { status: 503 }) }
    }
    return { error: NextResponse.json({ error: message }, { status: 500 }) }
  }
}
