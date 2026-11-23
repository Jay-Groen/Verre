import type { Trip } from '../types'
import { normalizeTrip } from './migrate'
import { supabase } from './supabase'

const LOCAL_KEY = 'reisplanner.trips.v1'

export function loadLocal(): Trip[] {
  try {
    const raw = localStorage.getItem(LOCAL_KEY)
    return raw ? (JSON.parse(raw) as Trip[]).map(normalizeTrip) : []
  } catch {
    return []
  }
}

export function saveLocal(trips: Trip[]) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(trips))
  } catch {
    /* opslag vol of geblokkeerd */
  }
}

export function clearLocal() {
  try {
    localStorage.removeItem(LOCAL_KEY)
  } catch {
    /* ignore */
  }
}

export async function loadRemote(): Promise<Trip[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('trips')
    .select('id, data')
    .order('updated_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map((r) => normalizeTrip({ ...(r.data as Trip), id: r.id as string }))
}

export async function saveRemote(trip: Trip) {
  if (!supabase) return
  const { error } = await supabase.from('trips').upsert({
    id: trip.id,
    name: trip.name,
    data: trip,
    updated_at: trip.updatedAt,
  })
  if (error) throw error
}

export async function deleteRemote(id: string) {
  if (!supabase) return
  const { error } = await supabase.from('trips').delete().eq('id', id)
  if (error) throw error
}
