export type DailyWorkingHours = { start: string; end: string; closed: boolean }

export type WorkingHours = {
  start: string
  end: string
  days?: Record<string, DailyWorkingHours>
}

const DAY_KEYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]
const DEFAULT_HOURS: DailyWorkingHours = { start: "08:00", end: "18:00", closed: false }

export function minutesFromTime(time: string): number {
  const [hours, minutes] = time.split(":").map(Number)
  return hours * 60 + minutes
}

export function getDailyWorkingHours(date: Date, hours?: WorkingHours | null): DailyWorkingHours {
  const day = hours?.days?.[DAY_KEYS[date.getDay()]]
  if (day) return day
  return { start: hours?.start || DEFAULT_HOURS.start, end: hours?.end || DEFAULT_HOURS.end, closed: false }
}

export function isWithinWorkingHours(date: Date, startMinutes: number, durationMinutes: number, hours?: WorkingHours | null): boolean {
  const day = getDailyWorkingHours(date, hours)
  return !day.closed && startMinutes >= minutesFromTime(day.start) && startMinutes + durationMinutes <= minutesFromTime(day.end)
}

export function getWeekGridHours(
  dates: Date[],
  appointments: { time: string; duration_minutes?: number | null }[],
  hours?: WorkingHours | null,
): { firstHour: number; lastHour: number } {
  const openDays = dates.map(date => getDailyWorkingHours(date, hours)).filter(day => !day.closed)
  const starts = [...openDays.map(day => minutesFromTime(day.start)), ...appointments.map(item => minutesFromTime(item.time))]
  const ends = [
    ...openDays.map(day => minutesFromTime(day.end)),
    ...appointments.map(item => minutesFromTime(item.time) + (Number(item.duration_minutes) || 60)),
  ]
  const firstHour = Math.max(0, Math.floor(Math.min(...(starts.length ? starts : [8 * 60])) / 60))
  const lastHour = Math.min(24, Math.max(firstHour + 1, Math.ceil(Math.max(...(ends.length ? ends : [18 * 60])) / 60)))
  return { firstHour, lastHour }
}
