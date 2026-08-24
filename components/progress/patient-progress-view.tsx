"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { TrendingDown, Calendar, Share2 } from "lucide-react"
import { CariesIndexChart } from "./caries-index-chart"
import { PeriodontalHealthChart } from "./periodontal-health-chart"
import { ComparisonChart } from "./comparison-chart"

export function PatientProgressView() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Progresso do Paciente</h1>
        <p className="text-muted-foreground">Evolução visual da saúde bucal</p>
      </div>

      {/* Patient Info Card */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary text-xl font-semibold">
                MS
              </div>
              <div>
                <h2 className="text-xl font-semibold text-foreground">Maria Santos</h2>
                <p className="text-sm text-muted-foreground">34 anos • Em acompanhamento desde Out/2024</p>
              </div>
            </div>
            <Button variant="outline" className="gap-2 bg-transparent">
              <Share2 className="h-4 w-4" />
              Compartilhar com Paciente
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Health Metrics */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Índice de Cárie</p>
                <p className="mt-2 text-3xl font-bold text-foreground">0.8</p>
                <p className="mt-1 text-xs text-muted-foreground">Meta: {"<"} 1.0 ✓</p>
              </div>
              <div className="flex items-center gap-1 rounded-full bg-success/10 px-2 py-1">
                <TrendingDown className="h-4 w-4 text-success" />
                <span className="text-xs font-medium text-success">-75%</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Saúde Periodontal</p>
                <p className="mt-2 text-3xl font-bold text-foreground">90%</p>
                <p className="mt-1 text-xs text-muted-foreground">Excelente evolução</p>
              </div>
              <div className="flex items-center gap-1 rounded-full bg-success/10 px-2 py-1">
                <TrendingDown className="h-4 w-4 text-success" />
                <span className="text-xs font-medium text-success">+78%</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div>
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Consultas Realizadas
              </p>
              <p className="mt-2 text-3xl font-bold text-foreground">12</p>
              <p className="mt-1 text-xs text-muted-foreground">Últimos 6 meses</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <CariesIndexChart data={[]} />
        <PeriodontalHealthChart data={[]} />
      </div>

      {/* Comparison Chart */}
      <ComparisonChart treatments={[]} />
    </div>
  )
}
