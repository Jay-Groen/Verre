import { useState } from 'react'
import type { Currency, Expense, ExpenseCategory, Trip } from '../types'
import { EXPENSE_CATEGORIES } from '../types'
import { useStore } from '../store'
import { fmtHome, fmtMoney, sortStops, toHome, tripCurrencies, uid } from '../lib/plan'
import { MoneyInput } from './ui'
import { legSlots } from '../lib/legs'
import { MODE_ICON } from '../types'
import { currencySymbol } from '../lib/currency'

interface Line {
  key: string
  title: string
  amount: number
  currency: Currency
  category: ExpenseCategory
  source: 'expense' | 'stay' | 'activity' | 'leg'
  paid?: boolean
}

export function BudgetView({ trip }: { trip: Trip }) {
  const update = useStore((s) => s.update)
  const blank = (category: ExpenseCategory = 'Vervoer'): Expense => ({ id: uid(), title: '', amount: 0, currency: trip.localCurrency, category, paid: false })
  const [draft, setDraft] = useState<Expense>(() => blank())
  const eur = (a: number, c: Currency) => toHome(a, c, trip)
  const fmtTotal = (a: number) => fmtHome(a, trip)

  const lines: Line[] = [
    ...trip.expenses.map((e) => ({ key: e.id, title: e.title, amount: e.amount, currency: e.currency, category: e.category, source: 'expense' as const, paid: e.paid })),
    ...sortStops(trip.stops)
      .filter((s) => s.stayCost)
      .map((s) => ({ key: s.id, title: `${s.stayName ?? 'Verblijf'} (${s.city})`, amount: s.stayCost!, currency: s.stayCurrency, category: 'Verblijf' as const, source: 'stay' as const, paid: s.booked })),
    ...legSlots(trip)
      .filter((x) => x.leg?.cost)
      .map((x) => ({ key: x.leg!.id, title: `${MODE_ICON[x.leg!.mode]} ${x.fromName} → ${x.toName}`, amount: x.leg!.cost!, currency: x.leg!.currency, category: 'Vervoer' as const, source: 'leg' as const, paid: x.leg!.booked })),
    ...trip.activities
      .filter((a) => a.cost)
      .map((a) => ({ key: a.id, title: a.title, amount: a.cost! * trip.travelers, currency: a.currency, category: 'Activiteiten' as const, source: 'activity' as const })),
  ]
  const total = lines.reduce((n, l) => n + eur(l.amount, l.currency), 0)
  const paid = lines.filter((l) => l.paid).reduce((n, l) => n + eur(l.amount, l.currency), 0)
  const byCat = EXPENSE_CATEGORIES.map((c) => ({
    c,
    v: lines.filter((l) => l.category === c).reduce((n, l) => n + eur(l.amount, l.currency), 0),
  })).filter((x) => x.v > 0)
  const max = Math.max(1, ...byCat.map((x) => x.v))
  const budget = trip.budget

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
          <button className="btn primary" disabled={!draft.title.trim() || !draft.amount}>Toevoegen</button>
        </form>
        <table className="lines">
          <thead>
            <tr>
              <th>Omschrijving</th>
              <th>Categorie</th>
              <th className="num">Bedrag</th>
              <th className="num">In {currencySymbol(trip.homeCurrency)}</th>
              <th>Betaald</th>
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
                <td colSpan={6} className="muted center">Nog geen kosten. Kosten van verblijven en activiteiten tellen automatisch mee.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

