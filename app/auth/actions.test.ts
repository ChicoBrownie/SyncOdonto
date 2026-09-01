import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  consumeRateLimit: vi.fn(),
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
}))

vi.mock("@/lib/security/rate-limit", () => ({ consumeRateLimit: mocks.consumeRateLimit }))
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ auth: {
    signInWithPassword: mocks.signInWithPassword,
    signUp: mocks.signUp,
  } })),
}))
vi.mock("@supabase/supabase-js", () => ({ createClient: vi.fn(() => ({})) }))

import { loginAction, signUpAction } from "./actions"

describe("fluxos de autenticação", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.consumeRateLimit.mockResolvedValue(true)
    mocks.signInWithPassword.mockResolvedValue({ error: null })
    mocks.signUp.mockResolvedValue({ error: null })
  })

  it("normaliza o e-mail e autentica com senha", async () => {
    await expect(loginAction("  GESTOR@EXEMPLO.COM ", "senha-segura")).resolves.toEqual({ success: true })
    expect(mocks.signInWithPassword).toHaveBeenCalledWith({ email: "gestor@exemplo.com", password: "senha-segura" })
  })

  it("bloqueia login quando o limite de tentativas termina", async () => {
    mocks.consumeRateLimit.mockResolvedValue(false)
    const result = await loginAction("gestor@exemplo.com", "incorreta")
    expect(result.error).toContain("Muitas tentativas")
    expect(mocks.signInWithPassword).not.toHaveBeenCalled()
  })

  it("envia os dados pessoais no cadastro", async () => {
    await signUpAction(" NOVO@EXEMPLO.COM ", "senha-segura", "Ana Lima", "Ana", "Lima")
    expect(mocks.signUp).toHaveBeenCalledWith({
      email: "novo@exemplo.com",
      password: "senha-segura",
      options: { data: { full_name: "Ana Lima", first_name: "Ana", last_name: "Lima" } },
    })
  })
})
