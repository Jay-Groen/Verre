/** Veelgebruikte reisvaluta (ISO 4217) met Nederlandse naam. */
export const CURRENCIES: [code: string, name: string][] = [
  ['EUR', 'Euro'],
  ['USD', 'Amerikaanse dollar'],
  ['GBP', 'Britse pond'],
  ['CHF', 'Zwitserse frank'],
  ['SEK', 'Zweedse kroon'],
  ['NOK', 'Noorse kroon'],
  ['DKK', 'Deense kroon'],
  ['ISK', 'IJslandse kroon'],
  ['PLN', 'Poolse zloty'],
  ['CZK', 'Tsjechische kroon'],
  ['HUF', 'Hongaarse forint'],
  ['RON', 'Roemeense leu'],
  ['TRY', 'Turkse lira'],
  ['MAD', 'Marokkaanse dirham'],
  ['EGP', 'Egyptisch pond'],
  ['ZAR', 'Zuid-Afrikaanse rand'],
  ['AED', 'VAE-dirham'],
  ['INR', 'Indiase roepie'],
  ['THB', 'Thaise baht'],
  ['VND', 'Vietnamese dong'],
  ['IDR', 'Indonesische roepia'],
  ['MYR', 'Maleisische ringgit'],
  ['SGD', 'Singaporese dollar'],
  ['PHP', 'Filipijnse peso'],
  ['CNY', 'Chinese yuan'],
  ['HKD', 'Hongkongse dollar'],
  ['KRW', 'Zuid-Koreaanse won'],
  ['JPY', 'Japanse yen'],
  ['AUD', 'Australische dollar'],
  ['NZD', 'Nieuw-Zeelandse dollar'],
  ['CAD', 'Canadese dollar'],
  ['MXN', 'Mexicaanse peso'],
  ['BRL', 'Braziliaanse real'],
  ['ARS', 'Argentijnse peso'],
]

export function currencySymbol(code: string) {
  try {
    const part = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: code, currencyDisplay: 'narrowSymbol' })
      .formatToParts(0)
      .find((p) => p.type === 'currency')
    return part?.value ?? code
  } catch {
    return code
  }
}

/** Actuele koers (ECB, via frankfurter.dev): hoeveel `to` je krijgt voor 1 `from`. */
export async function fetchRate(from: string, to: string): Promise<number | null> {
  if (from === to) return 1
  try {
    const res = await fetch(`https://api.frankfurter.dev/v1/latest?base=${from}&symbols=${to}`)
    if (!res.ok) return null
    const data = (await res.json()) as { rates?: Record<string, number> }
    return data.rates?.[to] ?? null
  } catch {
    return null
  }
}
