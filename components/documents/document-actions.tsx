import { Card, CardContent } from "@/components/ui/card"
import { Upload, FileText, FileSignature } from "lucide-react"

const actions = [
  {
    icon: Upload,
    label: "Novo Documento",
    description: "Upload ou criação de documento",
    color: "text-primary",
    bgColor: "bg-primary/10",
  },
  {
    icon: FileText,
    label: "Novo Termo",
    description: "Criar termo de consentimento",
    color: "text-success",
    bgColor: "bg-success/10",
  },
  {
    icon: FileSignature,
    label: "Novo Orçamento",
    description: "Gerar orçamento digital",
    color: "text-purple-600",
    bgColor: "bg-purple-600/10",
  },
]

export function DocumentActions({ onNewDocument, onNewTerm, onNewBudget }: { onNewDocument: () => void; onNewTerm: () => void; onNewBudget: () => void }) {
  const callbacks = [onNewDocument, onNewTerm, onNewBudget]
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {actions.map((action, index) => {
        const Icon = action.icon
        return (
          <Card key={action.label} role="button" tabIndex={0} onClick={callbacks[index]} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") callbacks[index]() }} className="cursor-pointer transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <CardContent className="p-6">
              <div className="flex flex-col items-center text-center gap-3">
                <div className={`rounded-lg p-4 ${action.bgColor}`}>
                  <Icon className={`h-6 w-6 ${action.color}`} />
                </div>
                <div>
                  <p className="font-medium text-foreground">{action.label}</p>
                  <p className="text-xs text-muted-foreground mt-1">{action.description}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
