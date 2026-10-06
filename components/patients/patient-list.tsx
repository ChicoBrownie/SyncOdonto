"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search, Filter } from "lucide-react"
import Link from "next/link"
import useSWR from "swr"
import { PatientTable } from "./patient-table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function PatientList() {
  const { data: access } = useSWR("/api/auth/check-access", (url: string) => fetch(url).then(response => response.json()))
  const [searchQuery, setSearchQuery] = useState("")
  const [activeTab, setActiveTab] = useState("all")
  const [filters, setFilters] = useState({
    status: [] as string[],
    risk: [] as string[],
  })

  const tabs = [
    { id: "all", label: "Todos" },
    { id: "treatment", label: "Em Tratamento" },
    { id: "attention", label: "Atenção" },
    { id: "high-risk", label: "Alto Risco" },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-3xl font-bold text-foreground">Lista de Pacientes</h1><p className="text-muted-foreground">Gerencia e acompanhe seus pacientes</p></div>
        {access?.access_role === "gestor" && <Button variant="outline" asChild><Link href="/importacao">Importar pacientes</Link></Button>}
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, CPF ou telefone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Filter Button */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2 bg-transparent">
                  <Filter className="h-4 w-4" />
                  Filtros
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="px-2 py-1.5 text-sm font-semibold">Status</div>
                <DropdownMenuCheckboxItem>Ativo</DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem>Em Tratamento</DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem>Concluído</DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem>Atenção</DropdownMenuCheckboxItem>
                <div className="my-1 h-px bg-border" />
                <div className="px-2 py-1.5 text-sm font-semibold">Risco Clínico</div>
                <DropdownMenuCheckboxItem>Baixo</DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem>Médio</DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem>Alto</DropdownMenuCheckboxItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Tabs */}
          <div className="mt-4 flex gap-2 border-b border-border overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Patient Table */}
      <PatientTable searchQuery={searchQuery} activeTab={activeTab} />
    </div>
  )
}
