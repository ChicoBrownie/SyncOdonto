function printable(value: string) {
  return value.replace(/[\u2010-\u2015]/g, "-").replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"').replace(/[^\x20-\x7e\xa0-\xff\n]/g, "?")
}

function escapePdf(value: string) {
  return value.replace(/([\\()])/g, "\\$1")
}

function wrap(line: string) {
  const parts: string[] = []
  const words = line.split(/\s+/)
  let current = ""
  for (const word of words) {
    if (!word) continue
    if (current && `${current} ${word}`.length > 88) { parts.push(current); current = "" }
    if (word.length > 88) {
      if (current) { parts.push(current); current = "" }
      for (let at = 0; at < word.length; at += 88) parts.push(word.slice(at, at + 88))
    } else current = current ? `${current} ${word}` : word
  }
  if (current) parts.push(current)
  return parts.length ? parts : [""]
}

export function createSimplePdf(title: string, content: string): Buffer {
  const lines = printable(`${title}\n\n${content}`).split("\n").flatMap(wrap)
  const pageLines: string[][] = []
  for (let at = 0; at < lines.length; at += 48) pageLines.push(lines.slice(at, at + 48))
  const pageRefs = pageLines.map((_, index) => `${4 + index * 2} 0 R`).join(" ")
  const objects: Buffer[] = [
    Buffer.from("<< /Type /Catalog /Pages 2 0 R >>"),
    Buffer.from(`<< /Type /Pages /Kids [${pageRefs}] /Count ${pageLines.length} >>`),
    Buffer.from("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>"),
  ]
  for (const [index, page] of pageLines.entries()) {
    const pageNumber = 4 + index * 2
    const stream = Buffer.from(["BT", "/F1 11 Tf", "50 790 Td", "14 TL", ...page.map((line, lineIndex) => `${lineIndex ? "T* " : ""}(${escapePdf(line)}) Tj`), "ET"].join("\n"), "latin1")
    objects.push(Buffer.from(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${pageNumber + 1} 0 R >>`))
    objects.push(Buffer.concat([Buffer.from(`<< /Length ${stream.length} >>\nstream\n`), stream, Buffer.from("\nendstream")]))
  }
  const chunks = [Buffer.from("%PDF-1.4\n")]
  const offsets = [0]
  let position = chunks[0].length
  for (const [index, object] of objects.entries()) {
    offsets.push(position)
    const wrapped = Buffer.concat([Buffer.from(`${index + 1} 0 obj\n`), object, Buffer.from("\nendobj\n")])
    chunks.push(wrapped)
    position += wrapped.length
  }
  const xref = position
  chunks.push(Buffer.from(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${String(offset).padStart(10, "0")} 00000 n `).join("\n")}\ntrailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`))
  return Buffer.concat(chunks)
}
