"use client"

import { useMemo, useState } from "react"
import { Loader2, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { PatientCombobox, type PatientOption } from "./patient-combobox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

type BudgetItem = { procedure: string; region: string; dentist: string; unitValue: number; discount: number }
const emptyItem = (): BudgetItem => ({ procedure: "", region: "", dentist: "", unitValue: 0, discount: 0 })
const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })

export function ModalNovoOrcamento({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (open: boolean) => void; onCreated: () => void }) {
  const [patient, setPatient] = useState<PatientOption | null>(null)
  const [leadName, setLeadName] = useState("")
  const [leadPhone, setLeadPhone] = useState("")
  const [items, setItems] = useState<BudgetItem[]>([emptyItem()])
  const [paymentMethod, setPaymentMethod] = useState("A combinar")
  const [entryAmount, setEntryAmount] = useState(0)
  const [installments, setInstallments] = useState(3)
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)
  const total = useMemo(() => items.reduce((sum, item) => sum + Math.max(0, item.unitValue - item.discount), 0), [items])
  const paymentDescription = useMemo(() => {
    if (paymentMethod !== "Parcelado") return paymentMethod
    const remainingCents = Math.max(0, Math.round((total - entryAmount) * 100))
    const baseCents = Math.floor(remainingCents / installments)
    const extraCents = remainingCents % installments
    const regular = money.format(baseCents / 100)
    const last = money.format((baseCents + extraCents) / 100)
    return `${entryAmount ? `Entrada ${money.format(entryAmount)} + ` : ""}${installments}x de ${regular}${extraCents ? ` (última ${last})` : ""}`
  }, [entryAmount, installments, paymentMethod, total])
  const updateItem = (index: number, field: keyof BudgetItem, value: string | number) => setItems((current) => current.map((item, i) => i === index ? { ...item, [field]: value } : item))

  const submit = async () => {
    if (!patient && (!leadName.trim() || !leadPhone.trim())) return toast.error("Selecione um paciente ou informe nome e telefone do contato.")
    if (items.some((item) => !item.procedure.trim() || item.unitValue <= 0)) return toast.error("Preencha procedimento e valor em todos os itens.")
    if (items.some((item) => item.discount < 0 || item.discount > item.unitValue)) return toast.error("O desconto não pode superar o valor do procedimento.")
    if (paymentMethod === "Parcelado" && (entryAmount < 0 || entryAmount >= total || installments < 1 || installments > 12)) return toast.error("Revise a entrada e o número de parcelas.")
    if (paymentDescription.length > 80) return toast.error("Reduza o número de parcelas para caber no orçamento.")
    setSaving(true)
    try {
      const contactName = patient?.full_name || leadName.trim()
      const response = await fetch("/api/documents", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ generate_pdf: true, patient_id: patient?.id || null, lead_name: patient ? null : leadName.trim(), lead_phone: patient ? null : leadPhone.trim(), title: `Orçamento - ${contactName}`, document_type: "budget", procedure: items.map((item) => item.procedure).join(", "), status: "pending", signed: false, items, total_amount: total, payment_method: paymentDescription, description: notes.trim() || null }) })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || "Erro ao salvar orçamento")
      toast.success("Orçamento criado com sucesso!")
      setPatient(null); setLeadName(""); setLeadPhone(""); setItems([emptyItem()]); setPaymentMethod("A combinar"); setEntryAmount(0); setInstallments(3); setNotes(""); onOpenChange(false); onCreated()
    } catch (error) { toast.error(error instanceof Error ? error.message : "Erro ao salvar orçamento") } finally { setSaving(false) }
  }

  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
    <DialogHeader><DialogTitle>Novo orçamento</DialogTitle><DialogDescription>Preencha os procedimentos e escolha como apresentar o pagamento.</DialogDescription></DialogHeader>
    <div className="grid gap-4">
      <div className="grid gap-2"><Label>Paciente existente (opcional)</Label><PatientCombobox value={patient} onChange={setPatient} /><p className="text-xs text-muted-foreground">Para enviar por e-mail, escolha um paciente com endereço cadastrado.</p></div>
      {!patient && <div className="grid gap-3 sm:grid-cols-2"><div className="grid gap-2"><Label>Nome</Label><Input value={leadName} onChange={(e) => setLeadName(e.target.value)} /></div><div className="grid gap-2"><Label>Telefone/WhatsApp</Label><Input value={leadPhone} onChange={(e) => setLeadPhone(e.target.value)} /></div></div>}
      <div className="space-y-3"><div className="flex items-center justify-between"><Label>Itens do orçamento</Label><Button type="button" variant="outline" size="sm" onClick={() => setItems((v) => [...v, emptyItem()])}><Plus className="mr-1 h-4 w-4" />Item</Button></div>
        {items.map((item, index) => <div key={index} className="grid gap-2 rounded-md border p-3">
          <div className="grid gap-2 sm:grid-cols-[2fr_1fr_1fr_1fr_auto]">
            <Input aria-label="Procedimento" placeholder="Procedimento" value={item.procedure} onChange={(e) => updateItem(index, "procedure", e.target.value)} />
            <Input aria-label="Dente ou região" placeholder="Dente/Região" value={item.region} onChange={(e) => updateItem(index, "region", e.target.value)} />
            <Input aria-label="Valor unitário" type="number" min="0" step="0.01" placeholder="Valor" value={item.unitValue || ""} onChange={(e) => updateItem(index, "unitValue", Number(e.target.value))} />
            <Input aria-label="Desconto" type="number" min="0" step="0.01" placeholder="Desconto" value={item.discount || ""} onChange={(e) => updateItem(index, "discount", Number(e.target.value))} />
            <Button type="button" variant="ghost" size="icon" disabled={items.length === 1} onClick={() => setItems((v) => v.filter((_, i) => i !== index))}><Trash2 className="h-4 w-4" /></Button>
          </div>
          <Input aria-label="Dentista" placeholder="Dentista responsável (opcional)" value={item.dentist} onChange={(e) => updateItem(index, "dentist", e.target.value)} />
        </div>)}
      </div>
      <div className="grid gap-3 sm:grid-cols-2"><div className="grid gap-2"><Label>Forma de pagamento prevista</Label><Select value={paymentMethod} onValueChange={setPaymentMethod}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["A combinar", "Pix", "Cartão de crédito", "Cartão de débito", "Dinheiro", "Parcelado"].map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select></div><div className="flex items-end justify-end text-xl font-bold">Total: {money.format(total)}</div></div>
      {paymentMethod === "Parcelado" && <div className="grid gap-3 rounded-lg border p-3 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor="budget-entry">Entrada (R$)</Label><Input id="budget-entry" type="number" min="0" max={total} step="0.01" value={entryAmount || ""} onChange={event => setEntryAmount(Number(event.target.value))} /></div><div className="grid gap-2"><Label htmlFor="budget-installments">Número de parcelas</Label><Input id="budget-installments" type="number" min="1" max="12" value={installments} onChange={event => setInstallments(Math.max(1, Math.min(12, Number(event.target.value) || 1)))} /></div><p className="text-sm text-muted-foreground sm:col-span-2">{paymentDescription}</p></div>}
      <div className="grid gap-2"><Label htmlFor="budget-notes">Observações (opcional)</Label><Textarea id="budget-notes" rows={3} placeholder="Ex.: validade da proposta ou orientações de pagamento" value={notes} onChange={event => setNotes(event.target.value)} /></div>
    </div>
    <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button><Button disabled={saving} onClick={submit}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar orçamento</Button></DialogFooter>
  </DialogContent></Dialog>
}
