"use client"

import type React from "react"
import { useState } from "react"
import { Sidebar } from "./sidebar"
import { Header } from "./header"
import { usePathname, useRouter } from "next/navigation"
import { EncounterGlobalControls, ClinicalMobileNav } from "@/components/encounters/global-controls"
import { ContextualHelp } from "@/components/encounters/contextual-help"
import { flushEncounterEdits } from "@/lib/encounters/client"
import { toast } from "sonner"
import { SWRConfig } from "swr"
import { Toaster } from "@/components/ui/sonner"

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const router = useRouter()
  const pathname = usePathname()
  const area = pathname.startsWith("/prontuario") ? "records" : pathname === "/agenda" ? "agenda" : pathname === "/pacientes" ? "patients" : pathname === "/odontograma" || pathname === "/mapa-odontologico" ? "chart" : pathname === "/financeiro" ? "finance" : null

  return (
    <SWRConfig value={{ provider: () => new Map() }}><div data-clinical={Boolean(area || pathname.startsWith("/atendimento"))} className="app-shell flex h-dvh overflow-hidden bg-background" onClickCapture={event => {
      const anchor = (event.target as HTMLElement).closest<HTMLAnchorElement>("a[href]")
      if (!anchor || anchor.target === "_blank" || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return
      const url = new URL(anchor.href, window.location.href)
      if (url.origin !== window.location.origin || url.pathname + url.search === window.location.pathname + window.location.search) return
      event.preventDefault()
      void flushEncounterEdits().then(() => router.push(url.pathname + url.search + url.hash)).catch(error => toast.error(error instanceof Error ? error.message : "Salve o atendimento antes de sair."))
    }}>
      {/* Sidebar desktop — sempre visível, no fluxo normal */}
      <div className="hidden lg:flex lg:w-64 lg:shrink-0">
        <Sidebar isOpen={true} onClose={() => {}} desktop />
      </div>

      {/* Sidebar mobile — overlay controlado pelo hamburguer */}
      <div className="lg:hidden">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      </div>

      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        <Header onMenuClick={() => setSidebarOpen(true)} />
        <EncounterGlobalControls />
        <main className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden">
          <div data-guide="clinical-main" className="container mx-auto min-w-0 p-4 lg:p-6">{area && <div className="mb-3 flex justify-end"><ContextualHelp key={area} area={area} steps={[
            { selector: "[data-guide='encounter-entry']", title: "Comece ou retome aqui", description: "Iniciar atendimento reúne as etapas clínicas com rascunho automático. Retomar atendimento recupera seus campos salvos, mesmo depois de fechar o navegador." },
            { selector: "[data-guide='clinical-main']", title: area === "finance" ? "Confira a cobrança" : area === "agenda" ? "Escolha a consulta" : area === "patients" ? "Localize a pessoa" : "Consulte o histórico clínico", description: area === "finance" ? "A consulta concluída cria uma única pendência. Confira o valor e confirme o recebimento nos controles financeiros existentes." : area === "agenda" ? "O botão Iniciar abre o atendimento e reaproveita esta consulta. Confirme o início antes de registrar os procedimentos." : area === "patients" ? "Busque por nome ou CPF e confira o cadastro. Use Iniciar atendimento para cadastro rápido e etapas clínicas com salvamento automático." : "O prontuário reúne saúde, dentes e exames. Para novos registros com rascunho e orçamento conectado, abra Iniciar atendimento e selecione este paciente." },
          ]} /></div>}{children}</div>
        </main>
        <ClinicalMobileNav />
        <Toaster position="top-center" richColors closeButton />
      </div>
    </div></SWRConfig>
  )
}

//só pra teste
