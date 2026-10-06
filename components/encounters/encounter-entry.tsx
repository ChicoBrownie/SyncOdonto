"use client"
import { useEffect, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { z } from "zod"
import { toast } from "sonner"
import { PatientCombobox, type PatientOption } from "@/components/documents/patient-combobox"
import { Button } from "@/components/ui/button"
import { emptyPayload, steps } from "@/lib/encounters/model"
import { encounterRequest } from "@/lib/encounters/client"
import { useSWRConfig } from "swr"
import { ContextualHelp } from "./contextual-help"

export function operationalNow() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Fortaleza", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date())
  const value = (type: string) => parts.find(part => part.type === type)?.value || ""
  return { date: `${value("year")}-${value("month")}-${value("day")}`, time: `${value("hour")}:${value("minute")}` }
}
const entryGuide = [{ selector: "[data-guide='patient-search']", title: "Encontre o paciente", description: "Busque por nome ou CPF. Confira o paciente antes de iniciar para aproveitar o cadastro e os horários existentes." }, { selector: "[data-guide='quick-register']", title: "Cadastro rápido", description: "Se a pessoa ainda não tem cadastro, informe nome, nascimento e CPF. O rascunho começa a ser salvo durante a digitação." }]
export function EncounterEntry() {
  const { mutate } = useSWRConfig()
  const router = useRouter()
  const params = useSearchParams()
  const [patient, setPatient] = useState<PatientOption | null>(null)
  const [busy, setBusy] = useState(false)
  const draftId = useRef<string | null>(null)
  const initial = useRef(false)
  const [error, setError] = useState("")
  async function create(patientId: string | null, appointmentId: string | null = null, step: string = "patient") {
    setBusy(true); setError("")
    try {
      draftId.current ||= crypto.randomUUID()
      const payload = emptyPayload(); payload.appointment = { ...payload.appointment, ...operationalNow() }
      const { data } = await encounterRequest("/api/encounters", { method: "POST", body: JSON.stringify({ id: draftId.current, patient_id: patientId, appointment_id: appointmentId, step: steps.includes(step as typeof steps[number]) ? step : "patient", payload }) })
      void mutate("/api/encounters"); router.replace(`/atendimento/${data.id}`)
    } catch (e) { const message = e instanceof Error ? e.message : "Não foi possível iniciar."; setError(message); toast.error(message) }
    finally { setBusy(false) }
  }
  useEffect(() => {
    const id = params.get("patientId")
    if (initial.current || !id || !z.string().uuid().safeParse(id).success) return
    initial.current = true
    const appointment = params.get("appointmentId")
    void create(id, appointment && z.string().uuid().safeParse(appointment).success ? appointment : null, params.get("step") || "patient")
    // A single id makes Strict Mode and a retry safe; navigation carries only IDs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params])
  return <section className="mx-auto max-w-xl space-y-5">
    <div className="flex items-center justify-between gap-3"><h1 className="text-2xl font-bold">Iniciar atendimento</h1><ContextualHelp area="encounter-entry" steps={entryGuide} /></div>
    <p className="text-muted-foreground">Encontre o paciente. Depois, escolha atender agora ou agendar.</p>
    <div data-guide="patient-search" className="space-y-2"><p className="font-medium">Quem será atendido?</p><PatientCombobox value={patient} onChange={setPatient} /></div>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <Button className="min-h-12 w-full" disabled={busy || !patient} onClick={() => void create(patient!.id)}>{busy ? "Abrindo atendimento…" : "Continuar com este paciente"}</Button>
    <Button data-guide="quick-register" variant="outline" className="min-h-12 w-full" disabled={busy} onClick={() => void create(null)}>Cadastrar novo paciente</Button>
  </section>
}
