import { useEffect, useMemo, useState } from 'react'
import type { Trip } from '../types'
import { MODE_ICON } from '../types'
import { buildDays, fmtHours, type DayInfo } from '../lib/plan'
import { fmtLong, nowMinutes, todayIso } from '../lib/dates'
import { fromMin, legSlots } from '../lib/legs'
import { scheduleDay, type ActBlock, type LegBlock } from '../lib/schedule'
import { BookingChips } from './BookingFields'
import { Empty, NavLink } from './ui'
import { useWeather, weatherIcon, weatherTitle } from '../lib/weather'

/** Ligt vandaag binnen de reis? */
export const isOngoing = (trip: Trip, today = todayIso()) => trip.startDate <= today && today <= trip.endDate

type Block = ActBlock | LegBlock

export function TodayView({ trip, onOpenDays }: { trip: Trip; onOpenDays: () => void }) {
  const [now, setNow] = useState(nowMinutes)
  useEffect(() => {
    const t = setInterval(() => setNow(nowMinutes()), 30_000)
    return () => clearInterval(t)
  }, [])

  const weather = useWeather(trip)
  const today = todayIso()
  const days = useMemo(() => buildDays(trip), [trip])
  const slots = useMemo(() => legSlots(trip), [trip])
  const d = days.find((x) => x.date === today)
  const tomorrow = d ? days[d.index + 1] : undefined
  if (!d) return <Empty title="De reis is nu niet bezig">Dit scherm laat tijdens je reis zien wat er vandaag gepland staat.</Empty>

  const legName = (id: string) => {
    const s = slots.find((x) => x.leg?.id === id)
    return s ? `${s.fromName} → ${s.toName}` : 'Vervoer'
  }
  const plan = scheduleDay(d)
  const blocks = plan.entries.filter((e): e is Block => e.kind !== 'move')
  const current = blocks.find((b) => b.start <= now && now < b.end)
  const upcoming = blocks.filter((b) => b.start > now)
  const next = upcoming[0]
  const stay = d.stop
  const doneAll = blocks.length > 0 && !current && !next

  return (
    <div className="today">
      <header className="today-head" style={{ '--stop': stay?.color ?? 'var(--primary)' } as React.CSSProperties}>
        <small>
          Dag {d.index + 1} van {days.length}
          {stay && ` · ${stay.city}`}
        </small>
        <h2>{fmtLong(d.date)}</h2>
        <span className="today-clock">
          {fromMin(now)}
          {weather[d.date] && (
            <small title={weatherTitle(weather[d.date])}>
              {weatherIcon(weather[d.date].code)[0]} {Math.round(weather[d.date].tmax)}° / {Math.round(weather[d.date].tmin)}°
            </small>
          )}
        </span>
      </header>

      {current && <FocusCard label="Nu" block={current} legName={legName} now={now} />}
      {next && <FocusCard label={current ? 'Hierna' : 'Straks'} block={next} legName={legName} now={now} />}
      {blocks.length === 0 && (
        <div className="card today-free">
          <strong>Niets gepland vandaag.</strong>
          <p className="muted">
            Een vrije dag{stay ? ` in ${stay.city}` : ''}. Bekijk je ideeën voor inspiratie, of{' '}
            <button className="link" onClick={onOpenDays}>
              plan iets in
            </button>
            .
          </p>
        </div>
      )}
      {doneAll && (
        <div className="card today-free">
          <strong>Klaar voor vandaag 🎉</strong>
          {stay && <p className="muted">Tijd om terug te gaan naar {stay.stayName ?? 'je verblijf'}.</p>}
        </div>
      )}

      {blocks.length > 0 && (
        <section className="card">
          <h3>Vandaag</h3>
          <ol className="today-list">
            {blocks.map((b) => {
              const state = b.end <= now ? 'past' : b === current ? 'now' : ''
              const title = b.kind === 'act' ? b.act.title : `${MODE_ICON[b.leg.mode]} ${legName(b.leg.id)}`
              const place = b.kind === 'act' ? b.act.place : undefined
              return (
                <li key={b.kind === 'act' ? b.act.id : b.leg.id} className={state}>
                  <span className="time">
                    {b.kind === 'act' && !b.fixed ? '~' : ''}
                    {fromMin(b.start)}
                  </span>
                  <span className="grow">{title}</span>
                  <NavLink to={place && { ...place, near: stay?.city }} label="" className="nav-link icon" />
                </li>
              )
            })}
          </ol>
        </section>
      )}

      {stay && (
        <section className="card today-stay">
          <h3>🛏️ Vannacht</h3>
          <strong>{stay.stayName ?? `Nog geen verblijf in ${stay.city}`}</strong>
          {stay.stayAddress && <span className="muted">{stay.stayAddress}</span>}
          <small className="muted">
            {d.travelFrom || d.index === 0 ? `Inchecken vanaf ${stay.checkIn ?? '?'}` : `Nog ${nights(d)} ${nights(d) === 1 ? 'nacht' : 'nachten'}`}
            {stay.end === tomorrow?.date && stay.checkOut ? ` · morgen uitchecken vóór ${stay.checkOut}` : ''}
          </small>
          <div className="row">
            <NavLink
              to={stay.lat !== undefined ? { lat: stay.lat, lng: stay.lng } : { name: stay.stayAddress ?? stay.stayName, near: stay.city }}
              label="Route naar verblijf"
            />
          </div>
          <BookingChips booking={stay.booking} />
        </section>
      )}

      {tomorrow && (
        <section className="card today-next">
          <h3>Morgen</h3>
          <small className="muted">
            {fmtLong(tomorrow.date)}
            {tomorrow.stop && ` · ${tomorrow.stop.city}`}
            {tomorrow.activities.length > 0 && ` · ${tomorrow.activities.length} gepland (${fmtHours(tomorrow.loadH)})`}
          </small>
          <ul>
            {tomorrow.legs.map((l) => (
              <li key={l.id}>
                {MODE_ICON[l.mode]} {l.depart ?? ''} {legName(l.id)}
                {!l.booked && <span className="tag todo">nog boeken</span>}
              </li>
            ))}
            {tomorrow.activities.slice(0, 3).map((a) => (
              <li key={a.id}>
                {a.time ?? '·'} {a.title}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

const nights = (d: DayInfo) => (d.stop ? Math.max(0, Math.round((Date.parse(d.stop.end) - Date.parse(d.date)) / 86_400_000)) : 0)

function FocusCard({ label, block: b, legName, now }: { label: string; block: Block; legName: (id: string) => string; now: number }) {
  const inMin = b.start - now
  const when = b.start <= now ? `tot ${fromMin(b.end)}` : inMin < 60 ? `over ${inMin} min` : `om ${fromMin(b.start)}`
  if (b.kind === 'leg') {
    const l = b.leg
    return (
      <section className="focus leg">
        <small>
          {label} · {when}
        </small>
        <h3>
          {MODE_ICON[l.mode]} {legName(l.id)}
        </h3>
        <p className="muted">
          {l.depart}
          {l.arrive && ` – ${l.arrive}`}
          {l.carrier && ` · ${l.carrier}`}
          {!l.booked && ' · nog niet geboekt'}
        </p>
        {l.notes && <p className="muted">{l.notes}</p>}
        <BookingChips booking={l.booking} />
      </section>
    )
  }
  const a = b.act
  return (
    <section className="focus">
      <small>
        {label} · {when}
      </small>
      <h3>{a.title}</h3>
      <p className="muted">
        {b.fixed ? '' : '± '}
        {fromMin(b.start)} – {fromMin(b.end)}
        {a.place?.name && a.place.name !== a.title && ` · ${a.place.name}`}
      </p>
      {a.notes && <p className="muted">{a.notes}</p>}
      <div className="row">
        <NavLink to={a.place} label="Route ernaartoe" />
      </div>
      <BookingChips booking={a.booking} />
    </section>
  )
}
