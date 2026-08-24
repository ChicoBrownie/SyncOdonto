"use client"

import Script from "next/script"
import { useEffect, useState } from "react"
import useSWR from "swr"
import { AppLayout } from "@/components/app-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Loader2, Mail, Phone, ShieldCheck } from "lucide-react"
import { toast } from "sonner"

declare global {
  interface Window {
    grecaptcha?: { ready: (callback: () => void) => void; execute: (siteKey: string, options: { action: string }) => Promise<string> }
  }
}

const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || ""
const fetcher = (url: string) => fetch(url).then(async (response) => {
  const body = await response.json()
  if (!response.ok) throw new Error(body.error)
  return body
})

async function recaptchaToken(action: string) {
  if (!siteKey || !window.grecaptcha) throw new Error("Proteção reCAPTCHA ainda não está disponível.")
  await new Promise<void>((resolve) => window.grecaptcha!.ready(resolve))
  return window.grecaptcha.execute(siteKey, { action })
}

export default function MyAccountPage() {
  const { data, isLoading, mutate } = useSWR("/api/account", fetcher)
  const [phone, setPhone] = useState("")
  const [requestId, setRequestId] = useState<string | null>(null)
  const [emailHint, setEmailHint] = useState("")
  const [code, setCode] = useState("")
  const [sending, setSending] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [cooldown, setCooldown] = useState(0)

  useEffect(() => { if (data?.data?.phone) setPhone(data.data.phone) }, [data])
  useEffect(() => {
    if (cooldown <= 0) return
    const timer = window.setInterval(() => setCooldown((value) => Math.max(0, value - 1)), 1000)
    return () => window.clearInterval(timer)
  }, [cooldown])

  const requestCode = async () => {
    setSending(true)
    try {
      const token = await recaptchaToken("request_phone_change")
      const response = await fetch("/api/account/phone/request", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, recaptchaToken: token }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || "Não foi possível enviar o código.")
      setRequestId(body.requestId)
      setEmailHint(body.emailHint)
      setCode("")
      setCooldown(60)
      toast.success("Código enviado para seu e-mail atual.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao solicitar alteração")
    } finally { setSending(false) }
  }

  const confirmCode = async () => {
    if (!requestId) return
    setConfirming(true)
    try {
      const response = await fetch("/api/account/phone/confirm", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, code }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || "Código inválido.")
      setRequestId(null)
      await mutate()
      toast.success("Telefone atualizado com segurança.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível confirmar o código")
    } finally { setConfirming(false) }
  }

  return (
    <AppLayout>
      {siteKey && <Script src={`https://www.google.com/recaptcha/api.js?render=${siteKey}`} strategy="afterInteractive" />}
      <div className="mx-auto max-w-2xl space-y-6">
        <div><h1 className="text-3xl font-bold">Minha Conta</h1><p className="text-muted-foreground">Gerencie seus dados pessoais com segurança.</p></div>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary" />Dados da conta</CardTitle></CardHeader>
          <CardContent className="space-y-5">
            {isLoading ? <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div> : <>
              <div className="space-y-2"><Label>Nome</Label><Input value={data?.data?.full_name || ""} disabled /></div>
              <div className="space-y-2"><Label className="flex items-center gap-2"><Mail className="h-4 w-4" />E-mail de segurança</Label><Input value={data?.data?.email || ""} disabled /><p className="text-xs text-muted-foreground">O código de confirmação será enviado para este endereço.</p></div>
              <div className="space-y-2"><Label htmlFor="phone" className="flex items-center gap-2"><Phone className="h-4 w-4" />Celular</Label><Input id="phone" inputMode="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="(85) 99999-9999" /></div>
              {!siteKey && <p className="text-sm text-amber-700">Configure NEXT_PUBLIC_RECAPTCHA_SITE_KEY para habilitar alterações.</p>}
              <Button onClick={requestCode} disabled={sending || cooldown > 0 || !siteKey || phone.replace(/\D/g, "") === String(data?.data?.phone || "").replace(/\D/g, "")}>
                {sending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {cooldown > 0 ? `Reenviar em ${cooldown}s` : "Enviar código de confirmação"}
              </Button>
            </>}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!requestId} onOpenChange={(open) => { if (!open && !confirming) setRequestId(null) }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Confirme seu novo telefone</DialogTitle><DialogDescription>Digite o código de 6 dígitos enviado para {emailHint || "seu e-mail"}. Ele expira em 10 minutos.</DialogDescription></DialogHeader>
          <div className="py-4"><Label htmlFor="otp">Código de segurança</Label><Input id="otp" className="mt-2 text-center text-2xl tracking-[0.5em]" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} autoFocus /></div>
          <DialogFooter><Button variant="outline" onClick={() => setRequestId(null)} disabled={confirming}>Cancelar</Button><Button onClick={confirmCode} disabled={confirming || code.length !== 6}>{confirming && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Confirmar telefone</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  )
}
