"use client"

import { useState, useEffect } from "react"
import { useClinicSettings, saveClinicSettings } from "@/lib/hooks/use-data"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Users, UserPlus, Trash2, Loader2, Edit, Mail, ShieldCheck,
  Copy, Check, AlertTriangle, KeyRound,
} from "lucide-react"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  AlertDialog, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { FinancialView } from "@/components/reports/financial-view"
import { ReportsView } from "@/components/reports/reports-view"
import { DocumentManagementView } from "@/components/documents/document-management-view"
import { useRouter, useSearchParams } from "next/navigation"
import {
  DEFAULT_PERMISSIONS, getEffectivePermissions,
  type StaffAccessRole, type StaffPermissions,
} from "@/lib/permissions"
import useSWR from "swr"
import { toast } from "sonner"

const PERMISSION_FIELDS: { key: keyof StaffPermissions; label: string; hint: string }[] = [
  { key: "relatorios" as const, label: "Relatórios", hint: "Ver métricas e relatórios semanais da clínica" },
  { key: "financeiro" as const, label: "Financeiro", hint: "Ver pagamentos e fazer fechamento de caixa" },
  { key: "configuracoes" as const, label: "Configurações da Clínica", hint: "Editar dados, horários e informações da clínica" },
]

const fetcher = (url: string) => fetch(url).then(r => r.json())

const ACCESS_ROLE_CONFIG: Record<string, { label: string; color: string }> = {
  gestor: { label: "Gestor", color: "bg-purple-100 text-purple-700" },
  dentista: { label: "Dentista", color: "bg-blue-100 text-blue-700" },
  recepcionista: { label: "Recepcionista", color: "bg-green-100 text-green-700" },
}

type CredentialsInfo = {
  email: string
  password: string
  emailDelivered: boolean
}

export function ClinicManagementView() {
  type ClinicTab = "equipe" | "financeiro" | "configuracoes" | "paperless" | "relatorios"
  const searchParams = useSearchParams()
  const router = useRouter()
  const requestedTab = searchParams.get("tab") as ClinicTab | null
  const [activeTab, setActiveTab] = useState<ClinicTab>(requestedTab || "equipe")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [editingMember, setEditingMember] = useState<any>(null)

  // Credenciais geradas na última criação de funcionário — exibidas em modal próprio
  const [credentialsInfo, setCredentialsInfo] = useState<CredentialsInfo | null>(null)
  const [copied, setCopied] = useState(false)

  // Membro selecionado para exclusão — usado pelo AlertDialog de confirmação
  const [memberToDelete, setMemberToDelete] = useState<any>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const { data: staffRes, mutate: mutateStaff } = useSWR("/api/clinic-staff", fetcher)
  const staff = staffRes?.data || []

  const { data: accessRes } = useSWR("/api/auth/check-access", fetcher)
  const isGestor = (accessRes?.access_role || "gestor") === "gestor"
  const myUserId = accessRes?.user_id
  // "(você)" precisa comparar com quem está logado de verdade — não com o
  // cargo. A flag `virtual` só indica "este card é o gestor renderizado
  // sinteticamente", não "este card é você".
  const isMe = (member: any) => !!myUserId && member.auth_user_id === myUserId
  // Antes a checagem era só "isGestor" — agora cada aba olha pra permissão
  // granular do usuário logado, que o próprio gestor configura por membro.
  const myPermissions: StaffPermissions = accessRes?.permissions || DEFAULT_PERMISSIONS.gestor
  const visibleTabs = (["equipe", "financeiro", "configuracoes", "paperless", "relatorios"] as const).filter((tab) => {
    if (tab === "equipe") return true
    if (tab === "financeiro") return myPermissions.financeiro
    if (tab === "configuracoes") return myPermissions.configuracoes
    if (tab === "relatorios") return myPermissions.relatorios
    if (tab === "paperless") return true
    return false
  })

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
  // Permissões granulares do membro sendo criado/editado no modal.
  const [permissionsForm, setPermissionsForm] = useState<StaffPermissions>(DEFAULT_PERMISSIONS.dentista)

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
        cnpj: settings.cnpj || "",
        phone: settings.phone || "",
        email: settings.email || "",
        address: settings.address || "",
        hours: (settings.working_hours as any)?.days || emptySettingsForm.hours,
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
        cnpj: settingsForm.cnpj || null,
        working_hours: { start: "08:00", end: "18:00", days: settingsForm.hours },
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
    setPermissionsForm(DEFAULT_PERMISSIONS[emptyForm.access_role as StaffAccessRole])
    setIsDialogOpen(true)
  }

  const openEdit = (member: any) => {
    // Entrada virtual do gestor (não existe linha real em clinic_staff) —
    // não deveria nem chegar aqui, já que o botão de editar some pra ela,
    // mas mantemos a guarda por segurança.
    if (member?.virtual) return

    setEditingMember(member)
    setForm({
      full_name: member.full_name || "",
      role: member.role || "Dentista",
      specialty: member.specialty || "",
      email: member.email || "",
      phone: member.phone || "",
      access_role: member.access_role || "dentista",
    })
    setPermissionsForm(getEffectivePermissions(member.access_role, member.permissions))
    setIsDialogOpen(true)
  }

  const handleSave = async () => {
    if (!form.full_name.trim()) { toast.error("Nome é obrigatório"); return }
    setIsSaving(true)
    try {
      const method = editingMember ? "PUT" : "POST"
      const permissionsToSend = form.access_role === "gestor" ? null : permissionsForm
      const body = editingMember
        ? { id: editingMember.id, ...form, permissions: permissionsToSend }
        : { ...form, permissions: permissionsToSend }

      const res = await fetch("/api/clinic-staff", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Erro ao salvar")

      mutateStaff()
      setIsDialogOpen(false)

      // Se uma senha temporária foi gerada, mostra no modal de credenciais
      // independente do e-mail ter sido entregue ou não.
      // Pequeno delay para deixar a animação de saída do modal "Novo Membro"
      // terminar antes de abrir o modal de credenciais (evita flicker de overlays sobrepostos).
      if (data.temp_password) {
        setTimeout(() => {
          setCredentialsInfo({
            email: form.email,
            password: data.temp_password,
            emailDelivered: !!data.email_delivered,
          })
          setCopied(false)
        }, 150)

        if (data.email_delivered) {
          toast.success(`Membro adicionado! Convite enviado para ${form.email}`)
        } else {
          toast.warning("Membro adicionado, mas o e-mail de convite falhou. Copie a senha no modal.")
        }
      } else {
        toast.success(editingMember ? "Membro atualizado!" : "Membro adicionado!")
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar membro")
    } finally {
      setIsSaving(false)
    }
  }

  const handleCopyPassword = async () => {
    if (!credentialsInfo) return
    try {
      await navigator.clipboard.writeText(credentialsInfo.password)
      setCopied(true)
      toast.success("Senha copiada!")
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error("Não foi possível copiar. Selecione o texto manualmente.")
    }
  }

  const confirmDelete = async () => {
    if (!memberToDelete) return
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/clinic-staff?id=${memberToDelete.id}`, { method: "DELETE" })
      // Antes: não checava res.ok, então um erro do Supabase (RLS, constraint, etc.)
      // aparecia como "removido com sucesso" mesmo sem apagar nada do banco.
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Erro ao remover membro")
      toast.success("Membro removido!")
      mutateStaff()
      setMemberToDelete(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao remover membro")
    } finally {
      setIsDeleting(false)
    }
  }

  const handleToggleActive = async (member: any) => {
    if (member?.virtual) return
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

  // Gera as iniciais do avatar de forma segura, ignorando espaços duplicados/no fim
  // que faziam aparecer "undefined" ou uma letra solta no círculo do avatar.
  const getInitials = (fullName: string) =>
    fullName
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((n: string) => n[0])
      .join("")
      .substring(0, 2)
      .toUpperCase()

  useEffect(() => {
    if (!visibleTabs.includes(activeTab)) setActiveTab("equipe")
  }, [visibleTabs, activeTab])

  const selectTab = (tab: ClinicTab) => {
    setActiveTab(tab)
    router.replace(`/gestao-clinica?tab=${tab}`, { scroll: false })
  }

  const tabLabels: Record<ClinicTab, string> = {
    equipe: "Equipe",
    financeiro: "Financeiro",
    configuracoes: "Configurações",
    paperless: "Gestão Paperless",
    relatorios: "Relatórios",
  }

  return (
    <div className="px-4 pb-4 pt-2 md:px-6 md:pb-6 md:pt-3 lg:px-8 lg:pb-8 lg:pt-4 space-y-5">
      {/* Tabs */}
      <div className="flex gap-2 border-b border-border overflow-x-auto">
        {visibleTabs.map(tab => (
          <button key={tab} onClick={() => selectTab(tab)}
            className={`px-4 py-2 font-medium whitespace-nowrap capitalize ${
              activeTab === tab ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"
            }`}>
            {tabLabels[tab]}
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
              {/* max-h + overflow-y-auto: o formulário cresceu com o campo "Perfil de Acesso"
                  e sem isso o rodapé com os botões ficava cortado em telas menores. */}
              <DialogContent className="sm:max-w-[500px] max-h-[85vh] overflow-y-auto">
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
                    <Select
                      value={form.access_role}
                      onValueChange={(v) => {
                        setForm({ ...form, access_role: v })
                        // Trocar o cargo reseta as permissões pro padrão daquele
                        // cargo — o gestor pode ajustar de novo logo abaixo.
                        setPermissionsForm(DEFAULT_PERMISSIONS[v as StaffAccessRole] || DEFAULT_PERMISSIONS.recepcionista)
                      }}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="gestor">Gestor — acesso total ao sistema</SelectItem>
                        <SelectItem value="dentista">Dentista — agenda, pacientes e prontuários</SelectItem>
                        <SelectItem value="recepcionista">Recepcionista — agenda e pacientes</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {form.access_role === "gestor" && "Acesso completo incluindo financeiro e configurações."}
                      {form.access_role === "dentista" && "Acesso à agenda, pacientes e prontuários. Ajuste abaixo o que mais ele pode ver."}
                      {form.access_role === "recepcionista" && "Acesso à agenda e cadastro de pacientes. Ajuste abaixo o que mais ele pode ver."}
                    </p>
                  </div>

                  {/* Permissões granulares — só faz sentido pra quem não é gestor,
                      já que gestor sempre tem acesso total. */}
                  {form.access_role !== "gestor" && (
                    <div className="grid gap-2">
                      <Label className="flex items-center gap-1">
                        <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                        Permissões Extras
                      </Label>
                      <div className="space-y-3 rounded-md border border-border p-3">
                        {PERMISSION_FIELDS.map(({ key, label, hint }) => (
                          <div key={String(key)} className="flex items-start gap-2">
                            <Checkbox
                              id={`perm-${String(key)}`}
                              checked={permissionsForm[key]}
                              onCheckedChange={(checked) =>
                                setPermissionsForm((prev: StaffPermissions) => ({ ...prev, [key]: !!checked }))
                              }
                            />
                            <div className="grid gap-0.5 leading-none">
                              <label htmlFor={`perm-${String(key)}`} className="text-sm font-medium text-foreground cursor-pointer">
                                {label}
                              </label>
                              <p className="text-xs text-muted-foreground">{hint}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

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
                      <p className="text-xs text-emerald-600">✓ Uma senha provisória será gerada e um e-mail de convite será enviado automaticamente.</p>
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

          {/* Modal de credenciais geradas — aparece logo após criar um funcionário com e-mail */}
          <Dialog open={!!credentialsInfo} onOpenChange={(open) => !open && setCredentialsInfo(null)}>
            <DialogContent className="sm:max-w-[440px]">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <KeyRound className="h-5 w-5 text-primary" />
                  Credenciais de Acesso
                </DialogTitle>
                <DialogDescription>
                  {credentialsInfo?.emailDelivered
                    ? "O e-mail de convite foi enviado, mas guarde a senha aqui como backup."
                    : "O e-mail de convite não pôde ser enviado. Copie a senha e informe ao funcionário manualmente."}
                </DialogDescription>
              </DialogHeader>

              {!credentialsInfo?.emailDelivered && (
                <div className="flex items-start gap-2 rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>Falha no envio do e-mail. A conta já foi criada normalmente — só falta repassar a senha.</span>
                </div>
              )}

              <div className="space-y-3 py-2">
                <div className="grid gap-1.5">
                  <Label>Login</Label>
                  <Input readOnly value={credentialsInfo?.email || ""} />
                </div>
                <div className="grid gap-1.5">
                  <Label>Senha Provisória</Label>
                  <div className="flex gap-2">
                    <Input readOnly value={credentialsInfo?.password || ""} className="font-mono" />
                    <Button type="button" variant="outline" size="icon" onClick={handleCopyPassword}>
                      {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    O funcionário será obrigado a trocar essa senha no primeiro login.
                  </p>
                </div>
              </div>

              <DialogFooter>
                <Button onClick={() => setCredentialsInfo(null)}>Fechar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Confirmação antes de remover um membro — evita exclusão acidental */}
          <AlertDialog open={!!memberToDelete} onOpenChange={(open) => !open && !isDeleting && setMemberToDelete(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Remover {memberToDelete?.full_name}?</AlertDialogTitle>
                <AlertDialogDescription>
                  Essa ação não pode ser desfeita.
                  {memberToDelete?.email
                    ? " O login vinculado a este e-mail deixará de ter acesso ao sistema."
                    : ""}
                  {" "}Consultas, prontuários e lançamentos financeiros já registrados não são apagados.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <Button variant="outline" className="bg-transparent" disabled={isDeleting} onClick={() => setMemberToDelete(null)}>
                  Cancelar
                </Button>
                <Button variant="destructive" disabled={isDeleting} onClick={confirmDelete}>
                  {isDeleting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Removendo...</> : "Remover Membro"}
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

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
                        <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
                          <span className="text-primary font-semibold text-sm">
                            {getInitials(member.full_name)}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-foreground">
                            {member.full_name}
                            {isMe(member) && <span className="text-muted-foreground font-normal"> (você)</span>}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <p className="text-sm text-muted-foreground">
                              {member.role}{member.specialty ? ` · ${member.specialty}` : ""}
                            </p>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${roleConfig.color}`}>
                              {roleConfig.label}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right hidden sm:block">
                          <p className="text-xs text-muted-foreground">Consultas Hoje</p>
                          <p className="font-semibold text-foreground">{getAppointmentCount(member.full_name)}</p>
                        </div>
                        {!member.virtual && (
                          <Badge
                            className={`cursor-pointer ${member.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"}`}
                            onClick={() => handleToggleActive(member)}
                          >
                            {member.is_active ? "Ativo" : "Inativo"}
                          </Badge>
                        )}
                        {/* A entrada do gestor é virtual (não existe linha em clinic_staff),
                            então não faz sentido oferecer editar/excluir por aqui. */}
                        {!member.virtual && (
                          <Button variant="ghost" size="icon" onClick={() => openEdit(member)}>
                            <Edit className="w-4 h-4" />
                          </Button>
                        )}
                        {/* Só o gestor pode ver (e usar) o botão de excluir membro. */}
                        {!member.virtual && isGestor && (
                          <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setMemberToDelete(member)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
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

      {activeTab === "paperless" && (
        <div key="paperless" className="[&>div>div:first-child]:hidden">
          <DocumentManagementView />
        </div>
      )}

      {activeTab === "relatorios" && (
        <div key="relatorios" className="-m-4 md:-m-6 lg:-m-8 [&>div>div:first-child]:hidden">
          <ReportsView />
        </div>
      )}
    </div>
  )
}

