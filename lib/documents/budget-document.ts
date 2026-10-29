export type BudgetItem = { procedure: string; region: string; unitValue: number; discount: number }

export type BudgetDocument = {
  created_at: string
  lead_name?: string | null
  description?: string | null
  payment_method?: string | null
  content?: string | null
  items?: unknown
  patient?: { full_name: string; email?: string | null } | null
}

export type BudgetClinic = { clinic_name?: string | null; address?: string | null; phone?: string | null; email?: string | null }

const money = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
const escape = (value: string) => value.replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!)

export function budgetItems(value: unknown): BudgetItem[] {
  if (!Array.isArray(value)) return []
  return value.flatMap(item => {
    if (!item || typeof item !== "object") return []
    const entry = item as Record<string, unknown>
    const procedure = typeof entry.procedure === "string" ? entry.procedure.trim().slice(0, 200) : ""
    const region = typeof entry.region === "string" ? entry.region.trim().slice(0, 300) : ""
    const unitValue = Number(entry.unitValue)
    const discount = Number(entry.discount || 0)
    return procedure && Number.isFinite(unitValue) && unitValue > 0 && unitValue <= 100_000_000 && Number.isFinite(discount) && discount >= 0 && discount <= unitValue
      ? [{ procedure, region, unitValue, discount }]
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
    ...items.map((item, index) => `${index + 1}. ${item.procedure}${item.region ? ` — ${item.region}` : ""}  ${money(item.unitValue - item.discount)}`),
    items.length ? `Total: ${money(budgetTotal(items))}` : document.content || "Nenhum procedimento informado.",
    "",
    `Pagamento: ${document.payment_method || "A combinar"}`,
    document.description ? `Observações: ${document.description}` : "",
    "",
    "Assinatura do paciente: ____________________________________",
  ]
  return lines.filter((line, index) => line || lines[index - 1]).join("\n")
}

export function budgetPrintHtml(document: BudgetDocument, clinic: BudgetClinic) {
  const items = budgetItems(document.items)
  const date = new Date(document.created_at).toLocaleDateString("pt-BR", { timeZone: "America/Fortaleza" })
  const patient = document.patient?.full_name || document.lead_name || "Não informado"
  const clinicLines = [clinic.address, clinic.phone, clinic.email].filter(Boolean).map(value => `<span>${escape(value!)}</span>`).join("")
  const rows = items.map(item => `<tr><td><strong>${escape(item.procedure)}</strong>${item.region ? `<small>${escape(item.region)}</small>` : ""}</td><td>${escape(money(item.unitValue))}</td><td>${item.discount ? escape(money(item.discount)) : "—"}</td><td>${escape(money(item.unitValue - item.discount))}</td></tr>`).join("")
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Orçamento — ${escape(patient)}</title><style>
  *{box-sizing:border-box}body{font:14px/1.5 system-ui,-apple-system,sans-serif;color:#17222b;background:#f5f7f8;margin:0}main{max-width:800px;margin:24px auto;padding:40px;background:#fff;box-shadow:0 6px 30px #0001}.top{display:flex;justify-content:space-between;gap:20px;align-items:start;border-bottom:2px solid #078e91;padding-bottom:20px}.brand{font-size:22px;font-weight:700;color:#087f82}.date{text-align:right;color:#52616b}h1{font-size:24px;margin:28px 0 20px}h2{font-size:14px;margin:28px 0 10px}p{margin:4px 0}.muted{color:#60717b}.clinic{display:flex;flex-wrap:wrap;gap:4px 16px;margin-top:6px;color:#60717b;font-size:12px}.patient{padding:16px;background:#f5f9f9;border-radius:8px}.patient strong{font-size:16px}table{width:100%;border-collapse:collapse}th,td{padding:11px 8px;text-align:left;border-bottom:1px solid #dfe5e7}th{font-size:12px;color:#60717b}td:not(:first-child),th:not(:first-child){text-align:right;white-space:nowrap}small{display:block;color:#60717b;font-size:12px}.total{text-align:right;font-size:18px;font-weight:700;margin-top:16px}.payment,.notes{white-space:pre-wrap}.signature{margin:90px 0 10px auto;width:270px;border-top:1px solid #17222b;text-align:center;padding-top:6px}.actions{max-width:800px;margin:20px auto 0;display:flex;justify-content:flex-end}.actions button{border:0;background:#087f82;color:#fff;padding:10px 20px;border-radius:6px;cursor:pointer}@media(max-width:600px){main{margin:0;padding:24px}.top{flex-direction:column}.date{text-align:left}th,td{padding:9px 4px}.actions{padding:0 16px}}@media print{body{background:#fff}main{margin:0;max-width:none;padding:0;box-shadow:none}.actions{display:none}@page{size:A4;margin:18mm}}
  </style><script defer src="/budget-print.js"></script></head><body><div class="actions"><button type="button" id="print-budget">Imprimir ou salvar em PDF</button></div><main><header class="top"><div><div class="brand">${escape(clinic.clinic_name || "SyncOdonto")}</div><div class="clinic">${clinicLines}</div></div><div class="date">Data: ${escape(date)}</div></header><h1>Orçamento</h1><section class="patient"><span class="muted">Paciente</span><p><strong>${escape(patient)}</strong></p>${document.patient?.email ? `<p>${escape(document.patient.email)}</p>` : ""}</section><h2>Procedimentos</h2>${items.length ? `<table><thead><tr><th>Descrição</th><th>Valor</th><th>Desconto</th><th>Subtotal</th></tr></thead><tbody>${rows}</tbody></table><p class="total">Total: ${escape(money(budgetTotal(items)))}</p>` : `<p>${escape(document.content || "Nenhum procedimento informado.")}</p>`}<h2>Forma de pagamento</h2><p class="payment">${escape(document.payment_method || "A combinar")}</p>${document.description ? `<h2>Observações</h2><p class="notes">${escape(document.description)}</p>` : ""}<p class="signature">Assinatura do paciente</p></main></body></html>`
}
