import { useState } from 'react'
import type { Stop, Trip } from '../types'
import { useStore } from '../store'
import { STOP_COLORS, fmtMoney, sortStops, uid } from '../lib/plan'
import { addDays, dateRange, daysBetween, fmtDay, fmtShort } from '../lib/dates'
import { StopForm } from './forms'
import { Empty, Field } from './ui'

export function RouteView({ trip }: { trip: Trip }) {
  const update = useStore((s) => s.update)
  const [editing, setEditing] = useState<{ stop: Stop; isNew: boolean } | null>(null)
  const stops = sortStops(trip.stops)

  // Nachten zonder verblijf of met dubbele boeking.
  const nights = dateRange(trip.startDate, addDays(trip.endDate, -1))
  const uncovered = nights.filter((n) => !stops.some((s) => s.start <= n && n < s.end))
  const double = nights.filter((n) => stops.filter((s) => s.start <= n && n < s.end).length > 1)
  const outside = stops.filter((s) => s.start < trip.startDate || s.end > trip.endDate)

  const addStop = () => {
    const last = stops[stops.length - 1]
    const start = last ? last.end : trip.startDate
    const end = addDays(start, 2) > trip.endDate ? trip.endDate : addDays(start, 2)
    setEditing({
      stop: {
        id: uid(),
        city: '',
        start,
        end: end > start ? end : addDays(start, 1),
        stayCurrency: 'JPY',
        booked: false,
        color: STOP_COLORS[trip.stops.length % STOP_COLORS.length],
      },
      isNew: true,
    })
  }

  return (
    <div className="route">
      <TripSettings trip={trip} />

      <div className="section-head">
        <h2>Route &amp; verblijven</h2>
        <button className="btn primary" onClick={addStop}>+ Stop toevoegen</button>
      </div>

      {(uncovered.length > 0 || double.length > 0 || outside.length > 0) && stops.length > 0 && (
        <div className="notice warn">
          {uncovered.length > 0 && (
            <div>
              🛏️ Nog geen verblijf voor {uncovered.length} {uncovered.length === 1 ? 'nacht' : 'nachten'}:{' '}
              {uncovered.map(fmtShort).join(', ')}
            </div>
          )}
          {double.length > 0 && <div>⚠️ Dubbele overnachting op {double.map(fmtShort).join(', ')}</div>}
          {outside.length > 0 && <div>📅 {outside.map((s) => s.city).join(', ')} valt buiten je reisdatums</div>}
        </div>
      )}

      {stops.length === 0 ? (
        <Empty title="Nog geen route">
          Voeg de steden toe waar je overnacht, bijvoorbeeld Tokyo → Kyoto → Osaka. Je planning per dag vult zich dan
          automatisch met de juiste stad.
        </Empty>
      ) : (
        <ol className="timeline">
          {stops.map((s, i) => {
            const n = daysBetween(s.start, s.end)
            const prev = stops[i - 1]
            return (
              <li key={s.id} style={{ '--stop': s.color } as React.CSSProperties}>
                {prev && prev.end === s.start && (
                  <div className="leg">🚄 {prev.city} → {s.city} · {fmtDay(s.start)}</div>
                )}
                <button className="stop-card" onClick={() => setEditing({ stop: s, isNew: false })}>
                  <div className="stop-dot" />
                  <div className="stop-main">
                    <h3>{s.city}</h3>
                    <small>
                      {fmtDay(s.start)} – {fmtDay(s.end)} · {n} {n === 1 ? 'nacht' : 'nachten'}
                    </small>
                  </div>
                  <div className="stop-stay">
                    {s.stayName ? (
                      <>
                        <strong>{s.stayName}</strong>
                        <small>
                          {s.checkIn && `in ${s.checkIn}`}
                          {s.checkOut && ` · uit ${s.checkOut}`}
                          {s.stayCost ? ` · ${fmtMoney(s.stayCost, s.stayCurrency)}` : ''}
                        </small>
                      </>
                    ) : (
                      <small className="muted">Nog geen verblijf</small>
                    )}
                  </div>
                  <span className={'badge ' + (s.booked ? 'ok' : 'todo')}>{s.booked ? 'Geboekt' : 'Te boeken'}</span>
                </button>
              </li>
            )
          })}
        </ol>
      )}

      {editing && (
        <StopForm
          initial={editing.stop}
          onClose={() => setEditing(null)}
          onDelete={
            editing.isNew
              ? undefined
              : () => {
                  update((t) => {
                    t.stops = t.stops.filter((x) => x.id !== editing.stop.id)
                  })
                  setEditing(null)
                }
          }
          onSave={(s) => {
            update((t) => {
              const old = t.stops.find((x) => x.id === s.id)
              if (old) Object.assign(old, s)
              else t.stops.push(s)
            })
            setEditing(null)
          }}
        />
      )}
    </div>
  )
}

function TripSettings({ trip }: { trip: Trip }) {
  const update = useStore((s) => s.update)
  const set = (fn: (t: Trip) => void) => update(fn)
  return (
    <details className="card settings">
      <summary>
        <strong>Reisgegevens</strong>
        <small className="muted">
          {fmtDay(trip.startDate)} – {fmtDay(trip.endDate)} · {trip.travelers} reizigers · €1 = ¥{trip.jpyPerEur}
        </small>
      </summary>
      <div className="form-grid">
        <Field label="Naam van de reis" wide>
          <input value={trip.name} onChange={(e) => set((t) => void (t.name = e.target.value))} />
        </Field>
        <Field label="Vertrek">
          <input
            type="date"
            value={trip.startDate}
            onChange={(e) => e.target.value && set((t) => void (t.startDate = e.target.value))}
          />
        </Field>
        <Field label="Terug">
          <input
            type="date"
            value={trip.endDate}
            min={trip.startDate}
            onChange={(e) => e.target.value && set((t) => void (t.endDate = e.target.value))}
          />
        </Field>
        <Field label="Reizigers">
          <input
            type="number"
            min={1}
            value={trip.travelers}
            onChange={(e) => set((t) => void (t.travelers = Math.max(1, Number(e.target.value) || 1)))}
          />
        </Field>
        <Field label="Wisselkoers (¥ per €1)">
          <input
            type="number"
            min={1}
            value={trip.jpyPerEur}
            onChange={(e) => set((t) => void (t.jpyPerEur = Number(e.target.value) || 1))}
          />
        </Field>
      </div>
    </details>
  )
}
