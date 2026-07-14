import { updateSession } from '@/lib/supabase/middleware'
import { createServerClient } from '@supabase/ssr'
import { type NextRequest, NextResponse } from 'next/server'

// Rotas que cada perfil pode acessar
const ROLE_PERMISSIONS: Record<string, string[]> = {
  gestor: ["/"], // acesso total
  dentista: [
    "/dashboard",
    "/pacientes",
    "/agenda",
    "/prontuario",
    "/gestao-paperless",
    "/relatorios",
  ],
  recepcionista: [
    "/dashboard",
    "/pacientes",
    "/agenda",
    "/gestao-paperless",
  ],
}

// Rotas bloqueadas para não-gestores
const GESTOR_ONLY = [
  "/gestao-clinica",
  "/relatorios/financeiro",
  "/admin",
]

export async function middleware(request: NextRequest) {
  // Primeiro atualiza a sessão normalmente
  const response = await updateSession(request)
  const { pathname } = request.nextUrl

  // Rotas públicas — deixa passar
  if (
    pathname.startsWith('/auth') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/auth') ||
    pathname === '/favicon.ico'
  ) {
    return response
  }

  // Verifica se a rota é restrita a gestor
  const isGestorOnly = GESTOR_ONLY.some(route => pathname.startsWith(route))
  if (!isGestorOnly) return response

  // Cria cliente Supabase para verificar o perfil
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

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(new URL('/auth/login', request.url))
  }

  // Verifica se é funcionário (não é o dono da clínica)
  const { data: staffRecord } = await supabase
    .from('clinic_staff')
    .select('access_role')
    .eq('auth_user_id', user.id)
    .single()

  // Se for funcionário e não for gestor, bloqueia
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
