import { describe, expect, it } from "vitest"
import { capitalizeWords, formatCpf, patientSearchPrefill } from "./patient-input"

describe("preenchimento de paciente a partir da busca", () => {
  it("leva o CPF pesquisado ao campo correto", () => {
    expect(patientSearchPrefill("123.456.789-01")).toEqual({ full_name: "", cpf: "12345678901" })
  })

  it("corrige as iniciais de nomes digitados em minúsculas", () => {
    expect(capitalizeWords("francisco henrique dos santos moura")).toBe("Francisco Henrique Dos Santos Moura")
  })

  it("pontua o CPF digitado ou colado", () => {
    expect(formatCpf("1234567")).toBe("123.456.7")
    expect(formatCpf("12345678901")).toBe("123.456.789-01")
    expect(formatCpf("123.456.789-01")).toBe("123.456.789-01")
  })
})
