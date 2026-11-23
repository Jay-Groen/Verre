import type { Leg, Stop, Trip } from '../types'
import { sortStops, uid } from './plan'

/** Een plek in de route waar vervoer hoort: heenreis, tussen twee stops, of terugreis. */
export interface LegSlot {
  toId: string
  from?: Stop
  to?: Stop
  /** Naam voor weergave, 'Thuis' als from/to ontbreekt. */
  fromName: string
  toName: string
  /** Standaarddatum: aankomst bij de volgende stop, of de laatste dag. */
  date: string
  leg?: Leg
}

export const HOME = 'home'

export function legSlots(trip: Trip): LegSlot[] {
  const stops = sortStops(trip.stops)
  if (stops.length === 0) return []
  const slots: LegSlot[] = stops.map((to, i) => {
    const from = stops[i - 1]
    return {
      toId: to.id,
      from,
      to,
      fromName: from?.city ?? 'Thuis',
      toName: to.city,
      date: to.start,
      leg: trip.legs.find((l) => l.toId === to.id),
    }
  })
  const last = stops[stops.length - 1]
  slots.push({
    toId: HOME,
    from: last,
    fromName: last.city,
    toName: 'Thuis',
    date: last.end,
    leg: trip.legs.find((l) => l.toId === HOME),
  })
  return slots
}

/** Hetzelfde verblijf in dezelfde stad achter elkaar heeft geen vervoer nodig. */
export const needsLeg = (s: LegSlot) => !(s.from && s.to && s.from.city === s.to.city && s.from.end === s.to.start && s.from.stayName === s.to.stayName)

export function newLeg(trip: Trip, slot: LegSlot): Leg {
  const far = !slot.from || !slot.to
  return {
    id: uid(),
    toId: slot.toId,
    mode: far ? 'Vlucht' : 'Trein',
    date: slot.date,
    currency: far ? trip.homeCurrency : trip.localCurrency,
    booked: false,
  }
}

export const toMin = (t?: string) => {
  if (!t) return undefined
  const [h, m] = t.split(':').map(Number)
  return h * 60 + (m || 0)
}

export const fromMin = (m: number) => {
  const d = ((Math.round(m) % 1440) + 1440) % 1440
  return `${String(Math.floor(d / 60)).padStart(2, '0')}:${String(d % 60).padStart(2, '0')}`
}

/** Reisduur in uren als vertrek en aankomst bekend zijn (over middernacht telt door). */
export function legHours(leg?: Leg): number | undefined {
  if (leg?.durationH) return leg.durationH
  const a = toMin(leg?.depart)
  const b = toMin(leg?.arrive)
  if (a === undefined || b === undefined) return undefined
  return ((b - a + 1440) % 1440) / 60
}

export const fmtDuration = (h: number) => {
  const m = Math.round(h * 60)
  if (m < 60) return `${m} min`
  return `${Math.floor(m / 60)} u${m % 60 ? ` ${m % 60}` : ''}`
}
