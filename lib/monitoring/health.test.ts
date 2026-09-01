import { describe, expect, it } from "vitest"
import { checkDatabaseHealth } from "./health"

describe("monitoramento de saúde", () => {
  it("informa conexão saudável e mede latência", async () => {
    const times = [100, 142]
    await expect(checkDatabaseHealth(async () => ({ error: null }), () => times.shift()!)).resolves.toEqual({
      status: "ok", database: "ok", latencyMs: 42,
    })
  })

  it("degrada sem expor o erro interno do banco", async () => {
    const result = await checkDatabaseHealth(async () => ({ error: { message: "segredo interno" } }))
    expect(result.status).toBe("degraded")
    expect(result).not.toHaveProperty("error")
  })
})
