import { create } from 'zustand'
import type { Trip } from './types'
import { supabase } from './lib/supabase'
import {
  clearLocal,
  deleteRemote,
  loadLocal,
  loadRemote,
  saveLocal,
  saveRemote,
} from './lib/storage'
import { defaultPacking } from './sample'
import { addDays, todayIso } from './lib/dates'
import { uid } from './lib/plan'

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

interface User {
  id: string
  email?: string
}

interface State {
  mode: 'local' | 'cloud'
  ready: boolean
  user: User | null
  trips: Trip[]
  currentId: string | null
  save: SaveState
  error?: string
  /** Lokale reizen die nog niet naar het account zijn geüpload. */
  localTrips: Trip[]

  init: () => void
  select: (id: string | null) => void
  createTrip: (t?: Partial<Trip>) => string
  addTrip: (t: Trip) => string
  deleteTrip: (id: string) => Promise<void>
  update: (fn: (t: Trip) => void) => void
  importLocal: () => Promise<void>
  signOut: () => Promise<void>
}

const timers = new Map<string, ReturnType<typeof setTimeout>>()

export const useStore = create<State>((set, get) => {
  const persist = (trip: Trip) => {
    if (get().mode === 'local') {
      saveLocal(get().trips)
      set({ save: 'saved' })
      return
    }
    set({ save: 'saving' })
    clearTimeout(timers.get(trip.id))
    timers.set(
      trip.id,
      setTimeout(async () => {
        timers.delete(trip.id)
        const latest = get().trips.find((t) => t.id === trip.id)
        if (!latest) return
        try {
          await saveRemote(latest)
          if (timers.size === 0) set({ save: 'saved' })
        } catch (e) {
          set({ save: 'error', error: (e as Error).message })
        }
      }, 700),
    )
  }

  const loadForUser = async (user: User | null) => {
    if (!user) {
      set({ user: null, trips: [], currentId: null, ready: true })
      return
    }
    set({ user, ready: false })
    try {
      const trips = await loadRemote()
      set({ trips, ready: true, localTrips: loadLocal(), error: undefined })
    } catch (e) {
      set({ trips: [], ready: true, error: (e as Error).message })
    }
  }

  return {
    mode: supabase ? 'cloud' : 'local',
    ready: false,
    user: null,
    trips: [],
    currentId: null,
    save: 'idle',
    localTrips: [],

    init: () => {
      let remembered: string | null = null
      try {
        remembered = localStorage.getItem('reisplanner.current')
      } catch {
        /* ignore */
      }
      const restore = () => {
        const id = remembered
        if (id && get().trips.some((t) => t.id === id)) set({ currentId: id })
      }
      if (!supabase) {
        set({ trips: loadLocal(), ready: true })
        restore()
        return
      }
      supabase.auth.getSession().then(async ({ data }) => {
        const u = data.session?.user
        await loadForUser(u ? { id: u.id, email: u.email } : null)
        restore()
      })
      supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN' && session?.user && session.user.id !== get().user?.id) {
          loadForUser({ id: session.user.id, email: session.user.email })
        }
        if (event === 'SIGNED_OUT') loadForUser(null)
      })
    },

    select: (id) => {
      set({ currentId: id })
      try {
        if (id) localStorage.setItem('reisplanner.current', id)
        else localStorage.removeItem('reisplanner.current')
      } catch {
        /* ignore */
      }
    },

    createTrip: (t = {}) => {
      const start = t.startDate ?? addDays(todayIso(), 60)
      const trip: Trip = {
        id: uid(),
        name: 'Nieuwe reis',
        startDate: start,
        endDate: addDays(start, 13),
        travelers: 2,
        homeCurrency: 'EUR',
        localCurrency: 'EUR',
        rate: 1,
        stops: [],
        activities: [],
        ideas: [],
        expenses: [],
        packing: defaultPacking(),
        updatedAt: new Date().toISOString(),
        ...t,
      }
      return get().addTrip(trip)
    },

    addTrip: (trip) => {
      set({ trips: [trip, ...get().trips] })
      persist(trip)
      get().select(trip.id)
      return trip.id
    },

    deleteTrip: async (id) => {
      set({ trips: get().trips.filter((t) => t.id !== id) })
      if (get().currentId === id) get().select(null)
      if (get().mode === 'local') saveLocal(get().trips)
      else {
        try {
          await deleteRemote(id)
        } catch (e) {
          set({ save: 'error', error: (e as Error).message })
        }
      }
    },

    update: (fn) => {
      const { currentId, trips } = get()
      const cur = trips.find((t) => t.id === currentId)
      if (!cur) return
      const next = structuredClone(cur)
      fn(next)
      next.updatedAt = new Date().toISOString()
      set({ trips: trips.map((t) => (t.id === next.id ? next : t)) })
      persist(next)
    },

    importLocal: async () => {
      const locals = get().localTrips
      for (const t of locals) {
        if (get().trips.some((x) => x.id === t.id)) continue
        await saveRemote(t)
        set({ trips: [t, ...get().trips] })
      }
      clearLocal()
      set({ localTrips: [] })
    },

    signOut: async () => {
      await supabase?.auth.signOut()
    },
  }
})

export const useTrip = () =>
  useStore((s) => s.trips.find((t) => t.id === s.currentId) ?? null)
