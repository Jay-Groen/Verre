import { useEffect, useMemo, useState } from 'react'
import { CircleMarker, MapContainer, Polyline, Popup, TileLayer, Tooltip, useMap } from 'react-leaflet'
import type { LatLngTuple } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { Trip } from '../types'
import { MODE_ICON } from '../types'
import { buildDays, fitIdea, sortStops } from '../lib/plan'
import { fmtDay } from '../lib/dates'
import { NavLink } from './ui'

/** Wereldkaart als niets bekend is. */
const WORLD: LatLngTuple = [25, 10]

function FitBounds({ points }: { points: LatLngTuple[] }) {
  const map = useMap()
  const key = JSON.stringify(points)
  useEffect(() => {
    if (points.length === 1) map.setView(points[0], 13)
    else if (points.length > 1) map.fitBounds(points, { padding: [40, 40], maxZoom: 14 })
  }, [key, map])
  return null
}

/** Vraagt de huidige locatie op (met toestemming van de browser). */
function locate(): Promise<LatLngTuple | null> {
  return new Promise((resolve) => {
    if (!('geolocation' in navigator)) return resolve(null)
    navigator.geolocation.getCurrentPosition(
      (p) => resolve([p.coords.latitude, p.coords.longitude]),
      () => resolve(null),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 600_000 },
    )
  })
}

/** Zonder plekken in de reis start de kaart op je huidige locatie. */
function StartAtUser({ enabled, onFound }: { enabled: boolean; onFound: (p: LatLngTuple) => void }) {
  const map = useMap()
  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    locate().then((p) => {
      if (!p || cancelled) return
      onFound(p)
      map.setView(p, 11)
    })
    return () => {
      cancelled = true
    }
    // Alleen bij het openen van de kaart.
  }, [enabled, map]) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}

function LocateButton({ onFound }: { onFound: (p: LatLngTuple) => void }) {
  const map = useMap()
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  return (
    <div className="leaflet-top leaflet-right">
      <div className="leaflet-control">
        <button
          type="button"
          className="map-locate"
          disabled={busy}
          title={failed ? 'Locatie niet beschikbaar (geen toestemming?)' : 'Ga naar mijn locatie'}
          onClick={async () => {
            setBusy(true)
            const p = await locate()
            setBusy(false)
            setFailed(!p)
            if (p) {
              onFound(p)
              map.flyTo(p, 13)
            }
          }}
        >
          {busy ? 'Zoeken…' : failed ? 'Geen locatie' : 'Mijn locatie'}
        </button>
      </div>
    </div>
  )
}

export function MapView({ trip }: { trip: Trip }) {
  const days = useMemo(() => buildDays(trip), [trip])
  const [day, setDay] = useState<string>('all')
  const [showIdeas, setShowIdeas] = useState(true)
  const [me, setMe] = useState<LatLngTuple | null>(null)
  const stops = sortStops(trip.stops).filter((s) => s.lat !== undefined && s.lng !== undefined)

  const dayInfo = days.find((d) => d.date === day)
  const colorFor = (date: string) => days.find((d) => d.date === date)?.stop?.color ?? '#666'

  const acts = trip.activities
    .filter((a) => a.place?.lat !== undefined && a.place.lng !== undefined)
    .filter((a) => day === 'all' || a.date === day)
  const actsSorted = dayInfo ? dayInfo.activities.filter((a) => acts.includes(a)) : acts

  const ideas = showIdeas
    ? trip.ideas
        .filter((i) => i.place?.lat !== undefined && !trip.activities.some((a) => a.ideaId === i.id) && !i.dropped)
        .filter((i) => {
          if (day === 'all') return true
          const f = fitIdea(i, trip, days)
          return (f.kind === 'fits' || f.kind === 'full') && f.options.some((o) => o.date === day)
        })
    : []

  const visibleStops = day === 'all' ? stops : stops.filter((s) => s.id === dayInfo?.stop?.id)
  const points: LatLngTuple[] = [
    ...visibleStops.map((s) => [s.lat!, s.lng!] as LatLngTuple),
    ...acts.map((a) => [a.place!.lat!, a.place!.lng!] as LatLngTuple),
    ...ideas.map((i) => [i.place!.lat!, i.place!.lng!] as LatLngTuple),
  ]

  return (
    <div className="map-view">
      <div className="map-toolbar">
        <select value={day} onChange={(e) => setDay(e.target.value)}>
          <option value="all">Hele reis</option>
          {days.map((d) => (
            <option key={d.date} value={d.date}>
              Dag {d.index + 1} · {fmtDay(d.date)} {d.stop ? `· ${d.stop.city}` : ''}
            </option>
          ))}
        </select>
        <label className="check">
          <input type="checkbox" checked={showIdeas} onChange={(e) => setShowIdeas(e.target.checked)} /> Open ideeën
          tonen
        </label>
        <span className="legend">
          <i className="lg-stay" /> verblijf <i className="lg-act" /> activiteit <i className="lg-idea" /> idee
        </span>
      </div>
      <div className="map-wrap">
        <MapContainer center={WORLD} zoom={2} scrollWheelZoom className="map">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <FitBounds points={points} />
          <StartAtUser enabled={points.length === 0} onFound={setMe} />
          <LocateButton onFound={setMe} />
          {me && (
            <CircleMarker
              center={me}
              radius={8}
              pathOptions={{ color: '#fff', weight: 3, fillColor: '#2f7de1', fillOpacity: 1 }}
            >
              <Tooltip direction="top" offset={[0, -6]}>
                Je bent hier
              </Tooltip>
            </CircleMarker>
          )}
          {day === 'all' &&
            stops.slice(1).map((s, i) => {
              const leg = trip.legs.find((l) => l.toId === s.id)
              return (
                <Polyline
                  key={s.id}
                  positions={[[stops[i].lat!, stops[i].lng!], [s.lat!, s.lng!]]}
                  pathOptions={{
                    color: '#3d5a98',
                    weight: 3,
                    dashArray: leg?.mode === 'Vlucht' ? '2 8' : '6 8',
                    opacity: 0.7,
                  }}
                >
                  <Tooltip sticky>
                    {leg ? `${MODE_ICON[leg.mode]} ${leg.mode}${leg.carrier ? ` · ${leg.carrier}` : ''}` : '🧭'} {stops[i].city} → {s.city}
                  </Tooltip>
                </Polyline>
              )
            })}
          {dayInfo && actsSorted.length > 1 && (
            <Polyline
              positions={actsSorted.map((a) => [a.place!.lat!, a.place!.lng!] as LatLngTuple)}
              pathOptions={{ color: dayInfo.stop?.color ?? '#e0603f', weight: 3, opacity: 0.6 }}
            />
          )}
          {visibleStops.map((s) => (
            <CircleMarker
              key={s.id}
              center={[s.lat!, s.lng!]}
              radius={11}
              pathOptions={{ color: '#fff', weight: 3, fillColor: s.color, fillOpacity: 1 }}
            >
              <Tooltip direction="top" offset={[0, -8]}>
                🛏️ {s.city}
              </Tooltip>
              <Popup>
                <strong>{s.city}</strong>
                <br />
                {s.stayName ?? 'Verblijf'}
                <br />
                {fmtDay(s.start)} – {fmtDay(s.end)}
                <br />
                <NavLink to={{ lat: s.lat, lng: s.lng }} label="Route hierheen" />
              </Popup>
            </CircleMarker>
          ))}
          {actsSorted.map((a, i) => (
            <CircleMarker
              key={a.id}
              center={[a.place!.lat!, a.place!.lng!]}
              radius={7}
              pathOptions={{ color: '#fff', weight: 2, fillColor: colorFor(a.date), fillOpacity: 0.95 }}
            >
              <Tooltip direction="top" offset={[0, -6]}>
                {dayInfo ? `${i + 1}. ` : ''}
                {a.title}
              </Tooltip>
              <Popup>
                <strong>{a.title}</strong>
                <br />
                Dag {(days.find((d) => d.date === a.date)?.index ?? 0) + 1} · {fmtDay(a.date)}
                {a.time ? ` · ${a.time}` : ''}
                <br />
                <NavLink to={a.place} label="Route hierheen" />
              </Popup>
            </CircleMarker>
          ))}
          {ideas.map((i) => (
            <CircleMarker
              key={i.id}
              center={[i.place!.lat!, i.place!.lng!]}
              radius={6}
              pathOptions={{ color: '#e0603f', weight: 2, dashArray: '2 3', fillColor: '#f6c2b2', fillOpacity: 0.9 }}
            >
              <Tooltip direction="top" offset={[0, -6]}>
                💡 {i.title}
              </Tooltip>
              <Popup>
                <strong>💡 {i.title}</strong>
                <br />
                {i.city ?? 'Geen stad'} · nog niet gepland
                <br />
                <NavLink to={i.place} label="Route hierheen" />
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>
      {points.length === 0 && (
        <p className="muted center">
          Nog niets op de kaart. Gebruik “Zoek op kaart” bij een activiteit, idee of verblijf om een locatie te koppelen.
        </p>
      )}
    </div>
  )
}
