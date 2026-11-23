import { useEffect, useState, type ReactNode } from 'react'
import { useTheme, type Theme } from './lib/theme'
import { Wordmark } from './components/ui'
import { useStore, useTrip } from './store'
import { Login } from './components/Login'
import { TripList } from './components/TripList'
import { DaysView } from './components/DaysView'
import { IdeasView } from './components/IdeasView'
import { RouteView } from './components/RouteView'
import { MapView } from './components/MapView'
import { BudgetView } from './components/BudgetView'
import { PackingView } from './components/PackingView'
import { daysBetween, fmtDay, todayIso } from './lib/dates'
import type { Trip } from './types'

const TABS = [
  { id: 'days', label: 'Planning', icon: '🗓️' },
  { id: 'ideas', label: 'Ideeën', icon: '💡' },
  { id: 'route', label: 'Route & verblijven', icon: '🛏️' },
  { id: 'map', label: 'Kaart', icon: '🗺️' },
  { id: 'budget', label: 'Budget', icon: '💰' },
  { id: 'packing', label: 'Paklijst', icon: '🎒' },
] as const
type Tab = (typeof TABS)[number]['id']

export default function App() {
  const { init, ready, mode, user } = useStore()
  const trip = useTrip()
  const { theme, toggle } = useTheme()
  useEffect(() => init(), [init])

  const themeButton = <ThemeToggle theme={theme} onToggle={toggle} />
  if (!ready) return <div className="loading">Laden…</div>
  if (mode === 'cloud' && !user) return <Login themeButton={themeButton} />

  return (
    <div className="app">
      <TopBar trip={trip} themeButton={themeButton} />
      <main>{trip ? <TripShell trip={trip} /> : <TripList />}</main>
    </div>
  )
}

function ThemeToggle({ theme, onToggle }: { theme: Theme; onToggle: () => void }) {
  const dark = theme === 'dark'
  const label = dark ? 'Lichte modus' : 'Donkere modus'
  return (
    <button className="bar-btn icon" onClick={onToggle} aria-label={label} title={label}>
      {dark ? (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />
        </svg>
      )}
    </button>
  )
}

function TopBar({ trip, themeButton }: { trip: Trip | null; themeButton: ReactNode }) {
  const { select, save, mode, user, signOut, error } = useStore()
  const until = trip ? daysBetween(todayIso(), trip.startDate) : 0
  return (
    <header className="topbar">
      <button className="brand" onClick={() => select(null)} title="Alle reizen">
        <img className="logo" src="/mark-white.svg" alt="" />
        <span className="brand-name">
          <Wordmark />
        </span>
      </button>
      {trip && (
        <div className="trip-title">
          <strong>{trip.name}</strong>
          <small className="muted">
            {fmtDay(trip.startDate)} – {fmtDay(trip.endDate)}
            {until > 0 ? ` · nog ${until} dagen` : ''}
          </small>
        </div>
      )}
      <span className="spacer" />
      <span className={'save-state ' + save} title={error}>
        {mode === 'local'
          ? 'Lokaal opgeslagen'
          : save === 'saving'
            ? 'Opslaan…'
            : save === 'error'
              ? 'Opslaan mislukt'
              : 'Opgeslagen'}
      </span>
      {user && (
        <button className="bar-btn" onClick={signOut} title={user.email}>
          Uitloggen
        </button>
      )}
      {themeButton}
    </header>
  )
}

function TripShell({ trip }: { trip: Trip }) {
  const [tab, setTab] = useState<Tab>(() => {
    try {
      const t = localStorage.getItem('reisplanner.tab') as Tab | null
      return t && TABS.some((x) => x.id === t) ? t : 'days'
    } catch {
      return 'days'
    }
  })
  const go = (t: Tab) => {
    setTab(t)
    try {
      localStorage.setItem('reisplanner.tab', t)
    } catch {
      /* ignore */
    }
  }
  return (
    <>
      <nav className="tabs">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? 'on' : ''} onClick={() => go(t.id)}>
            <span aria-hidden>{t.icon}</span> {t.label}
          </button>
        ))}
      </nav>
      <div className="view">
        {tab === 'days' && <DaysView trip={trip} onGoRoute={() => go('route')} />}
        {tab === 'ideas' && <IdeasView trip={trip} />}
        {tab === 'route' && <RouteView trip={trip} />}
        {tab === 'map' && <MapView trip={trip} />}
        {tab === 'budget' && <BudgetView trip={trip} />}
        {tab === 'packing' && <PackingView trip={trip} />}
      </div>
    </>
  )
}
