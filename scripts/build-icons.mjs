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

/** Merkkleuren, gelijk aan de tokens in src/index.css. */
const C = {
  indigo: '#3d5a98',
  navy: '#22396a',
  ribbon: '#e0603f',
  white: '#ffffff',
  lilac: '#c9d0e2',
  ink: '#1c2540',
}

/** Het beeldmerk (reisdagboek met lintje) op een 100×100-raster, naar Jay's tekening. */
const mark = (() => {
  const x = 26.5
  const y = 16
  const dots = [7.6, 21, 34.2, 47.4, 60.4]
    .map((cy) => `<ellipse cx="${x + 0.6}" cy="${y + cy}" rx="3.2" ry="2.3" fill="${C.navy}"/>`)
    .join('')
  return (
    `<rect x="${x}" y="${y}" width="50.5" height="68" rx="4.5" fill="${C.white}"/>` +
    `<path d="M${x + 32.4} ${y} H${x + 43.5} V${y + 28} L${x + 37.95} ${y + 23.6} L${x + 32.4} ${y + 28} Z" fill="${C.ribbon}"/>` +
    `<rect x="${x + 8.9}" y="${y + 36.9}" width="30.8" height="3.8" rx="1.9" fill="${C.lilac}"/>` +
    `<rect x="${x + 8.9}" y="${y + 44.8}" width="23.2" height="3.8" rx="1.9" fill="${C.lilac}"/>` +
    dots
  )
})()

const svg = (w, h, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>\n`

/** Rond icoon (favicon, PWA). */
const icon = svg(100, 100, `<rect width="100" height="100" rx="24" fill="${C.indigo}"/>${mark}`)
/** Vierkant zonder transparantie; iOS rondt zelf af. */
const iconSquare = svg(100, 100, `<rect width="100" height="100" fill="${C.indigo}"/>${mark}`)
/** Android 'maskable': inhoud binnen de veilige 80% in het midden. */
const iconMaskable = svg(100, 100, `<rect width="100" height="100" fill="${C.indigo}"/><g transform="translate(12 12) scale(0.76)">${mark}</g>`)
/** Alleen het dagboek, voor op een gekleurde achtergrond. */
const markOnly = svg(100, 100, mark)

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

const capHeight = fraunces.tables.os2.sCapHeight / fraunces.unitsPerEm

/**
 * 'Verre' met het lintje achter de e, in de verhoudingen van Jay's ontwerp
 * (gemeten in kapitaalhoogtes): lintje 0,25 breed, 0,58 hoog, steekt 0,04 boven
 * de V uit, 0,15 ruimte na de e.
 */
function wordmarkParts(x, baseline, size, fill) {
  const cap = capHeight * size
  const t = text(fraunces, 'Verre', x, baseline, size, fill)
  const rx = x + t.width + cap * 0.15
  const rw = cap * 0.25
  const rh = cap * 0.58
  const top = baseline - cap - cap * 0.04
  const notch = cap * 0.105
  const ribbon = `<path d="M${rx.toFixed(2)} ${top.toFixed(2)} h${rw.toFixed(2)} v${rh.toFixed(2)} l${(-rw / 2).toFixed(2)} ${(-notch).toFixed(2)} l${(-rw / 2).toFixed(2)} ${notch.toFixed(2)} Z" fill="${C.ribbon}"/>`
  return { body: t.d + ribbon, width: rx + rw - x, top, cap }
}

function wordmark(fill) {
  const size = 100
  const cap = capHeight * size
  const pad = 4
  const baseline = pad + cap * 1.04
  const p = wordmarkParts(pad, baseline, size, fill)
  return svg(Math.ceil(p.width + pad * 2), Math.ceil(baseline + size * 0.06 + pad), p.body)
}

/** Icoon + woordmerk naast elkaar. */
function lockup(fill) {
  const size = 100
  const cap = capHeight * size
  const iconH = cap * 1.6
  const gap = iconH * 0.45
  const baseline = (iconH + cap) / 2
  const p = wordmarkParts(iconH + gap, baseline, size, fill)
  const s = iconH / 100
  return svg(
    Math.ceil(iconH + gap + p.width + 2),
    Math.ceil(iconH),
    `<g transform="scale(${s})"><rect width="100" height="100" rx="24" fill="${C.indigo}"/>${mark}</g>${p.body}`,
  )
}

function ogImage() {
  const W = 1200
  const H = 630
  const size = 150
  const cap = capHeight * size
  // Verhoudingen uit Jay's ontwerp: boekje 1,62× kapitaalhoogte, 2,05× ruimte tot de V.
  const bookH = cap * 1.62
  const s = bookH / 68
  const bookW = 52 * s
  const gap = cap * 2.05
  const probe = wordmarkParts(0, 0, size, C.white)
  const rowW = bookW + gap + probe.width
  const x0 = (W - rowW) / 2
  const y0 = 200
  const baseline = y0 + (bookH + cap) / 2
  const tag = text(jakarta, 'Plan je reis overzichtelijk', 0, 0, 40, C.lilac)
  return svg(
    W,
    H,
    `<rect width="${W}" height="${H}" fill="${C.indigo}"/>` +
      `<g transform="translate(${x0 - 25 * s} ${y0 - 16 * s}) scale(${s})">${mark}</g>` +
      wordmarkParts(x0 + bookW + gap, baseline, size, C.white).body +
      text(jakarta, 'Plan je reis overzichtelijk', (W - tag.width) / 2, y0 + bookH + 120, 40, C.lilac).d,
  )
}

const png = (src, size, file, h = size) =>
  sharp(Buffer.from(src), { density: 72 * Math.ceil(size / 100) * 4 })
    .resize(size, h)
    .png()
    .toFile(out(file))

writeFileSync(out('favicon.svg'), icon)
writeFileSync(out('mark-white.svg'), markOnly)
writeFileSync(out('wordmark.svg'), wordmark(C.ink))
writeFileSync(out('wordmark-white.svg'), wordmark(C.white))
writeFileSync(out('logo.svg'), lockup(C.ink))
writeFileSync(out('logo-white.svg'), lockup(C.white))

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
      background_color: C.indigo,
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
