import type { Trip } from '../types'
import { MODE_ICON } from '../types'
import { addDays } from './dates'
import { buildDays } from './plan'
import { fromMin, legSlots, toMin } from './legs'
import { scheduleDay } from './schedule'

const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/[,;]/g, (c) => '\\' + c)
const day = (d: string) => d.replace(/-/g, '')
/** Zwevende lokale tijd: de agenda toont hem in de tijdzone waar je dan bent. */
const at = (d: string, minutes: number) => {
  const extra = Math.floor(minutes / 1440)
  return `${day(addDays(d, extra))}T${fromMin(minutes).replace(':', '')}00`
}

/** Lange regels moeten worden afgebroken (max. 75 bytes); 60 tekens houdt ook emoji en accenten binnen de marge. */
function fold(line: string) {
  const chars = Array.from(line)
  if (chars.length <= 60) return line
  const out: string[] = []
  for (let i = 0; i < chars.length; i += 60) out.push((i ? ' ' : '') + chars.slice(i, i + 60).join(''))
  return out.join('\r\n')
}

export function tripToIcs(trip: Trip): string {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z'
  const events: string[][] = []
  const ev = (uid: string, props: Record<string, string | undefined>) =>
    events.push([
      'BEGIN:VEVENT',
      `UID:${uid}@verre`,
      `DTSTAMP:${stamp}`,
      ...Object.entries(props)
        .filter(([, v]) => v)
        .map(([k, v]) => `${k}${k.startsWith('DT') ? '' : ':'}${v}`),
      'END:VEVENT',
    ])

  for (const s of trip.stops) {
    ev(s.id, {
      'DTSTART;VALUE=DATE:': day(s.start),
      'DTEND;VALUE=DATE:': day(s.end),
      SUMMARY: esc(`🛏️ ${s.stayName ?? 'Verblijf'} (${s.city})`),
      LOCATION: s.stayAddress && esc(s.stayAddress),
      DESCRIPTION: esc(
        [s.checkIn && `Inchecken ${s.checkIn}`, s.checkOut && `Uitchecken ${s.checkOut}`, s.booking?.ref && `Boeking: ${s.booking.ref}`, s.notes]
          .filter(Boolean)
          .join('\n'),
      ),
      TRANSP: 'TRANSPARENT',
    })
  }

  for (const slot of legSlots(trip)) {
    const l = slot.leg
    if (!l) continue
    const start = toMin(l.depart)
    const arrive = toMin(l.arrive)
    const summary = esc(`${MODE_ICON[l.mode]} ${slot.fromName} → ${slot.toName}${l.carrier ? ` (${l.carrier})` : ''}`)
    const description = esc([l.booking?.ref && `Boeking: ${l.booking.ref}`, l.notes].filter(Boolean).join('\n'))
    if (start === undefined) {
      ev(l.id, { 'DTSTART;VALUE=DATE:': day(l.date), 'DTEND;VALUE=DATE:': day(addDays(l.date, 1)), SUMMARY: summary, DESCRIPTION: description })
    } else {
      const end = arrive !== undefined ? (arrive > start ? arrive : arrive + 1440) : start + 60
      ev(l.id, { 'DTSTART:': at(l.date, start), 'DTEND:': at(l.date, end), SUMMARY: summary, DESCRIPTION: description })
    }
  }

  for (const d of buildDays(trip)) {
    for (const e of scheduleDay(d).entries) {
      if (e.kind !== 'act') continue
      const a = e.act
      ev(a.id, {
        'DTSTART:': at(d.date, e.start),
        'DTEND:': at(d.date, Math.max(e.end, e.start + 15)),
        SUMMARY: esc(a.title),
        LOCATION: a.place?.name && esc(a.place.name),
        GEO: a.place?.lat !== undefined ? `${a.place.lat};${a.place.lng}` : undefined,
        DESCRIPTION: esc([e.fixed ? '' : 'Tijd is een schatting.', a.booking?.ref && `Boeking: ${a.booking.ref}`, a.notes].filter(Boolean).join('\n')),
      })
    }
  }

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Verre//Reisplanner//NL',
    'CALSCALE:GREGORIAN',
    `X-WR-CALNAME:${esc(trip.name)}`,
    ...events.flat(),
    'END:VCALENDAR',
  ]
  return lines.map(fold).join('\r\n') + '\r\n'
}

export function download(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export const safeFileName = (s: string) =>
  s.normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').toLowerCase() || 'reis'
