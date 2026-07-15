import { updateSession } from '@/lib/supabase/middleware'
import { createServerClient } from '@supabase/ssr'
import { type NextRequest, NextResponse } from 'next/server'

const GESTOR_ONLY = [
  "/gestao-clinica",
  "/relatorios/financeiro",
  "/admin",
]

export async function middleware(request: NextRequest) {
  const response = await updateSession(request)
  const { pathname } = request.nextUrl

  // Rotas públicas — deixa passar
  if (
    pathname.startsWith('/auth') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname === '/favicon.ico'
  ) {
    return response
  }

  // Se não é rota restrita, deixa passar
  const isGestorOnly = GESTOR_ONLY.some(route => pathname.startsWith(route))
  if (!isGestorOnly) return response

  // Cria cliente para verificar sessão e perfil
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Pega usuário logado
  const { data: authData } = await supabase.auth.getUser()
  const user = authData?.user

  // Não logado — redireciona para login
  if (!user) {
    return NextResponse.redirect(new URL('/auth/login', request.url))
  }

  // Verifica perfil na tabela clinic_staff
  const { data: staffRecord } = await supabase
    .from('clinic_staff')
    .select('access_role')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  // Se for funcionário sem permissão de gestor, bloqueia
  if (staffRecord && staffRecord.access_role !== 'gestor') {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
