/** Haalt uit een geplakte link zoveel mogelijk op: naam, coördinaten en soort site. */
export interface LinkInfo {
  url: string
  title?: string
  lat?: number
  lng?: number
  /** Korte deellink (bijv. maps.app.goo.gl) die de browser niet kan uitlezen. */
  short?: boolean
  site?: string
}

const num = (s?: string | null) => {
  const n = Number(s)
  return s && Number.isFinite(n) ? n : undefined
}
const valid = (lat?: number, lng?: number) =>
  lat !== undefined && lng !== undefined && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : {}

const decode = (s: string) => {
  try {
    return decodeURIComponent(s.replace(/\+/g, ' '))
  } catch {
    return s
  }
}

/** 'beste-ramen-in-tokyo_2024' → 'Beste ramen in tokyo' */
function fromSlug(path: string) {
  const parts = path.split('/').filter((p) => p && !/^\d+$/.test(p) && !/^(p|reel|watch|video|blog|posts?|nl|en|index\.\w+)$/i.test(p))
  const last = parts.at(-1)
  if (!last) return undefined
  const words = decode(last)
    .replace(/\.\w{2,5}$/, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+\d{3,}$/, '')
    .trim()
  if (words.length < 3 || /^[\w]{8,}$/.test(words)) return undefined // id's als 'Cx8kP2a9' overslaan
  return words.charAt(0).toUpperCase() + words.slice(1)
}

export function parseLink(raw: string): LinkInfo | null {
  let u: URL
  try {
    u = new URL(raw.trim())
  } catch {
    return null
  }
  if (!/^https?:$/.test(u.protocol)) return null
  const host = u.hostname.replace(/^www\./, '')
  const info: LinkInfo = { url: u.toString(), site: host }

  // Google Maps
  if ((/(^|\.)google\.[a-z.]+$/.test(host) && u.pathname.startsWith('/maps')) || host === 'maps.google.com') {
    info.site = 'Google Maps'
    const place = u.pathname.match(/\/place\/([^/]+)/)
    if (place) info.title = decode(place[1])
    const pin = u.href.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/) // exacte plek
    const view = u.pathname.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/) // middelpunt van de kaart
    const q = u.searchParams.get('q') ?? u.searchParams.get('query') ?? u.searchParams.get('destination')
    const qPos = q?.match(/^\s*(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)\s*$/)
    if (pin) Object.assign(info, valid(num(pin[1]), num(pin[2])))
    else if (qPos) Object.assign(info, valid(num(qPos[1]), num(qPos[2])))
    else if (view && place) Object.assign(info, valid(num(view[1]), num(view[2])))
    if (!info.title && q && !qPos) info.title = q
    return info
  }
  if (host === 'maps.app.goo.gl' || host === 'goo.gl') return { ...info, site: 'Google Maps', short: true }

  // Apple Kaarten
  if (host === 'maps.apple.com' || host === 'maps.apple') {
    info.site = 'Apple Kaarten'
    const ll = (u.searchParams.get('ll') ?? u.searchParams.get('coordinate') ?? u.searchParams.get('sll'))?.split(',')
    if (ll) Object.assign(info, valid(num(ll[0]), num(ll[1])))
    info.title = u.searchParams.get('q') ?? u.searchParams.get('name') ?? u.searchParams.get('address') ?? undefined
    return info
  }

  // OpenStreetMap
  if (host.endsWith('openstreetmap.org')) {
    info.site = 'OpenStreetMap'
    const m = u.hash.match(/map=\d+\/(-?\d+\.\d+)\/(-?\d+\.\d+)/)
    Object.assign(info, valid(num(u.searchParams.get('mlat')) ?? num(m?.[1]), num(u.searchParams.get('mlon')) ?? num(m?.[2])))
    return info
  }

  // Overige sites: titel uit het adres, bijv. een blog of TripAdvisor-pagina.
  if (/tripadvisor\./.test(host)) {
    const m = u.pathname.match(/-Reviews-([^-]+(?:-[^-]+)*?)-[^-]+\.html/)
    if (m) info.title = decode(m[1]).replace(/_/g, ' ')
  }
  if (!/instagram|tiktok|youtube|youtu\.be|facebook|x\.com|twitter/.test(host)) info.title ??= fromSlug(u.pathname)
  return info
}

/** Stad bij coördinaten (Nominatim), om een idee aan de juiste stop te koppelen. */
export async function cityAt(lat: number, lng: number): Promise<string | undefined> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&zoom=10&accept-language=nl&lat=${lat}&lon=${lng}`,
    )
    const j = (await res.json()) as { address?: Record<string, string> }
    const a = j.address ?? {}
    return a.city ?? a.town ?? a.village ?? a.municipality ?? a.county
  } catch {
    return undefined
  }
}

/** Eerste zoekresultaat voor een naam (Nominatim). */
export async function findPlace(q: string): Promise<{ lat: number; lng: number } | undefined> {
  try {
    const res = await fetch(
      'https://nominatim.openstreetmap.org/search?format=json&limit=1&accept-language=nl&q=' + encodeURIComponent(q),
    )
    const [r] = (await res.json()) as { lat: string; lon: string }[]
    return r ? { lat: Number(r.lat), lng: Number(r.lon) } : undefined
  } catch {
    return undefined
  }
}
