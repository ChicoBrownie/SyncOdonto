'use client'

import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import Link from 'next/link'
import { useState } from 'react'
import { Stethoscope, ArrowLeft, CheckCircle } from 'lucide-react'

export default function EsqueciSenhaPage() {
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const supabase = createClient()
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${siteUrl}/auth/nova-senha`,
      })

      if (error) {
        setError('Erro ao enviar email. Verifique o endereço e tente novamente.')
      } else {
        setSent(true)
      }
    } catch {
      setError('Erro de conexão. Tente novamente.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10 bg-gradient-to-br from-teal-50 to-cyan-100">
      <div className="w-full max-w-sm">
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Stethoscope className="h-10 w-10 text-teal-600" />
            <span className="text-3xl font-bold text-teal-700">SyncOdonto</span>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">Recuperar senha</CardTitle>
              <CardDescription>
                {sent
                  ? "Email enviado com sucesso!"
                  : "Digite seu email para receber o link de recuperação"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {sent ? (
                <div className="flex flex-col items-center gap-4 py-4 text-center">
                  <CheckCircle className="h-12 w-12 text-teal-600" />
                  <p className="text-sm text-muted-foreground">
                    Enviamos um link para <strong>{email}</strong>. Verifique sua caixa de entrada e clique no link para criar uma nova senha.
                  </p>
                  <Link href="/auth/login">
                    <Button variant="outline" className="bg-transparent gap-2 mt-2">
                      <ArrowLeft className="h-4 w-4" />
                      Voltar para o login
                    </Button>
                  </Link>
                </div>
              ) : (
                <form onSubmit={handleSubmit}>
                  <div className="flex flex-col gap-5">
                    <div className="grid gap-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="seu@email.com"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </div>

                    {error && (
                      <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                        {error}
                      </p>
                    )}

                    <Button type="submit" className="w-full bg-teal-600 hover:bg-teal-700" disabled={isLoading}>
                      {isLoading ? 'Enviando...' : 'Enviar link de recuperação'}
                    </Button>

                    <Link href="/auth/login" className="text-center">
                      <Button variant="ghost" type="button" className="w-full gap-2 text-muted-foreground">
                        <ArrowLeft className="h-4 w-4" />
                        Voltar para o login
                      </Button>
                    </Link>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
