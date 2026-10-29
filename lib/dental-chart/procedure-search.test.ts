import { describe, expect, it } from "vitest"
import { searchProcedures } from "./procedure-search"

const items = [
  { name: "Limpeza e profilaxia", description: null },
  { name: "Restauração em resina", description: null },
  { name: "Extração dentária", description: null },
  { name: "Tratamento de canal", description: null },
]

describe("searchProcedures", () => {
  it("aceita acentos e palavras em outra ordem", () => {
    expect(searchProcedures(items, "resina restauracao").matches.map(item => item.name)).toEqual(["Restauração em resina"])
  })

  it("sugere um procedimento quando há erro de digitação", () => {
    const result = searchProcedures(items, "limpzea")
    expect(result.suggested).toBe(true)
    expect(result.matches.map(item => item.name)).toContain("Limpeza e profilaxia")
    expect(result.canCreate).toBe(true)
  })

  it("reconhece uma palavra invertida mesmo com preposição diferente", () => {
    expect(searchProcedures(items, "tratamento do canla").matches.map(item => item.name)).toContain("Tratamento de canal")
  })

  it("oferece cadastro quando não encontra opção semelhante", () => {
    const result = searchProcedures(items, "clareamento")
    expect(result.matches).toEqual([])
    expect(result.canCreate).toBe(true)
  })
})
