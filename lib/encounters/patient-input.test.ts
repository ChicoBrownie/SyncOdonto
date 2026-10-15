import { describe, expect, it } from "vitest"
import { capitalizeWords, patientSearchPrefill } from "./patient-input"

describe("preenchimento de paciente a partir da busca", () => {
  it("leva o CPF pesquisado ao campo correto", () => {
    expect(patientSearchPrefill("123.456.789-01")).toEqual({ full_name: "", cpf: "12345678901" })
  })

  it("corrige as iniciais de nomes digitados em minúsculas", () => {
    expect(capitalizeWords("francisco henrique dos santos moura")).toBe("Francisco Henrique Dos Santos Moura")
  })
})
