import { useState } from 'react'
import type { Currency, Expense, ExpenseCategory, Trip } from '../types'
import { EXPENSE_CATEGORIES } from '../types'
import { useStore } from '../store'
import { fmtHome, fmtMoney, sortStops, toHome, tripCurrencies, uid } from '../lib/plan'
import { MoneyInput } from './ui'
import { legSlots } from '../lib/legs'
import { MODE_ICON } from '../types'
import { currencySymbol } from '../lib/currency'
import { balances, peopleOf, settle } from '../lib/split'

interface Line {
  key: string
  title: string
  amount: number
  currency: Currency
  category: ExpenseCategory
  source: 'expense' | 'stay' | 'activity' | 'leg'
  paid?: boolean
  paidBy?: string
  among?: string[]
  /** Zet wie betaald heeft op het onderliggende item. */
  setPaidBy: (t: Trip, who?: string) => void
}

function findIn<T extends { id: string }>(list: T[], id: string) {
  return list.find((x) => x.id === id)
}

export function BudgetView({ trip }: { trip: Trip }) {
  const update = useStore((s) => s.update)
  const blank = (category: ExpenseCategory = 'Vervoer'): Expense => ({ id: uid(), title: '', amount: 0, currency: trip.localCurrency, category, paid: false })
  const [draft, setDraft] = useState<Expense>(() => blank())
  const eur = (a: number, c: Currency) => toHome(a, c, trip)
  const fmtTotal = (a: number) => fmtHome(a, trip)

  const lines: Line[] = [
    ...trip.expenses.map((e) => ({ key: e.id, title: e.title, amount: e.amount, currency: e.currency, category: e.category, source: 'expense' as const, paid: e.paid, paidBy: e.paidBy, among: e.splitAmong, setPaidBy: (t: Trip, w?: string) => void (findIn(t.expenses, e.id)!.paidBy = w) })),
    ...sortStops(trip.stops)
      .filter((s) => s.stayCost)
      .map((s) => ({ key: s.id, title: `${s.stayName ?? 'Verblijf'} (${s.city})`, amount: s.stayCost!, currency: s.stayCurrency, category: 'Verblijf' as const, source: 'stay' as const, paid: s.booked, paidBy: s.paidBy, setPaidBy: (t: Trip, w?: string) => void (findIn(t.stops, s.id)!.paidBy = w) })),
    ...legSlots(trip)
      .filter((x) => x.leg?.cost)
      .map((x) => ({ key: x.leg!.id, title: `${MODE_ICON[x.leg!.mode]} ${x.fromName} → ${x.toName}`, amount: x.leg!.cost!, currency: x.leg!.currency, category: 'Vervoer' as const, source: 'leg' as const, paid: x.leg!.booked, paidBy: x.leg!.paidBy, setPaidBy: (t: Trip, w?: string) => void (findIn(t.legs, x.leg!.id)!.paidBy = w) })),
    ...trip.activities
      .filter((a) => a.cost)
      .map((a) => ({ key: a.id, title: a.title, amount: a.cost! * trip.travelers, currency: a.currency, category: 'Activiteiten' as const, source: 'activity' as const, paidBy: a.paidBy, setPaidBy: (t: Trip, w?: string) => void (findIn(t.activities, a.id)!.paidBy = w) })),
  ]
  const total = lines.reduce((n, l) => n + eur(l.amount, l.currency), 0)
  const paid = lines.filter((l) => l.paid).reduce((n, l) => n + eur(l.amount, l.currency), 0)
  const byCat = EXPENSE_CATEGORIES.map((c) => ({
    c,
    v: lines.filter((l) => l.category === c).reduce((n, l) => n + eur(l.amount, l.currency), 0),
  })).filter((x) => x.v > 0)
  const max = Math.max(1, ...byCat.map((x) => x.v))
  const budget = trip.budget
  const people = peopleOf(trip)
  const assigned = lines.filter((l) => l.paidBy && people.includes(l.paidBy))
  const bal = balances(
    people,
    assigned.map((l) => ({ amount: eur(l.amount, l.currency), paidBy: l.paidBy!, among: l.among?.length ? l.among : people })),
  )
  const transfers = settle(bal)
  const unassigned = lines.filter((l) => !l.paidBy || !people.includes(l.paidBy)).reduce((n, l) => n + eur(l.amount, l.currency), 0)

  return (
    <div className="budget">
      <div className="kpis">
        <div className="kpi">
          <small>Totaal gepland</small>
          <strong>{fmtTotal(total)}</strong>
          <small className="muted">{fmtTotal(total / trip.travelers)} p.p.</small>
        </div>
        <div className="kpi">
          <small>Al betaald / geboekt</small>
          <strong>{fmtTotal(paid)}</strong>
          <small className="muted">nog {fmtTotal(total - paid)}</small>
        </div>
        <div className="kpi">
          <small>Budget</small>
          <div className="row tight">
            <span>{currencySymbol(trip.homeCurrency)}</span>
            <input
              type="number"
              min={0}
              className="budget-input"
              value={budget ?? ''}
              placeholder="instellen"
              onChange={(e) => update((t) => void (t.budget = e.target.value ? Number(e.target.value) : undefined))}
            />
          </div>
          {budget ? (
            <>
              <div className={'bar' + (total > budget ? ' over' : '')}>
                <span style={{ width: `${Math.min(100, (total / budget) * 100)}%` }} />
              </div>
              <small className={total > budget ? 'warn-text' : 'muted'}>
                {total > budget ? `${fmtTotal(total - budget)} over budget` : `${fmtTotal(budget - total)} over`}
              </small>
            </>
          ) : null}
        </div>
      </div>

      {people.length > 1 && (
        <SplitCard
          trip={trip}
          people={people}
          bal={bal}
          transfers={transfers}
          unassigned={unassigned}
          fmt={fmtTotal}
        />
      )}

      {byCat.length > 0 && (
        <div className="card">
          <h3>Per categorie</h3>
          <ul className="cat-bars">
            {byCat.map(({ c, v }) => (
              <li key={c}>
                <span>{c}</span>
                <div className="bar">
                  <span style={{ width: `${(v / max) * 100}%` }} />
                </div>
                <strong>{fmtTotal(v)}</strong>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="card">
        <h3>Uitgaven</h3>
        <form
          className="expense-add"
          onSubmit={(e) => {
            e.preventDefault()
            if (!draft.title.trim() || !draft.amount) return
            update((t) => void t.expenses.push({ ...draft, title: draft.title.trim() }))
            setDraft(blank(draft.category))
          }}
        >
          <input placeholder="Omschrijving, bijv. reisverzekering" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
          <MoneyInput amount={draft.amount || undefined} currency={draft.currency} currencies={tripCurrencies(trip)} onChange={(amount, currency) => setDraft({ ...draft, amount: amount ?? 0, currency })} />
          <select value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value as ExpenseCategory })}>
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          {people.length > 1 && (
            <select
              value={draft.paidBy ?? ''}
              aria-label="Betaald door"
              onChange={(e) => setDraft({ ...draft, paidBy: e.target.value || undefined, paid: !!e.target.value || draft.paid })}
            >
              <option value="">Betaald door…</option>
              {people.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          )}
          <button className="btn primary" disabled={!draft.title.trim() || !draft.amount}>Toevoegen</button>
          {people.length > 1 && (
            <div className="split-among">
              <small className="muted">Verdelen over:</small>
              {people.map((p) => {
                const among = draft.splitAmong ?? people
                const on = among.includes(p)
                return (
                  <label key={p} className="check">
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => {
                        const next = on ? among.filter((x) => x !== p) : [...among, p]
                        setDraft({ ...draft, splitAmong: next.length === people.length ? undefined : next })
                      }}
                    />{' '}
                    {p}
                  </label>
                )
              })}
            </div>
          )}
        </form>
        <table className="lines">
          <thead>
            <tr>
              <th>Omschrijving</th>
              <th>Categorie</th>
              <th className="num">Bedrag</th>
              <th className="num">In {currencySymbol(trip.homeCurrency)}</th>
              <th>Betaald</th>
              {people.length > 1 && <th>Door</th>}
              <th />
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.source + l.key}>
                <td>
                  {l.title}
                  {l.source !== 'expense' && <small className="muted"> · {l.source === 'activity' ? `uit planning, × ${trip.travelers}` : 'uit route'}</small>}
                </td>
                <td>{l.category}</td>
                <td className="num">{fmtMoney(l.amount, l.currency)}</td>
                <td className="num">{fmtTotal(eur(l.amount, l.currency))}</td>
                <td>
                  {l.source === 'expense' ? (
                    <input
                      type="checkbox"
                      checked={!!l.paid}
                      onChange={(e) =>
                        update((t) => {
                          const x = t.expenses.find((y) => y.id === l.key)
                          if (x) x.paid = e.target.checked
                        })
                      }
                    />
                  ) : l.source === 'stay' || l.source === 'leg' ? (
                    <small className="muted">{l.paid ? 'geboekt' : '—'}</small>
                  ) : null}
                </td>
                {people.length > 1 && (
                  <td>
                    <select
                      className="paid-by"
                      value={l.paidBy ?? ''}
                      aria-label={`Betaald door, ${l.title}`}
                      onChange={(e) => update((t) => l.setPaidBy(t, e.target.value || undefined))}
                    >
                      <option value="">—</option>
                      {people.map((p) => (
                        <option key={p}>{p}</option>
                      ))}
                    </select>
                    {l.among?.length ? <small className="muted"> voor {l.among.join(', ')}</small> : null}
                  </td>
                )}
                <td>
                  {l.source === 'expense' && (
                    <button className="icon-btn" aria-label="Verwijderen" onClick={() => update((t) => void (t.expenses = t.expenses.filter((y) => y.id !== l.key)))}>
                      ✕
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {lines.length === 0 && (
              <tr>
                <td colSpan={7} className="muted center">Nog geen kosten. Kosten van verblijven en activiteiten tellen automatisch mee.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}


function SplitCard({
  trip,
  people,
  bal,
  transfers,
  unassigned,
  fmt,
}: {
  trip: Trip
  people: string[]
  bal: Record<string, number>
  transfers: { from: string; to: string; amount: number }[]
  unassigned: number
  fmt: (n: number) => string
}) {
  const update = useStore((s) => s.update)
  const [editing, setEditing] = useState(false)
  const [names, setNames] = useState(people)
  const anyPaid = Object.values(bal).some((v) => Math.abs(v) > 0.005)

  return (
    <div className="card split">
      <div className="split-head">
        <h3>Kosten verdelen</h3>
        <button className="btn small ghost" onClick={() => (setNames(people), setEditing(!editing))}>
          {editing ? 'Annuleren' : 'Namen aanpassen'}
        </button>
      </div>
      {editing ? (
        <form
          className="split-names"
          onSubmit={(e) => {
            e.preventDefault()
            const clean = names.map((n) => n.trim()).filter(Boolean)
            if (new Set(clean).size !== clean.length || clean.length === 0) return
            update((t) => renamePeople(t, people, clean))
            setEditing(false)
          }}
        >
          {names.map((n, i) => (
            <div key={i} className="row nowrap">
              <input value={n} aria-label={`Naam reiziger ${i + 1}`} onChange={(e) => setNames(names.map((x, j) => (j === i ? e.target.value : x)))} />
              {names.length > 1 && (
                <button type="button" className="icon-btn" aria-label="Reiziger verwijderen" onClick={() => setNames(names.filter((_, j) => j !== i))}>
                  ✕
                </button>
              )}
            </div>
          ))}
          <div className="row">
            <button type="button" className="btn small ghost" onClick={() => setNames([...names, ''])}>
              + Reiziger
            </button>
            <span className="spacer" />
            <button className="btn small primary">Opslaan</button>
          </div>
          {new Set(names.map((n) => n.trim())).size !== names.length && <small className="warn-text">Gebruik voor iedereen een andere naam.</small>}
        </form>
      ) : (
        <>
          <ul className="split-bal">
            {people.map((p) => (
              <li key={p}>
                <span className="avatar" aria-hidden>
                  {p.charAt(0).toUpperCase()}
                </span>
                <span className="grow">{p}</span>
                <strong className={bal[p] > 0.005 ? 'ok' : bal[p] < -0.005 ? 'warn-text' : 'muted'}>
                  {bal[p] > 0.005 ? '+' : ''}
                  {fmt(bal[p])}
                </strong>
              </li>
            ))}
          </ul>
          {transfers.length > 0 ? (
            <div className="split-transfers">
              <small className="muted">Om quitte te spelen:</small>
              {transfers.map((t, i) => (
                <div key={i}>
                  <strong>{t.from}</strong> betaalt <strong>{fmt(t.amount)}</strong> aan <strong>{t.to}</strong>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted">
              {anyPaid ? 'Iedereen staat quitte.' : 'Kies in de lijst hieronder bij “Door” wie iets heeft betaald.'}
            </p>
          )}
          {unassigned > 0.5 && (
            <small className="muted">
              {fmt(unassigned)} aan kosten is nog niet aan iemand toegewezen en telt niet mee.
              {trip.travelers !== people.length && ' '}
            </small>
          )}
        </>
      )}
    </div>
  )
}

/** Past namen aan en werkt alle verwijzingen ('betaald door', 'verdelen over') mee bij. */
function renamePeople(t: Trip, before: string[], after: string[]) {
  const map = new Map<string, string | undefined>()
  before.forEach((b, i) => map.set(b, after[i]))
  const fix = (w?: string) => (w === undefined ? undefined : map.has(w) ? map.get(w) : w)
  for (const x of [...t.expenses, ...t.stops, ...t.legs, ...t.activities]) x.paidBy = fix(x.paidBy)
  for (const e of t.expenses) {
    if (e.splitAmong) {
      const s = e.splitAmong.map(fix).filter((v): v is string => !!v)
      e.splitAmong = s.length && s.length < after.length ? s : undefined
    }
  }
  for (const i of t.ideas) {
    if (i.votes) {
      const v = i.votes.map(fix).filter((x): x is string => !!x)
      i.votes = v.length ? v : undefined
    }
  }
  t.people = after
  t.travelers = after.length
}
