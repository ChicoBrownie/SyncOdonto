// Isolated browser fixture: every Supabase request stays on loopback.
import http from "node:http"
import { spawn } from "node:child_process"
const user = { id: "22222222-2222-4222-8222-222222222222", aud: "authenticated", role: "authenticated", email: "ficticio@example.invalid", app_metadata: { provider: "email" }, user_metadata: { full_name: "Profissional Fictícia" }, created_at: "2026-10-05T00:00:00Z" }
const fixture = http.createServer((request, response) => {
  response.setHeader("Content-Type", "application/json")
  response.setHeader("Access-Control-Allow-Origin", "http://127.0.0.1:3100")
  response.setHeader("Access-Control-Allow-Headers", "*")
  if (request.method === "OPTIONS") { response.end(); return }
  response.end(JSON.stringify(request.url?.startsWith("/auth/v1/user") ? user : []))
})
fixture.listen(54399, "127.0.0.1")
const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "--hostname", "127.0.0.1", "--port", "3100"], {
  stdio: "inherit", env: { ...process.env, SYNCODONTO_TEST_BUILD: "1", NEXT_TELEMETRY_DISABLED: "1", NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54399", NEXT_PUBLIC_SUPABASE_ANON_KEY: "synthetic-test-key", SUPABASE_SERVICE_ROLE_KEY: "synthetic-test-service-key" }, windowsHide: true,
})
child.on("exit", code => { fixture.close(); process.exit(code || 0) })
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => { child.kill(); fixture.close(); process.exit(0) })
