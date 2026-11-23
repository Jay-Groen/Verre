import { useEffect, useState } from 'react'
import type { Activity, Booking, Leg, Stop, Trip } from '../types'
import { MODE_ICON } from '../types'
import { useStore } from '../store'
import { fmtMoney, sortStops } from '../lib/plan'
import { daysBetween, fmtDay, todayIso } from '../lib/dates'
import { legSlots, needsLeg, newLeg, type LegSlot } from '../lib/legs'
import { deleteStop, saveActivity, saveLeg, saveStop } from '../lib/actions'
import { allFiles, makeOffline, offlineStatus, openFile, removeBookingFiles } from '../lib/files'
import { ActivityForm, LegForm, StopForm } from './forms'
import { Empty } from './ui'

interface Item {
  key: string
  kind: 'stay' | 'leg' | 'activity'
  icon: string
  title: string
  sub: string
  date: string
  booked: boolean
  /** Er is nog helemaal niets ingevuld (bijv. vervoer zonder gegevens). */
  missing?: boolean
  cost?: string
  booking?: Booking
  open: () => void
}

type Editing =
  | { kind: 'stay'; stop: Stop }
  | { kind: 'leg'; slot: LegSlot; leg: Leg; isNew: boolean }
  | { kind: 'activity'; act: Activity }

export function BookingsView({ trip }: { trip: Trip }) {
  const update = useStore((s) => s.update)
  const [editing, setEditing] = useState<Editing | null>(null)
  const today = todayIso()

  const items: Item[] = [
    ...sortStops(trip.stops).map(
      (s): Item => ({
        key: s.id,
        kind: 'stay',
        icon: '🛏️',
        title: s.stayName ?? `Verblijf in ${s.city}`,
        sub: `${s.city} · ${fmtDay(s.start)} – ${fmtDay(s.end)}`,
        date: s.start,
        booked: s.booked,
        missing: !s.stayName,
        cost: s.stayCost ? fmtMoney(s.stayCost, s.stayCurrency) : undefined,
        booking: s.booking,
        open: () => setEditing({ kind: 'stay', stop: s }),
      }),
    ),
    ...legSlots(trip)
      .filter((x) => x.leg || needsLeg(x))
      .map((x): Item => {
        const l = x.leg
        return {
          key: 'leg' + x.toId,
          kind: 'leg',
          icon: l ? MODE_ICON[l.mode] : '🧭',
          title: `${x.fromName} → ${x.toName}`,
          sub: l
            ? [fmtDay(l.date), l.depart && `${l.depart}${l.arrive ? `–${l.arrive}` : ''}`, l.carrier].filter(Boolean).join(' · ')
            : `${fmtDay(x.date)} · nog geen vervoer ingevuld`,
          date: l?.date ?? x.date,
          booked: !!l?.booked,
          missing: !l,
          cost: l?.cost ? fmtMoney(l.cost, l.currency) : undefined,
          booking: l?.booking,
          open: () => setEditing({ kind: 'leg', slot: x, leg: l ?? newLeg(trip, x), isNew: !l }),
        }
      }),
    ...trip.activities
      .filter((a) => a.reserve)
      .map(
        (a): Item => ({
          key: a.id,
          kind: 'activity',
          icon: '🎟️',
          title: a.title,
          sub: `${fmtDay(a.date)}${a.time ? ` · ${a.time}` : ''}`,
          date: a.date,
          booked: a.reserve === 'booked',
          cost: a.cost ? `${fmtMoney(a.cost, a.currency)} p.p.` : undefined,
          booking: a.booking,
          open: () => setEditing({ kind: 'activity', act: a }),
        }),
      ),
  ]

  const byUrgency = (a: Item, b: Item) =>
    (a.booking?.deadline ?? '9999').localeCompare(b.booking?.deadline ?? '9999') || a.date.localeCompare(b.date)
  const todo = items.filter((i) => !i.booked).sort(byUrgency)
  const done = items.filter((i) => i.booked).sort((a, b) => a.date.localeCompare(b.date))
  const files = items.reduce((n, i) => n + (i.booking?.files?.length ?? 0), 0)

  if (items.length === 0)
    return (
      <Empty title="Nog niets te boeken">
        Voeg verblijven en vervoer toe bij Route &amp; verblijven, of zet bij een activiteit “Reserveren” aan. Ze
        verschijnen dan hier, met je bevestigingen en tickets bij elkaar.
      </Empty>
    )

  return (
    <div className="bookings">
      <div className="ideas-top">
        <div className="stat-row">
          <div className="stat warn">
            <strong>{todo.length}</strong> nog te boeken
          </div>
          <div className="stat ok">
            <strong>{done.length}</strong> geboekt
          </div>
          <div className="stat info">
            <strong>{files}</strong> {files === 1 ? 'bijlage' : 'bijlagen'}
          </div>
        </div>
        <div className="bar wide" title={`${done.length} van ${items.length} geboekt`}>
          <span style={{ width: `${(done.length / items.length) * 100}%` }} />
        </div>
      </div>
      <OfflineFiles trip={trip} />

      {todo.length > 0 && (
        <section className="booking-group">
          <h2>Nog te boeken</h2>
          <ul className="booking-list">
            {todo.map((i) => (
              <BookingRow key={i.key} item={i} today={today} />
            ))}
          </ul>
        </section>
      )}
      {done.length > 0 && (
        <section className="booking-group">
          <h2>Geboekt</h2>
          <ul className="booking-list">
            {done.map((i) => (
              <BookingRow key={i.key} item={i} today={today} />
            ))}
          </ul>
        </section>
      )}

      {editing?.kind === 'stay' && (
        <StopForm
          trip={trip}
          initial={editing.stop}
          onClose={() => setEditing(null)}
          onDelete={() => {
            removeBookingFiles(editing.stop.booking)
            update((t) => deleteStop(t, editing.stop.id))
            setEditing(null)
          }}
          onSave={(s) => {
            update((t) => saveStop(t, s))
            setEditing(null)
          }}
        />
      )}
      {editing?.kind === 'leg' && (
        <LegForm
          trip={trip}
          slot={editing.slot}
          initial={editing.leg}
          onClose={() => setEditing(null)}
          onDelete={
            editing.isNew
              ? undefined
              : () => {
                  removeBookingFiles(editing.leg.booking)
                  update((t) => void (t.legs = t.legs.filter((x) => x.id !== editing.leg.id)))
                  setEditing(null)
                }
          }
          onSave={(l) => {
            update((t) => saveLeg(t, l))
            setEditing(null)
          }}
        />
      )}
      {editing?.kind === 'activity' && (
        <ActivityForm
          trip={trip}
          initial={editing.act}
          onClose={() => setEditing(null)}
          onDelete={() => {
            removeBookingFiles(editing.act.booking)
            update((t) => void (t.activities = t.activities.filter((x) => x.id !== editing.act.id)))
            setEditing(null)
          }}
          onSave={(a) => {
            update((t) => saveActivity(t, a))
            setEditing(null)
          }}
        />
      )}
    </div>
  )
}

function BookingRow({ item: i, today }: { item: Item; today: string }) {
  const dl = i.booking?.deadline
  const left = dl ? daysBetween(today, dl) : undefined
  return (
    <li className={'booking' + (i.booked ? ' booked' : '')}>
      <button className="booking-main" onClick={i.open}>
        <span className="booking-icon" aria-hidden>
          {i.icon}
        </span>
        <span className="booking-text">
          <strong>{i.title}</strong>
          <small>
            {i.sub}
            {i.cost && ` · ${i.cost}`}
          </small>
        </span>
        {!i.booked && left !== undefined && (
          <span className={'badge ' + (left < 0 ? 'late' : left <= 14 ? 'todo' : 'soft')}>
            {left < 0 ? `deadline ${fmtDay(dl!)} verlopen` : left === 0 ? 'vandaag boeken' : `vóór ${fmtDay(dl!)}`}
          </span>
        )}
        {i.booked && i.booking?.ref && <code className="ref">{i.booking.ref}</code>}
        {!i.booked && (
          <span className="badge todo">{i.missing ? 'invullen' : 'te boeken'}</span>
        )}
      </button>
      {(i.booking?.files?.length || i.booking?.url) && (
        <div className="booking-files">
          {i.booking.files?.map((f) => (
            <button key={f.id} className="file-chip" onClick={() => openFile(f)} title={`${f.name} openen`}>
              {f.type.includes('pdf') ? '📄' : f.type.startsWith('image/') ? '🖼️' : '📎'} {f.name}
            </button>
          ))}
          {i.booking.url && (
            <a className="file-chip" href={i.booking.url} target="_blank" rel="noreferrer">
              🔗 Boeking openen
            </a>
          )}
        </div>
      )}
    </li>
  )
}

/** Zet alle bijlagen uit je account op dit apparaat, zodat je ze onderweg zonder internet kunt openen. */
function OfflineFiles({ trip }: { trip: Trip }) {
  const files = allFiles(trip)
  const key = files.map((f) => f.id).join()
  const [state, setState] = useState<{ total: number; have: number } | null>(null)
  const [busy, setBusy] = useState<number | null>(null)
  const [error, setError] = useState<string>()
  useEffect(() => {
    offlineStatus(files).then(setState)
    // files is afgeleid van key
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!state || state.total === 0) return null
  const all = state.have >= state.total
  return (
    <div className={'notice offline-files' + (all ? ' done' : '')}>
      {all ? (
        <span>📴 Alle {state.total} bijlagen staan op dit apparaat en werken ook zonder internet.</span>
      ) : (
        <>
          <span>
            📴 {state.have} van {state.total} bijlagen staan op dit apparaat. Download ze vóór vertrek, dan heb je je tickets
            ook zonder internet.
          </span>
          <button
            className="btn small primary"
            disabled={busy !== null}
            onClick={async () => {
              setBusy(0)
              setError(undefined)
              try {
                await makeOffline(files, setBusy)
              } catch (e) {
                setError((e as Error).message)
              }
              setBusy(null)
              setState(await offlineStatus(files))
            }}
          >
            {busy !== null ? `Bezig… ${busy}/${state.total}` : 'Bewaar op dit apparaat'}
          </button>
        </>
      )}
      {error && <small className="warn-text">{error}</small>}
    </div>
  )
}
