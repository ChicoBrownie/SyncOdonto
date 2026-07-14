import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'
  const type = searchParams.get('type')

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      // Verifica se é convite pelo user_metadata
      const isInvite = data?.user?.app_metadata?.provider === 'email' &&
        data?.user?.user_metadata?.access_role !== undefined

      if (type === 'invite' || isInvite) {
        return NextResponse.redirect(`${origin}/auth/nova-senha?type=invite`)
      }
      if (type === 'recovery') {
        return NextResponse.redirect(`${origin}/auth/nova-senha`)
      }
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // Tenta detectar pelo hash (convites via magic link)
  return NextResponse.redirect(`${origin}/auth/nova-senha?type=invite`)
}
