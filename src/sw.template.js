/* Verre service worker: laat de app ook zonder internet openen. Wordt bij `npm run build` gevuld. */
const VERSION = '__VERSION__'
const APP = `verre-app-${VERSION}`
const TILES = 'verre-tiles'
const MAX_TILES = 600
const PRECACHE = [/*__PRECACHE__*/]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(APP)
      .then((c) => c.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('verre-app-') && k !== APP).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

async function trimTiles() {
  const c = await caches.open(TILES)
  const keys = await c.keys()
  for (const k of keys.slice(0, Math.max(0, keys.length - MAX_TILES))) await c.delete(k)
}

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)

  // Pagina's: eerst het netwerk (nieuwste versie), offline de opgeslagen app.
  if (req.mode === 'navigate' && url.origin === self.location.origin) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone()
          caches.open(APP).then((c) => c.put('./', copy))
          return res
        })
        .catch(() => caches.match('./', { ignoreSearch: true, ignoreVary: true }).then((r) => r || Response.error())),
    )
    return
  }

  // Eigen bestanden (scripts, stijlen, lettertypes, iconen): eerst uit de cache.
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(req, { ignoreVary: true }).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok && url.pathname.startsWith('/assets/')) {
              const copy = res.clone()
              caches.open(APP).then((c) => c.put(req, copy))
            }
            return res
          }),
      ),
    )
    return
  }

  // Kaarttegels: snel uit de cache, op de achtergrond ververst; beperkt aantal.
  if (/(^|\.)tile\.openstreetmap\.org$/.test(url.hostname)) {
    event.respondWith(
      caches.open(TILES).then(async (c) => {
        const hit = await c.match(req, { ignoreVary: true })
        const fresh = fetch(req)
          .then((res) => {
            if (res.ok || res.type === 'opaque') {
              c.put(req, res.clone()).then(trimTiles)
            }
            return res
          })
          .catch(() => hit || Response.error())
        return hit || fresh
      }),
    )
  }
  // Al het andere (Supabase, weer, zoeken) gaat gewoon over het netwerk; de app bewaart zelf de reisdata.
})
