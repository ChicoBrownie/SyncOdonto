import { describe, expect, it } from "vitest"

import { getEffectivePermissions } from "./permissions"

describe("getEffectivePermissions", () => {
  it("mantém acesso total para o gestor", () => {
    expect(getEffectivePermissions("gestor", { financeiro: false })).toEqual({
      financeiro: true,
      relatorios: true,
      configuracoes: true,
    })
  })

  it("usa o padrão restritivo para equipe e aplica apenas liberações explícitas", () => {
    expect(getEffectivePermissions("dentista", { relatorios: true })).toEqual({
      financeiro: false,
      relatorios: true,
      configuracoes: false,
    })
  })

  it("falha de forma restritiva quando o perfil é inválido", () => {
    expect(getEffectivePermissions("perfil-invalido")).toEqual({
      financeiro: false,
      relatorios: false,
      configuracoes: false,
    })
  })

  it("mantém dentista e recepcionista restritos até liberação individual", () => {
    expect(getEffectivePermissions("dentista")).toEqual({ financeiro: false, relatorios: false, configuracoes: false })
    expect(getEffectivePermissions("recepcionista", { financeiro: true })).toEqual({
      financeiro: true,
      relatorios: false,
      configuracoes: false,
    })
  })
})
