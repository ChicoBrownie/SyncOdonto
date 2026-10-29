import { createHash } from "node:crypto"
import { DEFAULT_PROCEDURES } from "./default-procedures"
import { normalizeProcedureText } from "./procedure-search"

type ExistingProcedure = { id: string; name: string }

export function defaultProcedureId(ownerId: string, name: string) {
  const bytes = createHash("sha1").update(`syncodonto:procedure:${ownerId}:${name}`).digest().subarray(0, 16)
  bytes[6] = (bytes[6] & 0x0f) | 0x50
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = bytes.toString("hex")
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

export function missingDefaultProcedureRows(ownerId: string, existing: ExistingProcedure[]) {
  // Os catálogos existentes receberam os cinco primeiros itens antes desta ampliação.
  // Se algum deles foi renomeado, não recriamos o nome antigo.
  const defaults = existing.length >= 5 ? DEFAULT_PROCEDURES.slice(5) : DEFAULT_PROCEDURES
  const names = new Set(existing.map(item => normalizeProcedureText(item.name)))
  const ids = new Set(existing.map(item => item.id))
  return defaults.filter(name => !names.has(normalizeProcedureText(name)) && !ids.has(defaultProcedureId(ownerId, name))).map(name => ({
    id: defaultProcedureId(ownerId, name), user_id: ownerId, name,
    description: null, default_price: 0, is_favorite: false, is_active: true,
  }))
}
