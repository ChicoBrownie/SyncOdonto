import { AppLayout } from "@/components/app-layout"
import { FinancialView } from "@/components/reports/financial-view"

export default async function FinanceiroPage({ searchParams }: { searchParams: Promise<{ patientId?: string }> }) {
  const { patientId } = await searchParams
  return <AppLayout><FinancialView patientId={patientId} /></AppLayout>
}
