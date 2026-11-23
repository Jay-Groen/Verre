import { useState } from 'react'
import type { Activity, Idea, Leg, Stop, Trip } from '../types'
import { IDEA_CATEGORIES, MODE_ICON, TRANSPORT_MODES } from '../types'
import { BookingFields, cleanupRemoved, tidyBooking } from './BookingFields'
import { fmtDuration, legHours, type LegSlot } from '../lib/legs'
import { Field, Modal, MoneyInput, PlaceInput } from './ui'
import { buildDays, sortStops, tripCurrencies } from '../lib/plan'
import { fmtDay } from '../lib/dates'

function Footer({ onDelete, onCancel, canSave }: { onDelete?: () => void; onCancel: () => void; canSave: boolean }) {
  return (
    <>
      {onDelete && (
        <button type="button" className="btn danger ghost" onClick={onDelete}>
          Verwijderen
        </button>
      )}
      <span className="spacer" />
      <button type="button" className="btn ghost" onClick={onCancel}>
        Annuleren
      </button>
      <button type="submit" form="modal-form" className="btn primary" disabled={!canSave}>
        Opslaan
      </button>
    </>
  )
}

export function ActivityForm({
  trip,
  initial,
  onSave,
  onDelete,
  onClose,
}: {
  trip: Trip
  initial: Activity
  onSave: (a: Activity) => void
  onDelete?: () => void
  onClose: () => void
}) {
  const [a, setA] = useState(initial)
  const set = (p: Partial<Activity>) => setA((x) => ({ ...x, ...p }))
  const days = buildDays(trip)
  const city = days.find((d) => d.date === a.date)?.stop?.city
  return (
    <Modal
      title={onDelete ? 'Activiteit bewerken' : 'Nieuwe activiteit'}
      onClose={onClose}
      footer={<Footer onDelete={onDelete} onCancel={onClose} canSave={!!a.title.trim()} />}
    >
      <form
        id="modal-form"
        className="form-grid"
        onSubmit={(e) => {
          e.preventDefault()
          const booking = a.reserve ? tidyBooking(a.booking) : undefined
          cleanupRemoved(initial.booking, booking)
          onSave({ ...a, title: a.title.trim(), booking })
        }}
      >
        <Field label="Wat ga je doen?" wide>
          <input autoFocus value={a.title} onChange={(e) => set({ title: e.target.value })} />
        </Field>
        <Field label="Dag">
          <select value={a.date} onChange={(e) => set({ date: e.target.value })}>
            {days.map((d) => (
              <option key={d.date} value={d.date}>
                Dag {d.index + 1} · {fmtDay(d.date)} {d.stop ? `· ${d.stop.city}` : ''}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Tijd">
          <input type="time" value={a.time ?? ''} onChange={(e) => set({ time: e.target.value || undefined })} />
        </Field>
        <Field label="Duur (uur)">
          <input
            type="number"
            min={0}
            step={0.5}
            value={a.durationH}
            onChange={(e) => set({ durationH: Number(e.target.value) || 0 })}
          />
        </Field>
        <Field label="Kosten">
          <MoneyInput amount={a.cost} currency={a.currency} currencies={tripCurrencies(trip)} onChange={(cost, currency) => set({ cost, currency })} />
        </Field>
        <Field label="Locatie" wide>
          <PlaceInput value={a.place} context={city} onChange={(place) => set({ place })} />
        </Field>
        <Field label="Reserveren">
          <select
            value={a.reserve ?? ''}
            onChange={(e) => set({ reserve: (e.target.value || undefined) as Activity['reserve'] })}
          >
            <option value="">Niet nodig</option>
            <option value="todo">Nog reserveren</option>
            <option value="booked">Gereserveerd / ticket</option>
          </select>
        </Field>
        {a.reserve && <BookingFields value={a.booking} onChange={(booking) => set({ booking })} />}
        <Field label="Notities" wide>
          <textarea rows={3} value={a.notes ?? ''} onChange={(e) => set({ notes: e.target.value || undefined })} />
        </Field>
      </form>
    </Modal>
  )
}

export function IdeaForm({
  trip,
  initial,
  onSave,
  onDelete,
  onClose,
}: {
  trip: Trip
  initial: Idea
  onSave: (i: Idea) => void
  onDelete?: () => void
  onClose: () => void
}) {
  const [i, setI] = useState(initial)
  const set = (p: Partial<Idea>) => setI((x) => ({ ...x, ...p }))
  const cities = [...new Set(sortStops(trip.stops).map((s) => s.city))]
  return (
    <Modal
      title={onDelete ? 'Idee bewerken' : 'Nieuw idee'}
      onClose={onClose}
      footer={<Footer onDelete={onDelete} onCancel={onClose} canSave={!!i.title.trim()} />}
    >
      <form
        id="modal-form"
        className="form-grid"
        onSubmit={(e) => {
          e.preventDefault()
          onSave({ ...i, title: i.title.trim(), city: i.city?.trim() || undefined })
        }}
      >
        <Field label="Idee" wide>
          <input
            autoFocus
            value={i.title}
            placeholder="Bijv. sushi-ontbijt bij de vismarkt"
            onChange={(e) => set({ title: e.target.value })}
          />
        </Field>
        <Field label="Stad / regio">
          <input
            list="idea-cities"
            value={i.city ?? ''}
            placeholder="Kies of typ een stad"
            onChange={(e) => set({ city: e.target.value })}
          />
          <datalist id="idea-cities">
            {cities.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Field>
        <Field label="Soort">
          <select value={i.category} onChange={(e) => set({ category: e.target.value as Idea['category'] })}>
            {IDEA_CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
        <Field label="Hoe graag?">
          <select value={i.priority} onChange={(e) => set({ priority: Number(e.target.value) as Idea['priority'] })}>
            <option value={1}>★★★ Must-do</option>
            <option value={2}>★★ Graag</option>
            <option value={3}>★ Als er tijd is</option>
          </select>
        </Field>
        <Field label="Duur (uur)">
          <input
            type="number"
            min={0}
            step={0.5}
            value={i.durationH}
            onChange={(e) => set({ durationH: Number(e.target.value) || 0 })}
          />
        </Field>
        <Field label="Geschatte kosten">
          <MoneyInput amount={i.cost} currency={i.currency} currencies={tripCurrencies(trip)} onChange={(cost, currency) => set({ cost, currency })} />
        </Field>
        <Field label="Link (blog, Instagram, website…)" wide>
          <input type="url" value={i.link ?? ''} placeholder="https://" onChange={(e) => set({ link: e.target.value || undefined })} />
        </Field>
        <Field label="Locatie" wide>
          <PlaceInput value={i.place} context={i.city} onChange={(place) => set({ place })} />
        </Field>
        <Field label="Notities" wide>
          <textarea rows={3} value={i.notes ?? ''} onChange={(e) => set({ notes: e.target.value || undefined })} />
        </Field>
      </form>
    </Modal>
  )
}

export function StopForm({
  trip,
  initial,
  onSave,
  onDelete,
  onClose,
}: {
  trip: Trip
  initial: Stop
  onSave: (s: Stop) => void
  onDelete?: () => void
  onClose: () => void
}) {
  const [s, setS] = useState(initial)
  const set = (p: Partial<Stop>) => setS((x) => ({ ...x, ...p }))
  const valid = !!s.city.trim() && s.start && s.end && s.end > s.start
  return (
    <Modal
      title={onDelete ? 'Stop bewerken' : 'Nieuwe stop'}
      onClose={onClose}
      footer={<Footer onDelete={onDelete} onCancel={onClose} canSave={!!valid} />}
    >
      <form
        id="modal-form"
        className="form-grid"
        onSubmit={(e) => {
          e.preventDefault()
          if (!valid) return
          const booking = tidyBooking(s.booking)
          cleanupRemoved(initial.booking, booking)
          onSave({ ...s, city: s.city.trim(), booking })
        }}
      >
        <Field label="Stad" wide>
          <input autoFocus value={s.city} placeholder="Bijv. Lissabon" onChange={(e) => set({ city: e.target.value })} />
        </Field>
        <Field label="Aankomst (eerste nacht)">
          <input type="date" value={s.start} onChange={(e) => set({ start: e.target.value })} />
        </Field>
        <Field label="Vertrek">
          <input type="date" value={s.end} min={s.start} onChange={(e) => set({ end: e.target.value })} />
        </Field>
        <Field label="Verblijf" wide>
          <PlaceInput
            value={s.stayName ? { name: s.stayName, lat: s.lat, lng: s.lng } : undefined}
            context={s.city}
            placeholder="Naam van hotel / ryokan / Airbnb"
            onChange={(p) => set({ stayName: p?.name, lat: p?.lat, lng: p?.lng })}
          />
        </Field>
        <Field label="Adres" wide>
          <input value={s.stayAddress ?? ''} onChange={(e) => set({ stayAddress: e.target.value || undefined })} />
        </Field>
        <Field label="Check-in">
          <input type="time" value={s.checkIn ?? ''} onChange={(e) => set({ checkIn: e.target.value || undefined })} />
        </Field>
        <Field label="Check-out">
          <input type="time" value={s.checkOut ?? ''} onChange={(e) => set({ checkOut: e.target.value || undefined })} />
        </Field>
        <Field label="Kosten verblijf (totaal)">
          <MoneyInput
            amount={s.stayCost}
            currency={s.stayCurrency}
            currencies={tripCurrencies(trip)}
            onChange={(stayCost, stayCurrency) => set({ stayCost, stayCurrency })}
          />
        </Field>
        <Field label="Status">
          <label className="check">
            <input type="checkbox" checked={s.booked} onChange={(e) => set({ booked: e.target.checked })} /> Geboekt
          </label>
        </Field>
        <BookingFields value={s.booking} onChange={(booking) => set({ booking })} />
        <Field label="Notities" wide>
          <textarea rows={2} value={s.notes ?? ''} onChange={(e) => set({ notes: e.target.value || undefined })} />
        </Field>
      </form>
    </Modal>
  )
}

export function LegForm({
  trip,
  slot,
  initial,
  onSave,
  onDelete,
  onClose,
}: {
  trip: Trip
  slot: LegSlot
  initial: Leg
  onSave: (l: Leg) => void
  onDelete?: () => void
  onClose: () => void
}) {
  const [l, setL] = useState(initial)
  const set = (p: Partial<Leg>) => setL((x) => ({ ...x, ...p }))
  const hours = legHours({ ...l, durationH: undefined })
  return (
    <Modal
      title={`${slot.fromName} → ${slot.toName}`}
      onClose={onClose}
      footer={<Footer onDelete={onDelete} onCancel={onClose} canSave={!!l.date} />}
    >
      <form
        id="modal-form"
        className="form-grid"
        onSubmit={(e) => {
          e.preventDefault()
          const booking = tidyBooking(l.booking)
          cleanupRemoved(initial.booking, booking)
          onSave({ ...l, carrier: l.carrier?.trim() || undefined, booking })
        }}
      >
        <div className="field wide">
          <span>Vervoer</span>
          <div className="seg modes">
            {TRANSPORT_MODES.map((m) => (
              <button type="button" key={m} className={l.mode === m ? 'on' : ''} onClick={() => set({ mode: m })}>
                <span aria-hidden>{MODE_ICON[m]}</span> {m}
              </button>
            ))}
          </div>
        </div>
        <Field label={l.mode === 'Vlucht' ? 'Vluchtnummer / maatschappij' : 'Lijn / maatschappij'} wide>
          <input
            value={l.carrier ?? ''}
            placeholder={l.mode === 'Vlucht' ? 'Bijv. KLM KL861' : l.mode === 'Auto' ? 'Bijv. huurauto Sixt' : 'Bijv. Alfa Pendular 123'}
            onChange={(e) => set({ carrier: e.target.value })}
          />
        </Field>
        <Field label="Datum vertrek">
          <input type="date" value={l.date} onChange={(e) => set({ date: e.target.value })} />
        </Field>
        <Field label="Kosten (totaal, alle reizigers)">
          <MoneyInput amount={l.cost} currency={l.currency} currencies={tripCurrencies(trip)} onChange={(cost, currency) => set({ cost, currency })} />
        </Field>
        <Field label="Vertrektijd">
          <input type="time" value={l.depart ?? ''} onChange={(e) => set({ depart: e.target.value || undefined })} />
        </Field>
        <Field label="Aankomsttijd (lokaal)">
          <input type="time" value={l.arrive ?? ''} onChange={(e) => set({ arrive: e.target.value || undefined })} />
        </Field>
        <Field label="Reisduur in uren (bij tijdverschil)">
          <input
            type="number"
            min={0}
            step={0.25}
            value={l.durationH ?? ''}
            placeholder={hours !== undefined ? `${fmtDuration(hours)} volgens de tijden` : 'Bijv. 13,75'}
            onChange={(e) => set({ durationH: e.target.value ? Number(e.target.value) : undefined })}
          />
        </Field>
        <Field label="Status">
          <label className="check">
            <input type="checkbox" checked={l.booked} onChange={(e) => set({ booked: e.target.checked })} /> Geboekt
          </label>
        </Field>
        <BookingFields value={l.booking} onChange={(booking) => set({ booking })} />
        <Field label="Notities" wide>
          <textarea rows={2} value={l.notes ?? ''} placeholder="Overstap, stoelnummers, ophaallocatie…" onChange={(e) => set({ notes: e.target.value || undefined })} />
        </Field>
      </form>
    </Modal>
  )
}
