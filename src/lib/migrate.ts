import type { Trip } from '../types'

/** Oudere reizen (van vóór de vrije valutakeuze) hadden een vaste yen/euro-koers. */
interface LegacyTrip {
  jpyPerEur?: number
  budgetEUR?: number
}

/** Brengt een opgeslagen reis naar het huidige datamodel. */
export function normalizeTrip(raw: Trip & LegacyTrip): Trip {
  const t = { ...raw }
  if (!t.homeCurrency) t.homeCurrency = 'EUR'
  if (!t.localCurrency) t.localCurrency = t.jpyPerEur ? 'JPY' : t.homeCurrency
  if (!t.rate) t.rate = t.jpyPerEur ?? 1
  if (t.budget === undefined && t.budgetEUR !== undefined) t.budget = t.budgetEUR
  delete t.jpyPerEur
  delete t.budgetEUR
  return t
}
