import { useState } from 'react'
import type { Trip } from '../types'
import { useStore } from '../store'
import { uid } from '../lib/plan'

export function PackingView({ trip }: { trip: Trip }) {
  const update = useStore((s) => s.update)
  const groups = [...new Set(trip.packing.map((p) => p.group))]
  const [newGroup, setNewGroup] = useState('')
  const done = trip.packing.filter((p) => p.done).length

  return (
    <div className="packing">
      <div className="section-head">
        <h2>Paklijst &amp; checklist</h2>
        <small className="muted">
          {done} van {trip.packing.length} afgevinkt
        </small>
      </div>
      <div className="bar wide">
        <span style={{ width: `${trip.packing.length ? (done / trip.packing.length) * 100 : 0}%` }} />
      </div>
      <div className="pack-grid">
        {groups.map((g) => (
          <PackGroup key={g} trip={trip} group={g} />
        ))}
        <form
          className="card pack-new"
          onSubmit={(e) => {
            e.preventDefault()
            const g = newGroup.trim()
            if (!g) return
            update((t) => void t.packing.push({ id: uid(), group: g, text: 'Nieuw item', done: false }))
            setNewGroup('')
          }}
        >
          <h3>Nieuwe lijst</h3>
          <input placeholder="Bijv. Onsen-spullen" value={newGroup} onChange={(e) => setNewGroup(e.target.value)} />
          <button className="btn" disabled={!newGroup.trim()}>Lijst toevoegen</button>
        </form>
      </div>
    </div>
  )
}

function PackGroup({ trip, group }: { trip: Trip; group: string }) {
  const update = useStore((s) => s.update)
  const [text, setText] = useState('')
  const items = trip.packing.filter((p) => p.group === group)
  return (
    <div className="card pack-group">
      <h3>
        {group} <small className="muted">{items.filter((i) => i.done).length}/{items.length}</small>
      </h3>
      <ul>
        {items.map((it) => (
          <li key={it.id} className={it.done ? 'done' : ''}>
            <label className="check">
              <input
                type="checkbox"
                checked={it.done}
                onChange={(e) =>
                  update((t) => {
                    const x = t.packing.find((p) => p.id === it.id)
                    if (x) x.done = e.target.checked
                  })
                }
              />
              <span>{it.text}</span>
            </label>
            <button
              className="icon-btn"
              aria-label="Verwijderen"
              onClick={() => update((t) => void (t.packing = t.packing.filter((p) => p.id !== it.id)))}
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault()
          if (!text.trim()) return
          update((t) => void t.packing.push({ id: uid(), group, text: text.trim(), done: false }))
          setText('')
        }}
      >
        <input placeholder="Item toevoegen" value={text} onChange={(e) => setText(e.target.value)} />
        <button className="btn small" disabled={!text.trim()}>+</button>
      </form>
    </div>
  )
}
