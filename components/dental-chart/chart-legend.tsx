import { Card, CardContent } from "@/components/ui/card"
import { CONDITIONS } from "./dental-chart"

export function ChartLegend() {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-sm font-medium text-foreground mb-3">Legenda de condições</p>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {CONDITIONS.map((item) => (
            <div key={item.value} className="flex items-center gap-2">
              <div className={`h-3.5 w-3.5 rounded-full ${item.dotColor}`} />
              <span className="text-sm text-muted-foreground">{item.label}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
