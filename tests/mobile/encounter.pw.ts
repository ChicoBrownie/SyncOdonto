import { test, expect, type Page } from "@playwright/test"
import { emptyPayload, type EncounterDraft } from "../../lib/encounters/model"

const id = "55555555-5555-4555-8555-555555555555"
const patientId = "44444444-4444-4444-8444-444444444444"
const actor = "22222222-2222-4222-8222-222222222222"
const clinic = "11111111-1111-4111-8111-111111111111"
const jsonbOrder = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(jsonbOrder)
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.length - b.length || a.localeCompare(b)).map(([key, item]) => [key, jsonbOrder(item)]))
  return value
}
async function fixture(page: Page, step: EncounterDraft["step"] = "anamnesis") {
  const payload = emptyPayload()
  payload.appointment = { doctor_name: "Profissional Fictícia", date: "2026-10-05", time: "09:00", duration_minutes: 60 }
  payload.budget.items = [{ source_id: null, procedure: "Procedimento fictício", region: "Dente 26", unitValue: 200, discount: 20 }]
  const draft: EncounterDraft = { id, clinic_id: clinic, actor_user_id: actor, patient_id: patientId, appointment_id: "66666666-6666-4666-8666-666666666666", step, payload, revision: 0, status: "active", signed_document_id: null, clinical_revision: null, updated_at: "2026-10-05T12:00:00Z" }
  const state = { draft, failSave: false, failAction: false, conflict: false, jsonbResponse: false, normalizeResponse: false, saveDelayMs: 0, guidesSeen: true, signCalls: 0, completeCalls: 0, publishCalls: 0, savedPayloads: [] as typeof payload[] }
  const token = `${Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url")}.${Buffer.from(JSON.stringify({ sub: actor, aud: "authenticated", role: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url")}.synthetic`
  const cookie = `base64-${Buffer.from(JSON.stringify({ access_token: token, refresh_token: "synthetic", token_type: "bearer", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: actor, email: "ficticio@example.invalid" } })).toString("base64url")}`
  await page.context().addCookies([{ name: "sb-127-auth-token", value: cookie, domain: "127.0.0.1", path: "/" }])
  await page.route("**/api/**", async route => {
    const url = new URL(route.request().url()); const path = url.pathname
    const send = (data: unknown, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(data) })
    if (path === `/api/encounters/${id}` && route.request().method() === "PATCH") {
      if (state.failSave) return route.abort("internetdisconnected")
      const body = route.request().postDataJSON()
      if (state.conflict || body.revision !== draft.revision) return send({ error: "Versão alterada em outra aba", conflict: true }, 409)
      draft.payload = state.jsonbResponse ? jsonbOrder(body.payload) as typeof payload : body.payload; draft.step = body.step; draft.revision++
      if (state.normalizeResponse) draft.payload.appointment.time = "09:00:00"
      state.savedPayloads.push(body.payload)
      if (state.saveDelayMs) await new Promise(resolve => setTimeout(resolve, state.saveDelayMs))
      return send({ data: draft })
    }
    if (path === `/api/encounters/${id}/actions`) {
      const body = route.request().postDataJSON()
      if (state.failAction) return send({ error: "Não foi possível iniciar a consulta. Tente novamente." }, 500)
      if (body.action === "start") { draft.appointment_id = "66666666-6666-4666-8666-666666666666"; draft.step = "anamnesis" }
      if (body.action === "publish") state.publishCalls++
      if (body.action === "sign") { state.signCalls++; draft.signed_document_id = "77777777-7777-4777-8777-777777777777"; draft.step = "financial"; draft.payload.settlement_amount = 180 }
      if (body.action === "complete") { state.completeCalls++; draft.status = "completed" }
      draft.revision++; return send({ data: draft })
    }
    if (path === `/api/encounters/${id}/document`) return send({ data: { id: draft.signed_document_id, content: "Proposta Fictícia\nTotal: R$ 180,00", signature_data: "data:image/png;base64,AA==", encounter_revision: 1, snapshot_hash: "ficticio", signed_at: "2026-10-05T12:00:00Z" } })
    if (path === `/api/encounters/${id}`) return send({ data: draft })
    if (path === "/api/encounters") return send({ data: draft.status === "active" ? [{ ...draft, patient: { full_name: "Paciente Fictício" } }] : [] })
    if (path === "/api/encounter-guides") return send({ data: state.guidesSeen ? ["encounter-entry", "encounter-patient", "encounter-anamnesis", "encounter-chart", "encounter-budget", "encounter-signature", "encounter-financial", "patients", "agenda", "records"].map(area => ({ area })) : [] })
    if (path === `/api/patients/${patientId}`) return send({ data: { id: patientId, full_name: "Paciente Fictício", allergies: "Alerta fictício", medications: null, pre_existing_conditions: null } })
    if (path === "/api/patients") return send({ data: [{ id: patientId, full_name: "Paciente Fictício", status: "Ativo", date_of_birth: "1990-01-01" }] })
    if (path === "/api/appointments") return send({ data: draft.appointment_id ? [{ id: draft.appointment_id, patient_id: patientId, date: "2026-10-05", time: "09:00", doctor_name: "Profissional Fictícia", status: "Em Andamento" }] : [] })
    if (path === "/api/auth/check-access") return send({ user_id: actor, access_role: "gestor", permissions: { financeiro: true, configuracoes: true, relatorios: true } })
    return send({ data: [] })
  })
  return state
}

test("salva anamnese e orçamento, retoma após navegação e atualização, sem conteúdo clínico em armazenamento persistente", async ({ page }) => {
  const state = await fixture(page)
  await page.goto(`/atendimento/${id}`)
  await page.getByLabel("O que trouxe o paciente hoje?").fill("Queixa fictícia para retomada")
  await expect(page.getByText("Rascunho salvo", { exact: true })).toBeVisible()
  await page.getByRole("link", { name: "Pacientes", exact: true }).last().click()
  await page.getByRole("button", { name: "Agora não" }).click()
  await page.getByRole("button", { name: /^Retomar atendimento/ }).click()
  await page.getByRole("link", { name: /Paciente Fictício.*Saúde e alertas/ }).click()
  await expect(page.getByLabel("O que trouxe o paciente hoje?")).toHaveValue("Queixa fictícia para retomada")
  await page.getByLabel("Ir diretamente para uma etapa").selectOption("budget")
  await page.getByLabel("Valor (R$)", { exact: true }).fill("250")
  await expect(page.getByText("Rascunho salvo", { exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByLabel("Valor (R$)", { exact: true })).toHaveValue("250")
  expect(state.draft.payload.anamnesis.chief_complaint).toBe("Queixa fictícia para retomada")
  const storage = await page.evaluate(() => JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage } }))
  expect(storage).not.toContain("Queixa fictícia"); expect(storage).not.toContain("Procedimento fictício")
})
test("exibe falha de salvamento e conflito sem sobrescrever o servidor", async ({ page }) => {
  const state = await fixture(page)
  await page.goto(`/atendimento/${id}`)
  state.failSave = true
  await page.getByLabel("O que trouxe o paciente hoje?").fill("Edição sem conexão")
  await expect(page.getByText(/Não foi possível salvar. Mantenha/)).toBeVisible()
  expect(state.draft.payload.anamnesis.chief_complaint).toBe("")
  state.failSave = false
  await page.getByRole("button", { name: "Tentar salvar novamente" }).click()
  await expect(page.getByText("Rascunho salvo", { exact: true })).toBeVisible()
  state.conflict = true
  await page.getByLabel("O que trouxe o paciente hoje?").fill("Edição antiga")
  await expect(page.getByText(/Outra aba alterou/)).toBeVisible()
  expect(state.draft.payload.anamnesis.chief_complaint).toBe("Edição sem conexão")
})
test("uma resposta JSONB reordenada não repete salvamentos e permite confirmar o prontuário", async ({ page }) => {
  const state = await fixture(page)
  state.jsonbResponse = true
  await page.goto(`/atendimento/${id}`)
  await expect(page.getByRole("heading", { name: "Cinco perguntas iniciais" })).toBeVisible()
  await expect(page.getByRole("link", { name: "Iniciar atendimento" })).toHaveCount(0)
  await expect(page.getByRole("button", { name: /^Retomar atendimento/ })).toHaveCount(0)
  await page.getByRole("button", { name: "Sim", exact: true }).first().click()
  await expect(page.getByText("Rascunho salvo", { exact: true })).toBeVisible()
  await page.waitForTimeout(1300)
  expect(state.savedPayloads).toHaveLength(1)
  await page.getByRole("button", { name: "Confirmar registro no prontuário" }).click()
  await expect(page.getByText("Registro confirmado no prontuário.")).toBeVisible()
  expect(state.publishCalls).toBe(1)
  expect(state.savedPayloads).toHaveLength(1)
})

test("uma resposta normalizada pelo servidor não inicia gravações sem fim", async ({ page }) => {
  const state = await fixture(page)
  state.normalizeResponse = true
  await page.goto(`/atendimento/${id}`)
  await page.getByLabel("O que trouxe o paciente hoje?").fill("Queixa fictícia normalizada")
  await expect(page.getByText("Rascunho salvo", { exact: true })).toBeVisible()
  await page.waitForTimeout(1500)
  expect(state.savedPayloads).toHaveLength(1)
  expect(state.draft.payload.anamnesis.chief_complaint).toBe("Queixa fictícia normalizada")
  await page.getByRole("button", { name: "Confirmar registro no prontuário" }).click()
  await expect(page.getByText("Registro confirmado no prontuário.")).toBeVisible()
  expect(state.publishCalls).toBe(1)
})

test("uma edição feita durante o envio anterior também chega ao servidor", async ({ page }) => {
  const state = await fixture(page)
  state.saveDelayMs = 800
  await page.goto(`/atendimento/${id}`)
  const complaint = page.getByLabel("O que trouxe o paciente hoje?")
  await complaint.fill("Primeira anotação fictícia")
  await expect.poll(() => state.savedPayloads.length).toBe(1)
  await complaint.fill("Segunda anotação fictícia")
  await expect(page.getByText("Rascunho salvo", { exact: true })).toBeVisible()
  expect(state.savedPayloads).toHaveLength(2)
  expect(state.draft.payload.anamnesis.chief_complaint).toBe("Segunda anotação fictícia")
})
test("teclado móvel libera o campo e esconde ações até terminar a digitação", async ({ page }) => {
  await fixture(page)
  await page.goto(`/atendimento/${id}`)
  const complaint = page.getByLabel("O que trouxe o paciente hoje?")
  await complaint.focus()
  await page.evaluate(() => {
    const viewport = window.visualViewport!
    Object.defineProperty(viewport, "height", { configurable: true, value: 420 })
    viewport.dispatchEvent(new Event("resize"))
  })
  await expect(page.locator(".app-shell")).toHaveAttribute("data-keyboard-open", "true")
  await expect(page.locator(".encounter-actions")).toBeHidden()
  await expect(page.getByRole("navigation", { name: "Navegação clínica no celular" })).toBeHidden()
  await expect.poll(() => complaint.evaluate(field => {
    const main = field.closest("main")!
    return field.getBoundingClientRect().bottom <= main.getBoundingClientRect().bottom + 1
  })).toBe(true)
  await complaint.fill("Queixa fictícia com teclado aberto")
  await page.evaluate(() => {
    const viewport = window.visualViewport!
    Reflect.deleteProperty(viewport, "height")
    viewport.dispatchEvent(new Event("resize"))
  })
  await expect(page.locator(".encounter-actions")).toBeVisible()
})
test("distingue rascunho salvo de falha ao iniciar a consulta e permite repetir o início", async ({ page }) => {
  const state = await fixture(page, "patient")
  state.draft.appointment_id = null
  state.failAction = true
  await page.goto(`/atendimento/${id}`)
  await page.getByRole("button", { name: "Atender agora", exact: true }).click()
  await expect(page.getByRole("alert").filter({ hasText: "Não foi possível iniciar a consulta" })).toBeVisible()
  await expect(page.getByText("Rascunho salvo", { exact: true })).toBeVisible()
  await expect(page.getByText("Não foi possível salvar no servidor. Tente novamente.", { exact: true })).toHaveCount(0)
  expect(state.draft.appointment_id).toBeNull()
  await page.getByLabel("Profissional responsável *").fill("Outra Profissional Fictícia")
  await expect(page.getByText("Rascunho salvo", { exact: true })).toBeVisible()
  await expect(page.getByRole("alert").filter({ hasText: "Não foi possível iniciar a consulta" })).toBeVisible()
  state.failAction = false
  await page.getByRole("button", { name: "Atender agora", exact: true }).click()
  await expect(page.getByLabel("O que trouxe o paciente hoje?")).toBeVisible()
  await expect(page.getByRole("alert").filter({ hasText: "Não foi possível iniciar a consulta" })).toHaveCount(0)
})
test("assinatura exige concordância e conclusão exige confirmação, mesmo com toque duplo", async ({ page }) => {
  const state = await fixture(page, "signature")
  await page.goto(`/atendimento/${id}`)
  const sign = page.getByRole("button", { name: "Assinar proposta", exact: true })
  await expect(sign).toBeDisabled()
  const canvas = page.getByLabel("Campo para desenhar a assinatura com o dedo, caneta ou mouse")
  await canvas.evaluate(node => node.scrollIntoView({ block: "center" }))
  const box = await canvas.boundingBox()
  expect(await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.tagName, [box!.x + 30, box!.y + 40])).toBe("CANVAS")
  await page.mouse.move(box!.x + 30, box!.y + 40); await page.mouse.down()
  await page.mouse.move(box!.x + 130, box!.y + 80, { steps: 10 }); await page.mouse.up()
  await page.getByRole("checkbox").check()
  await sign.dblclick()
  await expect(page.getByLabel("Valor desta consulta (R$)")).toBeVisible()
  expect(state.signCalls).toBe(1)
  await page.getByRole("button", { name: "Concluir e encaminhar cobrança", exact: true }).click()
  expect(state.completeCalls).toBe(0)
  await page.getByRole("button", { name: "Confirmar e encaminhar cobrança", exact: true }).dblclick()
  await expect(page.getByRole("heading", { name: "Atendimento concluído" })).toBeVisible()
  expect(state.completeCalls).toBe(1)
})
test("guia destaca a função, permite Escape e reabertura; exames preservam a etapa", async ({ page }) => {
  const state = await fixture(page, "chart")
  state.guidesSeen = false
  await page.goto(`/atendimento/${id}`)
  await expect(page.getByRole("dialog", { name: "Dentes e procedimentos" })).toBeVisible()
  await page.keyboard.press("Escape")
  await page.getByRole("button", { name: "Ajuda", exact: true }).click()
  await expect(page.getByRole("dialog", { name: "Dentes e procedimentos" })).toBeVisible()
  await page.getByRole("button", { name: "Pular guia" }).click()
  await page.getByRole("button", { name: "Exames", exact: true }).click()
  await expect(page.getByRole("dialog", { name: "Exames do paciente" })).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(page.getByLabel("Ir diretamente para uma etapa")).toHaveValue("chart")
})
test("etapas principais cabem em telas de 320, 390 e 768 pixels", async ({ page }) => {
  await fixture(page)
  await page.goto(`/atendimento/${id}`)
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 844 })
    for (const step of ["patient", "anamnesis", "chart", "budget", "signature", "financial"]) {
      await page.getByLabel("Ir diretamente para uma etapa").selectOption(step)
      await expect(page.getByText("Rascunho salvo", { exact: true })).toBeVisible()
      const overflow = await page.evaluate(() => [...document.querySelectorAll("main,.encounter-editor")].some(node => node.scrollWidth > node.clientWidth + 1))
      expect(overflow, `${step} em ${width}px`).toBe(false)
      if (width === 390 && step === "budget") await page.screenshot({ path: "test-results/atendimento-mobile-ficticio.png" })
    }
  }
})
