import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  scopedClient: vi.fn(),
  rateLimit: vi.fn(),
  audit: vi.fn(),
  send: vi.fn(),
}))
vi.mock("@/lib/supabase/clinic-scope", () => ({ getClinicScopedClient: mocks.scopedClient }))
vi.mock("@/lib/security/rate-limit", () => ({ consumeRateLimit: mocks.rateLimit }))
vi.mock("@/lib/security/audit", () => ({ recordAuditEvent: mocks.audit }))
vi.mock("@/lib/email/resend", () => ({ resend: { emails: { send: mocks.send } } }))

import { POST } from "./route"

const params = { params: Promise.resolve({ id: "documento-1" }) }

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv("RESEND_API_KEY", "test-key")
  mocks.rateLimit.mockResolvedValue(true)
  mocks.audit.mockResolvedValue(undefined)
  mocks.send.mockResolvedValue({ error: null })
})
afterEach(() => vi.unstubAllEnvs())

describe("envio de orçamento", () => {
  it("envia o link apenas para o e-mail do paciente vinculado ao documento da clínica", async () => {
    const query: any = { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn() }
    query.select.mockReturnValue(query)
    query.eq.mockReturnValue(query)
    query.maybeSingle.mockResolvedValue({ data: { id: "documento-1", title: "Orçamento", document_type: "budget", storage_path: "clinica-1/orcamento.pdf", file_url: null, patient: { id: "paciente-1", full_name: "Paciente Teste", email: "paciente@example.com" } }, error: null })
    const createSignedUrl = vi.fn().mockResolvedValue({ data: { signedUrl: "https://storage.example.com/orcamento.pdf" }, error: null })
    mocks.scopedClient.mockResolvedValue({ supabase: { from: vi.fn().mockReturnValue(query), storage: { from: vi.fn().mockReturnValue({ createSignedUrl }) } }, ownerId: "clinica-1", user: { id: "usuario-1" } })

    const response = await POST(new Request("http://localhost/api/documents/documento-1/email", { method: "POST" }), params)
    expect(response.status).toBe(200)
    expect(query.eq).toHaveBeenCalledWith("user_id", "clinica-1")
    expect(createSignedUrl).toHaveBeenCalledWith("clinica-1/orcamento.pdf", 86400)
    expect(mocks.send).toHaveBeenCalledWith(expect.objectContaining({ to: "paciente@example.com", subject: "Orçamento — SyncOdonto" }))
    expect(await response.json()).toEqual({ message: "Orçamento enviado para paciente@example.com." })
  })
})
