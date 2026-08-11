"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Calendar, Plus, Loader2, Pencil, ChevronDown, ChevronUp, MapPin, Tag } from "lucide-react"
import Link from "next/link"
import { usePatients, createPatient, updatePatient } from "@/lib/hooks/use-data"
import { useState } from "react"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { toast } from "sonner"
import type { Patient } from "@/lib/types/database"

const AVAILABLE_TAGS = [
  { value: "Em Tratamento", color: "bg-blue-500/10 text-blue-600" },
  { value: "Atenção", color: "bg-amber-500/10 text-amber-600" },
  { value: "Alto Risco", color: "bg-red-500/10 text-red-600" },
]

const emptyForm = {
  full_name: "",
  email: "",
  phone: "",
  date_of_birth: "",
  gender: "Masculino" as "Masculino" | "Feminino" | "Outro",
  cpf: "",
  address: "",
  allergies: "",
  pre_existing_conditions: "",
  medications: "",
  tags: [] as string[],
}

interface PatientTableProps {
  searchQuery: string
  activeTab: string
}

export function PatientTable({ searchQuery, activeTab }: PatientTableProps) {
  const { patients, isLoading, error, mutate } = usePatients(searchQuery)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [showMedicalHistory, setShowMedicalHistory] = useState(false)
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null)
  const [form, setForm] = useState(emptyForm)

  const openCreateDialog = () => {
    setEditingPatient(null)
    setForm(emptyForm)
    setShowMedicalHistory(false)
    setIsDialogOpen(true)
  }

  const openEditDialog = (patient: Patient) => {
    setEditingPatient(patient)
    const patientTags = Array.isArray((patient as any).tags) ? (patient as any).tags : []
    setForm({
      full_name: patient.full_name || "",
      email: patient.email || "",
      phone: patient.phone || "",
      date_of_birth: patient.date_of_birth || "",
      gender: (patient.gender as "Masculino" | "Feminino" | "Outro") || "Masculino",
      cpf: patient.cpf || "",
      address: (patient as any).address || "",
      allergies: patient.allergies || "",
      pre_existing_conditions: (patient as any).pre_existing_conditions || "",
      medications: (patient as any).medications || "",
      tags: patientTags,
    })
    setShowMedicalHistory(
      !!(patient.allergies || (patient as any).pre_existing_conditions || (patient as any).medications)
    )
    setIsDialogOpen(true)
  }

  const toggleTag = (tag: string) => {
    setForm(prev => ({
      ...prev,
      tags: prev.tags.includes(tag) ? prev.tags.filter(t => t !== tag) : [...prev.tags, tag]
    }))
  }

  const handleSave = async () => {
    if (!form.full_name.trim()) {
      toast.error("Nome completo é obrigatório.")
      return
    }
    if (!form.date_of_birth) {
      toast.error("Data de nascimento é obrigatória.")
      return
    }
    if (!form.cpf.trim()) {
      toast.error("CPF é obrigatório.")
      return
    }

    setIsSaving(true)
    try {
      const payload: any = { ...form }

      for (const key of Object.keys(payload)) {
        if (typeof payload[key] === "string" && payload[key].trim() === "") {
          if (!["full_name", "cpf", "date_of_birth"].includes(key)) {
            payload[key] = null
          }
        }
      }
      payload.tags = form.tags

      if (editingPatient) {
        await updatePatient(editingPatient.id, payload)
        toast.success("Paciente atualizado com sucesso!")
      } else {
        await createPatient(payload)
        toast.success("Paciente cadastrado com sucesso!")
      }
      mutate()
      setIsDialogOpen(false)
      setForm(emptyForm)
      setEditingPatient(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar paciente")
    } finally {
      setIsSaving(false)
    }
  }

  const getInitials = (name: string) =>
    name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()

  const calculateAge = (birthDate: string | null) => {
    if (!birthDate) return null
    const today = new Date()
    const birth = new Date(birthDate)
    let age = today.getFullYear() - birth.getFullYear()
    const m = today.getMonth() - birth.getMonth()
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
    return age
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "-"
    return new Date(dateString).toLocaleDateString("pt-BR")
  }

  const renderTags = (patient: Patient) => {
    const tags = Array.isArray((patient as any).tags) ? (patient as any).tags as string[] : []
    if (tags.length === 0) return null
    return (
      <div className="flex flex-wrap gap-1 mt-1">
        {tags.map(tag => {
          const tagDef = AVAILABLE_TAGS.find(t => t.value === tag)
          return (
            <Badge key={tag} variant="secondary" className={`text-[10px] px-1.5 py-0 ${tagDef?.color || ""}`}>
              {tag}
            </Badge>
          )
        })}
      </div>
    )
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">Erro ao carregar pacientes. Faça login para continuar.</p>
          <Link href="/auth/login"><Button className="mt-4">Fazer Login</Button></Link>
        </CardContent>
      </Card>
    )
  }

  const allPatients = patients || []
  const filteredPatients = activeTab === "all" ? allPatients
    : activeTab === "treatment" ? allPatients.filter(p => Array.isArray((p as any).tags) && (p as any).tags.includes("Em Tratamento"))
    : activeTab === "attention" ? allPatients.filter(p => Array.isArray((p as any).tags) && (p as any).tags.includes("Atenção"))
    : activeTab === "high-risk" ? allPatients.filter(p => Array.isArray((p as any).tags) && (p as any).tags.includes("Alto Risco"))
    : allPatients

  return (
    <Card>
      <CardContent className="p-0">
        {/* Cabeçalho */}
        <div className="flex justify-end p-4 border-b border-border">
          <Button className="gap-2" onClick={openCreateDialog}>
            <Plus className="h-4 w-4" />Novo Paciente
          </Button>
        </div>

        {/* Modal cadastro/edição */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="w-[calc(100vw-2rem)] sm:w-full sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingPatient ? "Editar Paciente" : "Cadastrar Novo Paciente"}</DialogTitle>
              <DialogDescription>
                Campos com * são obrigatórios. Os demais são opcionais.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              {/* Nome */}
              <div className="grid gap-2">
                <Label htmlFor="full_name">Nome Completo *</Label>
                <Input id="full_name" value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  placeholder="Ex: Maria Silva" />
              </div>

              {/* Email e Telefone — opcionais */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="email@exemplo.com" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="phone">Telefone</Label>
                  <Input id="phone" value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="(89) 99999-9999" />
                  <p className="text-xs text-muted-foreground -mt-1">
                    Necessário para notificações WhatsApp
                  </p>
                </div>
              </div>

              {/* Data nascimento e gênero */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="date_of_birth">Data de Nascimento *</Label>
                  <Input id="date_of_birth" type="date" value={form.date_of_birth}
                    onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="gender">Gênero</Label>
                  <Select value={form.gender}
                    onValueChange={(v: "Masculino" | "Feminino" | "Outro") => setForm({ ...form, gender: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Masculino">Masculino</SelectItem>
                      <SelectItem value="Feminino">Feminino</SelectItem>
                      <SelectItem value="Outro">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* CPF */}
              <div className="grid gap-2">
                <Label htmlFor="cpf">CPF *</Label>
                <Input id="cpf" value={form.cpf}
                  onChange={(e) => setForm({ ...form, cpf: e.target.value })}
                  placeholder="000.000.000-00" />
              </div>

              {/* Endereço — opcional */}
              <div className="grid gap-2">
                <Label htmlFor="address" className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" />
                  Endereço
                </Label>
                <Textarea id="address" value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  placeholder="Rua, número, bairro, cidade - UF, CEP"
                  rows={2} />
              </div>

              {/* Tags */}
              <div className="grid gap-2">
                <Label className="flex items-center gap-1.5">
                  <Tag className="h-3.5 w-3.5" />
                  Classificação do Paciente
                </Label>
                <p className="text-xs text-muted-foreground">Marque as classificações que se aplicam.</p>
                <div className="flex flex-col gap-2 mt-1">
                  {AVAILABLE_TAGS.map(tag => (
                    <label key={tag.value} className="flex items-center gap-2 cursor-pointer">
                      <Checkbox checked={form.tags.includes(tag.value)} onCheckedChange={() => toggleTag(tag.value)} />
                      <Badge variant="secondary" className={`${tag.color} pointer-events-none`}>{tag.value}</Badge>
                    </label>
                  ))}
                </div>
              </div>

              {/* Histórico Médico colapsável */}
              <div className="border border-border rounded-lg">
                <button type="button"
                  className="flex items-center justify-between w-full px-4 py-3 text-sm font-medium text-foreground hover:bg-muted/50 rounded-lg transition-colors"
                  onClick={() => setShowMedicalHistory(!showMedicalHistory)}>
                  <span>Histórico Médico (opcional)</span>
                  {showMedicalHistory
                    ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </button>
                {showMedicalHistory && (
                  <div className="px-4 pb-4 grid gap-4 border-t border-border pt-4">
                    <div className="grid gap-2">
                      <Label htmlFor="allergies">Alergias</Label>
                      <Textarea id="allergies" value={form.allergies}
                        onChange={(e) => setForm({ ...form, allergies: e.target.value })}
                        placeholder="Ex: Penicilina, Látex, Anestésico local..." rows={2} />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="pre_existing_conditions">Condições Pré-existentes</Label>
                      <Textarea id="pre_existing_conditions" value={form.pre_existing_conditions}
                        onChange={(e) => setForm({ ...form, pre_existing_conditions: e.target.value })}
                        placeholder="Ex: Diabetes, Hipertensão, Cardiopatia..." rows={2} />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="medications">Medicamentos em Uso</Label>
                      <Textarea id="medications" value={form.medications}
                        onChange={(e) => setForm({ ...form, medications: e.target.value })}
                        placeholder="Ex: Insulina, Losartana 50mg..." rows={2} />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" className="bg-transparent"
                onClick={() => { setIsDialogOpen(false); setEditingPatient(null) }}>
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving
                  ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Salvando...</>
                  : editingPatient ? "Atualizar" : "Cadastrar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {filteredPatients.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-muted-foreground">Nenhum paciente encontrado.</p>
            <p className="text-sm text-muted-foreground mt-2">
              {activeTab !== "all"
                ? "Nenhum paciente com esta classificação."
                : "Clique em \"Novo Paciente\" para cadastrar o primeiro paciente."}
            </p>
          </div>
        ) : (
          <>
            {/* Tabela desktop */}
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full">
                <thead className="border-b border-border bg-muted/30">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Paciente</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Idade</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Telefone</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Classificação</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Cadastrado em</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-foreground">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPatients.map((patient) => (
                    <tr key={patient.id} className="border-b border-border transition-colors hover:bg-muted/30">
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-medium">
                            {getInitials(patient.full_name)}
                          </div>
                          <div>
                            <span className="font-medium text-foreground">{patient.full_name}</span>
                            {patient.email && <p className="text-xs text-muted-foreground">{patient.email}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-muted-foreground">
                        {calculateAge(patient.date_of_birth) ? `${calculateAge(patient.date_of_birth)} anos` : "-"}
                      </td>
                      <td className="px-4 py-4 text-sm text-muted-foreground">{patient.phone || "-"}</td>
                      <td className="px-4 py-4">
                        {renderTags(patient) || <span className="text-xs text-muted-foreground">-</span>}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Calendar className="h-4 w-4" />
                          {formatDate(patient.created_at)}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button size="sm" variant="outline" className="bg-transparent gap-1.5"
                            onClick={() => openEditDialog(patient)}>
                            <Pencil className="h-3.5 w-3.5" />Editar
                          </Button>
                          <Link href={`/prontuario/${patient.id}`}>
                            <Button size="sm">Prontuário</Button>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Cards mobile */}
            <div className="space-y-3 p-4 lg:hidden">
              {filteredPatients.map((patient) => (
                <Card key={patient.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-medium">
                        {getInitials(patient.full_name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-foreground">{patient.full_name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {calculateAge(patient.date_of_birth) ? `${calculateAge(patient.date_of_birth)} anos` : "Idade não informada"}
                        </p>
                        {renderTags(patient)}
                        <div className="mt-3 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Calendar className="h-3 w-3" />{formatDate(patient.created_at)}
                          </div>
                          <div className="flex items-center gap-2">
                            <Button size="sm" variant="outline" className="bg-transparent"
                              onClick={() => openEditDialog(patient)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Link href={`/prontuario/${patient.id}`}>
                              <Button size="sm">Prontuário</Button>
                            </Link>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}

        {filteredPatients.length > 0 && (
          <div className="flex items-center justify-between border-t border-border px-4 py-4">
            <p className="text-sm text-muted-foreground">
              Mostrando {filteredPatients.length} paciente{filteredPatients.length !== 1 ? "s" : ""}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
