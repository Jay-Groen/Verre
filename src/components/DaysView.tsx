import { useMemo, useState } from 'react'
import type { Activity, Trip } from '../types'
import { useStore } from '../store'
import { buildDays, fitIdea, fmtHome, fmtHours, fmtMoney, norm, toHome, type DayInfo } from '../lib/plan'
import { fmtLong } from '../lib/dates'
import { moveActivity, newActivity, planIdea } from '../lib/actions'
import { ActivityForm } from './forms'
import { Empty } from './ui'

const DRAG_ACT = 'application/x-activity'
const DRAG_IDEA = 'application/x-idea'

export function DaysView({ trip, onGoRoute }: { trip: Trip; onGoRoute: () => void }) {
  const update = useStore((s) => s.update)
  const days = useMemo(() => buildDays(trip), [trip])
  const [editing, setEditing] = useState<{ act: Activity; isNew: boolean } | null>(null)
  const [openIdeas, setOpenIdeas] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState<string | null>(null)

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
        const over = d.loadH > d.capacityH
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
                  {d.travelFrom && (
                    <span className="chip travel">
                      🚄 {d.travelFrom.city} → {d.stop?.city}
                    </span>
                  )}
                  {d.goingHome && <span className="chip travel">✈️ Terugreis</span>}
                  {d.index === 0 && <span className="chip travel">✈️ Aankomst</span>}
                  {!d.stop && !d.goingHome && <span className="chip warn">Geen verblijf gepland</span>}
                </div>
              </div>
              <div className={'load' + (over ? ' over' : '')} title="Geplande uren t.o.v. wat haalbaar is">
                <div className="bar">
                  <span style={{ width: `${Math.min(100, (d.loadH / d.capacityH) * 100)}%` }} />
                </div>
                <small>
                  {fmtHours(d.loadH)} / {fmtHours(d.capacityH)}
                  {over && ' · te vol'}
                </small>
              </div>
            </header>

            <ol className="acts">
              {d.activities.map((a) => (
                <li
                  key={a.id}
                  className="act"
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData(DRAG_ACT, a.id)
                    e.dataTransfer.effectAllowed = 'move'
                  }}
                  onDrop={(e) => onDrop(e, d.date, a.id)}
                  onClick={() => setEditing({ act: a, isNew: false })}
                >
                  <span className="grip" aria-hidden>⋮⋮</span>
                  <span className="time">{a.time ?? '—'}</span>
                  <span className="act-title">
                    {a.title}
                    {a.ideaId && <span className="tag">idee</span>}
                    {a.place?.lat !== undefined && <span className="pin" title="Op de kaart">📍</span>}
                  </span>
                  <span className="meta">
                    {fmtHours(a.durationH)}
                    {a.cost ? ` · ${fmtMoney(a.cost, a.currency)}` : ''}
                  </span>
                </li>
              ))}
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
              <span className="spacer" />
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
