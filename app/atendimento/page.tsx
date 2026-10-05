import { Suspense } from "react"
import { AppLayout } from "@/components/app-layout"
import { EncounterEntry } from "@/components/encounters/encounter-entry"
export default function EncounterPage() {
  return <AppLayout><Suspense fallback={<p>Carregando atendimento…</p>}><EncounterEntry /></Suspense></AppLayout>
}
