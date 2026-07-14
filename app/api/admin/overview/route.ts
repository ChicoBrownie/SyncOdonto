import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

// ── ID do administrador autorizado a acessar este painel ───────────────────
const ADMIN_USER_IDS = [
  "9185a031-de69-4f9f-a4e1-24352cc7722f",
  "f02efbc1-919c-4afa-a8b1-58cd90e7277b",
  "ecc4b798-4abc-43af-b298-e9bba09312cb",
]

// Cliente com Service Role — ignora RLS, só usado neste arquivo de servidor
function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(url, serviceKey)
}

// Cliente normal — só para validar quem está fazendo a requisição
import { createClient as createServerClient } from "@/lib/supabase/server"

export async function GET() {
  // 1. Verifica se quem está chamando é o admin autorizado
  const authClient = await createServerClient()
  const { data: { user }, error: authError } = await authClient.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 })
  }

  if (!ADMIN_USER_IDS.includes(user.id)) {
    return NextResponse.json({ error: "Acesso restrito ao administrador." }, { status: 403 })
  }

  // 2. Usa o Service Role para buscar dados de TODAS as contas
  const supabase = getServiceClient()

  const { data: patientsData } = await supabase
    .from("patients")
    .select("user_id")

  const { data: appointmentsData } = await supabase
    .from("appointments")
    .select("user_id, date, status, created_at")

  const { data: financialData } = await supabase
    .from("financial_transactions")
    .select("user_id, amount, status, type, created_at")

  const { data: usersData } = await supabase.auth.admin.listUsers()

  // 3. Agrupa tudo por user_id
  const userIds = new Set<string>()
  ;[...(patientsData || []), ...(appointmentsData || []), ...(financialData || [])]
    .forEach((row: any) => userIds.add(row.user_id))

  const today = new Date()
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)

  const accounts = Array.from(userIds).map((uid) => {
    const authUser = usersData?.users?.find((u) => u.id === uid)

    const userPatients = (patientsData || []).filter((p: any) => p.user_id === uid)
    const userAppointments = (appointmentsData || []).filter((a: any) => a.user_id === uid)
    const userFinancial = (financialData || []).filter((f: any) => f.user_id === uid)

    const appointmentsThisMonth = userAppointments.filter(
      (a: any) => new Date(a.created_at) >= startOfMonth
    )

    const revenueThisMonth = userFinancial
      .filter((f: any) => f.type === "income" && f.status === "paid" && new Date(f.created_at) >= startOfMonth)
      .reduce((sum: number, f: any) => sum + (Number(f.amount) || 0), 0)

    // Última atividade = data de criação mais recente entre agendamentos
    const lastActivity = userAppointments
      .map((a: any) => new Date(a.created_at).getTime())
      .sort((a, b) => b - a)[0]

    return {
      userId: uid,
      email: authUser?.email || "—",
      createdAt: authUser?.created_at || null,
      lastSignInAt: authUser?.last_sign_in_at || null,
      lastActivity: lastActivity ? new Date(lastActivity).toISOString() : null,
      totalPatients: userPatients.length,
      totalAppointments: userAppointments.length,
      appointmentsThisMonth: appointmentsThisMonth.length,
      revenueThisMonth,
    }
  })

  // Ordena por última atividade (mais recente primeiro)
  accounts.sort((a, b) => {
    if (!a.lastActivity) return 1
    if (!b.lastActivity) return -1
    return new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime()
  })

  return NextResponse.json({
    totalAccounts: accounts.length,
    accounts,
  })
}