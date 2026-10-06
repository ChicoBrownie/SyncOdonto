"use client"
import { useCallback, useEffect, useRef, useState } from "react"
import { useSWRConfig } from "swr"
import { EncounterError, encounterRequest, registerSaver, resumeKey } from "./client"
import type { EncounterDraft, EncounterPayload, EncounterStep } from "./model"

type SaveState = "loading" | "saving" | "saved" | "error" | "conflict"
const canonical = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonical)
  if (value && typeof value === "object") return Object.fromEntries(
    Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => [key, canonical(item)])
  )
  return value
}
// PostgreSQL JSONB can reorder object keys. Their order is not a clinical edit.
const fingerprint = (value: EncounterDraft) => JSON.stringify([canonical(value.payload), value.step])
export function useEncounter(id: string) {
  const { mutate } = useSWRConfig()
  const [draft, setDraft] = useState<EncounterDraft | null>(null)
  const [saveState, setSaveState] = useState<SaveState>("loading")
  const [message, setMessage] = useState("")
  const [actionMessage, setActionMessage] = useState("")
  const [busy, setBusy] = useState(false)
  const current = useRef<EncounterDraft | null>(null)
  const saved = useRef("")
  const blocked = useRef(false)
  const acting = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inFlight = useRef<Promise<EncounterDraft | null> | null>(null)

  const load = useCallback(async () => {
    setDraft(null)
    setSaveState("loading")
    try {
      const { data } = await encounterRequest(`/api/encounters/${id}`)
      current.current = data; saved.current = fingerprint(data); blocked.current = false
      setDraft(data); setSaveState("saved"); setMessage(""); setActionMessage("")
    } catch (error) { setSaveState("error"); setMessage(error instanceof Error ? error.message : "Não foi possível carregar.") }
  }, [id])
  useEffect(() => { void load() }, [load])

  const flush = useCallback(async function saveLatest(): Promise<EncounterDraft | null> {
    if (timer.current) { clearTimeout(timer.current); timer.current = null }
    if (blocked.current) throw new EncounterError("Há uma versão mais recente. Recarregue para continuar.", true)
    if (inFlight.current) { await inFlight.current; return saveLatest() }
    const snapshot = current.current
    if (!snapshot || snapshot.status !== "active" || fingerprint(snapshot) === saved.current) return snapshot
    setSaveState("saving")
    const pending = (async () => {
      try {
        const body = JSON.stringify({ revision: snapshot.revision, step: snapshot.step, payload: snapshot.payload })
        const { data } = await encounterRequest(`/api/encounters/${id}`, { method: "PATCH", keepalive: new TextEncoder().encode(body).length < 60_000, body })
        saved.current = fingerprint(data)
        const latest = current.current!
        // A server-normalized response is saved, not another edit. Only replay
        // changes made by the user while this request was in flight.
        const editedWhileSaving = latest !== snapshot
        const accepted = editedWhileSaving ? { ...data, payload: latest.payload, step: latest.step } : data
        current.current = accepted
        setDraft(accepted)
        setSaveState(fingerprint(accepted) === saved.current ? "saved" : "saving")
        setMessage(""); void mutate(resumeKey)
        return accepted
      } catch (error) {
        blocked.current = error instanceof EncounterError && error.conflict
        setSaveState(blocked.current ? "conflict" : "error")
        setMessage(error instanceof Error ? error.message : "Não foi possível salvar.")
        throw error
      } finally { inFlight.current = null }
    })()
    inFlight.current = pending
    await pending
    return saveLatest()
  }, [id, mutate])

  const update = useCallback((change: (payload: EncounterPayload) => EncounterPayload) => {
    if (!current.current || current.current.status !== "active" || blocked.current || acting.current) return
    const next = { ...current.current, payload: change(current.current.payload) }
    if (fingerprint(next) === fingerprint(current.current)) return
    current.current = next
    setDraft(current.current); setSaveState("saving")
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => { void flush().catch(() => undefined) }, 500)
  }, [flush])

  const go = useCallback(async (step: EncounterStep) => {
    if (!current.current || blocked.current || acting.current) return
    current.current = { ...current.current, step }
    setDraft(current.current)
    await flush()
  }, [flush])

  const action = useCallback(async (actionName: string, input: Record<string, unknown> = {}) => {
    if (acting.current) return null
    acting.current = true; setBusy(true); setActionMessage("")
    let performingAction = false
    try {
      const latest = await flush()
      if (!latest) throw new Error("Aguarde o atendimento carregar.")
      performingAction = true
      const { data } = await encounterRequest(`/api/encounters/${id}/actions`, { method: "POST", body: JSON.stringify({ revision: latest.revision, action: actionName, ...input }) })
      current.current = data; saved.current = fingerprint(data)
      setDraft(data); setSaveState("saved"); setMessage(""); void mutate(resumeKey)
      return data as EncounterDraft
    } catch (error) {
      if (error instanceof EncounterError && error.conflict) { blocked.current = true; setSaveState("conflict"); setMessage(error.message) }
      else if (performingAction) setActionMessage(error instanceof Error ? error.message : "Não foi possível concluir.")
      throw error
    } finally { acting.current = false; setBusy(false) }
  }, [flush, id, mutate])

  useEffect(() => {
    const unregister = registerSaver(flush)
    const onHide = () => { if (document.visibilityState === "hidden") void flush().catch(() => undefined) }
    const onOnline = () => { void flush().catch(() => undefined) }
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (current.current?.status === "active" && fingerprint(current.current) !== saved.current) { event.preventDefault(); event.returnValue = "" }
    }
    document.addEventListener("visibilitychange", onHide)
    window.addEventListener("online", onOnline)
    window.addEventListener("beforeunload", beforeUnload)
    return () => {
      unregister(); document.removeEventListener("visibilitychange", onHide)
      window.removeEventListener("online", onOnline); window.removeEventListener("beforeunload", beforeUnload)
      if (timer.current) clearTimeout(timer.current)
      void flush().catch(() => undefined)
    }
  }, [flush])
  return { draft, saveState, message, actionMessage, busy, update, go, flush, action, reload: load }
}
