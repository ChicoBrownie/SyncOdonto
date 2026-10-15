"use client"

import Link from "next/link"
import { Bell, LogOut, UserRound } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/lib/hooks/use-auth"
import { flushEncounterEdits } from "@/lib/encounters/client"
import { toast } from "sonner"

export function AccountSettings() {
  const { user, isAuthenticated, signOut } = useAuth()
  const name = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Conta"
  return <section className="grid gap-4 sm:grid-cols-2" aria-label="Perfil e notificações">
    <div className="rounded-xl border bg-card p-4">
      <div className="mb-3 flex items-center gap-2 font-semibold"><UserRound className="h-5 w-5 text-primary" />Perfil</div>
      {isAuthenticated ? <><p>{name}</p><p className="mb-4 break-all text-sm text-muted-foreground">{user?.email}</p><div className="flex flex-wrap gap-2"><Button asChild variant="outline"><Link href="/minha-conta">Minha conta</Link></Button><Button variant="ghost" onClick={() => void flushEncounterEdits().then(() => signOut()).catch(error => toast.error(error instanceof Error ? error.message : "Salve o atendimento antes de sair."))}><LogOut className="mr-2 h-4 w-4" />Sair</Button></div></> : <Button asChild><Link href="/auth/login">Entrar</Link></Button>}
    </div>
    <div className="rounded-xl border bg-card p-4">
      <div className="mb-3 flex items-center gap-2 font-semibold"><Bell className="h-5 w-5 text-primary" />Notificações</div>
      <p className="text-sm text-muted-foreground">Sistema pronto. Bem-vindo ao SyncOdonto!</p>
    </div>
  </section>
}
