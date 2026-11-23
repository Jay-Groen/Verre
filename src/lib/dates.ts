const DAY = 86_400_000

export const toDate = (s: string) => new Date(s + 'T00:00:00Z')
export const iso = (d: Date) => d.toISOString().slice(0, 10)
export const addDays = (s: string, n: number) => iso(new Date(toDate(s).getTime() + n * DAY))
export const daysBetween = (a: string, b: string) =>
  Math.round((toDate(b).getTime() - toDate(a).getTime()) / DAY)

/** Alle datums van a t/m b. */
export function dateRange(a: string, b: string): string[] {
  const n = daysBetween(a, b)
  if (!(n >= 0) || n > 366) return []
  return Array.from({ length: n + 1 }, (_, i) => addDays(a, i))
}

const dayFmt = new Intl.DateTimeFormat('nl-NL', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
})
const longFmt = new Intl.DateTimeFormat('nl-NL', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC',
})
const shortFmt = new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'short', timeZone: 'UTC' })

export const fmtDay = (s: string) => dayFmt.format(toDate(s))
export const fmtLong = (s: string) => longFmt.format(toDate(s))
export const fmtShort = (s: string) => shortFmt.format(toDate(s))

export const realToday = () => iso(new Date(Date.now() - new Date().getTimezoneOffset() * 60_000))

/** Vandaag (YYYY-MM-DD). Voor testen te overschrijven met localStorage 'verre.today'. */
export const todayIso = () => {
  try {
    const t = localStorage.getItem('verre.today')
    if (t && /^\d{4}-\d{2}-\d{2}$/.test(t)) return t
  } catch {
    /* ignore */
  }
  return realToday()
}

/** Minuten sinds middernacht, lokale tijd (te overschrijven met 'verre.now', bijv. '10:30'). */
export const nowMinutes = () => {
  try {
    const t = localStorage.getItem('verre.now')
    if (t && /^\d{2}:\d{2}$/.test(t)) return Number(t.slice(0, 2)) * 60 + Number(t.slice(3))
  } catch {
    /* ignore */
  }
  const d = new Date()
  return d.getHours() * 60 + d.getMinutes()
}
