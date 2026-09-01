import { readFileSync } from "node:fs"
import { resolve } from "node:path"

const envFile = resolve(process.cwd(), process.argv[2] || ".env.local")
const parsed = Object.fromEntries(
  readFileSync(envFile, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => {
      const separator = line.indexOf("=")
      return [line.slice(0, separator), line.slice(separator + 1).trim()]
    }),
)

const errors = []
const required = [
  "APP_ENV",
  "NEXT_PUBLIC_SITE_URL",
  "NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
]

for (const name of required) {
  if (!parsed[name]) errors.push(`${name} não foi definida`)
}

if (parsed.APP_ENV !== "pilot") errors.push("APP_ENV deve ser exatamente 'pilot'")

for (const name of ["NEXT_PUBLIC_SITE_URL", "NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL", "NEXT_PUBLIC_SUPABASE_URL"]) {
  if (!parsed[name]) continue
  try {
    const url = new URL(parsed[name])
    if (url.protocol !== "https:") errors.push(`${name} deve usar HTTPS`)
  } catch {
    errors.push(`${name} não contém uma URL válida`)
  }
}

if (parsed.NEXT_PUBLIC_SITE_URL && parsed.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL) {
  try {
    const site = new URL(parsed.NEXT_PUBLIC_SITE_URL)
    const callback = new URL(parsed.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL)
    if (site.origin !== callback.origin || callback.pathname !== "/auth/callback") {
      errors.push("o callback deve ser /auth/callback no mesmo domínio do piloto")
    }
  } catch {}
}

const placeholders = /SEU-|example|COLOQUE|changeme|00000000/i
for (const name of required) {
  if (placeholders.test(parsed[name] || "")) errors.push(`${name} ainda contém um valor de exemplo`)
}

if (errors.length) {
  console.error("Pré-voo do piloto reprovado:\n- " + errors.join("\n- "))
  process.exit(1)
}

console.log("Pré-voo do piloto aprovado. Nenhum segredo foi exibido.")
