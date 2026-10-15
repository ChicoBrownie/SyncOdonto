import { test, expect } from "@playwright/test"

test("agenda semanal permite tocar na consulta e escolher outro horário", async ({ page }) => {
  const actor = "22222222-2222-4222-8222-222222222222"
  const token = `${Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url")}.${Buffer.from(JSON.stringify({ sub: actor, aud: "authenticated", role: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url")}.synthetic`
  const cookie = `base64-${Buffer.from(JSON.stringify({ access_token: token, refresh_token: "synthetic", token_type: "bearer", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: actor, email: "ficticio@example.invalid" } })).toString("base64url")}`
  await page.context().addCookies([{ name: "sb-127-auth-token", value: cookie, domain: "127.0.0.1", path: "/" }])
  const date = new Date()
  const monday = new Date(date)
  monday.setDate(date.getDate() - ((date.getDay() + 6) % 7))
  const wednesday = new Date(monday); wednesday.setDate(monday.getDate() + 2)
  const iso = (value: Date) => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`
  const mondayISO = iso(monday), wednesdayISO = iso(wednesday)
  const appointment = { id: "66666666-6666-4666-8666-666666666666", patient_id: "44444444-4444-4444-8444-444444444444", date: mondayISO, time: "09:00:00", duration_minutes: 60, doctor_name: "Bruno", status: "Pendente", patient: { full_name: "Gilson" } }
  const patches: { date: string; time: string }[] = []
  const created: { date: string; time: string; patient_id: string }[] = []
  await page.route("**/api/**", async route => {
    const url = new URL(route.request().url())
    const send = (data: unknown) => route.fulfill({ contentType: "application/json", body: JSON.stringify(data) })
    if (url.pathname === `/api/appointments/${appointment.id}` && route.request().method() === "PATCH") {
      const change = route.request().postDataJSON() as { date: string; time: string }
      patches.push(change); Object.assign(appointment, change)
      return send({ data: appointment })
    }
    if (url.pathname === "/api/appointments" && route.request().method() === "POST") {
      created.push(route.request().postDataJSON())
      return send({ data: { ...created.at(-1), id: "77777777-7777-4777-8777-777777777777" } })
    }
    if (url.pathname === "/api/appointments") return send({ data: url.searchParams.has("startDate") || url.searchParams.get("date") === appointment.date ? [appointment] : [] })
    if (url.pathname === "/api/patients") return send({ data: [{ id: appointment.patient_id, full_name: "Gilson" }] })
    if (url.pathname === "/api/encounters") return send({ data: [], count: 0 })
    if (url.pathname === "/api/encounter-guides") return send({ data: [{ area: "agenda" }] })
    if (url.pathname === "/api/clinic-settings") return send({ data: { working_hours: { start: "08:00", end: "18:00" } } })
    return send({ data: [] })
  })
  await page.goto("/agenda")
  await expect(page.getByRole("heading", { name: "Agendamento" })).toBeVisible()
  await expect(page.getByRole("button", { name: "Semana" })).toHaveAttribute("aria-pressed", "true")
  await expect(page.getByText("Visão Semanal")).toHaveCount(0)
  await expect(page.getByRole("button", { name: "Período" })).toHaveCount(0)
  await page.getByRole("button", { name: /Gilson, 09:00.*Bruno/ }).click()
  await page.getByRole("button", { name: `${wednesday.toLocaleDateString("pt-BR")} às 13:00` }).click()
  await expect.poll(() => patches).toEqual([{ date: wednesdayISO, time: "13:00" }])
  await expect(page.getByText(/Consulta remarcada/)).toBeVisible()

  await page.getByRole("button", { name: "Escolher data ou intervalo" }).click()
  await page.getByLabel("Data", { exact: true }).fill(wednesdayISO)
  await page.getByRole("button", { name: "Mostrar semana" }).click()
  await page.getByRole("button", { name: "Novo", exact: true }).click()
  const dialog = page.getByRole("dialog")
  await expect(dialog.getByLabel("Dia da consulta *")).toBeVisible()
  await dialog.getByLabel("Dia da consulta *").fill(mondayISO)
  await dialog.getByRole("combobox").first().click()
  await page.getByRole("option", { name: "Gilson" }).click()
  await dialog.getByRole("combobox").nth(1).click()
  await page.getByRole("option", { name: "Consulta" }).click()
  await dialog.getByLabel("Horário *").fill("14:30")
  await dialog.getByPlaceholder("Nome do dentista (obrigatório)").fill("Bruno")
  await dialog.getByRole("button", { name: "Agendar", exact: true }).click()
  await expect.poll(() => created).toMatchObject([{ date: mondayISO, time: "14:30", patient_id: appointment.patient_id }])
})
