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

/** Wie een reis bezit; bij gedeelde reizen ben je medereiziger. */
export interface Access {
  owner: boolean
  ownerEmail?: string
}

export async function loadRemote(userId: string): Promise<{ trips: Trip[]; access: Record<string, Access> }> {
  if (!supabase) return { trips: [], access: {} }
  const query = (cols: string) => supabase!.from('trips').select(cols).order('updated_at', { ascending: false })
  let { data, error } = await query('id, data, owner, owner_email')
  // Database nog niet bijgewerkt met schema.sql: werkt verder zonder eigenaar-e-mail.
  if (error?.code === '42703') ({ data, error } = await query('id, data, owner'))
  if (error) throw error
  const access: Record<string, Access> = {}
  const rows = (data ?? []) as unknown as { id: string; data: Trip; owner: string; owner_email?: string }[]
  const trips = rows.map((r) => {
    access[r.id as string] = { owner: r.owner === userId, ownerEmail: (r.owner_email as string) ?? undefined }
    return normalizeTrip({ ...(r.data as Trip), id: r.id as string })
  })
  return { trips, access }
}

export async function saveRemote(trip: Trip, isOwner = true) {
  if (!supabase) return
  const row = { name: trip.name, data: trip, updated_at: trip.updatedAt }
  // Medereizigers mogen alleen bijwerken, niet aanmaken.
  const { error } = isOwner
    ? await supabase.from('trips').upsert({ id: trip.id, ...row })
    : await supabase.from('trips').update(row).eq('id', trip.id)
  if (error) throw error
}

export async function deleteRemote(id: string) {
  if (!supabase) return
  const { error } = await supabase.from('trips').delete().eq('id', id)
  if (error) throw error
}
