import { updateSession } from '@/lib/supabase/middleware'
import { NextResponse, type NextRequest } from 'next/server'
import { getEffectivePermissions, type StaffPermissions } from '@/lib/permissions'

const GESTOR_ONLY = [
  '/admin',
]

const PERMISSION_ROUTES: Record<string, keyof StaffPermissions> = {
  '/financeiro': 'financeiro',
  '/relatorios': 'relatorios',
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const { supabaseResponse, user, supabase } = await updateSession(request)

  if (
    pathname.startsWith('/auth') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname === '/favicon.ico'
  ) {
    return supabaseResponse
  }

  if (!user || !supabase) {
    return supabaseResponse
  }

  if (user.user_metadata?.must_change_password) {
    return NextResponse.redirect(new URL('/auth/nova-senha?type=force', request.url))
  }

  const isGestorOnly = GESTOR_ONLY.some(route => pathname.startsWith(route))
  const permissionEntry = Object.entries(PERMISSION_ROUTES).find(([route]) =>
    pathname.startsWith(route)
  )

  const { data: staffRecord } = await supabase
    .from('clinic_staff')
    .select('access_role, permissions, is_active')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (staffRecord?.is_active === false) {
    return NextResponse.redirect(new URL('/auth/error?error=access_disabled', request.url))
  }

  if (!isGestorOnly && !permissionEntry) return supabaseResponse

  const accessRole = staffRecord
    ? staffRecord.access_role === 'gestor' || staffRecord.access_role === 'dentista' || staffRecord.access_role === 'recepcionista'
      ? staffRecord.access_role
      : 'recepcionista'
    : 'gestor'

  if (isGestorOnly) {
    if (accessRole !== 'gestor') {
      return NextResponse.redirect(new URL('/', request.url))
    }
    return supabaseResponse
  }

  if (permissionEntry) {
    const [, permissionKey] = permissionEntry
    const permissions = getEffectivePermissions(accessRole, staffRecord?.permissions as any)
    if (!permissions[permissionKey]) {
      return NextResponse.redirect(new URL('/', request.url))
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
