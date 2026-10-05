import type { EncounterDraft } from "./model"

export class EncounterError extends Error {
  constructor(message: string, public conflict = false) { super(message) }
}
export async function encounterRequest(url: string, options?: RequestInit) {
  const response = await fetch(url, { cache: "no-store", ...options, headers: { "Content-Type": "application/json", ...options?.headers } })
  let payload
  try { payload = await response.json() } catch { throw new EncounterError("O servidor não respondeu como esperado. Tente novamente.") }
  if (!response.ok) throw new EncounterError(payload.error || "Não foi possível salvar.", Boolean(payload.conflict))
  return payload
}
export const resumeKey = "/api/encounters"
// Memory only: no clinical data in localStorage, IndexedDB or a service worker.
const pendingSavers = new Set<() => Promise<EncounterDraft | null>>()
export function registerSaver(save: () => Promise<EncounterDraft | null>) {
  pendingSavers.add(save)
  return () => { pendingSavers.delete(save) }
}
export async function flushEncounterEdits() {
  await Promise.all([...pendingSavers].map(save => save()))
}
