import { AppLayout } from "@/components/app-layout"
import { FinancialView } from "@/components/reports/financial-view"

export default async function FinanceiroPage({ searchParams }: { searchParams: Promise<{ appointmentId?: string }> }) {
  const { appointmentId } = await searchParams
  return <AppLayout><FinancialView appointmentId={appointmentId} /></AppLayout>
}
