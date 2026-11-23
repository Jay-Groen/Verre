import { useEffect, useState } from 'react'
import type { Trip } from '../types'
import { addDays, daysBetween, realToday as todayIso } from './dates'
import { sortStops } from './plan'

/** Weer voor één dag, via Open-Meteo (gratis, zonder sleutel). */
export interface DayWeather {
  code: number
  tmax: number
  tmin: number
  /** Kans op regen (%) bij een verwachting, of mm neerslag bij vorig jaar. */
  rain?: number
  kind: 'forecast' | 'lastyear'
  /** Bij 'lastyear': het jaar waar de meting vandaan komt. */
  year?: number
}

const FORECAST_DAYS = 15

/** WMO-weercodes naar een icoon en omschrijving. */
export function weatherIcon(code: number): [string, string] {
  if (code === 0) return ['☀️', 'Zonnig']
  if (code <= 2) return ['🌤️', 'Licht bewolkt']
  if (code === 3) return ['☁️', 'Bewolkt']
  if (code <= 48) return ['🌫️', 'Mist']
  if (code <= 57) return ['🌦️', 'Motregen']
  if (code <= 67) return ['🌧️', 'Regen']
  if (code <= 77) return ['🌨️', 'Sneeuw']
  if (code <= 82) return ['🌦️', 'Buien']
  if (code <= 86) return ['🌨️', 'Sneeuwbuien']
  return ['⛈️', 'Onweer']
}

const CACHE = 'verre.weather.v1'
const TTL = 3 * 3600_000

function readCache(): Record<string, { at: number; data: Record<string, DayWeather> }> {
  try {
    return JSON.parse(localStorage.getItem(CACHE) ?? '{}')
  } catch {
    return {}
  }
}

function writeCache(key: string, data: Record<string, DayWeather>) {
  try {
    const all = readCache()
    // Oude items opruimen zodat de opslag klein blijft.
    for (const [k, v] of Object.entries(all)) if (Date.now() - v.at > TTL) delete all[k]
    all[key] = { at: Date.now(), data }
    localStorage.setItem(CACHE, JSON.stringify(all))
  } catch {
    /* opslag vol: dan maar zonder cache */
  }
}

interface Daily {
  time: string[]
  weather_code: (number | null)[]
  temperature_2m_max: (number | null)[]
  temperature_2m_min: (number | null)[]
  precipitation_probability_max?: (number | null)[]
  precipitation_sum?: (number | null)[]
}

async function fetchRange(lat: number, lng: number, start: string, end: string, kind: DayWeather['kind']) {
  const key = [lat.toFixed(2), lng.toFixed(2), start, end, kind].join('|')
  const hit = readCache()[key]
  if (hit && Date.now() - hit.at < TTL) return hit.data
  // Het meest recente jaar waarvan de metingen al beschikbaar zijn (archief loopt ~5 dagen achter).
  const years = kind === 'lastyear' ? Math.max(1, Math.ceil(daysBetween(addDays(todayIso(), -6), end) / 365)) : 0
  const shift = -365 * years
  const base = kind === 'forecast' ? 'https://api.open-meteo.com/v1/forecast' : 'https://archive-api.open-meteo.com/v1/archive'
  const rain = kind === 'forecast' ? 'precipitation_probability_max' : 'precipitation_sum'
  const url =
    `${base}?latitude=${lat}&longitude=${lng}&timezone=auto` +
    `&start_date=${addDays(start, shift)}&end_date=${addDays(end, shift)}` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,${rain}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Weer: ${res.status}`)
  const { daily } = (await res.json()) as { daily?: Daily }
  const data: Record<string, DayWeather> = {}
  daily?.time.forEach((t, i) => {
    const code = daily.weather_code[i]
    const tmax = daily.temperature_2m_max[i]
    const tmin = daily.temperature_2m_min[i]
    if (code == null || tmax == null || tmin == null) return
    data[addDays(t, -shift)] = { code, tmax, tmin, rain: (daily[rain] as (number | null)[] | undefined)?.[i] ?? undefined, kind, year: years ? Number(t.slice(0, 4)) : undefined }
  })
  writeCache(key, data)
  return data
}

/** Weer per datum voor alle stops met een locatie. */
export function useWeather(trip: Trip): Record<string, DayWeather> {
  const [weather, setWeather] = useState<Record<string, DayWeather>>({})
  const ranges = sortStops(trip.stops)
    .filter((s) => s.lat !== undefined && s.lng !== undefined)
    .map((s) => ({ lat: s.lat!, lng: s.lng!, start: s.start, end: addDays(s.end, -1) > s.start ? addDays(s.end, -1) : s.start }))
  // Laatste dag (vertrek) hoort bij de laatste stop.
  const key = JSON.stringify(ranges)

  useEffect(() => {
    let cancelled = false
    const today = todayIso()
    const lastForecast = addDays(today, FORECAST_DAYS)
    const jobs: Promise<Record<string, DayWeather>>[] = []
    for (const r of ranges) {
      // Binnen 15 dagen: echte verwachting. Daarna (of in het verleden): vorig jaar ter indicatie.
      const fStart = r.start < today ? today : r.start
      const fEnd = r.end > lastForecast ? lastForecast : r.end
      if (fStart <= fEnd) jobs.push(fetchRange(r.lat, r.lng, fStart, fEnd, 'forecast').catch(() => ({})))
      const lStart = r.start
      const lEnd = r.end
      if (daysBetween(today, lEnd) > FORECAST_DAYS || r.start < today)
        jobs.push(fetchRange(r.lat, r.lng, lStart, lEnd, 'lastyear').catch(() => ({})))
    }
    Promise.all(jobs).then((parts) => {
      if (cancelled) return
      const merged: Record<string, DayWeather> = {}
      // Verwachting gaat voor vorig jaar.
      for (const p of parts) for (const [d, w] of Object.entries(p)) if (w.kind === 'lastyear' && !merged[d]) merged[d] = w
      for (const p of parts) for (const [d, w] of Object.entries(p)) if (w.kind === 'forecast') merged[d] = w
      setWeather(merged)
    })
    return () => {
      cancelled = true
    }
    // ranges is afgeleid van key
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps

  return weather
}

export function weatherTitle(w: DayWeather) {
  const [, label] = weatherIcon(w.code)
  const rain =
    w.rain === undefined ? '' : w.kind === 'forecast' ? ` · ${Math.round(w.rain)}% kans op regen` : ` · ${w.rain.toFixed(1).replace('.', ',')} mm regen`
  return `${w.kind === 'forecast' ? 'Verwachting' : `Zo was het weer hier in ${w.year ?? 'een eerder jaar'}`}: ${label}, ${Math.round(w.tmax)}° / ${Math.round(w.tmin)}°${rain}`
}
