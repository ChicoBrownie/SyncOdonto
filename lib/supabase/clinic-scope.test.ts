import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ getUser: vi.fn(), staff: vi.fn() }))
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getUser: mocks.getUser } }) }))
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: mocks.staff }) }) }) }),
}))

import { getClinicScopedClient } from "./clinic-scope"

beforeEach(() => {
  vi.clearAllMocks()
  mocks.getUser.mockResolvedValue({ data: { user: { id: "usuario-1" } }, error: null })
})

describe("escopo da clínica", () => {
  it("não assume propriedade da clínica quando a consulta da equipe falha", async () => {
    mocks.staff.mockResolvedValue({ data: null, error: { message: "Falha temporária" } })
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {})
    try {
      const result = await getClinicScopedClient()
      expect("error" in result && result.error?.status).toBe(503)
    } finally { errorLog.mockRestore() }
  })

  it("usa o vínculo confirmado com a clínica", async () => {
    mocks.staff.mockResolvedValue({ data: { user_id: "clinica-1", access_role: "dentista", permissions: null, is_active: true }, error: null })
    const result = await getClinicScopedClient()
    expect(result).toMatchObject({ ownerId: "clinica-1", accessRole: "dentista" })
  })
})
