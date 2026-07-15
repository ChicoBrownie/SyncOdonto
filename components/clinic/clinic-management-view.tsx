"use client"

import { FinancialView } from "@/components/reports/financial-view"
import { useClinicSettings, saveClinicSettings } from "@/lib/hooks/use-data"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Users, Calendar, TrendingUp, Clock, UserPlus, Trash2, Loader2, Edit, Mail, ShieldCheck,
} from "lucide-react"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import useSWR from "swr"
import { toast } from "sonner"

const fetcher = (url: string) => fetch(url).then(r => r.json())

const ACCESS_ROLE_CONFIG: Record<string, { label: string; color: string }> = {
  gestor: { label: "Gestor", color: "bg-purple-100 text-purple-700" },
  dentista: { label: "Dentista", color: "bg-blue-100 text-blue-700" },
  recepcionista: { label: "Recepcionista", color: "bg-green-100 text-green-700" },
}

export function ClinicManagementView() {
  const [activeTab, setActiveTab] = useState<"equipe" | "financeiro" | "configuracoes">("equipe")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [editingMember, setEditingMember] = useState<any>(null)

  const { data: staffRes, mutate: mutateStaff } = useSWR("/api/clinic-staff", fetcher)
  const staff = staffRes?.data || []

  const { data: accessRes } = useSWR("/api/auth/check-access", fetcher)
  const isGestor = (accessRes?.access_role || "gestor") === "gestor"
  const visibleTabs = (["equipe", "financeiro", "configuracoes"] as const).filter(
    (tab) => isGestor || tab === "equipe"
  )

  const today = new Date().toISOString().split("T")[0]
  const { data: apptRes } = useSWR(`/api/appointments?date=${today}`, fetcher)
  const todayAppointments = apptRes?.data || []

  const getAppointmentCount = (doctorName: string) =>
    todayAppointments.filter((a: any) => a.doctor_name === doctorName && a.status !== "Cancelada").length

  const emptyForm = {
    full_name: "", role: "Dentista", specialty: "",
    email: "", phone: "", access_role: "dentista",
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
    clinic_name: "", cnpj: "", phone: "", email: "", address: "",
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
      hours: { ...prev.hours, [dayKey]: { ...prev.hours[dayKey], [field]: value } },
    }))
  }

  const handleSaveSettings = async () => {
    if (!settingsForm.clinic_name.trim()) { toast.error("Nome da clínica é obrigatório."); return }
    setIsSavingSettings(true)
    try {
      await saveClinicSettings({
        clinic_name: settingsForm.clinic_name.trim(),
        phone: settingsForm.phone || null,
        email: settingsForm.email || null,
        address: settingsForm.address || null,
        working_hours: { start: "08:00", end: "18:00" },
        settings: { cnpj: settingsForm.cnpj, hours: settingsForm.hours },
      } as any)
      toast.success("Configurações salvas com sucesso!")
      mutateSettings()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar configurações")
    } finally {
      setIsSavingSettings(false)
    }
  }

  const openCreate = () => { setEditingMember(null); setForm(emptyForm); setIsDialogOpen(true) }

  const openEdit = (member: any) => {
    setEditingMember(member)
    setForm({
      full_name: member.full_name || "",
      role: member.role || "Dentista",
      specialty: member.specialty || "",
      email: member.email || "",
      phone: member.phone || "",
      access_role: member.access_role || "dentista",
    })
    setIsDialogOpen(true)
  }

  const handleSave = async () => {
    if (!form.full_name.trim()) { toast.error("Nome é obrigatório"); return }
    setIsSaving(true)
    try {
      const method = editingMember ? "PUT" : "POST"
      const body = editingMember ? { id: editingMember.id, ...form } : form

      const res = await fetch("/api/clinic-staff", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Erro ao salvar")

      if (data.invite_sent) {
        toast.success(`Membro adicionado! Convite enviado para ${form.email}`)
      } else {
        toast.success(editingMember ? "Membro atualizado!" : "Membro adicionado!")
      }

      mutateStaff()
      setIsDialogOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar membro")
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/clinic-staff?id=${id}`, { method: "DELETE" })
      toast.success("Membro removido!")
      mutateStaff()
    } catch { toast.error("Erro ao remover membro") }
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
    } catch { toast.error("Erro ao atualizar status") }
  }

  const activeStaff = staff.filter((s: any) => s.is_active).length

  useEffect(() => {
    if (!isGestor && activeTab !== "equipe") setActiveTab("equipe")
  }, [isGestor, activeTab])

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">Gestão da Clínica</h1>
        <p className="text-muted-foreground mt-1">Gerencie equipe, finanças e operações</p>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Membros Ativos", value: activeStaff, sub: `de ${staff.length} cadastrados`, icon: Users, color: "bg-primary/10 text-primary" },
          { label: "Consultas Hoje", value: todayAppointments.length, sub: "Agendadas para hoje", icon: Calendar, color: "bg-green-500/10 text-green-600" },
          { label: "Taxa de Ocupação", value: `${Math.min(Math.round((todayAppointments.length / 8) * 100), 100)}%`, sub: "Base: 8 consultas/dia", icon: Clock, color: "bg-purple-500/10 text-purple-600" },
          { label: "Concluídas Hoje", value: todayAppointments.filter((a: any) => a.status === "Concluída").length, sub: "Finalizadas", icon: TrendingUp, color: "bg-orange-500/10 text-orange-600" },
        ].map(({ label, value, sub, icon: Icon, color }) => (
          <Card key={label} className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{label}</p>
                <p className="text-2xl font-bold text-foreground mt-1">{value}</p>
                <p className="text-xs text-muted-foreground mt-1">{sub}</p>
              </div>
              <div className={`p-3 rounded-lg ${color.split(" ")[0]}`}>
                <Icon className={`w-5 h-5 ${color.split(" ")[1]}`} />
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border overflow-x-auto">
        {visibleTabs.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 font-medium whitespace-nowrap capitalize ${
              activeTab === tab ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"
            }`}>
            {tab === "equipe" ? "Equipe" : tab === "financeiro" ? "Financeiro" : "Configurações"}
          </button>
        ))}
      </div>

      {/* ABA EQUIPE */}
      {activeTab === "equipe" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold text-foreground">Membros da Equipe</h2>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={openCreate}><UserPlus className="w-4 h-4 mr-2" />Adicionar Membro</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>{editingMember ? "Editar Membro" : "Novo Membro"}</DialogTitle>
                  <DialogDescription>
                    {editingMember ? "Atualize as informações do membro." : "Adicione um novo membro à equipe."}
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label>Nome Completo *</Label>
                    <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} placeholder="Dr(a). Nome Sobrenome" />
                  </div>

                  {/* Perfil de acesso — campo novo */}
                  <div className="grid gap-2">
                    <Label className="flex items-center gap-1">
                      <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                      Perfil de Acesso
                    </Label>
                    <Select value={form.access_role} onValueChange={(v) => setForm({ ...form, access_role: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="gestor">Gestor — acesso total ao sistema</SelectItem>
                        <SelectItem value="dentista">Dentista — agenda, pacientes e prontuários</SelectItem>
                        <SelectItem value="recepcionista">Recepcionista — agenda e pacientes</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {form.access_role === "gestor" && "Acesso completo incluindo financeiro e configurações."}
                      {form.access_role === "dentista" && "Acesso à agenda, pacientes, prontuários e relatórios."}
                      {form.access_role === "recepcionista" && "Acesso à agenda e cadastro de pacientes. Sem financeiro."}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label>Função</Label>
                      <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Dentista">Dentista</SelectItem>
                          <SelectItem value="Ortodontista">Ortodontista</SelectItem>
                          <SelectItem value="Cirurgião">Cirurgião</SelectItem>
                          <SelectItem value="Endodontista">Endodontista</SelectItem>
                          <SelectItem value="Higienista">Higienista</SelectItem>
                          <SelectItem value="Recepcionista">Recepcionista</SelectItem>
                          <SelectItem value="Auxiliar">Auxiliar</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label>Especialidade</Label>
                      <Input value={form.specialty} onChange={(e) => setForm({ ...form, specialty: e.target.value })} placeholder="Ex: Implantodontia" />
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <Label className="flex items-center gap-1">
                      <Mail className="h-3.5 w-3.5" />
                      Email {form.access_role !== "gestor" && "(para enviar convite de acesso)"}
                    </Label>
                    <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="email@clinica.com" />
                    {form.email && !editingMember && (
                      <p className="text-xs text-emerald-600">✓ Um email de convite será enviado automaticamente.</p>
                    )}
                  </div>

                  <div className="grid gap-2">
                    <Label>Telefone</Label>
                    <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="(11) 99999-9999" />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="bg-transparent">Cancelar</Button>
                  <Button onClick={handleSave} disabled={isSaving}>
                    {isSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Salvando...</> : editingMember ? "Salvar" : "Adicionar"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {staff.length === 0 ? (
            <Card className="p-8 text-center">
              <Users className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">Nenhum membro cadastrado</p>
            </Card>
          ) : (
            <div className="grid gap-4">
              {staff.map((member: any) => {
                const roleConfig = ACCESS_ROLE_CONFIG[member.access_role] || ACCESS_ROLE_CONFIG.dentista
                return (
                  <Card key={member.id} className="p-4">
                    <div className="flex items-center justify-between flex-wrap gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                          <span className="text-primary font-semibold text-sm">
                            {member.full_name.split(" ").map((n: string) => n[0]).join("").substring(0, 2).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{member.full_name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <p className="text-sm text-muted-foreground">
                              {member.role}{member.specialty ? ` · ${member.specialty}` : ""}
                            </p>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${roleConfig.color}`}>
                              {roleConfig.label}
                            </span>
                          </div>
                          {member.invite_sent_at && (
                            <p className="text-xs text-emerald-600 mt-0.5 flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              Convite enviado
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right hidden sm:block">
                          <p className="text-xs text-muted-foreground">Consultas Hoje</p>
                          <p className="font-semibold text-foreground">{getAppointmentCount(member.full_name)}</p>
                        </div>
                        <Badge
                          className={`cursor-pointer ${member.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"}`}
                          onClick={() => handleToggleActive(member)}
                        >
                          {member.is_active ? "Ativo" : "Inativo"}
                        </Badge>
                        <Button variant="ghost" size="icon" onClick={() => openEdit(member)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(member.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === "financeiro" && (
        <div className="-m-4 md:-m-6 lg:-m-8"><FinancialView /></div>
      )}

      {activeTab === "configuracoes" && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground">Configurações da Clínica</h2>
          {isLoadingSettings ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <Card className="p-6">
                <h3 className="font-semibold text-foreground mb-4">Informações Básicas</h3>
                <div className="space-y-4">
                  {[
                    { label: "Nome da Clínica *", key: "clinic_name", placeholder: "SyncOdonto Clínica" },
                    { label: "CNPJ", key: "cnpj", placeholder: "00.000.000/0001-00" },
                    { label: "Email", key: "email", placeholder: "contato@clinica.com", type: "email" },
                    { label: "Telefone", key: "phone", placeholder: "(11) 98765-4321" },
                    { label: "Endereço", key: "address", placeholder: "Rua das Flores, 123 - São Paulo, SP" },
                  ].map(({ label, key, placeholder, type }) => (
                    <div key={key}>
                      <label className="text-sm font-medium text-foreground">{label}</label>
                      <Input
                        className="mt-1" type={type || "text"}
                        value={(settingsForm as any)[key]}
                        onChange={(e) => setSettingsForm({ ...settingsForm, [key]: e.target.value })}
                        placeholder={placeholder}
                      />
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="p-6">
                <h3 className="font-semibold text-foreground mb-4">Horário de Funcionamento</h3>
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
                            <Input type="time" className="h-8 w-28 text-sm" value={day.start} onChange={(e) => updateDayHours(key, "start", e.target.value)} />
                            <span className="text-muted-foreground text-sm">até</span>
                            <Input type="time" className="h-8 w-28 text-sm" value={day.end} onChange={(e) => updateDayHours(key, "end", e.target.value)} />
                          </div>
                        )}
                        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => updateDayHours(key, "closed", !day.closed)}>
                          {day.closed ? "Marcar como aberto" : "Marcar como fechado"}
                        </Button>
                      </div>
                    )
                  })}
                </div>
              </Card>

              <Button className="w-full" onClick={handleSaveSettings} disabled={isSavingSettings}>
                {isSavingSettings ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Salvando...</> : "Salvar Configurações"}
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
