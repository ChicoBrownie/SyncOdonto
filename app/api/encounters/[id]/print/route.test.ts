import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextResponse } from "next/server"
import { emptyPayload } from "@/lib/encounters/model"

const mocks = vi.hoisted(() => ({ context: vi.fn() }))
vi.mock("@/lib/supabase/clinic-scope", () => ({ getClinicScopedClient: mocks.context }))
import { GET } from "./route"

const id = "55555555-5555-4555-8555-555555555555"
const patientId = "44444444-4444-4444-8444-444444444444"
const clinic = "11111111-1111-4111-8111-111111111111"
const actor = "22222222-2222-4222-8222-222222222222"
const params = { params: Promise.resolve({ id }) }

beforeEach(() => vi.clearAllMocks())

describe("impressão do atendimento", () => {
  it("exige autenticação antes de consultar o prontuário", async () => {
    mocks.context.mockResolvedValue({ error: NextResponse.json({ error: "Não autorizado" }, { status: 401 }) })
    expect((await GET(new Request(`http://localhost/api/encounters/${id}/print?kind=record`), params)).status).toBe(401)
  })

  it("limita o arquivo à clínica e ao profissional do atendimento", async () => {
    const payload = emptyPayload()
    payload.budget.items = [{ source_id: null, procedure: "Extração", region: "Dente 11", unitValue: 50, discount: 0 }]
    const values: Record<string, unknown> = {
      encounter_drafts: { patient_id: patientId, payload, signed_document_id: null },
      patients: { full_name: "Paciente Fictício", email: null },
    }
    const queries: Record<string, { eq: ReturnType<typeof vi.fn> }> = {}
    const supabase = { from: vi.fn((table: string) => {
      const query: any = { eq: vi.fn(), select: vi.fn(), maybeSingle: vi.fn() }
      query.eq.mockReturnValue(query)
      query.select.mockReturnValue(query)
      query.maybeSingle.mockResolvedValue({ data: values[table], error: null })
      queries[table] = query
      return query
    }) }
    mocks.context.mockResolvedValue({ supabase, ownerId: clinic, user: { id: actor } })
    const response = await GET(new Request(`http://localhost/api/encounters/${id}/print?kind=proposal&format=pdf`), params)
    expect(response.status).toBe(200)
    expect(response.headers.get("content-type")).toBe("application/pdf")
    expect(new TextDecoder().decode((await response.arrayBuffer()).slice(0, 8))).toContain("%PDF")
    expect(queries.encounter_drafts.eq).toHaveBeenCalledWith("clinic_id", clinic)
    expect(queries.encounter_drafts.eq).toHaveBeenCalledWith("actor_user_id", actor)
    expect(queries.patients.eq).toHaveBeenCalledWith("user_id", clinic)
  })
})
