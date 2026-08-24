"use client"

import { useEffect, useRef, useState } from "react"
import useSWR from "swr"
import { ClipboardList, FileBadge, Loader2, Plus, RotateCcw, Save, Stethoscope, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { AUTOMATIC_FIELDS, DEFAULT_TEMPLATES, type AnamnesisQuestion, type PaperlessTemplate, type TemplateType } from "@/lib/documents/template-defaults"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { SustainabilityImpact } from "./sustainability-impact"

const fetcher = async (url: string) => { const response = await fetch(url); const payload = await response.json(); if (!response.ok) throw new Error(payload.error || "Erro ao carregar modelos"); return payload }
const icons = { dental_certificate: FileBadge, dental_prescription: Stethoscope, anamnesis: ClipboardList }

function TemplateEditor({ template, open, onOpenChange, onSaved }: { template: PaperlessTemplate | null; open: boolean; onOpenChange: (open: boolean) => void; onSaved: () => void }) {
  const [content, setContent] = useState("")
  const [questions, setQuestions] = useState<AnamnesisQuestion[]>([])
  const [saving, setSaving] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  useEffect(() => { if (template) { setContent(template.content); setQuestions(template.questions.map((question) => ({ ...question }))) } }, [template])
  if (!template) return null

  const insertField = (token: string) => {
    const textarea = textareaRef.current
    const start = textarea?.selectionStart ?? content.length
    const end = textarea?.selectionEnd ?? content.length
    setContent(`${content.slice(0, start)}${token}${content.slice(end)}`)
    requestAnimationFrame(() => { textarea?.focus(); textarea?.setSelectionRange(start + token.length, start + token.length) })
  }
  const save = async () => {
    if (!content.trim()) return toast.error("O texto do modelo não pode ficar vazio.")
    if (template.type === "anamnesis" && questions.some((question) => !question.text.trim())) return toast.error("Preencha ou remova as perguntas vazias.")
    setSaving(true)
    try {
      const response = await fetch("/api/paperless-templates", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: template.type, content, questions }) })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || "Erro ao salvar modelo")
      toast.success("Modelo personalizado salvo!"); onOpenChange(false); onSaved()
    } catch (error) { toast.error(error instanceof Error ? error.message : "Erro ao salvar modelo") } finally { setSaving(false) }
  }
  const restore = async () => {
    if (!window.confirm("Restaurar o modelo padrão do SyncOdonto? Sua personalização será removida.")) return
    setSaving(true)
    try {
      const response = await fetch(`/api/paperless-templates?type=${template.type}`, { method: "DELETE" })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || "Erro ao restaurar modelo")
      setContent(DEFAULT_TEMPLATES[template.type].content); setQuestions(DEFAULT_TEMPLATES[template.type].questions.map((question) => ({ ...question })))
      toast.success("Modelo padrão restaurado."); onSaved()
    } catch (error) { toast.error(error instanceof Error ? error.message : "Erro ao restaurar modelo") } finally { setSaving(false) }
  }
  const updateQuestion = (id: string, changes: Partial<AnamnesisQuestion>) => setQuestions((current) => current.map((question) => question.id === id ? { ...question, ...changes } : question))

  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
    <DialogHeader><DialogTitle>Personalizar {template.name}</DialogTitle><DialogDescription>O SyncOdonto preencherá os campos automáticos ao usar este modelo no prontuário.</DialogDescription></DialogHeader>
    <div className="space-y-5">
      <div className="space-y-2"><Label>Campos automáticos</Label><div className="flex flex-wrap gap-2">{AUTOMATIC_FIELDS.map((field) => <Button key={field.token} type="button" size="sm" variant="outline" onClick={() => insertField(field.token)}><Plus className="mr-1 h-3.5 w-3.5" />{field.label}</Button>)}</div></div>
      <div className="space-y-2"><Label>{template.type === "anamnesis" ? "Texto de apresentação" : "Texto do modelo"}</Label><Textarea ref={textareaRef} rows={template.type === "anamnesis" ? 3 : 12} value={content} onChange={(event) => setContent(event.target.value)} className="font-mono text-sm" /></div>
      {template.type === "anamnesis" && <div className="space-y-3"><div className="flex items-center justify-between"><div><Label>Perguntas da anamnese</Label><p className="text-xs text-muted-foreground">Edite, remova ou acrescente perguntas ao questionário.</p></div><Button type="button" size="sm" variant="outline" onClick={() => setQuestions((current) => [...current, { id: crypto.randomUUID(), text: "", answerType: "yes_no", required: false }])}><Plus className="mr-1 h-4 w-4" />Pergunta</Button></div>
        {questions.map((question, index) => <div key={question.id} className="grid gap-3 rounded-lg border p-3 sm:grid-cols-[1fr_150px_auto_auto] sm:items-center"><Input aria-label={`Pergunta ${index + 1}`} value={question.text} onChange={(event) => updateQuestion(question.id, { text: event.target.value })} placeholder="Digite a pergunta" /><Select value={question.answerType} onValueChange={(value) => updateQuestion(question.id, { answerType: value as "yes_no" | "text" })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="yes_no">Sim / Não</SelectItem><SelectItem value="text">Texto livre</SelectItem></SelectContent></Select><label className="flex items-center gap-2 text-xs"><Switch checked={question.required} onCheckedChange={(checked) => updateQuestion(question.id, { required: checked })} />Obrigatória</label><Button type="button" variant="ghost" size="icon" title="Remover pergunta" onClick={() => setQuestions((current) => current.filter((item) => item.id !== question.id))}><Trash2 className="h-4 w-4 text-destructive" /></Button></div>)}
      </div>}
      <div className="space-y-2"><Label>Pré-visualização</Label><div className="rounded-lg border bg-muted/20 p-5"><div className="mb-4 border-b pb-3 text-center"><p className="font-semibold">{`{{clinica_nome}}`}</p><p className="text-xs text-muted-foreground">Documento odontológico</p></div><p className="whitespace-pre-wrap text-sm leading-6">{content}</p>{template.type === "anamnesis" && <ol className="mt-4 space-y-2 text-sm">{questions.map((question, index) => <li key={question.id}>{index + 1}. {question.text || "Pergunta sem texto"} {question.required && <span className="text-destructive">*</span>}</li>)}</ol>}</div></div>
    </div>
    <DialogFooter className="sm:justify-between"><Button variant="ghost" disabled={saving} onClick={restore}><RotateCcw className="mr-2 h-4 w-4" />Restaurar padrão</Button><div className="flex gap-2"><Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button><Button disabled={saving} onClick={save}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Salvar modelo</Button></div></DialogFooter>
  </DialogContent></Dialog>
}

export function DocumentManagementView() {
  const { data, error, isLoading, mutate } = useSWR<{ data: PaperlessTemplate[] }>("/api/paperless-templates", fetcher)
  const [editingType, setEditingType] = useState<TemplateType | null>(null)
  const templates = data?.data || []
  const selected = templates.find((template) => template.type === editingType) || null

  return <div className="space-y-5"><div><h1 className="text-2xl font-bold">Modelos odontológicos</h1><p className="text-sm text-muted-foreground">Personalize os documentos usados pela sua clínica. Os dados do paciente e do profissional serão preenchidos automaticamente.</p></div>
    <SustainabilityImpact />
    {isLoading ? <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div> : error ? <Card><CardContent className="p-8 text-center text-sm text-destructive">Não foi possível carregar os modelos. Verifique se a migração de modelos foi aplicada no Supabase.</CardContent></Card> : <div className="grid gap-4 md:grid-cols-3">{templates.map((template) => { const Icon = icons[template.type]; return <Card key={template.type} className="flex flex-col"><CardContent className="flex flex-1 flex-col p-5"><div className="mb-4 flex items-start justify-between"><div className="rounded-lg bg-primary/10 p-2.5"><Icon className="h-5 w-5 text-primary" /></div><Badge variant="secondary">{template.customized ? "Personalizado" : "Padrão SyncOdonto"}</Badge></div><h2 className="font-semibold">{template.name}</h2><p className="mt-1 flex-1 text-sm text-muted-foreground">{template.description}</p><Button className="mt-5 w-full" variant="outline" onClick={() => setEditingType(template.type)}>Personalizar modelo</Button></CardContent></Card>})}</div>}
    <Card className="border-dashed"><CardContent className="p-4 text-sm text-muted-foreground"><strong className="text-foreground">Como funciona:</strong> personalize o modelo aqui uma única vez. Em uma próxima etapa, ele será selecionado dentro do prontuário do paciente para preenchimento e emissão. Assinatura certificada não faz parte desta versão inicial.</CardContent></Card>
    <TemplateEditor template={selected} open={Boolean(selected)} onOpenChange={(open) => !open && setEditingType(null)} onSaved={() => mutate()} />
  </div>
}
