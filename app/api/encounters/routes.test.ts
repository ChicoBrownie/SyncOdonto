import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextResponse } from "next/server"
import { emptyPayload } from "@/lib/encounters/model"

const mocks = vi.hoisted(() => ({ context: vi.fn() }))
vi.mock("@/lib/supabase/clinic-scope", () => ({ getClinicScopedClient: mocks.context }))
vi.mock("@/lib/security/audit", () => ({ recordAuditEvent: vi.fn() }))
import { GET as list, POST as create } from "./route"
import { GET as read, PATCH as save } from "./[id]/route"
import { POST as action } from "./[id]/actions/route"

const id = "55555555-5555-4555-8555-555555555555"
const clinic = "11111111-1111-4111-8111-111111111111"
const actor = "22222222-2222-4222-8222-222222222222"
const params = { params: Promise.resolve({ id }) }
const draft = { id, clinic_id: clinic, actor_user_id: actor, patient_id: "44444444-4444-4444-8444-444444444444", appointment_id: "66666666-6666-4666-8666-666666666666", revision: 7, payload: emptyPayload(), status: "active", signed_document_id: null }
function client(value: unknown = draft) {
  const query: any = { maybeSingle: vi.fn().mockResolvedValue({ data: value, error: null }) }
  for (const method of ["select", "eq", "order", "limit", "range", "upsert"]) query[method] = vi.fn().mockReturnValue(query)
  query.then = (resolve: (value: unknown) => unknown) => Promise.resolve({ data: value, error: null }).then(resolve)
  const rpc = vi.fn().mockResolvedValue({ data: draft, error: null })
  const supabase = { from: vi.fn().mockReturnValue(query), rpc }
  mocks.context.mockResolvedValue({ supabase, ownerId: clinic, user: { id: actor } })
  return { query, rpc }
}
const request = (body: unknown) => new Request(`http://localhost/api/encounters/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
beforeEach(() => vi.clearAllMocks())
describe("APIs de rascunho autenticadas e isoladas", () => {
  it("devolve a falha de autenticação sem consultar dados", async () => {
    mocks.context.mockResolvedValue({ error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) })
    expect((await list()).status).toBe(401)
    expect((await save(request({}), params)).status).toBe(401)
    expect((await action(request({}), params)).status).toBe(401)
  })
  it("lista apenas rascunhos ativos da clínica e do usuário", async () => {
    const { query } = client([])
    const response = await list()
    expect(query.eq).toHaveBeenCalledWith("clinic_id", clinic)
    expect(query.eq).toHaveBeenCalledWith("actor_user_id", actor)
    expect(query.eq).toHaveBeenCalledWith("status", "active")
    expect(query.range).toHaveBeenCalledWith(0, 4)
    expect(response.headers.get("cache-control")).toBe("no-store")
  })
  it("não recupera ID fora do escopo e não faz ações nele", async () => {
    const { query, rpc } = client(null)
    expect((await read(new Request("http://localhost"), params)).status).toBe(404)
    expect((await action(request({ action: "publish", revision: 7 }), params)).status).toBe(404)
    expect(query.eq).toHaveBeenCalledWith("actor_user_id", actor)
    expect(rpc).not.toHaveBeenCalled()
  })
  it("não permite substituir clínica ou usuário no corpo", async () => {
    const { rpc } = client()
    const response = await save(request({ revision: 7, step: "budget", payload: emptyPayload(), clinic_id: "outra" }), params)
    expect(response.status).toBe(400); expect(rpc).not.toHaveBeenCalled()
    expect((await create(request({ id, actor_user_id: "outra" }))).status).toBe(400)
  })
  it("salva com revisão esperada e escopo derivado da sessão", async () => {
    const { rpc } = client()
    expect((await save(request({ revision: 7, step: "budget", payload: emptyPayload() }), params)).status).toBe(200)
    expect(rpc).toHaveBeenCalledWith("save_encounter_draft", expect.objectContaining({ p_clinic: clinic, p_actor: actor, p_revision: 7 }))
  })
  it("informa conflito sem repetir a escrita nem devolver dados da versão concorrente", async () => {
    const { rpc } = client()
    rpc.mockResolvedValue({ data: null, error: { code: "40001", message: "Versão mudou" } })
    const response = await save(request({ revision: 7, step: "budget", payload: emptyPayload() }), params)
    expect(response.status).toBe(409); expect(await response.json()).toMatchObject({ conflict: true })
    expect(rpc).toHaveBeenCalledTimes(1)
  })
  it("assinatura e financeiro exigem confirmação explícita", async () => {
    const { rpc } = client()
    expect((await action(request({ action: "sign", revision: 7, signature: "data:image/png;base64,AA==" }), params)).status).toBe(400)
    expect((await action(request({ action: "complete", revision: 7 }), params)).status).toBe(400)
    expect(rpc).not.toHaveBeenCalled()
  })
  it("retorna a mesma assinatura e conclusão após resposta perdida", async () => {
    const { rpc } = client({ ...draft, signed_document_id: "77777777-7777-4777-8777-777777777777", status: "completed" })
    expect((await action(request({ action: "sign", revision: 2, confirmed: true }), params)).status).toBe(200)
    expect((await action(request({ action: "complete", revision: 2, confirmed: true }), params)).status).toBe(200)
    expect(rpc).not.toHaveBeenCalled()
  })
})
