"use client"

import { useState } from "react"
import { useSWRConfig } from "swr"
import { Plus } from "lucide-react"
import { AppLayout } from "@/components/app-layout"
import { Button } from "@/components/ui/button"
import { DocumentList } from "@/components/documents/document-list"
import { ModalNovoOrcamento } from "@/components/documents/modal-novo-orcamento"

export default function OrcamentosPage() {
  return <AppLayout><OrcamentosContent /></AppLayout>
}

function OrcamentosContent() {
  const [open, setOpen] = useState(false)
  const { mutate } = useSWRConfig()

  return <div className="mx-auto w-full max-w-6xl space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-bold">Orçamentos</h1><p className="text-sm text-muted-foreground">Crie, imprima e envie propostas de tratamento.</p></div><Button onClick={() => setOpen(true)}><Plus className="mr-2 h-4 w-4" />Novo orçamento</Button></div>
    <DocumentList onlyBudgets />
    <ModalNovoOrcamento open={open} onOpenChange={setOpen} onCreated={() => void mutate("/api/documents")} />
  </div>
}
