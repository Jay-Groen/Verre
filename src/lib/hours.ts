/**
 * Eenvoudige lezer voor openingstijden in OpenStreetMap-stijl, bijv.
 * "Mo-Fr 09:00-17:00; Sa 10:00-14:00; Su off". Nederlandse dagen (ma, di, … zo)
 * en "gesloten" werken ook. Regels die we niet begrijpen (feestdagen, maanden)
 * slaan we over, zodat we nooit onterecht "gesloten" melden.
 */

const DAYS: Record<string, number> = {
  mo: 1, tu: 2, we: 3, th: 4, fr: 5, sa: 6, su: 0,
  ma: 1, di: 2, wo: 3, do: 4, vr: 5, za: 6, zo: 0,
}
const DAY_NAMES = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag']

/** Per weekdag (0 = zondag) de open blokken in minuten, of undefined als onbekend. */
export type Week = ([number, number][] | undefined)[]

const toMin = (t: string) => {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function parseDays(spec: string): number[] | null {
  const out = new Set<number>()
  for (const part of spec.split(',')) {
    const m = part.trim().toLowerCase().match(/^([a-z]{2})(?:\s*-\s*([a-z]{2}))?$/)
    if (!m || !(m[1] in DAYS) || (m[2] && !(m[2] in DAYS))) return null
    const a = DAYS[m[1]]
    const b = m[2] ? DAYS[m[2]] : a
    for (let d = a; ; d = (d + 1) % 7) {
      out.add(d)
      if (d === b) break
    }
  }
  return [...out]
}

function parseTimes(spec: string): [number, number][] | null {
  const out: [number, number][] = []
  for (const part of spec.split(',')) {
    const m = part.trim().match(/^(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})\+?$/)
    if (!m) return null
    const a = toMin(m[1])
    let b = toMin(m[2])
    if (b <= a) b += 1440 // tot na middernacht
    out.push([a, b])
  }
  return out
}

export function parseHours(text?: string): Week | null {
  if (!text?.trim()) return null
  const s = text.trim()
  if (/^24\/7$/.test(s)) return Array.from({ length: 7 }, () => [[0, 1440]])
  const week: Week = Array(7).fill(undefined)
  let understood = false
  for (const rule of s.split(';')) {
    const r = rule.trim()
    if (!r) continue
    const m = r.match(/^((?:[A-Za-z]{2}\b(?:\s*-\s*[A-Za-z]{2}\b)?\s*,?\s*)+)?\s*(.*)$/)
    if (!m) continue
    const daySpec = m[1]?.trim().replace(/,$/, '')
    const rest = m[2].trim().toLowerCase()
    const days = daySpec ? parseDays(daySpec) : [0, 1, 2, 3, 4, 5, 6]
    if (!days) continue
    let times: [number, number][] | null
    if (/^(off|closed|gesloten|dicht)$/.test(rest)) times = []
    else if (rest === '' && daySpec) times = [[0, 1440]]
    else times = parseTimes(rest)
    if (!times) continue
    for (const d of days) week[d] = times
    understood = true
  }
  return understood ? week : null
}

const weekday = (date: string) => new Date(date + 'T00:00:00Z').getUTCDay()
const hhmm = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`

export interface HoursCheck {
  closed: boolean
  /** Uitleg voor de gebruiker, bijv. 'Gesloten op maandag' of 'Open 09:00–17:00'. */
  message: string
}

/**
 * Past een bezoek in de openingstijden? Zonder tijd kijken we alleen of het die dag open is.
 * Geeft null als alles in orde is of als de tijden onbekend zijn.
 */
export function checkHours(hours: string | undefined, date: string, start?: number, end?: number): HoursCheck | null {
  const week = parseHours(hours)
  if (!week) return null
  const wd = weekday(date)
  const open = week[wd]
  if (!open) return null
  if (open.length === 0) return { closed: true, message: `Gesloten op ${DAY_NAMES[wd]}` }
  if (start === undefined) return null
  const fits = open.some(([a, b]) => start >= a && (end ?? start) <= b)
  if (fits) return null
  return { closed: false, message: `Open ${open.map(([a, b]) => `${hhmm(a)}–${hhmm(b)}`).join(', ')}` }
}

/** Is het op deze datum open (true), dicht (false), of weten we het niet (undefined)? */
export function openOn(hours: string | undefined, date: string): boolean | undefined {
  const week = parseHours(hours)
  const open = week?.[weekday(date)]
  return open === undefined ? undefined : open.length > 0
}
