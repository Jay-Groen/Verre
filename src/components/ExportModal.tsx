import { useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import type { Trip } from '../types'
import { MODE_ICON } from '../types'
import { buildDays, fmtHome, fmtMoney, sortStops, toHome } from '../lib/plan'
import { daysBetween, fmtDay, fmtLong } from '../lib/dates'
import { fmtDuration, fromMin, legHours, legSlots } from '../lib/legs'
import { scheduleDay } from '../lib/schedule'
import { download, safeFileName, tripToIcs } from '../lib/ics'
import { Modal } from './ui'

export function ExportModal({ trip, onClose, onPrint }: { trip: Trip; onClose: () => void; onPrint: () => void }) {
  return (
    <Modal title="Exporteren" onClose={onClose}>
      <div className="export-options">
        <button
          className="export-option"
          onClick={() => {
            download(`${safeFileName(trip.name)}.ics`, tripToIcs(trip), 'text/calendar;charset=utf-8')
            onClose()
          }}
        >
          <span aria-hidden>📅</span>
          <span>
            <strong>Naar je agenda</strong>
            <small className="muted">
              Een .ics-bestand met verblijven, vervoer en activiteiten. Open het om alles in Google Agenda, Apple Agenda of
              Outlook te zetten.
            </small>
          </span>
        </button>
        <button
          className="export-option"
          onClick={() => {
            onClose()
            onPrint()
          }}
        >
          <span aria-hidden>🖨️</span>
          <span>
            <strong>Reisgids printen of als PDF</strong>
            <small className="muted">Route, planning per dag en boekingscodes op papier. Kies “Opslaan als PDF” om hem op je telefoon te zetten.</small>
          </span>
        </button>
      </div>
    </Modal>
  )
}

/** Printbare reisgids. Wordt los van de app getoond en opent meteen het printvenster. */
export function PrintGuide({ trip, onClose }: { trip: Trip; onClose: () => void }) {
  const days = useMemo(() => buildDays(trip), [trip])
  const slots = useMemo(() => legSlots(trip), [trip])
  const stops = sortStops(trip.stops)

  useEffect(() => {
    document.body.classList.add('printing')
    const t = setTimeout(() => window.print(), 300)
    return () => {
      clearTimeout(t)
      document.body.classList.remove('printing')
    }
  }, [])

  const legName = (id: string) => {
    const s = slots.find((x) => x.leg?.id === id)
    return s ? `${s.fromName} → ${s.toName}` : ''
  }
  const total =
    trip.expenses.reduce((n, e) => n + toHome(e.amount, e.currency, trip), 0) +
    trip.stops.reduce((n, s) => n + (s.stayCost ? toHome(s.stayCost, s.stayCurrency, trip) : 0), 0) +
    trip.legs.reduce((n, l) => n + (l.cost ? toHome(l.cost, l.currency, trip) : 0), 0) +
    trip.activities.reduce((n, a) => n + (a.cost ? toHome(a.cost, a.currency, trip) * trip.travelers : 0), 0)

  return createPortal(
    <div className="print-guide">
      <div className="print-bar no-print">
        <button className="btn primary" onClick={() => window.print()}>
          🖨️ Printen / PDF
        </button>
        <button className="btn ghost" onClick={onClose}>
          Sluiten
        </button>
      </div>

      <header className="pg-head">
        <img src="/favicon.svg" alt="" />
        <div>
          <h1>{trip.name}</h1>
          <p>
            {fmtLong(trip.startDate)} – {fmtLong(trip.endDate)} · {daysBetween(trip.startDate, trip.endDate) + 1} dagen ·{' '}
            {trip.travelers} reizigers · begroot {fmtHome(total, trip)}
          </p>
        </div>
      </header>

      <section>
        <h2>Route</h2>
        <table className="pg-table">
          <tbody>
            {slots.map((s) => {
              const stop = stops.find((x) => x.id === s.toId)
              const l = s.leg
              const h = legHours(l)
              return (
                <tr key={s.toId}>
                  <td className="pg-when">{l ? fmtDay(l.date) : stop ? fmtDay(stop.start) : ''}</td>
                  <td>
                    {l ? (
                      <>
                        {MODE_ICON[l.mode]} {s.fromName} → {s.toName}
                        {l.depart && ` · ${l.depart}${l.arrive ? `–${l.arrive}` : ''}`}
                        {h !== undefined && ` (${fmtDuration(h)})`}
                        {l.carrier && ` · ${l.carrier}`}
                        {l.booking?.ref && <code> {l.booking.ref}</code>}
                      </>
                    ) : (
                      <span className="pg-muted">
                        {s.fromName} → {s.toName}
                      </span>
                    )}
                    {stop && (
                      <div>
                        🛏️ <strong>{stop.city}</strong>, {daysBetween(stop.start, stop.end)} {daysBetween(stop.start, stop.end) === 1 ? 'nacht' : 'nachten'} · {stop.stayName ?? 'nog geen verblijf'}
                        {stop.stayAddress && `, ${stop.stayAddress}`}
                        {stop.checkIn && ` · in ${stop.checkIn}`}
                        {stop.checkOut && ` / uit ${stop.checkOut}`}
                        {stop.booking?.ref && <code> {stop.booking.ref}</code>}
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </section>

      <section>
        <h2>Planning per dag</h2>
        {days.map((d) => {
          const plan = scheduleDay(d)
          return (
            <div key={d.date} className="pg-day">
              <h3>
                Dag {d.index + 1} · {fmtLong(d.date)}
                {d.stop && <span className="pg-muted"> · {d.stop.city}</span>}
              </h3>
              {plan.entries.length === 0 ? (
                <p className="pg-muted">Vrije dag</p>
              ) : (
                <ul>
                  {plan.entries.map((e, i) =>
                    e.kind === 'move' ? null : e.kind === 'leg' ? (
                      <li key={i}>
                        <span className="pg-time">{fromMin(e.start)}</span>
                        {MODE_ICON[e.leg.mode]} {legName(e.leg.id)}
                        {e.leg.carrier && ` · ${e.leg.carrier}`}
                      </li>
                    ) : (
                      <li key={i}>
                        <span className="pg-time">
                          {e.fixed ? '' : '~'}
                          {fromMin(e.start)}
                        </span>
                        <strong>{e.act.title}</strong>
                        {e.act.place?.name && e.act.place.name !== e.act.title && ` · ${e.act.place.name}`}
                        {e.act.cost ? ` · ${fmtMoney(e.act.cost, e.act.currency)} p.p.` : ''}
                        {e.act.booking?.ref && <code> {e.act.booking.ref}</code>}
                        {e.act.notes && <div className="pg-note">{e.act.notes}</div>}
                      </li>
                    ),
                  )}
                </ul>
              )}
            </div>
          )
        })}
      </section>

      <footer className="pg-foot">Gemaakt met Verre</footer>
    </div>,
    document.body,
  )
}
