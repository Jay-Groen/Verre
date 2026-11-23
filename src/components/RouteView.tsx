import { useState } from 'react'
import type { Leg, Stop, Trip } from '../types'
import { MODE_ICON } from '../types'
import { fmtDuration, legHours, legSlots, needsLeg, newLeg, type LegSlot } from '../lib/legs'
import { removeBookingFiles } from '../lib/files'
import { useStore } from '../store'
import { STOP_COLORS, fmtMoney, sortStops, uid } from '../lib/plan'
import { addDays, dateRange, daysBetween, fmtDay, fmtShort } from '../lib/dates'
import { LegForm, StopForm } from './forms'
import { CurrencyFields } from './CurrencyFields'
import { currencySymbol } from '../lib/currency'
import { Empty, Field } from './ui'

export function RouteView({ trip }: { trip: Trip }) {
  const update = useStore((s) => s.update)
  const [editing, setEditing] = useState<{ stop: Stop; isNew: boolean } | null>(null)
  const [editLeg, setEditLeg] = useState<{ slot: LegSlot; leg: Leg; isNew: boolean } | null>(null)
  const stops = sortStops(trip.stops)
  const slots = legSlots(trip)
  const openLeg = (slot: LegSlot) =>
    setEditLeg(slot.leg ? { slot, leg: slot.leg, isNew: false } : { slot, leg: newLeg(trip, slot), isNew: true })

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
        stayCurrency: trip.localCurrency,
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
          Voeg de steden toe waar je overnacht, bijvoorbeeld Lissabon → Porto → Madrid. Je planning per dag vult zich dan
          automatisch met de juiste stad.
        </Empty>
      ) : (
        <ol className="timeline">
          {stops.map((s) => {
            const n = daysBetween(s.start, s.end)
            const slot = slots.find((x) => x.toId === s.id)!
            return (
              <li key={s.id} style={{ '--stop': s.color } as React.CSSProperties}>
                <LegRow slot={slot} onOpen={() => openLeg(slot)} />
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
                  <span className={'badge ' + (s.booked ? 'ok' : 'todo')}>
                    {s.booked ? 'Geboekt' : 'Te boeken'}
                    {s.booking?.files?.length ? ' · 📎' : ''}
                  </span>
                </button>
              </li>
            )
          })}
          <li>
            <LegRow slot={slots[slots.length - 1]} onOpen={() => openLeg(slots[slots.length - 1])} />
            <div className="home-end">🏠 Thuis</div>
          </li>
        </ol>
      )}

      {editLeg && (
        <LegForm
          trip={trip}
          slot={editLeg.slot}
          initial={editLeg.leg}
          onClose={() => setEditLeg(null)}
          onDelete={
            editLeg.isNew
              ? undefined
              : () => {
                  removeBookingFiles(editLeg.leg.booking)
                  update((t) => void (t.legs = t.legs.filter((x) => x.id !== editLeg.leg.id)))
                  setEditLeg(null)
                }
          }
          onSave={(l) => {
            update((t) => {
              t.legs = t.legs.filter((x) => x.id !== l.id && x.toId !== l.toId)
              t.legs.push(l)
            })
            setEditLeg(null)
          }}
        />
      )}

      {editing && (
        <StopForm
          trip={trip}
          initial={editing.stop}
          onClose={() => setEditing(null)}
          onDelete={
            editing.isNew
              ? undefined
              : () => {
                  removeBookingFiles(editing.stop.booking)
                  const leg = trip.legs.find((l) => l.toId === editing.stop.id)
                  removeBookingFiles(leg?.booking)
                  update((t) => {
                    t.stops = t.stops.filter((x) => x.id !== editing.stop.id)
                    t.legs = t.legs.filter((l) => l.toId !== editing.stop.id)
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

function LegRow({ slot, onOpen }: { slot: LegSlot; onOpen: () => void }) {
  const l = slot.leg
  if (!l) {
    if (!needsLeg(slot)) return <div className="leg" />
    return (
      <div className="leg">
        <button className="leg-add" onClick={onOpen}>
          + Vervoer {slot.fromName} → {slot.toName}
        </button>
      </div>
    )
  }
  const h = legHours(l)
  return (
    <div className="leg">
      <button className="leg-card" onClick={onOpen}>
        <span className="leg-icon" aria-hidden>{MODE_ICON[l.mode]}</span>
        <span className="leg-main">
          <strong>
            {slot.fromName} → {slot.toName}
          </strong>
          <small>
            {fmtDay(l.date)}
            {l.depart && ` · ${l.depart}`}
            {l.arrive && ` – ${l.arrive}`}
            {h !== undefined && ` (${fmtDuration(h)})`}
            {l.carrier && ` · ${l.carrier}`}
            {l.cost ? ` · ${fmtMoney(l.cost, l.currency)}` : ''}
          </small>
        </span>
        <span className={'badge ' + (l.booked ? 'ok' : 'todo')}>
          {l.booked ? 'Geboekt' : 'Te boeken'}
          {l.booking?.files?.length ? ' · 📎' : ''}
        </span>
      </button>
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
          {fmtDay(trip.startDate)} – {fmtDay(trip.endDate)} · {trip.travelers} reizigers
          {trip.localCurrency !== trip.homeCurrency &&
            ` · ${currencySymbol(trip.homeCurrency)} 1 = ${currencySymbol(trip.localCurrency)} ${trip.rate}`}
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
        <CurrencyFields value={trip} onChange={(v) => set((t) => void Object.assign(t, v))} />
      </div>
    </details>
  )
}
