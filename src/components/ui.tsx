import { useEffect, useState, type ReactNode } from 'react'
import type { Currency, Place } from '../types'
import { currencySymbol } from '../lib/currency'

export function Modal({
  title,
  onClose,
  children,
  footer,
}: {
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <header className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Sluiten">
            ✕
          </button>
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-foot">{footer}</footer>}
      </div>
    </div>
  )
}

export function Field({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <label className={'field' + (wide ? ' wide' : '')}>
      <span>{label}</span>
      {children}
    </label>
  )
}

export function MoneyInput({
  amount,
  currency,
  currencies,
  onChange,
}: {
  amount?: number
  currency: Currency
  /** Valuta om uit te kiezen (lokaal en thuis). */
  currencies: Currency[]
  onChange: (amount: number | undefined, currency: Currency) => void
}) {
  const options = currencies.includes(currency) ? currencies : [currency, ...currencies]
  return (
    <div className="money-input">
      <input
        type="number"
        min={0}
        inputMode="decimal"
        value={amount ?? ''}
        placeholder="0"
        onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value), currency)}
      />
      {options.length > 1 ? (
        <select value={currency} onChange={(e) => onChange(amount, e.target.value)} aria-label="Valuta">
          {options.map((c) => (
            <option key={c} value={c}>
              {currencySymbol(c)}
            </option>
          ))}
        </select>
      ) : (
        <span className="money-unit">{currencySymbol(currency)}</span>
      )}
    </div>
  )
}

interface GeoResult {
  display_name: string
  lat: string
  lon: string
}

/** Plaatsnaam + zoeken via OpenStreetMap (Nominatim) zodat het op de kaart komt. */
export function PlaceInput({
  value,
  onChange,
  context,
  placeholder = 'Bijv. Sagrada Família',
}: {
  value?: Place
  onChange: (p: Place | undefined) => void
  context?: string
  placeholder?: string
}) {
  const [results, setResults] = useState<GeoResult[] | null>(null)
  const [busy, setBusy] = useState(false)
  const name = value?.name ?? ''

  const search = async () => {
    if (!name.trim()) return
    setBusy(true)
    try {
      const q = [name, context].filter(Boolean).join(', ')
      const res = await fetch(
        'https://nominatim.openstreetmap.org/search?format=json&limit=5&accept-language=nl&q=' +
          encodeURIComponent(q),
      )
      let data = (await res.json()) as GeoResult[]
      if (data.length === 0 && context) {
        const res2 = await fetch(
          'https://nominatim.openstreetmap.org/search?format=json&limit=5&accept-language=nl&q=' +
            encodeURIComponent(name),
        )
        data = (await res2.json()) as GeoResult[]
      }
      setResults(data)
    } catch {
      setResults([])
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="place-input">
      <div className="row">
        <input
          value={name}
          placeholder={placeholder}
          onChange={(e) =>
            onChange(e.target.value ? { name: e.target.value } : undefined)
          }
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              search()
            }
          }}
        />
        <button type="button" className="btn ghost" onClick={search} disabled={busy || !name.trim()}>
          {busy ? 'Zoeken…' : 'Zoek op kaart'}
        </button>
      </div>
      {value?.lat !== undefined && (
        <small className="ok">
          📍 Op de kaart ({value.lat.toFixed(4)}, {value.lng?.toFixed(4)}){' '}
          <button type="button" className="link" onClick={() => onChange({ name })}>
            wissen
          </button>
        </small>
      )}
      {results && (
        <ul className="geo-results">
          {results.length === 0 && <li className="muted">Niets gevonden, probeer een andere naam.</li>}
          {results.map((r) => (
            <li key={r.lat + r.lon}>
              <button
                type="button"
                onClick={() => {
                  onChange({ name, lat: Number(r.lat), lng: Number(r.lon) })
                  setResults(null)
                }}
              >
                {r.display_name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** 'Verre' met het lintje, als echte tekst zodat het meekleurt met het thema. */
export function Wordmark() {
  return (
    <span className="wordmark" aria-label="Verre">
      Verre
      <span className="ribbon" aria-hidden />
    </span>
  )
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      {children}
    </div>
  )
}
