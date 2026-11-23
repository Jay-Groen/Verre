import { useMemo, useState } from 'react'
import type { Idea, Trip } from '../types'
import { useStore } from '../store'
import { buildDays, fitIdea, fmtHours, fmtMoney, norm, sortStops, type DayInfo, type Fit } from '../lib/plan'
import { fmtDay } from '../lib/dates'
import { newIdea, planIdea } from '../lib/actions'
import { IdeaForm } from './forms'
import { Empty } from './ui'
import { peopleOf } from '../lib/split'
import { cityAt, findPlace, parseLink } from '../lib/linkparse'

/** Naam om te tonen: bij een e-mailadres alleen het deel vóór de @. */
const voterName = (v: string) => (v.includes('@') ? v.split('@')[0] : v)

/** Wie stemt er op dit apparaat: met account je e-mailadres, anders een gekozen reiziger. */
function useMe(trip: Trip) {
  const email = useStore((s) => s.user?.email?.toLowerCase())
  const people = peopleOf(trip)
  const key = `verre.me.${trip.id}`
  const [picked, setPicked] = useState(() => {
    try {
      return localStorage.getItem(key) ?? undefined
    } catch {
      return undefined
    }
  })
  const me = email ?? (picked && people.includes(picked) ? picked : people[0])
  const pick = (p: string) => {
    setPicked(p)
    try {
      localStorage.setItem(key, p)
    } catch {
      /* ignore */
    }
  }
  return { me, pick, people, canPick: !email && people.length > 1 }
}

type Filter = 'all' | 'open' | 'planned'

interface Group {
  key: string
  title: string
  sub?: string
  days: DayInfo[]
  ideas: { idea: Idea; fit: Fit }[]
  onRoute: boolean
}

export function IdeasView({ trip }: { trip: Trip }) {
  const update = useStore((s) => s.update)
  const days = useMemo(() => buildDays(trip), [trip])
  const [editing, setEditing] = useState<{ idea: Idea; isNew: boolean } | null>(null)
  const [filter, setFilter] = useState<Filter>('open')
  const [byVotes, setByVotes] = useState(false)
  const { me, pick, people, canPick } = useMe(trip)
  const vote = (id: string) =>
    update((t) => {
      const i = t.ideas.find((x) => x.id === id)
      if (!i) return
      const v = i.votes ?? []
      i.votes = v.includes(me) ? v.filter((x) => x !== me) : [...v, me]
      if (!i.votes.length) i.votes = undefined
    })

  const all = trip.ideas.map((idea) => ({ idea, fit: fitIdea(idea, trip, days) }))
  const counts = {
    planned: all.filter((x) => x.fit.kind === 'planned').length,
    fits: all.filter((x) => x.fit.kind === 'fits' || x.fit.kind === 'nocity').length,
    full: all.filter((x) => x.fit.kind === 'full').length,
    offroute: all.filter((x) => x.fit.kind === 'offroute').length,
  }

  const shown = all
    .filter(({ fit }) =>
      filter === 'all' ? true : filter === 'planned' ? fit.kind === 'planned' : fit.kind !== 'planned' && fit.kind !== 'dropped',
    )
    .sort(
      (a, b) =>
        (byVotes ? (b.idea.votes?.length ?? 0) - (a.idea.votes?.length ?? 0) : 0) ||
        a.idea.priority - b.idea.priority ||
        a.idea.title.localeCompare(b.idea.title),
    )

  // Groepeer per stad in de volgorde van de route.
  const groups: Group[] = []
  const routeCities = [...new Set(sortStops(trip.stops).map((s) => s.city))]
  for (const city of routeCities) {
    const cityDays = days.filter((d) => norm(d.stop?.city) === norm(city))
    const free = cityDays.reduce((n, d) => n + Math.max(0, d.capacityH - d.loadH), 0)
    const ideas = shown.filter((x) => norm(x.idea.city) === norm(city))
    const openH = all
      .filter((x) => norm(x.idea.city) === norm(city) && (x.fit.kind === 'fits' || x.fit.kind === 'full'))
      .reduce((n, x) => n + x.idea.durationH, 0)
    groups.push({
      key: city,
      title: city,
      sub: `${cityDays.length} ${cityDays.length === 1 ? 'dag' : 'dagen'} · ${fmtHours(free)} vrij · ${fmtHours(openH)} aan open ideeën`,
      days: cityDays,
      ideas,
      onRoute: true,
    })
  }
  const off = shown.filter((x) => x.fit.kind === 'offroute' || (x.fit.kind === 'dropped' && x.idea.city && !routeCities.some((c) => norm(c) === norm(x.idea.city))))
  if (off.length)
    groups.push({ key: '__off', title: 'Niet op je route', sub: 'Voeg de plek toe aan je route, of plan het als dagtrip vanuit een stad in de buurt.', days, ideas: off, onRoute: false })
  const nocity = shown.filter((x) => !norm(x.idea.city))
  if (nocity.length) groups.push({ key: '__none', title: 'Overal mogelijk', sub: 'Ideeën zonder vaste stad.', days, ideas: nocity, onRoute: false })

  const plan = (id: string, date: string) => update((t) => planIdea(t, id, date))

  return (
    <div className="ideas">
      <div className="ideas-top">
        <div className="stat-row">
          <Stat n={counts.planned} label="ingepland" tone="ok" />
          <Stat n={counts.fits} label="passen nog" tone="info" />
          <Stat n={counts.full} label="krap in tijd" tone="warn" />
          <Stat n={counts.offroute} label="niet op route" tone="muted" />
        </div>
        <div className="row">
          {canPick && (
            <label className="me-pick">
              <small className="muted">Ik ben</small>
              <select value={me} onChange={(e) => pick(e.target.value)}>
                {people.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </label>
          )}
          <button
            className={'btn small ghost' + (byVotes ? ' on' : '')}
            onClick={() => setByVotes(!byVotes)}
            title="Sorteer op aantal stemmen"
          >
            👍 {byVotes ? 'Populairst eerst' : 'Sorteer op stemmen'}
          </button>
          <div className="seg">
            {(['open', 'planned', 'all'] as Filter[]).map((f) => (
              <button key={f} className={filter === f ? 'on' : ''} onClick={() => setFilter(f)}>
                {f === 'open' ? 'Nog te plannen' : f === 'planned' ? 'Ingepland' : 'Alles'}
              </button>
            ))}
          </div>
          <button className="btn primary" onClick={() => setEditing({ idea: newIdea(trip), isNew: true })}>
            + Idee toevoegen
          </button>
        </div>
      </div>

      <QuickAdd
        trip={trip}
        onReady={(idea) => setEditing({ idea, isNew: true })}
      />

      {trip.ideas.length === 0 && (
        <Empty title="Nog geen ideeën">
          Verzamel hier alles wat je tegenkomt — van blogs, vrienden of TikTok — en zie direct waar het in je planning past.
        </Empty>
      )}

      {groups
        .filter((g) => g.ideas.length > 0)
        .map((g) => (
          <section key={g.key} className="idea-group">
            <header>
              <h3>{g.title}</h3>
              {g.sub && <small className="muted">{g.sub}</small>}
              {g.onRoute && (
                <button className="btn small ghost" onClick={() => setEditing({ idea: newIdea(trip, g.title), isNew: true })}>
                  + idee in {g.title}
                </button>
              )}
            </header>
            <div className="idea-grid">
              {g.ideas.map(({ idea, fit }) => (
                <IdeaCard
                  key={idea.id}
                  idea={idea}
                  fit={fit}
                  days={days}
                  onEdit={() => setEditing({ idea, isNew: false })}
                  me={me}
                  onVote={() => vote(idea.id)}
                  onPlan={(date) => plan(idea.id, date)}
                  onUnplan={() =>
                    update((t) => {
                      t.activities = t.activities.filter((a) => a.ideaId !== idea.id)
                    })
                  }
                  onDrop={(dropped) =>
                    update((t) => {
                      const i = t.ideas.find((x) => x.id === idea.id)
                      if (i) i.dropped = dropped
                    })
                  }
                />
              ))}
            </div>
          </section>
        ))}

      {editing && (
        <IdeaForm
          trip={trip}
          initial={editing.idea}
          onClose={() => setEditing(null)}
          onDelete={
            editing.isNew
              ? undefined
              : () => {
                  update((t) => {
                    t.ideas = t.ideas.filter((x) => x.id !== editing.idea.id)
                    t.activities.forEach((a) => {
                      if (a.ideaId === editing.idea.id) a.ideaId = undefined
                    })
                  })
                  setEditing(null)
                }
          }
          onSave={(i) => {
            update((t) => {
              const old = t.ideas.find((x) => x.id === i.id)
              if (old) Object.assign(old, i)
              else t.ideas.push(i)
            })
            setEditing(null)
          }}
        />
      )}
    </div>
  )
}

function Stat({ n, label, tone }: { n: number; label: string; tone: string }) {
  return (
    <div className={'stat ' + tone}>
      <strong>{n}</strong>
      <span>{label}</span>
    </div>
  )
}

function IdeaCard({
  idea,
  fit,
  days,
  onEdit,
  onPlan,
  onUnplan,
  onDrop,
  me,
  onVote,
}: {
  idea: Idea
  fit: Fit
  days: DayInfo[]
  me: string
  onVote: () => void
  onEdit: () => void
  onPlan: (date: string) => void
  onUnplan: () => void
  onDrop: (dropped: boolean) => void
}) {
  const dayNo = (date: string) => (days.find((d) => d.date === date)?.index ?? 0) + 1
  return (
    <article className={'idea-card fit-' + fit.kind}>
      <div className="idea-head">
        <span className="stars" title="Prioriteit">{'★'.repeat(4 - idea.priority)}</span>
        <h4 onClick={onEdit}>{idea.title}</h4>
        <button
          className={'vote' + (idea.votes?.includes(me) ? ' on' : '')}
          onClick={onVote}
          aria-pressed={!!idea.votes?.includes(me)}
          title={idea.votes?.length ? `Leuk volgens ${idea.votes.map(voterName).join(', ')}` : 'Vind ik leuk'}
        >
          👍 {idea.votes?.length ?? ''}
        </button>
        <button className="icon-btn" onClick={onEdit} aria-label="Bewerken">✎</button>
      </div>
      {idea.votes?.length ? (
        <div className="voters" aria-label="Stemmen">
          {idea.votes.map((v) => (
            <span key={v} className="avatar mini" title={voterName(v)}>
              {voterName(v).charAt(0).toUpperCase()}
            </span>
          ))}
        </div>
      ) : null}
      <div className="idea-meta">
        <span>{idea.category}</span>
        <span>{fmtHours(idea.durationH)}</span>
        {idea.cost ? <span>{fmtMoney(idea.cost, idea.currency)}</span> : null}
        {idea.place?.lat !== undefined && <span title="Op de kaart">📍</span>}
        {idea.link && (
          <a href={idea.link} target="_blank" rel="noreferrer">
            link ↗
          </a>
        )}
      </div>
      {idea.notes && <p className="idea-notes">{idea.notes}</p>}

      <div className="fit">
        {fit.kind === 'planned' && (
          <>
            <span>
              ✅ Gepland op dag {dayNo(fit.activity.date)} · {fmtDay(fit.activity.date)}
            </span>
            <button className="link" onClick={onUnplan}>terug naar ideeën</button>
          </>
        )}
        {fit.kind === 'fits' && (
          <>
            <span>Past op:</span>
            <div className="day-chips">
              {fit.options.slice(0, 4).map((o) => (
                <button key={o.date} className="day-chip" onClick={() => onPlan(o.date)} title="Klik om hier te plannen">
                  Dag {dayNo(o.date)} <small>{fmtHours(o.freeH)} vrij</small>
                </button>
              ))}
            </div>
          </>
        )}
        {fit.kind === 'full' && (
          <>
            <span>⚠️ Je dagen in {fit.city} zitten vol (max. {fmtHours(Math.max(0, fit.options[0]?.freeH ?? 0))} vrij).</span>
            <DayPicker days={fit.options.map((o) => o.date)} dayNo={dayNo} onPick={onPlan} label="Toch plannen…" />
          </>
        )}
        {fit.kind === 'offroute' && (
          <>
            <span>🧭 {fit.city} staat niet op je route.</span>
            <DayPicker days={days.map((d) => d.date)} dayNo={dayNo} onPick={onPlan} label="Plan als dagtrip…" />
          </>
        )}
        {fit.kind === 'nocity' && (
          <DayPicker
            days={fit.options.map((o) => o.date)}
            dayNo={dayNo}
            onPick={onPlan}
            label="Plan op dag…"
          />
        )}
        {fit.kind === 'dropped' && (
          <>
            <span className="muted">Afgevallen</span>
            <button className="link" onClick={() => onDrop(false)}>terugzetten</button>
          </>
        )}
        {fit.kind !== 'planned' && fit.kind !== 'dropped' && (
          <button className="link muted" onClick={() => onDrop(true)}>laat vallen</button>
        )}
      </div>
    </article>
  )
}

function DayPicker({
  days,
  dayNo,
  onPick,
  label,
}: {
  days: string[]
  dayNo: (d: string) => number
  onPick: (d: string) => void
  label: string
}) {
  return (
    <select
      className="day-picker"
      value=""
      onChange={(e) => e.target.value && onPick(e.target.value)}
    >
      <option value="">{label}</option>
      {[...days].sort().map((d) => (
        <option key={d} value={d}>
          Dag {dayNo(d)} · {fmtDay(d)}
        </option>
      ))}
    </select>
  )
}

/** Plak een link (Google Maps, blog, …) of typ een idee; opent het formulier vooraf ingevuld. */
function QuickAdd({ trip, onReady }: { trip: Trip; onReady: (i: Idea) => void }) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string>()
  const routeCities = [...new Set(trip.stops.map((s) => s.city))]

  const submit = async () => {
    const value = text.trim()
    if (!value) return
    const idea = newIdea(trip)
    const info = parseLink(value)
    setNote(undefined)
    if (!info) {
      onReady({ ...idea, title: value })
      setText('')
      return
    }
    setBusy(true)
    idea.link = info.url
    idea.title = info.title ?? ''
    let pos = info.lat !== undefined ? { lat: info.lat, lng: info.lng! } : undefined
    // Een plaatsnaam uit een kaartlink kunnen we opzoeken; een blogtitel niet.
    if (!pos && info.title && /Google Maps|Apple Kaarten/.test(info.site ?? '')) pos = await findPlace(info.title)
    if (pos) {
      idea.place = { name: info.title ?? 'Locatie uit link', ...pos }
      const city = await cityAt(pos.lat, pos.lng)
      if (city) idea.city = routeCities.find((c) => norm(c) === norm(city)) ?? city
    }
    if (/Google Maps|Apple Kaarten|OpenStreetMap/.test(info.site ?? '') && !info.title) idea.title = ''
    setBusy(false)
    setText('')
    if (info.short)
      setNote('Korte deellinks (maps.app.goo.gl) kunnen we niet uitlezen. Open de link en kopieer het volledige adres uit de adresbalk, dan komt de plek op de kaart.')
    onReady(idea)
  }

  return (
    <form
      className="quick-add"
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
    >
      <input
        value={text}
        placeholder="Plak een link (Google Maps, blog, TripAdvisor…) of typ een idee"
        onChange={(e) => setText(e.target.value)}
        aria-label="Snel een idee toevoegen"
      />
      <button className="btn" disabled={busy || !text.trim()}>
        {busy ? 'Ophalen…' : 'Toevoegen'}
      </button>
      {note && <small className="muted quick-note">{note}</small>}
    </form>
  )
}
