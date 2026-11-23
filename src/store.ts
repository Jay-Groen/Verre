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
  loadCache,
  saveCache,
  clearCache,
  isNetworkError,
  type Access,
} from './lib/storage'
import { normalizeTrip } from './lib/migrate'
import { removeMember } from './lib/sharing'
import { clearCloudFiles } from './lib/files'
import { defaultPacking } from './sample'
import { addDays, todayIso } from './lib/dates'
import { uid } from './lib/plan'

type SaveState = 'idle' | 'saving' | 'saved' | 'error' | 'offline'

interface User {
  id: string
  email?: string
}

interface State {
  mode: 'local' | 'cloud'
  ready: boolean
  user: User | null
  trips: Trip[]
  /** Per reis: ben je eigenaar of medereiziger (alleen met account). */
  access: Record<string, Access>
  currentId: string | null
  save: SaveState
  error?: string
  /** Lokale reizen die nog niet naar het account zijn geüpload. */
  localTrips: Trip[]
  /** Geen verbinding: je werkt met de offline kopie. */
  offline: boolean

  init: () => void
  select: (id: string | null) => void
  createTrip: (t?: Partial<Trip>) => string
  addTrip: (t: Trip) => string
  deleteTrip: (id: string) => Promise<void>
  update: (fn: (t: Trip) => void) => void
  importLocal: () => Promise<void>
  signOut: () => Promise<void>
  /** Haalt wijzigingen van medereizigers op. */
  refresh: () => Promise<void>
}

const timers = new Map<string, ReturnType<typeof setTimeout>>()
/** Reizen met wijzigingen die nog naar Supabase moeten (bijv. omdat je offline was). */
const pending = new Set<string>()

export const useStore = create<State>((set, get) => {
  const writeCache = () => {
    const u = get().user
    if (u) saveCache(u.id, { trips: get().trips, access: get().access, pending: [...pending] })
  }

  const upload = async (id: string) => {
    const latest = get().trips.find((t) => t.id === id)
    if (!latest) {
      pending.delete(id)
      return
    }
    try {
      await saveRemote(latest, get().access[latest.id]?.owner ?? true)
      pending.delete(id)
      writeCache()
      if (timers.size === 0 && pending.size === 0) set({ save: 'saved', offline: false })
    } catch (e) {
      pending.add(id)
      writeCache()
      if (isNetworkError(e)) set({ save: 'offline', offline: true })
      else set({ save: 'error', error: (e as Error).message })
    }
  }

  const retryPending = async () => {
    for (const id of [...pending]) await upload(id)
  }

  const persist = (trip: Trip) => {
    if (get().mode === 'local') {
      saveLocal(get().trips)
      set({ save: 'saved' })
      return
    }
    // Altijd meteen een offline kopie, zodat niets verloren gaat zonder verbinding.
    pending.add(trip.id)
    writeCache()
    if (get().offline && !navigator.onLine) {
      set({ save: 'offline' })
      return
    }
    set({ save: 'saving' })
    clearTimeout(timers.get(trip.id))
    timers.set(
      trip.id,
      setTimeout(async () => {
        timers.delete(trip.id)
        await upload(trip.id)
      }, 700),
    )
  }

  const loadForUser = async (user: User | null) => {
    if (!user) {
      set({ user: null, trips: [], access: {}, currentId: null, ready: true })
      stopListening()
      return
    }
    set({ user, ready: false })
    const cache = loadCache(user.id)
    cache?.pending.forEach((id) => pending.add(id))
    try {
      const { trips: remote, access } = await loadRemote(user.id)
      // Wijzigingen die offline zijn gemaakt, gaan voor op wat er online staat.
      const trips = remote.map((r) => (pending.has(r.id) ? (cache?.trips.find((c) => c.id === r.id) ?? r) : r))
      const unsent = (cache?.trips ?? []).filter((c) => pending.has(c.id) && !remote.some((r) => r.id === c.id))
      set({
        trips: [...unsent, ...trips],
        access: { ...access, ...Object.fromEntries(unsent.map((t) => [t.id, cache?.access[t.id] ?? { owner: true }])) },
        ready: true,
        offline: false,
        localTrips: loadLocal(),
        error: undefined,
      })
      writeCache()
      listen()
      retryPending()
    } catch (e) {
      if (cache && isNetworkError(e)) {
        set({ trips: cache.trips, access: cache.access, ready: true, offline: true, save: 'offline', error: undefined })
        listen()
      } else set({ trips: [], ready: true, error: (e as Error).message })
    }
  }

  // ---- Live bijwerken: Realtime + bij terugkeren naar het tabblad ----
  let channel: ReturnType<NonNullable<typeof supabase>['channel']> | null = null
  let refreshTimer: ReturnType<typeof setTimeout> | undefined
  let lastRefresh = 0
  const soon = () => {
    clearTimeout(refreshTimer)
    refreshTimer = setTimeout(() => get().refresh(), 400)
  }
  const onFocus = () => {
    if (document.visibilityState === 'visible' && Date.now() - lastRefresh > 15_000) soon()
  }
  const listen = () => {
    if (!supabase || channel) return
    channel = supabase
      .channel('trips-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trips' }, soon)
      .subscribe()
    document.addEventListener('visibilitychange', onFocus)
    window.addEventListener('focus', onFocus)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
  }
  const onOnline = async () => {
    set({ offline: false })
    await retryPending()
    get().refresh()
  }
  const onOffline = () => set({ offline: true, save: pending.size ? 'offline' : get().save })
  const stopListening = () => {
    if (channel) supabase?.removeChannel(channel)
    channel = null
    document.removeEventListener('visibilitychange', onFocus)
    window.removeEventListener('focus', onFocus)
    window.removeEventListener('online', onOnline)
    window.removeEventListener('offline', onOffline)
  }

  return {
    mode: supabase ? 'cloud' : 'local',
    access: {},
    ready: false,
    user: null,
    trips: [],
    currentId: null,
    save: 'idle',
    localTrips: [],
    offline: false,

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
        legs: [],
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
      set({ trips: [trip, ...get().trips], access: { ...get().access, [trip.id]: { owner: true } } })
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
          const acc = get().access[id]
          // Een gedeelde reis verlaat je; alleen de eigenaar verwijdert hem echt.
          if (acc && !acc.owner) await removeMember(id, (get().user?.email ?? '').toLowerCase())
          else await deleteRemote(id)
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
      const u = get().user
      // Uitloggen wist de offline kopie, zodat de volgende gebruiker van dit apparaat niets ziet.
      if (u) clearCache(u.id)
      pending.clear()
      await clearCloudFiles()
      await supabase?.auth.signOut()
    },

    refresh: async () => {
      const user = get().user
      if (!supabase || !user || !navigator.onLine) return
      lastRefresh = Date.now()
      try {
        const { trips: remote, access } = await loadRemote(user.id)
        const local = get().trips
        // Lokale wijzigingen die nog worden opgeslagen, of nieuwer zijn, gaan voor.
        const merged = remote.map((r) => {
          const l = local.find((x) => x.id === r.id)
          return l && (timers.has(l.id) || pending.has(l.id) || l.updatedAt >= r.updatedAt) ? l : normalizeTrip(r)
        })
        const pendingNew = local.filter((l) => timers.has(l.id) && !remote.some((r) => r.id === l.id))
        set({ trips: [...pendingNew, ...merged], access: { ...access, ...Object.fromEntries(pendingNew.map((t) => [t.id, { owner: true }])) } })
        const cur = get().currentId
        if (cur && !get().trips.some((t) => t.id === cur)) get().select(null)
        writeCache()
      } catch {
        /* volgende keer opnieuw */
      }
    },
  }
})

export const useTrip = () =>
  useStore((s) => s.trips.find((t) => t.id === s.currentId) ?? null)
