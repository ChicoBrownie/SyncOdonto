"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle, Clock } from "lucide-react"
import useSWR from "swr"

type SignatureDocument = { status?: string; signed?: boolean; created_at: string }
const fetcher = async (url: string) => { const response = await fetch(url); if (!response.ok) throw new Error("Erro ao carregar documentos"); return response.json() }

export function DigitalSignature() {
  const { data } = useSWR<{ data: SignatureDocument[] }>("/api/documents", fetcher)
  const documents = data?.data || []
  const now = new Date()
  const signedThisMonth = documents.filter((document) => (document.status === "signed" || document.signed) && new Date(document.created_at).getMonth() === now.getMonth() && new Date(document.created_at).getFullYear() === now.getFullYear()).length
  const pending = documents.filter((document) => (document.status || (document.signed ? "signed" : "pending")) === "pending").length
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Assinatura Digital</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-border bg-muted/30 p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="h-5 w-5 text-success" />
              <p className="text-sm font-medium text-foreground">Documentos Assinados</p>
            </div>
            <p className="text-2xl font-bold text-foreground">{signedThisMonth}</p>
            <p className="text-xs text-muted-foreground">Este mês</p>
          </div>

          <div className="rounded-lg border border-border bg-muted/30 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-5 w-5 text-warning" />
              <p className="text-sm font-medium text-foreground">Aguardando Assinatura</p>
            </div>
            <p className="text-2xl font-bold text-foreground">{pending}</p>
            <p className="text-xs text-muted-foreground">Pendentes</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
