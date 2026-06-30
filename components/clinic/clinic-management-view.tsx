"use client"

import { FinancialView } from "@/components/reports/financial-view"
import { useClinicSettings, saveClinicSettings } from "@/lib/hooks/use-data"
import { useEffect } from "react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Users, Calendar, DollarSign, TrendingUp, Clock, UserPlus, Settings,
  Trash2, Loader2, Edit,
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import useSWR from "swr"
import { toast } from "sonner"
import Link from "next/link"

const fetcher = (url: string) => fetch(url).then(r => r.json())

export function ClinicManagementView() {
  const [activeTab, setActiveTab] = useState<"equipe" | "financeiro" | "configuracoes">("equipe")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [editingMember, setEditingMember] = useState<any>(null)

  const { data: staffRes, mutate: mutateStaff } = useSWR("/api/clinic-staff", fetcher)
  const staff = staffRes?.data || []

  // Fetch today's appointments to count per doctor
  const today = new Date().toISOString().split("T")[0]
  const { data: apptRes } = useSWR(`/api/appointments?date=${today}`, fetcher)
  const todayAppointments = apptRes?.data || []

  const getAppointmentCount = (doctorName: string) => {
    return todayAppointments.filter(
      (a: any) => a.doctor_name === doctorName && a.status !== "Cancelada"
    ).length
  }

  const emptyForm = {
    full_name: "",
    role: "Dentista",
    specialty: "",
    email: "",
    phone: "",
  }
  const [form, setForm] = useState(emptyForm)

  const { settings, isLoading: isLoadingSettings, mutate: mutateSettings } = useClinicSettings()
const [isSavingSettings, setIsSavingSettings] = useState(false)

const DIAS_SEMANA = [
  { key: "monday", label: "Segunda-feira" },
  { key: "tuesday", label: "Terça-feira" },
  { key: "wednesday", label: "Quarta-feira" },
  { key: "thursday", label: "Quinta-feira" },
  { key: "friday", label: "Sexta-feira" },
  { key: "saturday", label: "Sábado" },
  { key: "sunday", label: "Domingo" },
]

const emptySettingsForm = {
  clinic_name: "",
  cnpj: "",
  phone: "",
  email: "",
  address: "",
  hours: DIAS_SEMANA.reduce((acc, d) => {
    acc[d.key] = { start: "08:00", end: d.key === "saturday" ? "12:00" : "18:00", closed: d.key === "sunday" }
    return acc
  }, {} as Record<string, { start: string; end: string; closed: boolean }>),
}

const [settingsForm, setSettingsForm] = useState(emptySettingsForm)

useEffect(() => {
  if (settings) {
    setSettingsForm({
      clinic_name: settings.clinic_name || "",
      cnpj: (settings.settings as any)?.cnpj || "",
      phone: settings.phone || "",
      email: settings.email || "",
      address: settings.address || "",
      hours: (settings.settings as any)?.hours || emptySettingsForm.hours,
    })
  }
}, [settings])

const updateDayHours = (dayKey: string, field: "start" | "end" | "closed", value: string | boolean) => {
  setSettingsForm(prev => ({
    ...prev,
    hours: {
      ...prev.hours,
      [dayKey]: { ...prev.hours[dayKey], [field]: value },
    },
  }))
}

const handleSaveSettings = async () => {
  if (!settingsForm.clinic_name.trim()) {
    toast.error("Nome da clínica é obrigatório.")
    return
  }
  setIsSavingSettings(true)
  try {
    await saveClinicSettings({
      clinic_name: settingsForm.clinic_name.trim(),
      phone: settingsForm.phone || null,
      email: settingsForm.email || null,
      address: settingsForm.address || null,
      working_hours: { start: "08:00", end: "18:00" },
      settings: {
        cnpj: settingsForm.cnpj,
        hours: settingsForm.hours,
      },
    } as any)
    toast.success("Configurações salvas com sucesso!")
    mutateSettings()
  } catch (err) {
    toast.error(err instanceof Error ? err.message : "Erro ao salvar configurações")
  } finally {
    setIsSavingSettings(false)
  }
}


  const openCreate = () => {
    setEditingMember(null)
    setForm(emptyForm)
    setIsDialogOpen(true)
  }

  const openEdit = (member: any) => {
    setEditingMember(member)
    setForm({
      full_name: member.full_name || "",
      role: member.role || "Dentista",
      specialty: member.specialty || "",
      email: member.email || "",
      phone: member.phone || "",
    })
    setIsDialogOpen(true)
  }

  const handleSave = async () => {
    if (!form.full_name.trim()) {
      toast.error("Nome e obrigatorio")
      return
    }
    setIsSaving(true)
    try {
      if (editingMember) {
        await fetch("/api/clinic-staff", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editingMember.id, ...form }),
        })
        toast.success("Membro atualizado!")
      } else {
        await fetch("/api/clinic-staff", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        })
        toast.success("Membro adicionado!")
      }
      mutateStaff()
      setIsDialogOpen(false)
    } catch {
      toast.error("Erro ao salvar membro")
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/clinic-staff?id=${id}`, { method: "DELETE" })
      toast.success("Membro removido!")
      mutateStaff()
    } catch {
      toast.error("Erro ao remover membro")
    }
  }

  const handleToggleActive = async (member: any) => {
    try {
      await fetch("/api/clinic-staff", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: member.id, is_active: !member.is_active }),
      })
      toast.success(member.is_active ? "Membro desativado" : "Membro ativado")
      mutateStaff()
    } catch {
      toast.error("Erro ao atualizar status")
    }
  }

  const activeStaff = staff.filter((s: any) => s.is_active).length

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">Gestao da Clinica</h1>
        <p className="text-muted-foreground mt-1">Gerencie equipe, financas e operacoes</p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 border-border">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Membros Ativos</p>
              <p className="text-2xl font-bold text-foreground mt-1">{activeStaff}</p>
              <p className="text-xs text-muted-foreground mt-1">de {staff.length} cadastrados</p>
            </div>
            <div className="p-3 bg-primary/10 rounded-lg">
              <Users className="w-5 h-5 text-primary" />
            </div>
          </div>
        </Card>

        <Card className="p-4 border-border">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Consultas Hoje</p>
              <p className="text-2xl font-bold text-foreground mt-1">{todayAppointments.length}</p>
              <p className="text-xs text-muted-foreground mt-1">Agendadas para hoje</p>
            </div>
            <div className="p-3 bg-green-500/10 rounded-lg">
              <Calendar className="w-5 h-5 text-green-600" />
            </div>
          </div>
        </Card>

        <Card className="p-4 border-border">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Taxa de Ocupacao</p>
              <p className="text-2xl font-bold text-foreground mt-1">
                {todayAppointments.length > 0 ? `${Math.min(Math.round((todayAppointments.length / 8) * 100), 100)}%` : "0%"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Base: 8 consultas/dia</p>
            </div>
            <div className="p-3 bg-purple-500/10 rounded-lg">
              <Clock className="w-5 h-5 text-purple-600" />
            </div>
          </div>
        </Card>

        <Card className="p-4 border-border">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Concluidas Hoje</p>
              <p className="text-2xl font-bold text-foreground mt-1">
                {todayAppointments.filter((a: any) => a.status === "Concluída").length}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Finalizadas</p>
            </div>
            <div className="p-3 bg-orange-500/10 rounded-lg">
              <TrendingUp className="w-5 h-5 text-orange-600" />
            </div>
          </div>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border overflow-x-auto">
        <button
          onClick={() => setActiveTab("equipe")}
          className={`px-4 py-2 font-medium whitespace-nowrap ${
            activeTab === "equipe"
              ? "text-primary border-b-2 border-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Equipe
        </button>
        <button
          onClick={() => setActiveTab("financeiro")}
          className={`px-4 py-2 font-medium whitespace-nowrap ${
            activeTab === "financeiro"
              ? "text-primary border-b-2 border-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Financeiro
        </button>
        <button
          onClick={() => setActiveTab("configuracoes")}
          className={`px-4 py-2 font-medium whitespace-nowrap ${
            activeTab === "configuracoes"
              ? "text-primary border-b-2 border-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Configuracoes
        </button>
      </div>

      {/* Content */}
      {activeTab === "equipe" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold text-foreground">Membros da Equipe</h2>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={openCreate}>
                  <UserPlus className="w-4 h-4 mr-2" />
                  Adicionar Membro
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>{editingMember ? "Editar Membro" : "Novo Membro"}</DialogTitle>
                  <DialogDescription>
                    {editingMember ? "Atualize as informacoes do membro." : "Adicione um novo membro a equipe."}
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label>Nome Completo *</Label>
                    <Input
                      value={form.full_name}
                      onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                      placeholder="Dr(a). Nome Sobrenome"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label>Funcao</Label>
                      <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Dentista">Dentista</SelectItem>
                          <SelectItem value="Ortodontista">Ortodontista</SelectItem>
                          <SelectItem value="Cirurgiao">Cirurgiao</SelectItem>
                          <SelectItem value="Endodontista">Endodontista</SelectItem>
                          <SelectItem value="Higienista">Higienista</SelectItem>
                          <SelectItem value="Recepcionista">Recepcionista</SelectItem>
                          <SelectItem value="Auxiliar">Auxiliar</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label>Especialidade</Label>
                      <Input
                        value={form.specialty}
                        onChange={(e) => setForm({ ...form, specialty: e.target.value })}
                        placeholder="Ex: Implantodontia"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label>Email</Label>
                      <Input
                        type="email"
                        value={form.email}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                        placeholder="email@clinica.com"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>Telefone</Label>
                      <Input
                        value={form.phone}
                        onChange={(e) => setForm({ ...form, phone: e.target.value })}
                        placeholder="(11) 99999-9999"
                      />
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="bg-transparent">
                    Cancelar
                  </Button>
                  <Button onClick={handleSave} disabled={isSaving}>
                    {isSaving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Salvando...
                      </>
                    ) : editingMember ? "Salvar" : "Adicionar"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {staff.length === 0 ? (
            <Card className="p-8 border-border text-center">
              <Users className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">Nenhum membro cadastrado</p>
              <p className="text-sm text-muted-foreground mt-1">Adicione os membros da sua equipe</p>
            </Card>
          ) : (
            <div className="grid gap-4">
              {staff.map((member: any) => (
                <Card key={member.id} className="p-4 border-border">
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                        <span className="text-primary font-semibold text-sm">
                          {member.full_name
                            .split(" ")
                            .map((n: string) => n[0])
                            .join("")
                            .substring(0, 2)
                            .toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{member.full_name}</p>
                        <p className="text-sm text-muted-foreground">
                          {member.role}{member.specialty ? ` - ${member.specialty}` : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right hidden sm:block">
                        <p className="text-xs text-muted-foreground">Consultas Hoje</p>
                        <p className="font-semibold text-foreground">{getAppointmentCount(member.full_name)}</p>
                      </div>
                      <Badge
                        className={
                          member.is_active
                            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 cursor-pointer"
                            : "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400 cursor-pointer"
                        }
                        onClick={() => handleToggleActive(member)}
                      >
                        {member.is_active ? "Ativo" : "Inativo"}
                      </Badge>
                      <Button variant="ghost" size="icon" onClick={() => openEdit(member)}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDelete(member.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "financeiro" && (
        <div className="-m-4 md:-m-6 lg:-m-8">
          <FinancialView />
        </div>
      )}

      {activeTab === "configuracoes" && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground">Configuracoes da Clinica</h2>

          {isLoadingSettings ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <Card className="p-6 border-border">
                <h3 className="font-semibold text-foreground mb-4">Informacoes Basicas</h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-foreground">Nome da Clinica *</label>
                    <Input
                      className="mt-1"
                      value={settingsForm.clinic_name}
                      onChange={(e) => setSettingsForm({ ...settingsForm, clinic_name: e.target.value })}
                      placeholder="SyncOdonto Clinica"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground">CNPJ</label>
                    <Input
                      className="mt-1"
                      value={settingsForm.cnpj}
                      onChange={(e) => setSettingsForm({ ...settingsForm, cnpj: e.target.value })}
                      placeholder="00.000.000/0001-00"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground">Email</label>
                    <Input
                      type="email"
                      className="mt-1"
                      value={settingsForm.email}
                      onChange={(e) => setSettingsForm({ ...settingsForm, email: e.target.value })}
                      placeholder="contato@clinica.com"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground">Telefone</label>
                    <Input
                      className="mt-1"
                      value={settingsForm.phone}
                      onChange={(e) => setSettingsForm({ ...settingsForm, phone: e.target.value })}
                      placeholder="(11) 98765-4321"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground">Endereco</label>
                    <Input
                      className="mt-1"
                      value={settingsForm.address}
                      onChange={(e) => setSettingsForm({ ...settingsForm, address: e.target.value })}
                      placeholder="Rua das Flores, 123 - Sao Paulo, SP"
                    />
                  </div>
                </div>
              </Card>

              <Card className="p-6 border-border">
                <h3 className="font-semibold text-foreground mb-4">Horario de Funcionamento</h3>
                <div className="space-y-3">
                  {DIAS_SEMANA.map(({ key, label }) => {
                    const day = settingsForm.hours[key] || { start: "08:00", end: "18:00", closed: false }
                    return (
                      <div key={key} className="flex items-center justify-between gap-3 flex-wrap">
                        <span className="text-foreground w-32">{label}</span>
                        {day.closed ? (
                          <span className="text-sm text-muted-foreground">Fechado</span>
                        ) : (
                          <div className="flex items-center gap-2">
                            <Input
                              type="time"
                              className="h-8 w-28 text-sm"
                              value={day.start}
                              onChange={(e) => updateDayHours(key, "start", e.target.value)}
                            />
                            <span className="text-muted-foreground text-sm">até</span>
                            <Input
                              type="time"
                              className="h-8 w-28 text-sm"
                              value={day.end}
                              onChange={(e) => updateDayHours(key, "end", e.target.value)}
                            />
                          </div>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => updateDayHours(key, "closed", !day.closed)}
                        >
                          {day.closed ? "Marcar como aberto" : "Marcar como fechado"}
                        </Button>
                      </div>
                    )
                  })}
                </div>
              </Card>

              <Button className="w-full" onClick={handleSaveSettings} disabled={isSavingSettings}>
                {isSavingSettings ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : "Salvar Configuracoes"}
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
