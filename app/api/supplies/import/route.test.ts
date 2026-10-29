import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ scoped: vi.fn(), rateLimit: vi.fn(), audit: vi.fn(), read: vi.fn() }))
vi.mock("@/lib/supabase/clinic-scope", () => ({ getClinicScopedClient: mocks.scoped }))
vi.mock("@/lib/security/rate-limit", () => ({ consumeRateLimit: mocks.rateLimit }))
vi.mock("@/lib/security/audit", () => ({ recordAuditEvent: mocks.audit }))
vi.mock("@/lib/supplies/import", () => ({ readSupplySpreadsheet: mocks.read }))

import { POST } from "./route"

const rows = [
  { line: 2, name: "Luvas", unit: "caixa", usable_quantity: 10, minimum_quantity: 2, is_critical: true, primary_supplier: null, primary_lead_days: null, backup_supplier: null, backup_lead_days: null },
  { line: 3, name: "Máscaras", unit: "caixa", usable_quantity: 5, minimum_quantity: 1, is_critical: true, primary_supplier: null, primary_lead_days: null, backup_supplier: null, backup_lead_days: null },
]

function request(mode: string) {
  const form = new FormData()
  form.set("mode", mode)
  form.set("file", new File(["Material\nLuvas"], "materiais.csv"))
  return new Request("http://localhost/api/supplies/import", { method: "POST", body: form })
}

function client(accessRole = "gestor") {
  const query: any = { select: vi.fn(), eq: vi.fn(), range: vi.fn(), insert: vi.fn() }
  query.select.mockReturnValue(query)
  query.eq.mockReturnValue(query)
  query.range.mockResolvedValue({ data: [{ name: "Luvas" }], error: null })
  query.insert.mockReturnValue(query)
  const inserted: any = { ...query, then: (resolve: (value: unknown) => void) => resolve({ data: [{ id: "novo-1" }], error: null }) }
  query.select.mockImplementation(() => inserted)
  const supabase = { from: vi.fn().mockReturnValue(query) }
  mocks.scoped.mockResolvedValue({ supabase, ownerId: "clinica-1", accessRole, user: { id: "gestor-1" } })
  return { query, supabase }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.read.mockResolvedValue({ rows, errors: [], unmapped: [] })
  mocks.rateLimit.mockResolvedValue(true)
  mocks.audit.mockResolvedValue(undefined)
})

describe("prévia e importação de materiais", () => {
  it("bloqueia alterações de quem não é gestor", async () => {
    const { query } = client("dentista")
    expect((await POST(request("commit"))).status).toBe(403)
    expect(query.insert).not.toHaveBeenCalled()
  })

  it("mostra os existentes sem gravar durante a prévia", async () => {
    const { query } = client()
    const response = await POST(request("preview"))
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ data: { newCount: 1, skippedCount: 1 } })
    expect(query.eq).toHaveBeenCalledWith("user_id", "clinica-1")
    expect(query.insert).not.toHaveBeenCalled()
  })

  it("grava somente materiais novos no escopo da clínica", async () => {
    const { query } = client()
    const response = await POST(request("commit"))
    expect(response.status).toBe(200)
    expect(query.insert).toHaveBeenCalledWith([expect.objectContaining({ name: "Máscaras", user_id: "clinica-1" })])
    expect(await response.json()).toMatchObject({ data: { importedCount: 1, skippedCount: 1 } })
  })
})
