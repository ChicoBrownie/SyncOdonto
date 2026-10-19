import { describe, expect, it } from "vitest"
import { createSimplePdf } from "./simple-pdf"
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs"

describe("geração local de documentos", () => {
  it("produz um PDF válido e não vazio", () => {
    const pdf = createSimplePdf("Atestado odontológico", "Paciente fictício apto para teste.")
    expect(pdf.byteLength).toBeGreaterThan(100)
    expect(new TextDecoder().decode(pdf.slice(0, 8))).toContain("%PDF")
  })
  it("preserva acentos e todas as linhas em várias páginas", async () => {
    const pdf = createSimplePdf("Proposta odontológica", Array.from({ length: 130 }, (_, index) => `Linha ${index + 1}: extração dentária`).join("\n"))
    const task = getDocument({ data: new Uint8Array(pdf), useSystemFonts: true })
    const document = await task.promise
    expect(document.numPages).toBeGreaterThan(1)
    const first = await (await document.getPage(1)).getTextContent()
    const last = await (await document.getPage(document.numPages)).getTextContent()
    expect(first.items.map(item => "str" in item ? item.str : "").join(" ")).toContain("Proposta odontológica")
    expect(last.items.map(item => "str" in item ? item.str : "").join(" ")).toContain("Linha 130: extração dentária")
    await task.destroy()
  })
})
