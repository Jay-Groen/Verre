import { useState } from 'react'
import { useStore } from '../store'
import { sampleJapanTrip } from '../sample'
import { daysBetween, fmtDay, todayIso } from '../lib/dates'
import { Field, Modal } from './ui'
import { addDays } from '../lib/dates'

export function TripList() {
  const { trips, select, createTrip, addTrip, deleteTrip, localTrips, importLocal, mode } = useStore()
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('Japan')
  const [start, setStart] = useState(addDays(todayIso(), 90))
  const [end, setEnd] = useState(addDays(todayIso(), 103))

  return (
    <div className="trip-list">
      <div className="section-head">
        <h1>Mijn reizen</h1>
        <div className="row">
          <button className="btn ghost" onClick={() => addTrip(sampleJapanTrip())}>Voorbeeldreis Japan</button>
          <button className="btn primary" onClick={() => setCreating(true)}>+ Nieuwe reis</button>
        </div>
      </div>

      {mode === 'cloud' && localTrips.length > 0 && (
        <div className="notice">
          Er staan {localTrips.length} reis(zen) lokaal in deze browser.{' '}
          <button className="link" onClick={importLocal}>Zet ze in je account</button>
        </div>
      )}

      {trips.length === 0 ? (
        <div className="empty hero">
          <div className="logo huge">旅</div>
          <h2>Waar gaat de reis heen?</h2>
          <p className="muted">
            Begin met een nieuwe reis, of bekijk de voorbeeldreis door Japan om te zien hoe ideeën, dagplanning,
            verblijven, kaart en budget samenwerken.
          </p>
        </div>
      ) : (
        <div className="trip-cards">
          {trips.map((t) => {
            const nights = daysBetween(t.startDate, t.endDate)
            const until = daysBetween(todayIso(), t.startDate)
            return (
              <article key={t.id} className="trip-card" onClick={() => select(t.id)}>
                <h3>{t.name}</h3>
                <p>
                  {fmtDay(t.startDate)} – {fmtDay(t.endDate)} · {nights + 1} dagen
                </p>
                <p className="muted">
                  {[...new Set(t.stops.map((s) => s.city))].join(' → ') || 'Nog geen route'}
                </p>
                <footer>
                  <small className="muted">
                    {until > 0 ? `Nog ${until} dagen` : until > -nights ? 'Onderweg!' : 'Geweest'} · {t.ideas.length} ideeën ·{' '}
                    {t.activities.length} activiteiten
                  </small>
                  <button
                    className="icon-btn"
                    aria-label="Reis verwijderen"
                    onClick={(e) => {
                      e.stopPropagation()
                      if (confirm(`“${t.name}” definitief verwijderen?`)) deleteTrip(t.id)
                    }}
                  >
                    🗑
                  </button>
                </footer>
              </article>
            )
          })}
        </div>
      )}

      {creating && (
        <Modal
          title="Nieuwe reis"
          onClose={() => setCreating(false)}
          footer={
            <>
              <span className="spacer" />
              <button className="btn ghost" onClick={() => setCreating(false)}>Annuleren</button>
              <button type="submit" form="new-trip" className="btn primary" disabled={!name.trim() || end < start}>
                Aanmaken
              </button>
            </>
          }
        >
          <form
            id="new-trip"
            className="form-grid"
            onSubmit={(e) => {
              e.preventDefault()
              createTrip({ name: name.trim(), startDate: start, endDate: end })
              setCreating(false)
            }}
          >
            <Field label="Naam" wide>
              <input autoFocus value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="Vertrek">
              <input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
            </Field>
            <Field label="Terug">
              <input type="date" value={end} min={start} onChange={(e) => setEnd(e.target.value)} />
            </Field>
          </form>
        </Modal>
      )}
    </div>
  )
}
