import type { Activity, Currency, Idea, Leg, Stop, Trip } from '../types'
import { dateRange } from './dates'
import { legHours } from './legs'

/** Uren die je op een gewone dag kunt vullen, en op een reisdag. */
export const DAY_CAPACITY_H = 9
export const TRAVEL_DAY_CAPACITY_H = 5

export const norm = (s?: string) => (s ?? '').trim().toLowerCase()

export interface DayInfo {
  date: string
  index: number
  /** Stad waar je die nacht slaapt (of, op de laatste dag, waar je vertrekt). */
  stop?: Stop
  /** Gezet op een reisdag: van welke stop je komt. */
  travelFrom?: Stop
  /** Laatste dag: vertrek naar huis. */
  goingHome: boolean
  activities: Activity[]
  /** Vervoer dat op deze dag vertrekt. */
  legs: Leg[]
  loadH: number
  capacityH: number
}

export const sortStops = (stops: Stop[]) =>
  [...stops].sort((a, b) => a.start.localeCompare(b.start))

export const sortActivities = (acts: Activity[]) =>
  [...acts].sort((a, b) => a.order - b.order)

export function buildDays(trip: Trip): DayInfo[] {
  const stops = sortStops(trip.stops)
  return dateRange(trip.startDate, trip.endDate).map((date, index) => {
    const night = stops.find((s) => s.start <= date && date < s.end)
    const leaving = stops.find((s) => s.end === date)
    const arriving = stops.find((s) => s.start === date)
    const travelFrom = arriving && leaving && leaving.id !== arriving.id ? leaving : undefined
    const goingHome = date === trip.endDate && !night
    const activities = sortActivities(trip.activities.filter((a) => a.date === date))
    const loadH = activities.reduce((n, a) => n + (a.durationH || 0), 0)
    const legs = trip.legs.filter((l) => l.date === date).sort((a, b) => (a.depart ?? '').localeCompare(b.depart ?? ''))
    const known = legs.map(legHours)
    const capacityH =
      legs.length && known.every((h) => h !== undefined)
        ? Math.max(1, DAY_CAPACITY_H - known.reduce((n, h) => n + h! + 0.5, 0))
        : travelFrom || goingHome || legs.length
          ? TRAVEL_DAY_CAPACITY_H
          : DAY_CAPACITY_H
    return {
      date,
      index,
      stop: night ?? leaving,
      travelFrom,
      goingHome,
      activities,
      legs,
      loadH,
      capacityH,
    }
  })
}

export type Fit =
  | { kind: 'planned'; activity: Activity }
  | { kind: 'dropped' }
  | { kind: 'fits'; city: string; options: { date: string; freeH: number }[] }
  | { kind: 'full'; city: string; options: { date: string; freeH: number }[] }
  | { kind: 'offroute'; city: string }
  | { kind: 'nocity'; options: { date: string; freeH: number }[] }

/** Bepaalt hoe een idee in de huidige planning past. */
export function fitIdea(idea: Idea, trip: Trip, days: DayInfo[]): Fit {
  const activity = trip.activities.find((a) => a.ideaId === idea.id)
  if (activity) return { kind: 'planned', activity }
  if (idea.dropped) return { kind: 'dropped' }

  const withFree = (ds: DayInfo[]) =>
    ds
      .map((d) => ({ date: d.date, freeH: d.capacityH - d.loadH }))
      .sort((a, b) => b.freeH - a.freeH || a.date.localeCompare(b.date))

  if (!norm(idea.city)) return { kind: 'nocity', options: withFree(days) }

  const cityDays = days.filter((d) => norm(d.stop?.city) === norm(idea.city))
  if (cityDays.length === 0) return { kind: 'offroute', city: idea.city! }

  const options = withFree(cityDays)
  const fitting = options.filter((o) => o.freeH >= idea.durationH)
  return fitting.length
    ? { kind: 'fits', city: idea.city!, options: fitting }
    : { kind: 'full', city: idea.city!, options }
}

/** Rekent een bedrag om naar de thuisvaluta van de reis. */
export const toHome = (amount: number, currency: Currency, trip: Trip) =>
  currency === trip.localCurrency && currency !== trip.homeCurrency ? amount / (trip.rate || 1) : amount

export const fmtMoney = (amount: number, currency: Currency) => {
  try {
    return new Intl.NumberFormat('nl-NL', { style: 'currency', currency }).format(amount)
  } catch {
    return `${currency} ${amount}`
  }
}

/** Afgerond bedrag in de thuisvaluta, voor totalen. */
export const fmtHome = (amount: number, trip: Trip) => {
  try {
    return new Intl.NumberFormat('nl-NL', {
      style: 'currency',
      currency: trip.homeCurrency,
      maximumFractionDigits: 0,
    }).format(amount)
  } catch {
    return `${trip.homeCurrency} ${Math.round(amount)}`
  }
}

/** De valuta waartussen je in deze reis kunt kiezen. */
export const tripCurrencies = (trip: Trip) => [...new Set([trip.localCurrency, trip.homeCurrency])]

export const STOP_COLORS = ['#e0603f', '#3d5a98', '#2e8a62', '#c08a1e', '#8a5bb0', '#2a94b0', '#c9577f']

export const uid = () => crypto.randomUUID()

export const fmtHours = (h: number) => {
  const r = Math.round(h * 2) / 2
  return `${String(r).replace('.', ',')} u`
}
