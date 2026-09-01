import type { SupabaseClient } from "@supabase/supabase-js"
import { describe, expect, it, vi } from "vitest"

import { patientBelongsToClinic } from "./clinic-data"

function clinicClient(result: { data: { id: string } | null; error: unknown }) {
  const chain = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue(result),
  }
  chain.select.mockReturnValue(chain)
  chain.eq.mockReturnValue(chain)

  return {
    client: { from: vi.fn().mockReturnValue(chain) } as unknown as SupabaseClient,
    chain,
  }
}

describe("patientBelongsToClinic", () => {
  it("aceita somente paciente encontrado dentro do escopo da clínica", async () => {
    const { client, chain } = clinicClient({ data: { id: "paciente-1" }, error: null })

    await expect(patientBelongsToClinic(client, "paciente-1", "clinica-1")).resolves.toBe(true)
    expect(chain.eq).toHaveBeenNthCalledWith(1, "id", "paciente-1")
    expect(chain.eq).toHaveBeenNthCalledWith(2, "user_id", "clinica-1")
  })

  it("rejeita identificador inválido ou paciente de outra clínica", async () => {
    const { client } = clinicClient({ data: null, error: null })
    await expect(patientBelongsToClinic(client, "paciente-2", "clinica-1")).resolves.toBe(false)
    await expect(patientBelongsToClinic(client, null, "clinica-1")).resolves.toBe(false)
  })

  it("mantém duas clínicas fictícias isoladas pelo proprietário", async () => {
    const clinicA = clinicClient({ data: { id: "paciente-a" }, error: null })
    const clinicB = clinicClient({ data: null, error: null })
    await expect(patientBelongsToClinic(clinicA.client, "paciente-a", "clinica-a")).resolves.toBe(true)
    await expect(patientBelongsToClinic(clinicB.client, "paciente-a", "clinica-b")).resolves.toBe(false)
    expect(clinicB.chain.eq).toHaveBeenNthCalledWith(2, "user_id", "clinica-b")
  })
})
