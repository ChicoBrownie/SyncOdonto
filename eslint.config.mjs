import { defineConfig, globalIgnores } from "eslint/config"
import nextVitals from "eslint-config-next/core-web-vitals"
import nextTypeScript from "eslint-config-next/typescript"

export default defineConfig([
  ...nextVitals,
  ...nextTypeScript,
  {
    // A base existente ainda usa valores dinâmicos vindos do Supabase em
    // vários pontos. O TypeScript estrito continua obrigatório no build;
    // esta regra será endurecida gradualmente conforme os tipos do banco forem
    // gerados e substituírem os casts legados.
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/refs": "warn",
    },
  },
  globalIgnores([
    ".next/**",
    "node_modules/**",
    "coverage/**",
    "next-env.d.ts",
    "tsconfig.tsbuildinfo",
  ]),
])
