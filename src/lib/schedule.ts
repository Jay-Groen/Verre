import type { Activity, Leg, Trip } from '../types'
import type { DayInfo } from './plan'
import { legHours, toMin } from './legs'

/** Hier begint een dag als je nergens een tijd voor hebt opgegeven. */
export const DAY_START = 9 * 60
/** Tijd na aankomst voordat je iets kunt doen (bagage, inchecken). */
const AFTER_ARRIVAL = 45

type LatLng = { lat: number; lng: number }

export interface Move {
  kind: 'move'
  minutes: number
  km: number
  mode: 'walk' | 'transit'
}
export interface ActBlock {
  kind: 'act'
  act: Activity
  start: number
  end: number
  /** Tijd door jou opgegeven (anders geschat). */
  fixed: boolean
  /** Begint voordat het vorige blok klaar is. */
  conflict: boolean
}
export interface LegBlock {
  kind: 'leg'
  leg: Leg
  start: number
  end: number
}
export type Entry = Move | ActBlock | LegBlock

const hasPos = (p?: { lat?: number; lng?: number }): p is LatLng => p?.lat !== undefined && p?.lng !== undefined

/** Afstand in km over de aarde. */
export function haversine(a: LatLng, b: LatLng) {
  const R = 6371
  const rad = Math.PI / 180
  const dLat = (b.lat - a.lat) * rad
  const dLng = (b.lng - a.lng) * rad
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

/** Grove schatting van de reistijd: lopen tot 1,5 km, daarna OV of taxi. */
export function estimateMove(a: LatLng, b: LatLng): Move | undefined {
  const km = haversine(a, b) * 1.3 // straten lopen niet in een rechte lijn
  if (km < 0.15) return undefined
  if (km <= 1.5) return { kind: 'move', km, minutes: Math.max(3, Math.round((km / 4.5) * 60)), mode: 'walk' }
  return { kind: 'move', km, minutes: Math.round(10 + (km / 25) * 60), mode: 'transit' }
}

/**
 * Zet de activiteiten van een dag op een tijdlijn. Activiteiten zonder tijd sluiten aan
 * op de vorige, met de geschatte reistijd ertussen; vervoer tussen steden is een vast blok.
 */
export function scheduleDay(day: DayInfo): { entries: Entry[]; moveMin: number; end?: number; unsorted: boolean } {
  const legs: LegBlock[] = day.legs
    .filter((l) => l.depart)
    .map((l) => {
      const start = toMin(l.depart)!
      const arrive = toMin(l.arrive)
      const h = legHours(l)
      // Lokale aankomsttijd telt (tijdzones); anders vertrek + reisduur.
      const end = arrive !== undefined ? (arrive >= start ? arrive : arrive + 1440) : h !== undefined ? start + h * 60 : start + 60
      return { kind: 'leg', leg: l, start, end }
    })

  const here = day.travelFrom ?? day.stop
  let pos: LatLng | undefined = hasPos(here) ? here : undefined
  const after = hasPos(day.stop) ? day.stop : undefined
  let cursor = DAY_START
  let lastEnd = -Infinity
  let moveMin = 0
  const entries: Entry[] = []
  const pending = [...legs].sort((x, y) => x.start - y.start)

  const flushLeg = () => {
    const l = pending.shift()!
    entries.push(l)
    cursor = Math.max(cursor, l.end + AFTER_ARRIVAL)
    lastEnd = Math.max(lastEnd, l.end)
    pos = after ?? pos
  }
  const moveTo = (dest?: LatLng) => (pos && dest ? estimateMove(pos, dest) : undefined)

  for (const act of day.activities) {
    const fixedAt = toMin(act.time)
    const dest = hasPos(act.place) ? act.place : undefined
    const duration = (act.durationH || 0) * 60
    if (fixedAt !== undefined) {
      while (pending[0] && pending[0].start <= fixedAt) flushLeg()
    } else {
      // Past het niet meer vóór het vervoer, dan komt het erna.
      while (pending[0] && cursor + (moveTo(dest)?.minutes ?? 0) + duration > pending[0].start) flushLeg()
    }
    const move = moveTo(dest)
    if (move) {
      entries.push(move)
      moveMin += move.minutes
    }
    // Geschatte tijden ronden we af op 5 minuten.
    const start = fixedAt ?? Math.ceil((cursor + (move?.minutes ?? 0)) / 5) * 5
    const end = start + duration
    // Te krap: begint voordat het vorige klaar is plus de reistijd (5 min speling).
    const conflict = start < lastEnd + (move?.minutes ?? 0) - 5
    entries.push({ kind: 'act', act, start, end, fixed: fixedAt !== undefined, conflict })
    lastEnd = Math.max(lastEnd, end)
    cursor = end
    if (dest) pos = dest
  }
  while (pending.length) flushLeg()

  const times = day.activities.map((a) => toMin(a.time)).filter((t): t is number => t !== undefined)
  const unsorted = times.some((t, i) => i > 0 && t < times[i - 1])
  const end = entries.reduce((m, e) => (e.kind === 'move' ? m : Math.max(m, e.end)), -Infinity)
  return { entries, moveMin, end: Number.isFinite(end) ? end : undefined, unsorted }
}

/** Sorteert de activiteiten op een dag op tijd; zonder tijd blijven ze na hun voorganger staan. */
export function sortDayByTime(trip: Trip, date: string) {
  const acts = trip.activities.filter((a) => a.date === date).sort((a, b) => a.order - b.order)
  const groups: Activity[][] = []
  for (const a of acts) {
    if (a.time || groups.length === 0) groups.push([a])
    else groups[groups.length - 1].push(a)
  }
  groups.sort((g, h) => (toMin(g[0].time) ?? -1) - (toMin(h[0].time) ?? -1))
  groups.flat().forEach((a, i) => (a.order = i))
}
