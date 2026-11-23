import { useMemo, useState } from 'react'
import type { Activity, Trip } from '../types'
import { useStore } from '../store'
import { buildDays, fitIdea, fmtHome, fmtHours, fmtMoney, norm, toHome, type DayInfo } from '../lib/plan'
import { fmtLong } from '../lib/dates'
import { moveActivity, newActivity, planIdea } from '../lib/actions'
import { ActivityForm } from './forms'
import { MODE_ICON } from '../types'
import { fmtDuration, fromMin, legSlots } from '../lib/legs'
import { scheduleDay, sortDayByTime } from '../lib/schedule'
import { removeBookingFiles } from '../lib/files'
import { useWeather, weatherIcon, weatherTitle } from '../lib/weather'
import { checkHours } from '../lib/hours'
import { Empty } from './ui'

const DRAG_ACT = 'application/x-activity'
const DRAG_IDEA = 'application/x-idea'

export function DaysView({ trip, onGoRoute }: { trip: Trip; onGoRoute: () => void }) {
  const update = useStore((s) => s.update)
  const days = useMemo(() => buildDays(trip), [trip])
  const slots = useMemo(() => legSlots(trip), [trip])
  const legName = (id: string) => {
    const x = slots.find((y) => y.leg?.id === id)
    return x ? `${x.fromName} → ${x.toName}` : ''
  }
  const outbound = slots[0]?.leg
  const [editing, setEditing] = useState<{ act: Activity; isNew: boolean } | null>(null)
  const [openIdeas, setOpenIdeas] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState<string | null>(null)
  const weather = useWeather(trip)

  if (days.length === 0)
    return <Empty title="Geen dagen">Stel eerst de begin- en einddatum van je reis in.</Empty>

  const onDrop = (e: React.DragEvent, date: string, beforeId?: string) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(null)
    const actId = e.dataTransfer.getData(DRAG_ACT)
    const ideaId = e.dataTransfer.getData(DRAG_IDEA)
    if (actId) update((t) => moveActivity(t, actId, date, beforeId))
    else if (ideaId) update((t) => planIdea(t, ideaId, date))
  }

  const openIdeasFor = (d: DayInfo) =>
    trip.ideas.filter((i) => {
      const f = fitIdea(i, trip, days)
      return (f.kind === 'fits' || f.kind === 'full') && norm(i.city) === norm(d.stop?.city)
    })

  return (
    <div className="days">
      {trip.stops.length === 0 && (
        <div className="notice">
          Tip: voeg eerst je <button className="link" onClick={onGoRoute}>route &amp; verblijven</button> toe,
          dan zie je per dag in welke stad je bent en welke ideeën daar passen.
        </div>
      )}
      {days.map((d) => {
        const plan = scheduleDay(d)
        const busyH = d.loadH + plan.moveMin / 60
        const over = busyH > d.capacityH
        const travelLeg = d.legs[0]
        const suggestions = openIdeasFor(d)
        const dayCost = d.activities.reduce(
          (n, a) => n + (a.cost ? toHome(a.cost, a.currency, trip) : 0),
          0,
        )
        return (
          <section
            key={d.date}
            className={'day' + (dragOver === d.date ? ' drag-over' : '')}
            style={{ '--stop': d.stop?.color ?? 'var(--line)' } as React.CSSProperties}
            onDragOver={(e) => {
              e.preventDefault()
              setDragOver(d.date)
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(null)
            }}
            onDrop={(e) => onDrop(e, d.date)}
          >
            <header className="day-head">
              <div className="day-num">
                <small>Dag</small>
                <strong>{d.index + 1}</strong>
              </div>
              <div className="day-title">
                <h3>{fmtLong(d.date)}</h3>
                <div className="chips">
                  {d.stop && <span className="chip city">{d.stop.city}</span>}
                  {weather[d.date] && (
                    <span className={'chip weather ' + weather[d.date].kind} title={weatherTitle(weather[d.date])}>
                      {weatherIcon(weather[d.date].code)[0]} {Math.round(weather[d.date].tmax)}°
                      <small>/{Math.round(weather[d.date].tmin)}°</small>
                    </span>
                  )}
                  {d.travelFrom && (
                    <span className="chip travel">
                      {travelLeg ? MODE_ICON[travelLeg.mode] : '🧳'} {d.travelFrom.city} → {d.stop?.city}
                    </span>
                  )}
                  {d.goingHome && <span className="chip travel">{travelLeg ? MODE_ICON[travelLeg.mode] : '🏠'} Terugreis</span>}
                  {d.index === 0 && (
                    <span className="chip travel">
                      {outbound ? MODE_ICON[outbound.mode] : '✈️'} Aankomst{outbound?.arrive ? ` ${outbound.arrive}` : ''}
                    </span>
                  )}
                  {!d.stop && !d.goingHome && <span className="chip warn">Geen verblijf gepland</span>}
                </div>
              </div>
              <div className={'load' + (over ? ' over' : '')} title="Geplande uren t.o.v. wat haalbaar is">
                <div className="bar">
                  <span style={{ width: `${Math.min(100, (busyH / d.capacityH) * 100)}%` }} />
                </div>
                <small title={plan.moveMin ? `waarvan ${fmtDuration(plan.moveMin / 60)} onderweg` : undefined}>
                  {fmtHours(busyH)} / {fmtHours(d.capacityH)}
                  {over && ' · te vol'}
                </small>
              </div>
            </header>

            <ol className="acts">
              {d.legs
                .filter((l) => !l.depart)
                .map((l) => (
                  <li key={l.id} className="act leg-row">
                    <span className="grip" />
                    <span className="time">—</span>
                    <span className="act-title">
                      {MODE_ICON[l.mode]} {legName(l.id)}
                      {l.carrier && <small className="muted"> · {l.carrier}</small>}
                    </span>
                    <span className="meta">{l.booked ? 'geboekt' : 'nog boeken'}</span>
                  </li>
                ))}
              {plan.entries.map((e, i) => {
                if (e.kind === 'move')
                  return (
                    <li key={'m' + i} className="move" aria-label="Reistijd">
                      {e.mode === 'walk' ? '🚶' : '🚇'} ±{fmtDuration(e.minutes / 60)} ·{' '}
                      {e.km < 10 ? e.km.toFixed(1).replace('.', ',') : Math.round(e.km)} km
                    </li>
                  )
                if (e.kind === 'leg')
                  return (
                    <li key={e.leg.id} className="act leg-row">
                      <span className="grip" />
                      <span className="time">
                        {fromMin(e.start)}
                        <small>{fromMin(e.end)}</small>
                      </span>
                      <span className="act-title">
                        {MODE_ICON[e.leg.mode]} {legName(e.leg.id)}
                        {e.leg.carrier && <small className="muted"> · {e.leg.carrier}</small>}
                      </span>
                      <span className="meta">{e.leg.booked ? 'geboekt' : 'nog boeken'}</span>
                    </li>
                  )
                const a = e.act
                const hours = checkHours(a.place?.hours, d.date, e.start, e.end)
                return (
                  <li
                    key={a.id}
                    className={'act' + (e.conflict || hours?.closed ? ' conflict' : '')}
                    draggable
                    onDragStart={(ev) => {
                      ev.dataTransfer.setData(DRAG_ACT, a.id)
                      ev.dataTransfer.effectAllowed = 'move'
                    }}
                    onDrop={(ev) => onDrop(ev, d.date, a.id)}
                    onClick={() => setEditing({ act: a, isNew: false })}
                  >
                    <span className="grip" aria-hidden>⋮⋮</span>
                    <span className={'time' + (e.fixed ? '' : ' est')} title={e.fixed ? undefined : 'Geschatte tijd'}>
                      {e.fixed ? '' : '~'}
                      {fromMin(e.start)}
                      <small>{fromMin(e.end)}</small>
                    </span>
                    <span className="act-title">
                      {a.title}
                      {a.ideaId && <span className="tag">idee</span>}
                      {a.reserve === 'todo' && <span className="tag todo">reserveren</span>}
                      {a.reserve === 'booked' && <span className="tag ok">🎟️ geboekt</span>}
                      {a.place?.lat !== undefined && <span className="pin" title="Op de kaart">📍</span>}
                      {e.conflict && <small className="warn-text conflict-note">Te krap na het vorige onderdeel</small>}
                      {hours && (
                        <small className="warn-text conflict-note">
                          🕑 {hours.message}
                          {!e.fixed && !hours.closed ? ' (geschatte tijd)' : ''}
                        </small>
                      )}
                    </span>
                    <span className="meta">
                      {fmtHours(a.durationH)}
                      {a.cost ? ` · ${fmtMoney(a.cost, a.currency)}` : ''}
                    </span>
                  </li>
                )
              })}
              {d.activities.length === 0 && <li className="act-empty">Nog niets gepland — sleep hier een activiteit of idee heen.</li>}
            </ol>

            <footer className="day-foot">
              <button className="btn small" onClick={() => setEditing({ act: newActivity(trip, d.date), isNew: true })}>
                + Activiteit
              </button>
              {suggestions.length > 0 && (
                <button
                  className={'btn small ghost idea-toggle' + (openIdeas === d.date ? ' on' : '')}
                  onClick={() => setOpenIdeas(openIdeas === d.date ? null : d.date)}
                >
                  💡 {suggestions.length} {suggestions.length === 1 ? 'idee past' : 'ideeën passen'} in {d.stop?.city}
                </button>
              )}
              {plan.unsorted && (
                <button className="btn small ghost" onClick={() => update((t) => sortDayByTime(t, d.date))}>
                  ↕ Sorteer op tijd
                </button>
              )}
              <span className="spacer" />
              {plan.moveMin > 0 && <small className="muted">±{fmtDuration(plan.moveMin / 60)} onderweg</small>}
              {plan.end !== undefined && d.activities.length > 0 && (
                <small className="muted">klaar ±{fromMin(plan.end)}</small>
              )}
              {dayCost > 0 && <small className="muted">≈ {fmtHome(dayCost, trip)} p.p.</small>}
              {d.stop?.stayName && (
                <small className="muted">
                  🛏️ {d.stop.stayName}
                  {!d.stop.booked && ' (nog boeken)'}
                </small>
              )}
            </footer>

            {openIdeas === d.date && suggestions.length > 0 && (
              <ul className="suggestions">
                {suggestions.map((i) => {
                  const free = d.capacityH - d.loadH
                  return (
                    <li
                      key={i.id}
                      draggable
                      onDragStart={(e) => e.dataTransfer.setData(DRAG_IDEA, i.id)}
                    >
                      <span className="stars">{'★'.repeat(4 - i.priority)}</span>
                      <span className="grow">{i.title}</span>
                      <small className={i.durationH > free ? 'warn-text' : 'muted'}>{fmtHours(i.durationH)}</small>
                      <button className="btn small primary" onClick={() => update((t) => planIdea(t, i.id, d.date))}>
                        Plan hier
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        )
      })}

      {editing && (
        <ActivityForm
          trip={trip}
          initial={editing.act}
          onClose={() => setEditing(null)}
          onDelete={
            editing.isNew
              ? undefined
              : () => {
                  removeBookingFiles(editing.act.booking)
                  update((t) => {
                    t.activities = t.activities.filter((x) => x.id !== editing.act.id)
                  })
                  setEditing(null)
                }
          }
          onSave={(a) => {
            update((t) => {
              const old = t.activities.find((x) => x.id === a.id)
              if (old && old.date !== a.date) {
                Object.assign(old, a)
                moveActivity(t, a.id, a.date)
              } else if (old) Object.assign(old, a)
              else t.activities.push(a)
            })
            setEditing(null)
          }}
        />
      )}
    </div>
  )
}
