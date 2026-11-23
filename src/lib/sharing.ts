import { supabase } from './supabase'

export interface Member {
  email: string
  created_at: string
}

const need = () => {
  if (!supabase) throw new Error('Delen kan alleen met een account')
  return supabase
}

/** Vertaalt databasefouten naar iets wat je kunt begrijpen. */
function explain(e: { message: string; code?: string }) {
  if (e.code === '23505') return new Error('Dit e-mailadres doet al mee')
  if (e.code === '42P01' || /trip_members/.test(e.message))
    return new Error('Delen is nog niet ingesteld: draai supabase/schema.sql opnieuw in Supabase')
  if (e.code === '42501') return new Error('Alleen de eigenaar van de reis kan mensen uitnodigen')
  return new Error(e.message)
}

export async function listMembers(tripId: string): Promise<Member[]> {
  const { data, error } = await need()
    .from('trip_members')
    .select('email, created_at')
    .eq('trip_id', tripId)
    .order('created_at')
  if (error) throw explain(error)
  return data ?? []
}

export async function addMember(tripId: string, email: string) {
  const { error } = await need().from('trip_members').insert({ trip_id: tripId, email: email.trim().toLowerCase() })
  if (error) throw explain(error)
}

export async function removeMember(tripId: string, email: string) {
  const { error } = await need().from('trip_members').delete().eq('trip_id', tripId).eq('email', email)
  if (error) throw explain(error)
}

export const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim())
