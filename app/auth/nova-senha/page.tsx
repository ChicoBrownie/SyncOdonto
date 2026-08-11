'use client'

import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useEffect, Suspense } from 'react'
import { Stethoscope, Eye, EyeOff, CheckCircle } from 'lucide-react'

function NovaSenhaForm() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [userName, setUserName] = useState<string | null>(null)
  const [isInvite, setIsInvite] = useState(false)
  const [isForced, setIsForced] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const supabase = createClient()
    const type = searchParams.get('type')
    const token_hash = searchParams.get('token_hash')

    if (type === 'force') setIsForced(true)
    if (type === 'invite') setIsInvite(true)

    if (token_hash && type === 'invite') {
      supabase.auth.verifyOtp({ token_hash, type: 'invite' }).then(({ data, error }) => {
        if (!error && data.user) {
          setUserName(data.user.user_metadata?.full_name || null)
          setIsInvite(true)
        }
      })
    } else {
      supabase.auth.getUser().then(({ data }) => {
        if (data.user) {
          setUserName(data.user.user_metadata?.full_name || null)
          if (type !== 'force' && data.user.user_metadata?.access_role) {
            setIsInvite(true)
          }
        }
      })
    }
  }, [searchParams])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.')
      return
    }

    if (password !== confirm) {
      setError('As senhas não coincidem. Verifique e tente novamente.')
      return
    }

    setIsLoading(true)

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.updateUser({
        password,
        data: { must_change_password: false },
      })

      if (error) {
        setError('Erro ao definir senha. O link pode ter expirado. Solicite um novo.')
      } else {
        await fetch("/api/auth/link-staff", { method: "POST" }).catch(() => {})
        setDone(true)
        setTimeout(() => router.push('/'), 2500)
      }
    } catch {
      setError('Erro de conexão. Tente novamente.')
    } finally {
      setIsLoading(false)
    }
  }

  const passwordsMatch = confirm.length > 0 && password === confirm

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
              <CardTitle className="text-2xl">
                {isForced ? "Defina sua senha" : isInvite ? "Bem-vindo ao SyncOdonto! 👋" : "Nova senha"}
              </CardTitle>
              <CardDescription>
                {done
                  ? "Senha definida com sucesso!"
                  : isForced
                  ? "Por segurança, você precisa criar uma nova senha antes de continuar."
                  : isInvite && userName
                  ? `Olá, ${userName.split(" ")[0]}! Crie sua senha para acessar o sistema.`
                  : isInvite
                  ? "Crie sua senha para acessar o sistema pela primeira vez."
                  : "Digite e confirme sua nova senha."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {done ? (
                <div className="flex flex-col items-center gap-4 py-4 text-center">
                  <CheckCircle className="h-12 w-12 text-teal-600" />
                  <p className="text-sm text-muted-foreground">
                    {isInvite || isForced ? "Conta ativada! Redirecionando para o sistema..." : "Senha alterada! Redirecionando..."}
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmit}>
                  <div className="flex flex-col gap-5">
                    <div className="grid gap-2">
                      <Label htmlFor="password">
                        {isInvite || isForced ? "Criar senha" : "Nova senha"}
                      </Label>
                      <div className="relative">
                        <Input
                          id="password"
                          type={showPassword ? "text" : "password"}
                          placeholder="Mínimo 6 caracteres"
                          required
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                          tabIndex={-1}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="confirm">Confirmar senha</Label>
                      <div className="relative">
                        <Input
                          id="confirm"
                          type={showConfirm ? "text" : "password"}
                          placeholder="Digite a senha novamente"
                          required
                          value={confirm}
                          onChange={(e) => setConfirm(e.target.value)}
                          className={`pr-10 ${
                            confirm.length > 0
                              ? passwordsMatch
                                ? "border-teal-500 focus-visible:ring-teal-500"
                                : "border-red-400 focus-visible:ring-red-400"
                              : ""
                          }`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirm(!showConfirm)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                          tabIndex={-1}
                        >
                          {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      {confirm.length > 0 && (
                        <p className={`text-xs ${passwordsMatch ? "text-teal-600" : "text-red-500"}`}>
                          {passwordsMatch ? "✓ As senhas coincidem" : "As senhas não coincidem"}
                        </p>
                      )}
                    </div>

                    {error && (
                      <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                        {error}
                      </p>
                    )}

                    <Button
                      type="submit"
                      className="w-full bg-teal-600 hover:bg-teal-700"
                      disabled={isLoading || !passwordsMatch}
                    >
                      {isLoading
                        ? "Salvando..."
                        : isForced
                        ? "Confirmar nova senha"
                        : isInvite
                        ? "Ativar minha conta"
                        : "Salvar nova senha"}
                    </Button>
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

export default function NovaSenhaPage() {
  return (
    <Suspense>
      <NovaSenhaForm />
    </Suspense>
  )
}
