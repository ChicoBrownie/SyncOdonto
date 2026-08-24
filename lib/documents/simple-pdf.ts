function ascii(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\x20-\x7E\n]/g, "?")
}

function escapePdf(value: string) {
  return value.replace(/([\\()])/g, "\\$1")
}

export function createSimplePdf(title: string, content: string): Buffer {
  const lines = ascii(`${title}\n\n${content}`).split("\n").flatMap((line) => {
    if (!line) return [""]
    const words = line.split(/\s+/)
    const wrapped: string[] = []
    let current = ""
    for (const word of words) {
      if (`${current} ${word}`.trim().length > 88) { wrapped.push(current); current = word } else current = `${current} ${word}`.trim()
    }
    if (current) wrapped.push(current)
    return wrapped
  }).slice(0, 48)
  const stream = [`BT`, `/F1 11 Tf`, `50 790 Td`, `14 TL`, ...lines.map((line, index) => `${index ? "T* " : ""}(${escapePdf(line)}) Tj`), `ET`].join("\n")
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ]
  let pdf = "%PDF-1.4\n"
  const offsets = [0]
  objects.forEach((object, index) => { offsets.push(Buffer.byteLength(pdf)); pdf += `${index + 1} 0 obj\n${object}\nendobj\n` })
  const xref = Buffer.byteLength(pdf)
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n `).join("\n")}\ntrailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`
  return Buffer.from(pdf)
}
