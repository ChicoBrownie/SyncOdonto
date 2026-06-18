import { AppLayout } from "@/components/app-layout"
import { FinancialView } from "@/components/reports/financial-view"
import { CashClosing } from "@/components/financeiro/cash-closing"

export default function FinanceiroPage() {
  return (
    <AppLayout>
      <div className="space-y-6">
        <CashClosing />
        <FinancialView />
      </div>
    </AppLayout>
  )
}
