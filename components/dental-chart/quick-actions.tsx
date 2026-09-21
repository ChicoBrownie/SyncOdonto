import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Download, FileImage, Printer } from "lucide-react"

interface QuickActionsProps {
  toothNumber: number | null
}

export function QuickActions({ toothNumber }: QuickActionsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Ações Rápidas</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <Button variant="outline" className="w-full justify-start gap-2 bg-transparent">
          <Download className="h-4 w-4" />
          Exportar Odontograma
        </Button>
        <Button variant="outline" className="w-full justify-start gap-2 bg-transparent" disabled={!toothNumber}>
          <FileImage className="h-4 w-4" />
          Comparar com Anterior
        </Button>
        <Button variant="outline" className="w-full justify-start gap-2 bg-transparent">
          <Printer className="h-4 w-4" />
          Imprimir Odontograma
        </Button>
      </CardContent>
    </Card>
  )
}
