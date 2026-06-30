import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Brain, Sparkles } from "lucide-react"

export function AiAlerts() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-purple-600" />
            Alertas da IA
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <Sparkles className="h-8 w-8 text-purple-300 mb-3" />
          <p className="text-sm font-medium text-foreground">Em breve</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-[220px]">
            Alertas inteligentes de IA para apoiar diagnósticos e acompanhamento de pacientes.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}