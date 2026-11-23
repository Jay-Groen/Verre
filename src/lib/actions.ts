import type { Activity, Idea, Trip } from '../types'
import { sortActivities, uid } from './plan'

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
    place: idea.place,
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
  return { id: uid(), date, title: '', durationH: 2, currency: 'JPY', order: nextOrder(trip, date) }
}

export function newIdea(city?: string): Idea {
  return { id: uid(), title: '', city, category: 'Bezienswaardigheid', durationH: 2, currency: 'JPY', priority: 2, dropped: false }
}
