import { useState } from 'react'
import { CURRENCIES, currencySymbol, fetchRate } from '../lib/currency'
import { Field } from './ui'

interface Value {
  homeCurrency: string
  localCurrency: string
  rate: number
}

function CurrencySelect({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  const known = CURRENCIES.some(([c]) => c === value)
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      {!known && <option value={value}>{value}</option>}
      {CURRENCIES.map(([c, name]) => (
        <option key={c} value={c}>
          {c} · {name}
        </option>
      ))}
    </select>
  )
}

/** Thuisvaluta, valuta op de bestemming en de wisselkoers (met ophaalknop). */
export function CurrencyFields({ value, onChange }: { value: Value; onChange: (v: Partial<Value>) => void }) {
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const same = value.homeCurrency === value.localCurrency

  const load = async (home = value.homeCurrency, local = value.localCurrency) => {
    if (home === local) return onChange({ rate: 1 })
    setBusy(true)
    setMsg(null)
    const r = await fetchRate(home, local)
    setBusy(false)
    if (r) onChange({ rate: Number(r.toPrecision(5)) })
    else setMsg('Geen actuele koers gevonden voor deze valuta; vul hem zelf in.')
  }

  return (
    <>
      <Field label="Valuta op de bestemming">
        <CurrencySelect
          value={value.localCurrency}
          onChange={(localCurrency) => {
            onChange({ localCurrency })
            load(value.homeCurrency, localCurrency)
          }}
        />
      </Field>
      <Field label="Je rekent in">
        <CurrencySelect
          value={value.homeCurrency}
          onChange={(homeCurrency) => {
            onChange({ homeCurrency })
            load(homeCurrency, value.localCurrency)
          }}
        />
      </Field>
      {!same && (
        <Field label={`Wisselkoers: ${currencySymbol(value.localCurrency)} voor ${currencySymbol(value.homeCurrency)} 1`} wide>
          <div className="row nowrap">
            <input
              type="number"
              min={0}
              step="any"
              value={value.rate}
              onChange={(e) => onChange({ rate: Number(e.target.value) || 1 })}
            />
            <button type="button" className="btn ghost" onClick={() => load()} disabled={busy}>
              {busy ? 'Ophalen…' : 'Actuele koers'}
            </button>
          </div>
          {msg && <small className="warn-text">{msg}</small>}
        </Field>
      )}
    </>
  )
}
