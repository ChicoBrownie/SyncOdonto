export type HealthCheck = { status: "ok" | "degraded"; database: "ok" | "error"; latencyMs: number }

export async function checkDatabaseHealth(
  query: () => PromiseLike<{ error: { message: string } | null }>,
  now: () => number = Date.now,
): Promise<HealthCheck> {
  const startedAt = now()
  try {
    const { error } = await query()
    return { status: error ? "degraded" : "ok", database: error ? "error" : "ok", latencyMs: Math.max(0, now() - startedAt) }
  } catch {
    return { status: "degraded", database: "error", latencyMs: Math.max(0, now() - startedAt) }
  }
}
