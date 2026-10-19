import { Suspense } from "react"
import { AppLayout } from "@/components/app-layout"
import { AgendaView } from "@/components/agenda/agenda-view"

export default function AgendaPage() {
  return (
    <AppLayout>
      <Suspense fallback={<p>Carregando agenda…</p>}><AgendaView /></Suspense>
    </AppLayout>
  )
}
