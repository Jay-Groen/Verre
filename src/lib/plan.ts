import type { Activity, Currency, Idea, Stop, Trip } from '../types'
import { dateRange } from './dates'

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
    const capacityH = travelFrom || goingHome ? TRAVEL_DAY_CAPACITY_H : DAY_CAPACITY_H
    return {
      date,
      index,
      stop: night ?? leaving,
      travelFrom,
      goingHome,
      activities,
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

export const toEUR = (amount: number, currency: Currency, jpyPerEur: number) =>
  currency === 'EUR' ? amount : amount / (jpyPerEur || 1)

export const fmtMoney = (amount: number, currency: Currency) =>
  new Intl.NumberFormat('nl-NL', {
    style: 'currency',
    currency,
    maximumFractionDigits: currency === 'JPY' ? 0 : 2,
  }).format(amount)

export const fmtEUR = (amount: number) =>
  new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(
    amount,
  )

export const STOP_COLORS = ['#d64933', '#3d5a98', '#2f8f6b', '#b07a1f', '#8a4fa3', '#1f8a9e', '#c2577f']

export const uid = () => crypto.randomUUID()

export const fmtHours = (h: number) => {
  const r = Math.round(h * 2) / 2
  return `${String(r).replace('.', ',')} u`
}
