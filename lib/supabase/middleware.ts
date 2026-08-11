import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { SupabaseClient, User } from '@supabase/supabase-js'

type UpdateSessionResult = {
  supabaseResponse: NextResponse
  user: User | null
  supabase: SupabaseClient | null
}

export async function updateSession(request: NextRequest): Promise<UpdateSessionResult> {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    // Supabase not configured yet - allow all routes through
    return { supabaseResponse, user: null, supabase: null }
  }

  // With Fluid compute, don't put this client in a global environment
  // variable. Always create a new one on each request.
  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          )
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  // Do not run code between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  const pathname = request.nextUrl.pathname
  const isAuthRoute = pathname.startsWith('/auth')
  const isApiRoute = pathname.startsWith('/api')
  // /auth/nova-senha é a única página de /auth que um usuário JÁ AUTENTICADO
  // pode (e deve) acessar — fluxo de senha provisória (must_change_password),
  // convite, ou recuperação de senha. Por isso ela fica de fora da regra que
  // "expulsa" usuários logados de páginas de /auth, evitando loop de redirect
  // com o must_change_password no middleware.ts externo.
  const isNovaSenhaPage = pathname.startsWith('/auth/nova-senha')
  const isAuthPage = isAuthRoute // mantém o nome usado abaixo p/ a regra de "não logado"

  // IMPORTANT: If you remove getUser() and you use server-side rendering
  // with the Supabase client, your users may be randomly logged out.
  // Esta é a ÚNICA chamada a getUser() de toda a stack de middleware —
  // o resultado (user + supabase) é reaproveitado pelo middleware.ts
  // externo, em vez de fazer uma segunda chamada de rede.
  let user: User | null = null
  try {
    const { data } = await supabase.auth.getUser()
    user = data.user
  } catch (error) {
    // Se houver erro (ex: cookies antigos com URL errada),
    // consideramos o usuario como nao autenticado
    console.error('Error getting user:', error)
  }

  if (!user && !isAuthPage && !isApiRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth/login'
    return { supabaseResponse: NextResponse.redirect(url), user: null, supabase }
  }

  if (user && isAuthPage && !isNovaSenhaPage) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return { supabaseResponse: NextResponse.redirect(url), user, supabase }
  }

  // IMPORTANT: You *must* return the supabaseResponse object as it is.
  // If you're creating a new response object with NextResponse.next() make sure to:
  // 1. Pass the request in it, like so:
  //    const myNewResponse = NextResponse.next({ request })
  // 2. Copy over the cookies, like so:
  //    myNewResponse.cookies.setAll(supabaseResponse.cookies.getAll())
  // 3. Change the myNewResponse object to fit your needs, but avoid changing
  //    the cookies!
  // 4. Finally:
  //    return myNewResponse
  // If this is not done, you may be causing the browser and server to go out
  // of sync and terminate the user's session prematurely!

  return { supabaseResponse, user, supabase }
}
