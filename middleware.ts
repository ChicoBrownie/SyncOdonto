import { updateSession } from '@/lib/supabase/middleware'
import { NextResponse, type NextRequest } from 'next/server'

const GESTOR_ONLY = [
  "/relatorios/financeiro",
  "/admin",
]

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const { supabaseResponse, user, supabase } = await updateSession(request)

  // Rotas públicas — deixa passar como updateSession já resolveu
  if (
    pathname.startsWith('/auth') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname === '/favicon.ico'
  ) {
    return supabaseResponse
  }

  // updateSession já redireciona pra /auth/login quando não há usuário
  if (!user || !supabase) {
    return supabaseResponse
  }

  // Senha provisória pendente — obriga trocar antes de acessar qualquer rota
  if (user.user_metadata?.must_change_password) {
    return NextResponse.redirect(new URL('/auth/nova-senha?type=force', request.url))
  }

  // Rotas restritas a gestor
  const isGestorOnly = GESTOR_ONLY.some(route => pathname.startsWith(route))
  if (!isGestorOnly) return supabaseResponse

  // Reaproveita o MESMO client (mesma sessão/cookies) já autenticado por
  // updateSession — não cria um segundo client nem chama getUser() de novo.
  const { data: staffRecord } = await supabase
    .from('clinic_staff')
    .select('access_role')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (staffRecord && staffRecord.access_role !== 'gestor') {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
