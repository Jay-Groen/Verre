// Genereert het Verre-logo en alle icoonformaten in public/.
// Draai opnieuw na een logo-wijziging: npm run icons
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import opentype from 'opentype.js'
import sharp from 'sharp'

const root = fileURLToPath(new URL('..', import.meta.url))
const out = (f) => root + 'public/' + f
const font = (pkg, file) =>
  opentype.parse(readFileSync(root + `node_modules/@fontsource/${pkg}/files/${file}`).buffer)

const fraunces = font('fraunces', 'fraunces-latin-600-normal.woff')
const jakarta = font('plus-jakarta-sans', 'plus-jakarta-sans-latin-500-normal.woff')

const C = { indigo: '#3d5a98', sun: '#d64933', cream: '#f7f4ee', ink: '#1f2330' }

/** Het beeldmerk op een 100×100-raster: een V-vallei met de zon erin. */
const mark = `<circle cx="50" cy="44" r="11" fill="${C.sun}"/><path d="M24 28 L50 78 L76 28" fill="none" stroke="${C.cream}" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/>`

const svg = (w, h, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>\n`

/** Rond icoon (favicon, PWA). */
const icon = svg(100, 100, `<rect width="100" height="100" rx="24" fill="${C.indigo}"/>${mark}`)
/** Vierkant zonder transparantie; iOS rondt zelf af. */
const iconSquare = svg(100, 100, `<rect width="100" height="100" fill="${C.indigo}"/>${mark}`)
/** Android 'maskable': inhoud binnen de veilige 80% in het midden. */
const iconMaskable = svg(100, 100, `<rect width="100" height="100" fill="${C.indigo}"/><g transform="translate(12 12) scale(0.76)">${mark}</g>`)

/** Eigen serializer: toPathData(n) van opentype.js geeft soms 'NaN' bij afronden. */
function pathData(p) {
  const n = (v) => +v.toFixed(2)
  return p.commands
    .map((c) => {
      if (c.type === 'Z') return 'Z'
      if (c.type === 'Q') return `Q${n(c.x1)} ${n(c.y1)} ${n(c.x)} ${n(c.y)}`
      if (c.type === 'C') return `C${n(c.x1)} ${n(c.y1)} ${n(c.x2)} ${n(c.y2)} ${n(c.x)} ${n(c.y)}`
      return `${c.type}${n(c.x)} ${n(c.y)}`
    })
    .join('')
}

/** Zet tekst glyph voor glyph om naar een pad (met kerning, zonder ligaturen:
 *  opentype.js ondersteunt niet alle substitutie-tabellen van deze fonts). */
function text(f, str, x, y, size, fill) {
  const scale = size / f.unitsPerEm
  const glyphs = [...str].map((ch) => f.charToGlyph(ch))
  const d = []
  let pen = x
  glyphs.forEach((g, i) => {
    if (g.unicode !== 32) d.push(pathData(g.getPath(pen, y, size)))
    pen += (g.advanceWidth || f.unitsPerEm * 0.26) * scale
    const k = glyphs[i + 1] ? f.getKerningValue(g, glyphs[i + 1]) : 0
    if (Number.isFinite(k)) pen += k * scale
  })
  return { d: `<path d="${d.join('')}" fill="${fill}"/>`, width: pen - x }
}

/** Woordmerk: icoon + 'Verre' als paden, zodat het font niet nodig is. */
function wordmark(fill) {
  const t = text(fraunces, 'Verre', 124, 76, 80, fill)
  const w = Math.ceil(124 + t.width + 4)
  return svg(w, 100, `<rect width="100" height="100" rx="24" fill="${C.indigo}"/>${mark}${t.d}`)
}

function ogImage() {
  const W = 1200
  const H = 630
  const name = text(fraunces, 'Verre', 0, 0, 150, C.ink)
  const tag = text(jakarta, 'Plan je reis overzichtelijk', 0, 0, 40, '#6b6f7b')
  const markSize = 150
  const rowW = markSize + 40 + name.width
  const x0 = (W - rowW) / 2
  const nameX = x0 + markSize + 40
  return svg(
    W,
    H,
    `<rect width="${W}" height="${H}" fill="${C.cream}"/>` +
      `<g transform="translate(${x0} 190) scale(${markSize / 100})"><rect width="100" height="100" rx="24" fill="${C.indigo}"/>${mark}</g>` +
      text(fraunces, 'Verre', nameX, 312, 150, C.ink).d +
      text(jakarta, 'Plan je reis overzichtelijk', (W - tag.width) / 2, 450, 40, '#6b6f7b').d,
  )
}

const png = (src, size, file, h = size) =>
  sharp(Buffer.from(src), { density: 72 * Math.ceil(size / 100) * 4 })
    .resize(size, h)
    .png()
    .toFile(out(file))

writeFileSync(out('favicon.svg'), icon)
writeFileSync(out('logo.svg'), wordmark(C.ink))
writeFileSync(out('logo-light.svg'), wordmark(C.cream))

await Promise.all([
  png(icon, 32, 'favicon-32.png'),
  png(iconSquare, 180, 'apple-touch-icon.png'),
  png(icon, 192, 'icon-192.png'),
  png(icon, 512, 'icon-512.png'),
  png(iconMaskable, 512, 'icon-maskable-512.png'),
  sharp(Buffer.from(ogImage())).png().toFile(out('og-image.png')),
])

writeFileSync(
  out('site.webmanifest'),
  JSON.stringify(
    {
      name: 'Verre',
      short_name: 'Verre',
      description: 'Plan je reis overzichtelijk',
      start_url: '.',
      display: 'standalone',
      background_color: C.cream,
      theme_color: C.indigo,
      icons: [
        { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
        { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    null,
    2,
  ) + '\n',
)

console.log('Iconen gegenereerd in public/')
