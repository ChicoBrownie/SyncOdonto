"use client"
import { useEffect, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { z } from "zod"
import { toast } from "sonner"
import { PatientCombobox, type PatientOption } from "@/components/documents/patient-combobox"
import { emptyPayload, steps } from "@/lib/encounters/model"
import { encounterRequest } from "@/lib/encounters/client"
import { patientSearchPrefill } from "@/lib/encounters/patient-input"
import { useSWRConfig } from "swr"
import { ContextualHelp } from "./contextual-help"

export function operationalNow() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Fortaleza", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date())
  const value = (type: string) => parts.find(part => part.type === type)?.value || ""
  return { date: `${value("year")}-${value("month")}-${value("day")}`, time: `${value("hour")}:${value("minute")}` }
}
const entryGuide = [{ selector: "[data-guide='patient-search']", title: "Quem será atendido?", description: "Digite o CPF ou nome. Toque no paciente encontrado para abrir a anamnese. Se não houver cadastro, escolha Novo paciente." }]
export function EncounterEntry() {
  const { mutate } = useSWRConfig()
  const router = useRouter()
  const params = useSearchParams()
  const [patient, setPatient] = useState<PatientOption | null>(null)
  const [busy, setBusy] = useState(false)
  const creating = useRef(false)
  const draftId = useRef<string | null>(null)
  const initial = useRef(false)
  const [error, setError] = useState("")
  async function create(patientId: string | null, appointmentId: string | null = null, step: string = "patient", search = "") {
    if (creating.current) return
    creating.current = true
    setBusy(true); setError("")
    try {
      draftId.current ||= crypto.randomUUID()
      const payload = emptyPayload(); payload.appointment = { ...payload.appointment, ...operationalNow() }; payload.registration = { ...payload.registration, ...patientSearchPrefill(search) }
      const { data } = await encounterRequest("/api/encounters", { method: "POST", body: JSON.stringify({ id: draftId.current, patient_id: patientId, appointment_id: appointmentId, step: steps.includes(step as typeof steps[number]) ? step : "patient", payload }) })
      const needsPrefill = search && data.id !== draftId.current && !data.payload.registration.full_name && !data.payload.registration.cpf
      const needsAnamnesis = patientId && !appointmentId && step === "anamnesis" && data.step === "patient"
      let draft = data
      if (needsPrefill || needsAnamnesis) {
        const updated = await encounterRequest(`/api/encounters/${data.id}`, { method: "PATCH", body: JSON.stringify({ revision: data.revision, step: needsAnamnesis ? "anamnesis" : data.step, payload: needsPrefill ? { ...data.payload, registration: { ...data.payload.registration, ...patientSearchPrefill(search) } } : data.payload }) })
        draft = updated.data
      }
      if (appointmentId && draft.status === "active" && !draft.signed_document_id && draft.step === "patient") {
        await encounterRequest(`/api/encounters/${draft.id}/actions`, { method: "POST", body: JSON.stringify({ revision: draft.revision, action: "start", appointment_id: appointmentId }) })
      }
      void mutate("/api/encounters"); router.replace(`/atendimento/${draft.id}`)
    } catch (e) { const message = e instanceof Error ? e.message : "Não foi possível iniciar."; setPatient(null); setError(message); toast.error(message) }
    finally { creating.current = false; setBusy(false) }
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
    <h1 className="text-2xl font-bold">Iniciar atendimento</h1>
    <ContextualHelp area="encounter-entry" steps={entryGuide} autoOpen={false} />
    <div data-guide="patient-search" className="space-y-2"><p className="font-medium">Quem será atendido?</p><PatientCombobox value={patient} onChange={selected => { setPatient(selected); if (selected) void create(selected.id, null, "anamnesis") }} inline quickEntry disabled={busy} onCreateNew={query => void create(null, null, "patient", query)} /></div>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {busy && <p role="status" className="text-sm text-muted-foreground">Abrindo atendimento…</p>}
  </section>
}
