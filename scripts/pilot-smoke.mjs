const baseUrl = (process.argv[2] || process.env.PILOT_BASE_URL || "").replace(/\/$/, "")
if (!baseUrl) {
  console.error("Informe a URL: npm run pilot:smoke -- https://seu-piloto.netlify.app")
  process.exit(1)
}

const thresholdMs = Number(process.env.PILOT_MAX_LATENCY_MS || 3000)
const checks = [
  { path: "/api/health", status: 200, json: true },
  { path: "/auth/login", status: 200 },
]
let failed = false

for (const check of checks) {
  const startedAt = performance.now()
  try {
    const response = await fetch(`${baseUrl}${check.path}`, { redirect: "manual", signal: AbortSignal.timeout(10000) })
    const elapsed = Math.round(performance.now() - startedAt)
    let valid = response.status === check.status && elapsed <= thresholdMs
    if (check.json) {
      const body = await response.json()
      valid = valid && body.status === "ok" && body.database === "ok" && body.environment === "pilot"
    }
    console.log(`${valid ? "OK" : "FALHA"} ${check.path}: HTTP ${response.status}, ${elapsed} ms`)
    failed ||= !valid
  } catch (error) {
    console.error(`FALHA ${check.path}: ${error instanceof Error ? error.message : "erro desconhecido"}`)
    failed = true
  }
}

process.exit(failed ? 1 : 0)
