import { AppLayout } from "@/components/app-layout"
import { ClinicManagementView } from "@/components/clinic/clinic-management-view"
import { AccountSettings } from "@/components/clinic/account-settings"

export default function ConfiguracoesPage() {
  return (
    <AppLayout>
      <div className="space-y-6"><h1 className="text-2xl font-bold">Ajustes</h1><AccountSettings /><ClinicManagementView initialTab="configuracoes" /></div>
    </AppLayout>
  )
}
