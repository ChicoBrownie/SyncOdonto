import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ auth: vi.fn(), staff: vi.fn() }))
vi.mock("@/lib/supabase/api-helper", () => ({ getAuthenticatedClient: mocks.auth }))
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: mocks.staff }) }) }) }),
}))

import { GET } from "./route"

beforeEach(() => {
  vi.clearAllMocks()
  mocks.auth.mockResolvedValue({ user: { id: "usuario-1" } })
})

describe("permissões do menu", () => {
  it("não concede acesso de gestor quando a consulta da equipe falha", async () => {
    mocks.staff.mockResolvedValue({ data: null, error: { message: "Falha temporária" } })
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {})
    try {
      const response = await GET()
      expect(response.status).toBe(503)
      expect(await response.json()).not.toHaveProperty("access_role")
    } finally { errorLog.mockRestore() }
  })

  it("mantém o gestor quando a consulta confirma que não há vínculo com a equipe", async () => {
    mocks.staff.mockResolvedValue({ data: null, error: null })
    const response = await GET()
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ access_role: "gestor" })
  })
})
