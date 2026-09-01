import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ getClinicScopedClient: vi.fn() }))
vi.mock("@/lib/supabase/clinic-scope", () => ({ getClinicScopedClient: mocks.getClinicScopedClient }))

import { GET } from "./[id]/signed-url/route"

function scopedClient(document: Record<string, unknown> | null) {
  const query = { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn().mockResolvedValue({ data: document, error: null }) }
  query.select.mockReturnValue(query)
  query.eq.mockReturnValue(query)
  const createSignedUrl = vi.fn().mockResolvedValue({ data: { signedUrl: "https://storage.test/assinada" }, error: null })
  const client = { from: vi.fn().mockReturnValue(query), storage: { from: vi.fn().mockReturnValue({ createSignedUrl }) } }
  return { client, query, createSignedUrl }
}

describe("download protegido de documentos", () => {
  beforeEach(() => vi.clearAllMocks())

  it("não gera link para documento ausente no escopo da clínica", async () => {
    const { client, query, createSignedUrl } = scopedClient(null)
    mocks.getClinicScopedClient.mockResolvedValue({ supabase: client, ownerId: "clinica-a" })
    const response = await GET(new Request("http://localhost"), { params: Promise.resolve({ id: "doc-b" }) })
    expect(response.status).toBe(404)
    expect(query.eq).toHaveBeenNthCalledWith(2, "user_id", "clinica-a")
    expect(createSignedUrl).not.toHaveBeenCalled()
  })

  it("gera link temporário para documento da própria clínica", async () => {
    const { client, createSignedUrl } = scopedClient({ storage_path: "clinica-a/doc.pdf", file_url: null, title: "Termo" })
    mocks.getClinicScopedClient.mockResolvedValue({ supabase: client, ownerId: "clinica-a" })
    const response = await GET(new Request("http://localhost"), { params: Promise.resolve({ id: "doc-a" }) })
    expect(response.status).toBe(200)
    expect(createSignedUrl).toHaveBeenCalledWith("clinica-a/doc.pdf", 600)
    expect(await response.json()).toMatchObject({ data: { expiresIn: 600 } })
  })
})
