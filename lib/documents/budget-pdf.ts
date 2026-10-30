import sharp from "sharp"
import { budgetItems, budgetTotal, type BudgetClinic, type BudgetDocument } from "./budget-document"

const pageWidth = 595
const pageHeight = 842
const left = 55
const right = 540
const printable = (value: string) => value.replace(/[\u2010-\u2015]/g, "-").replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"').replace(/[^\x20-\x7e\xa0-\xff]/g, "?")
const literal = (value: string) => printable(value).replace(/([\\()])/g, "\\$1")
const money = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })

function wrap(value: string, max: number): string[] {
  const lines: string[] = []
  for (const paragraph of value.split(/\r?\n/)) {
    let current = ""
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      if (current && `${current} ${word}`.length > max) { lines.push(current); current = "" }
      if (word.length > max) {
        if (current) { lines.push(current); current = "" }
        for (let index = 0; index < word.length; index += max) lines.push(word.slice(index, index + max))
      } else current = current ? `${current} ${word}` : word
    }
    lines.push(current)
  }
  return lines
}

export async function createBudgetPdf(document: BudgetDocument, clinic: BudgetClinic, logo?: Buffer): Promise<Buffer> {
  const pages: string[][] = [[]]
  let y = 775
  const commands = () => pages[pages.length - 1]
  const nextPage = () => { pages.push([]); y = 775 }
  const ensure = (height: number) => { if (y - height < 100) nextPage() }
  const text = (value: string, x: number, at: number, size = 11, font = "F1") => commands().push(`BT /${font} ${size} Tf ${x} ${at} Td (${literal(value)}) Tj ET`)
  const line = (x1: number, y1: number, x2: number, y2: number) => commands().push(`${x1} ${y1} m ${x2} ${y2} l S`)
  const paragraph = (value: string, max = 83, size = 11, leading = 16) => {
    for (const item of wrap(value, max)) { ensure(leading); if (item) text(item, left, y, size); y -= leading }
  }
  const heading = (value: string) => { ensure(60); y -= 28; text(value, left, y, 24, "F3"); y -= 22 }

  let jpeg: Buffer | undefined
  let imageWidth = 0
  let imageHeight = 0
  if (logo) {
    const converted = await sharp(logo).flatten({ background: "#ffffff" }).resize({ width: 380, height: 150, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer({ resolveWithObject: true })
    jpeg = converted.data
    imageWidth = converted.info.width
    imageHeight = converted.info.height
    const scale = Math.min(170 / imageWidth, 65 / imageHeight, 1)
    commands().push(`q ${Math.round(imageWidth * scale)} 0 0 ${Math.round(imageHeight * scale)} ${left} 725 cm /Logo Do Q`)
  }
  y = 692
  const date = new Date(document.created_at).toLocaleDateString("pt-BR", { timeZone: "America/Fortaleza" })
  text(date, 460, 747, 9)
  text("Orçamento", left, y, 36, "F3")
  y -= 35
  commands().push("q 0.97 g 55 592 485 57 re f Q 0 G 0.8 w 55 592 485 57 re S")
  const patient = document.patient?.full_name || document.lead_name || "Não informado"
  text(`Paciente: ${patient}`.slice(0, 85), left + 13, 628, 11)
  if (document.patient?.email) text(`Email: ${document.patient.email}`.slice(0, 85), left + 13, 608, 11)
  y = 567
  text(clinic.clinic_name || "Clínica odontológica", left, y, 15, "F2")
  y -= 21
  for (const value of [clinic.address, clinic.email, clinic.phone].filter(Boolean) as string[]) paragraph(value, 90, 10, 14)
  heading("Procedimentos")
  const items = budgetItems(document.items)
  if (items.length) {
    for (const [index, item] of items.entries()) {
      const blockHeight = wrap(`${index + 1}. ${item.procedure}`, 68).length * 15
        + (item.dentist ? wrap(`Dentista: ${item.dentist}`, 86).length * 13 : 0)
        + (item.region ? wrap(`Dente ou região: ${item.region}`, 86).length * 13 : 0)
        + (item.discount ? 13 : 0) + 8
      ensure(blockHeight)
      const itemTop = y
      paragraph(`${index + 1}. ${item.procedure}`, 68, 11, 15)
      text(money(item.unitValue - item.discount), 445, itemTop, 10, "F2")
      if (item.dentist) paragraph(`Dentista: ${item.dentist}`, 86, 10, 13)
      if (item.region) paragraph(`Dente ou região: ${item.region}`, 86, 10, 13)
      if (item.discount) paragraph(`Desconto: ${money(item.discount)}`, 86, 10, 13)
      y -= 8
    }
    ensure(32)
    line(left, y + 7, right, y + 7)
    y -= 14
    text(`Total: ${money(budgetTotal(items))}`, 395, y, 12, "F2")
    y -= 8
  } else paragraph(document.content || "Nenhum procedimento informado.")
  heading("Forma de Pagamento")
  paragraph(document.payment_method || "A combinar")
  heading("Observações")
  paragraph(document.description || "—")
  if (y < 135) nextPage()
  line(325, 93, 530, 93)
  text("Assinatura do paciente", 365, 77, 10)

  const objects: Buffer[] = [
    Buffer.from("<< /Type /Catalog /Pages 2 0 R >>"),
    Buffer.alloc(0),
    Buffer.from("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>"),
    Buffer.from("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>"),
    Buffer.from("<< /Type /Font /Subtype /Type1 /BaseFont /Times-Roman /Encoding /WinAnsiEncoding >>"),
  ]
  let imageRef = ""
  if (jpeg) {
    imageRef = `${objects.length + 1} 0 R`
    objects.push(Buffer.concat([Buffer.from(`<< /Type /XObject /Subtype /Image /Width ${imageWidth} /Height ${imageHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`), jpeg, Buffer.from("\nendstream")]))
  }
  const refs: string[] = []
  for (const page of pages) {
    const pageRef = objects.length + 1
    refs.push(`${pageRef} 0 R`)
    const stream = Buffer.from(page.join("\n"), "latin1")
    objects.push(Buffer.from(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >> ${imageRef ? `/XObject << /Logo ${imageRef} >>` : ""} >> /Contents ${pageRef + 1} 0 R >>`))
    objects.push(Buffer.concat([Buffer.from(`<< /Length ${stream.length} >>\nstream\n`), stream, Buffer.from("\nendstream")]))
  }
  objects[1] = Buffer.from(`<< /Type /Pages /Kids [${refs.join(" ")}] /Count ${pages.length} >>`)
  const chunks = [Buffer.from("%PDF-1.4\n")]
  const offsets = [0]
  let position = chunks[0].length
  for (const [index, object] of objects.entries()) {
    offsets.push(position)
    const part = Buffer.concat([Buffer.from(`${index + 1} 0 obj\n`), object, Buffer.from("\nendobj\n")])
    chunks.push(part)
    position += part.length
  }
  chunks.push(Buffer.from(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${String(offset).padStart(10, "0")} 00000 n `).join("\n")}\ntrailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${position}\n%%EOF`))
  return Buffer.concat(chunks)
}
