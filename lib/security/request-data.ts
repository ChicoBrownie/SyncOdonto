const IMMUTABLE_TENANT_FIELDS = new Set([
  "id",
  "user_id",
  "created_at",
  "updated_at",
])

export function stripImmutableTenantFields<T extends Record<string, unknown>>(
  value: T,
): T {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {} as T

  return Object.fromEntries(
    Object.entries(value).filter(([key]) => !IMMUTABLE_TENANT_FIELDS.has(key)),
  ) as T
}

export function isClinicManager(accessRole: string | null | undefined) {
  return accessRole === "gestor"
}
