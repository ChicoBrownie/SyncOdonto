export type BudgetItem = { procedure: string; region: string; dentist?: string; unitValue: number; discount: number }

export type BudgetDocument = {
  created_at: string
  lead_name?: string | null
  description?: string | null
  payment_method?: string | null
  content?: string | null
  items?: unknown
  patient?: { full_name: string; email?: string | null } | null
}

export type BudgetClinic = { clinic_name?: string | null; address?: string | null; phone?: string | null; email?: string | null; logo_url?: string | null }

const money = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
const escape = (value: string) => value.replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!)

export function budgetItems(value: unknown): BudgetItem[] {
  if (!Array.isArray(value)) return []
  return value.flatMap(item => {
    if (!item || typeof item !== "object") return []
    const entry = item as Record<string, unknown>
    const procedure = typeof entry.procedure === "string" ? entry.procedure.trim().slice(0, 200) : ""
    const region = typeof entry.region === "string" ? entry.region.trim().slice(0, 300) : ""
    const dentist = typeof entry.dentist === "string" ? entry.dentist.trim().slice(0, 200) : ""
    const unitValue = Number(entry.unitValue)
    const discount = Number(entry.discount || 0)
    return procedure && Number.isFinite(unitValue) && unitValue > 0 && unitValue <= 100_000_000 && Number.isFinite(discount) && discount >= 0 && discount <= unitValue
      ? [{ procedure, region, dentist, unitValue, discount }]
      : []
  })
}

export function budgetTotal(items: BudgetItem[]) {
  return Math.round(items.reduce((sum, item) => sum + Math.round((item.unitValue - item.discount) * 100), 0)) / 100
}

export function budgetPlainText(document: BudgetDocument, clinic: BudgetClinic) {
  const items = budgetItems(document.items)
  const date = new Date(document.created_at).toLocaleDateString("pt-BR", { timeZone: "America/Fortaleza" })
  const lines = [
    `${clinic.clinic_name || "Clínica odontológica"}  |  ${date}`,
    [clinic.address, clinic.phone, clinic.email].filter(Boolean).join("  |  "),
    "",
    `Paciente: ${document.patient?.full_name || document.lead_name || "Não informado"}`,
    document.patient?.email ? `E-mail: ${document.patient.email}` : "",
    "",
    "PROCEDIMENTOS",
    ...items.map((item, index) => `${index + 1}. ${item.procedure}${item.region ? ` — ${item.region}` : ""}${item.dentist ? ` — Dentista: ${item.dentist}` : ""}  ${money(item.unitValue - item.discount)}`),
    items.length ? `Total: ${money(budgetTotal(items))}` : document.content || "Nenhum procedimento informado.",
    "",
    `Pagamento: ${document.payment_method || "A combinar"}`,
    document.description ? `Observações: ${document.description}` : "",
    "",
    "Assinatura do paciente: ____________________________________",
  ]
  return lines.filter((line, index) => line || lines[index - 1]).join("\n")
}

export function budgetPrintHtml(document: BudgetDocument, clinic: BudgetClinic, logoDataUrl?: string) {
  const items = budgetItems(document.items)
  const date = new Date(document.created_at).toLocaleDateString("pt-BR", { timeZone: "America/Fortaleza" })
  const patient = document.patient?.full_name || document.lead_name || "Não informado"
  const clinicLines = [clinic.address, clinic.email, clinic.phone].filter(Boolean).map(value => `<p>${escape(value!)}</p>`).join("")
  const rows = items.map(item => `<li><div class="procedure"><strong>${escape(item.procedure)}</strong><strong>${escape(money(item.unitValue - item.discount))}</strong></div>${item.dentist ? `<p>Dentista: ${escape(item.dentist)}</p>` : ""}${item.region ? `<p>Dente ou região: ${escape(item.region)}</p>` : ""}${item.discount ? `<p>Desconto: ${escape(money(item.discount))}</p>` : ""}</li>`).join("")
  const safeLogo = logoDataUrl && /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(logoDataUrl) ? logoDataUrl : ""
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Orçamento — ${escape(patient)}</title><style>
  *{box-sizing:border-box}body{font:15px/1.55 Arial,sans-serif;color:#1c1c1c;background:#f4f4f4;margin:0}main{max-width:794px;min-height:1123px;margin:24px auto;padding:65px 64px 50px;background:#fff;box-shadow:0 4px 24px #0001;display:flex;flex-direction:column}.logo{height:85px;width:210px;object-fit:contain;object-position:left center}.logo-space{height:85px}.date{text-align:right;color:#666;font-size:12px}h1,h2{font-family:Georgia,serif;font-weight:400}h1{font-size:43px;margin:15px 0 26px}h2{font-size:30px;margin:38px 0 10px}.patient{border:1px solid #d3d3d3;background:#fafafa;border-radius:5px;padding:14px 18px}.patient p{margin:2px 0}.clinic{margin-top:34px}.clinic strong{font-size:18px}.clinic p{margin:2px 0}.procedures{padding-left:22px;margin:0}.procedures li{padding:7px 0}.procedures p{margin:1px 0;color:#555}.procedure{display:flex;justify-content:space-between;gap:12px}.total{font-weight:bold;text-align:right;border-top:1px solid #d3d3d3;padding-top:10px}.payment,.notes{white-space:pre-wrap;margin:0}.signature{margin:100px 0 0 auto;width:265px;border-top:1px solid #333;text-align:center;padding-top:7px;font-size:13px}.spacer{flex:1;min-height:30px}.actions{max-width:794px;margin:20px auto 0;display:flex;justify-content:flex-end}.actions button{border:0;background:#087f82;color:#fff;padding:10px 20px;border-radius:6px;cursor:pointer}@media(max-width:600px){main{margin:0;padding:28px;min-height:100vh}.actions{padding:0 16px}h1{font-size:36px}}@media print{body{background:#fff}main{margin:0;min-height:259mm;max-width:none;padding:0;box-shadow:none}.actions{display:none}.signature{break-inside:avoid}@page{size:A4;margin:18mm}}
  </style><script defer src="/budget-print.js"></script></head><body><div class="actions"><button type="button" id="print-budget">Imprimir ou salvar em PDF</button></div><main>${safeLogo ? `<img class="logo" src="${safeLogo}" alt="Logo da clínica">` : `<div class="logo-space"></div>`}<div class="date">${escape(date)}</div><h1>Orçamento</h1><section class="patient"><p><strong>Paciente:</strong> ${escape(patient)}</p>${document.patient?.email ? `<p><strong>Email:</strong> ${escape(document.patient.email)}</p>` : ""}</section><section class="clinic"><strong>${escape(clinic.clinic_name || "Clínica odontológica")}</strong>${clinicLines}</section><section><h2>Procedimentos</h2>${items.length ? `<ol class="procedures">${rows}</ol><p class="total">Total: ${escape(money(budgetTotal(items)))}</p>` : `<p>${escape(document.content || "Nenhum procedimento informado.")}</p>`}</section><section><h2>Forma de Pagamento</h2><p class="payment">${escape(document.payment_method || "A combinar")}</p></section><section><h2>Observações</h2><p class="notes">${escape(document.description || "—")}</p></section><div class="spacer"></div><p class="signature">Assinatura do paciente</p></main></body></html>`
}
