import type { Activity, Idea, Leg, Stop, Trip } from '../types'
import { sortActivities, uid } from './plan'
import { addDays, daysBetween } from './dates'

/** Zet een activiteit op een (andere) dag, optioneel vóór een andere activiteit. */
export function moveActivity(trip: Trip, id: string, date: string, beforeId?: string) {
  const act = trip.activities.find((a) => a.id === id)
  if (!act || id === beforeId) return
  act.date = date
  const day = sortActivities(trip.activities.filter((a) => a.date === date && a.id !== id))
  const at = beforeId ? day.findIndex((a) => a.id === beforeId) : -1
  day.splice(at < 0 ? day.length : at, 0, act)
  day.forEach((a, i) => (a.order = i))
}

export function nextOrder(trip: Trip, date: string) {
  return trip.activities.filter((a) => a.date === date).reduce((m, a) => Math.max(m, a.order + 1), 0)
}

export function activityFromIdea(trip: Trip, idea: Idea, date: string): Activity {
  return {
    id: uid(),
    date,
    title: idea.title,
    place: idea.place && { ...idea.place },
    durationH: idea.durationH,
    cost: idea.cost,
    currency: idea.currency,
    notes: [idea.notes, idea.link].filter(Boolean).join('\n') || undefined,
    ideaId: idea.id,
    order: nextOrder(trip, date),
  }
}

export function planIdea(trip: Trip, ideaId: string, date: string) {
  const idea = trip.ideas.find((i) => i.id === ideaId)
  if (!idea) return
  trip.activities = trip.activities.filter((a) => a.ideaId !== ideaId)
  trip.activities.push(activityFromIdea(trip, idea, date))
}

export function newActivity(trip: Trip, date: string): Activity {
  return { id: uid(), date, title: '', durationH: 2, currency: trip.localCurrency, order: nextOrder(trip, date) }
}

export function newIdea(trip: Trip, city?: string): Idea {
  return { id: uid(), title: '', city, category: 'Bezienswaardigheid', durationH: 2, currency: trip.localCurrency, priority: 2, dropped: false }
}

// ---- Opslaan en verwijderen vanuit formulieren (gedeeld door meerdere tabbladen) ----

export function saveStop(trip: Trip, s: Stop) {
  const old = trip.stops.find((x) => x.id === s.id)
  if (old) Object.assign(old, s)
  else trip.stops.push(s)
}

export function deleteStop(trip: Trip, id: string) {
  trip.stops = trip.stops.filter((x) => x.id !== id)
  trip.legs = trip.legs.filter((l) => l.toId !== id)
}

export function saveLeg(trip: Trip, l: Leg) {
  trip.legs = trip.legs.filter((x) => x.id !== l.id && x.toId !== l.toId)
  trip.legs.push(l)
}

export function saveActivity(trip: Trip, a: Activity) {
  const old = trip.activities.find((x) => x.id === a.id)
  if (old && old.date !== a.date) {
    Object.assign(old, a)
    moveActivity(trip, a.id, a.date)
  } else if (old) Object.assign(old, a)
  else trip.activities.push(a)
}

/**
 * Kopie van een reis als sjabloon: nieuwe id's, alle datums verschoven naar de nieuwe
 * vertrekdatum, en boekingen, betalingen en afgevinkte paklijst weer op nul.
 */
export function duplicateTrip(src: Trip, name: string, startDate: string): Trip {
  const shift = daysBetween(src.startDate, startDate)
  const mv = (d: string) => addDays(d, shift)
  const stopIds = new Map(src.stops.map((s) => [s.id, uid()]))
  const ideaIds = new Map(src.ideas.map((i) => [i.id, uid()]))
  return {
    ...structuredClone(src),
    id: uid(),
    name,
    startDate: mv(src.startDate),
    endDate: mv(src.endDate),
    stops: src.stops.map((s) => ({ ...s, id: stopIds.get(s.id)!, start: mv(s.start), end: mv(s.end), booked: false, booking: undefined })),
    legs: src.legs.map((l) => ({
      ...l,
      id: uid(),
      toId: stopIds.get(l.toId) ?? l.toId,
      date: mv(l.date),
      booked: false,
      booking: undefined,
    })),
    ideas: src.ideas.map((i) => ({ ...i, id: ideaIds.get(i.id)!, votes: undefined })),
    activities: src.activities.map((a) => ({
      ...a,
      id: uid(),
      date: mv(a.date),
      ideaId: a.ideaId && ideaIds.get(a.ideaId),
      reserve: a.reserve ? 'todo' : undefined,
      booking: undefined,
    })),
    expenses: src.expenses.map((e) => ({ ...e, id: uid(), paid: false })),
    packing: src.packing.map((p) => ({ ...p, id: uid(), done: false })),
    updatedAt: new Date().toISOString(),
  }
}
