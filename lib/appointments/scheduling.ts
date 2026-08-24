export const CLINIC_TIME_ZONE = "America/Fortaleza"

export function parseMinutes(time: string): number {
  const match = /^(\d{2}):(\d{2})(?::\d{2})?$/.exec(time)
  if (!match) return Number.NaN

  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours > 23 || minutes > 59) return Number.NaN
  return hours * 60 + minutes
}

export function hasTimeConflict(
  startA: string,
  durationA: number,
  startB: string,
  durationB: number,
): boolean {
  const startAMin = parseMinutes(startA)
  const startBMin = parseMinutes(startB)
  if (!Number.isFinite(startAMin) || !Number.isFinite(startBMin)) return false

  const endAMin = startAMin + durationA
  const endBMin = startBMin + durationB
  return startAMin < endBMin && startBMin < endAMin
}

export function getLocalDate(
  date = new Date(),
  timeZone = CLINIC_TIME_ZONE,
): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date)
}

export function getLocalMinutes(
  date = new Date(),
  timeZone = CLINIC_TIME_ZONE,
): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date)
  const hours = Number(parts.find((part) => part.type === "hour")?.value)
  const minutes = Number(parts.find((part) => part.type === "minute")?.value)
  return hours * 60 + minutes
}
