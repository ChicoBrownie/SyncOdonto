import { AppLayout } from "@/components/app-layout"
import { ClinicManagementView } from "@/components/clinic/clinic-management-view"

export default function ConfiguracoesPage() {
  return (
    <AppLayout>
      <ClinicManagementView initialTab="configuracoes" />
    </AppLayout>
  )
}
