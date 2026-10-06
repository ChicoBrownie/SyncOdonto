import { AppLayout } from "@/components/app-layout"
import { EncounterEditor } from "@/components/encounters/encounter-editor"
export default async function EncounterDraftPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <AppLayout><EncounterEditor id={id} /></AppLayout>
}
