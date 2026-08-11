import { createClient } from "@/lib/supabase/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

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
      .select("user_id, access_role")
      .eq("auth_user_id", user.id)
      .maybeSingle()

    const ownerId = staff?.user_id ?? user.id
    const accessRole = staff?.access_role ?? "gestor"

    // IMPORTANTE: a partir daqui devolvemos o client de SERVICE ROLE (que
    // ignora RLS) em vez do client autenticado como o usuário logado.
    //
    // Motivo: as tabelas de dados da clínica (financial_transactions,
    // dental_charts, patients, appointments, etc.) têm policies de RLS que
    // checam `auth.uid() = user_id`. Os registros são salvos com
    // `user_id = ownerId` (o dono da clínica), mas um funcionário logado tem
    // seu PRÓPRIO auth.uid(), diferente do ownerId. Resultado: qualquer
    // INSERT/UPDATE feito por um funcionário (não o dono) violava a policy.
    //
    // Como o isolamento por clínica já é garantido no código de cada rota
    // (todo select/insert/update/delete usa `.eq("user_id", ownerId)`), não
    // precisamos mais da RLS pra isso — só precisamos GARANTIR que toda
    // rota nova continue filtrando manualmente por ownerId, já que agora
    // não existe mais essa rede de segurança do banco.
    return { supabase: serviceClient, user, ownerId, accessRole }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Internal server error"
    if (message.includes("Supabase nao esta configurado")) {
      return { error: NextResponse.json({ error: "Supabase nao esta configurado. Conecte a integracao no painel lateral." }, { status: 503 }) }
    }
    return { error: NextResponse.json({ error: message }, { status: 500 }) }
  }
}
