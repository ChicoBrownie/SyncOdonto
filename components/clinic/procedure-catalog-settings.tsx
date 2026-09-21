"use client"

import { useState } from "react"
import useSWR from "swr"
import { Archive, Edit, Loader2, Plus, RotateCcw, Star } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

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
const emptyForm = { name: "", description: "", price: "", favorite: false }

export function ProcedureCatalogSettings() {
  const { data, error, isLoading, mutate } = useSWR("/api/procedure-catalog?includeInactive=true", fetcher)
  const items: CatalogItem[] = data?.data || []
  const favoriteCount = items.filter((item) => item.is_active && item.is_favorite).length
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<CatalogItem | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm)
    setDialogOpen(true)
  }

  const openEdit = (item: CatalogItem) => {
    setEditing(item)
    setForm({ name: item.name, description: item.description || "", price: Number(item.default_price).toFixed(2), favorite: item.is_favorite })
    setDialogOpen(true)
  }

  const save = async () => {
    const price = Number(form.price.replace(",", "."))
    if (form.name.trim().length < 2 || Number.isNaN(price) || price < 0) {
      toast.error("Informe o nome e um preço padrão válido.")
      return
    }
    if (form.favorite && !editing?.is_favorite && favoriteCount >= 5) {
      toast.error("A clínica pode ter no máximo cinco opções rápidas.")
      return
    }
    setSaving(true)
    try {
      const response = await fetch(editing ? `/api/procedure-catalog/${editing.id}` : "/api/procedure-catalog", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name.trim(), description: form.description.trim() || null, default_price: price, is_favorite: form.favorite, is_active: true }),
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
          <p className="mt-1 text-sm text-muted-foreground">Defina os serviços e preços padrão desta clínica. Até cinco procedimentos podem ser marcados manualmente como opções rápidas.</p>
        </div>
        <Button size="sm" onClick={openCreate}><Plus className="mr-2 h-4 w-4" />Novo procedimento</Button>
      </div>

      {isLoading ? <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div> : error ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error.message}</p>
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">Nenhum procedimento cadastrado.</div>
      ) : (
        <div className="divide-y rounded-lg border">
          {items.map((item) => (
            <div key={item.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className={!item.is_active ? "opacity-60" : ""}>
                <div className="flex flex-wrap items-center gap-2"><p className="font-medium">{item.name}</p>{item.is_favorite && <Badge variant="secondary"><Star className="mr-1 h-3 w-3 fill-current" />Opção rápida</Badge>}{!item.is_active && <Badge variant="outline">Arquivado</Badge>}</div>
                {item.description && <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>}
                <p className="mt-1 text-sm font-semibold text-primary">{currency.format(Number(item.default_price || 0))}</p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-1">
                {item.is_active && <Button size="sm" variant="ghost" disabled={updatingId === item.id || (!item.is_favorite && favoriteCount >= 5)} onClick={() => patchItem(item, { is_favorite: !item.is_favorite }, item.is_favorite ? "Removido das opções rápidas." : "Adicionado às opções rápidas.")}><Star className="mr-1 h-4 w-4" />{item.is_favorite ? "Desafixar" : "Destacar"}</Button>}
                {item.is_active && <Button size="sm" variant="ghost" onClick={() => openEdit(item)}><Edit className="mr-1 h-4 w-4" />Editar</Button>}
                {item.is_active ? <Button size="sm" variant="ghost" disabled={updatingId === item.id} onClick={() => patchItem(item, { is_active: false }, "Procedimento arquivado.")}><Archive className="mr-1 h-4 w-4" />Arquivar</Button> : <Button size="sm" variant="ghost" disabled={updatingId === item.id} onClick={() => patchItem(item, { is_active: true }, "Procedimento reativado.")}><RotateCcw className="mr-1 h-4 w-4" />Reativar</Button>}
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
            <label className="flex items-center gap-2 text-sm"><Checkbox checked={form.favorite} disabled={!editing?.is_favorite && favoriteCount >= 5} onCheckedChange={(checked) => setForm((current) => ({ ...current, favorite: checked === true }))} />Mostrar como opção rápida no odontograma ({favoriteCount}/5)</label>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button><Button onClick={save} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar procedimento"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
