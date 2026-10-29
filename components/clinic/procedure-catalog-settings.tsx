"use client"

import { useState } from "react"
import useSWR from "swr"
import { Edit, Loader2, Pin, Plus, RotateCcw, Search } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { normalizeProcedureText } from "@/lib/dental-chart/procedure-search"

type CatalogItem = {
  id: string
  name: string
  description: string | null
  default_price: number
  is_favorite: boolean
  is_active: boolean
}

const fetcher = (url: string) => fetch(url).then(async (response) => {
  const body = await response.json()
  if (!response.ok) throw new Error(body.error || "Erro ao carregar catálogo")
  return body
})
const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })
const emptyForm = { name: "", description: "", price: "" }

export function ProcedureCatalogSettings() {
  const { data, error, isLoading, mutate } = useSWR("/api/procedure-catalog?includeInactive=true", fetcher)
  const items: CatalogItem[] = data?.data || []
  const favoriteCount = items.filter((item) => item.is_active && item.is_favorite).length
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<CatalogItem | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const visibleItems = items.filter(item => normalizeProcedureText(item.name).includes(normalizeProcedureText(search)))

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm)
    setDialogOpen(true)
  }

  const openEdit = (item: CatalogItem) => {
    setEditing(item)
    setForm({ name: item.name, description: item.description || "", price: Number(item.default_price).toFixed(2) })
    setDialogOpen(true)
  }

  const save = async () => {
    const price = Number(form.price.replace(",", "."))
    if (form.name.trim().length < 2 || Number.isNaN(price) || price < 0) {
      toast.error("Informe o nome e um preço padrão válido.")
      return
    }
    setSaving(true)
    try {
      const response = await fetch(editing ? `/api/procedure-catalog/${editing.id}` : "/api/procedure-catalog", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name.trim(), description: form.description.trim() || null, default_price: price, ...(editing ? {} : { is_favorite: false }), is_active: true }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || "Erro ao salvar procedimento")
      await mutate()
      setDialogOpen(false)
      toast.success(editing ? "Procedimento atualizado." : "Procedimento incluído no catálogo.")
    } catch (saveError) {
      toast.error(saveError instanceof Error ? saveError.message : "Erro ao salvar procedimento")
    } finally {
      setSaving(false)
    }
  }

  const patchItem = async (item: CatalogItem, changes: Partial<CatalogItem>, success: string) => {
    if (changes.is_favorite === true && !item.is_favorite && favoriteCount >= 5) {
      toast.error("A clínica pode ter no máximo cinco opções rápidas.")
      return
    }
    setUpdatingId(item.id)
    try {
      const response = await fetch(`/api/procedure-catalog/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(changes),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || "Erro ao atualizar procedimento")
      await mutate()
      toast.success(success)
    } catch (patchError) {
      toast.error(patchError instanceof Error ? patchError.message : "Erro ao atualizar procedimento")
    } finally {
      setUpdatingId(null)
    }
  }

  return (
    <Card className="p-6">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="font-semibold text-foreground">Catálogo de procedimentos</h3>
          {items.some(item => Number(item.default_price) === 0) && <p className="mt-1 text-xs text-muted-foreground">Revise os valores dos procedimentos antes de usar em orçamentos.</p>}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={event => setSearch(event.target.value)} aria-label="Buscar procedimento no catálogo" placeholder="Buscar procedimento" className="pl-9 sm:w-56" /></div>
          <Button size="sm" onClick={openCreate}><Plus className="mr-2 h-4 w-4" />Novo procedimento</Button>
        </div>
      </div>

      {isLoading ? <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div> : error ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error.message}</p>
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">Nenhum procedimento cadastrado.</div>
      ) : visibleItems.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">Nenhum procedimento encontrado.</div>
      ) : (
        <div className="grid gap-3 xl:grid-cols-2">
          {visibleItems.map((item) => (
            <div key={item.id} className="flex min-w-0 flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className={`min-w-0 ${!item.is_active ? "opacity-60" : ""}`}>
                <div className="flex flex-wrap items-center gap-2"><p className="font-medium">{item.name}</p>{!item.is_active && <Badge variant="outline">Arquivado</Badge>}</div>
                <p className="mt-1 text-sm font-semibold text-primary">{currency.format(Number(item.default_price || 0))}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {item.is_active && <Button type="button" size="icon" variant="ghost" aria-label={`${item.is_favorite ? "Desafixar" : "Fixar"} ${item.name}`} aria-pressed={item.is_favorite} title={item.is_favorite ? "Desafixar das opções rápidas" : "Fixar nas opções rápidas"} disabled={updatingId === item.id} onClick={() => patchItem(item, { is_favorite: !item.is_favorite }, item.is_favorite ? "Removido das opções rápidas." : "Adicionado às opções rápidas.")}><Pin className={`h-4 w-4 ${item.is_favorite ? "fill-current" : ""}`} /></Button>}
                {item.is_active && <Button size="sm" variant="ghost" onClick={() => openEdit(item)}><Edit className="mr-1 h-4 w-4" />Editar</Button>}
                {!item.is_active && <Button size="sm" variant="ghost" disabled={updatingId === item.id} onClick={() => patchItem(item, { is_active: true }, "Procedimento reativado.")}><RotateCcw className="mr-1 h-4 w-4" />Reativar</Button>}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Editar procedimento" : "Novo procedimento"}</DialogTitle><DialogDescription>Estas informações pertencem somente ao catálogo desta clínica.</DialogDescription></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2"><Label htmlFor="catalog-name">Nome *</Label><Input id="catalog-name" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} /></div>
            <div className="space-y-2"><Label htmlFor="catalog-description">Descrição</Label><Textarea id="catalog-description" value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} /></div>
            <div className="space-y-2"><Label htmlFor="catalog-price">Preço padrão *</Label><Input id="catalog-price" type="number" min="0" step="0.01" value={form.price} onChange={(event) => setForm((current) => ({ ...current, price: event.target.value }))} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button><Button onClick={save} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar procedimento"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
