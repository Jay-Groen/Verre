import react from '@vitejs/plugin-react'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { defineConfig, type Plugin } from 'vite'

/**
 * Bouwt de service worker (src/sw.template.js) met de lijst van alle gebouwde bestanden,
 * zodat de app na één bezoek ook zonder internet opent.
 */
function serviceWorker(): Plugin {
  return {
    name: 'verre-service-worker',
    apply: 'build',
    generateBundle(_, bundle) {
      const files = Object.keys(bundle).filter((f) => !f.endsWith('.map'))
      const publicFiles = ['favicon.svg', 'favicon-32.png', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png', 'mark-white.svg', 'site.webmanifest']
      const precache = ['./', ...files, ...publicFiles].map((f) => (f === './' ? f : './' + f))
      const template = readFileSync('src/sw.template.js', 'utf8')
      const version = createHash('sha1').update(precache.join('|') + template).digest('hex').slice(0, 10)
      this.emitFile({
        type: 'asset',
        fileName: 'sw.js',
        source: template
          .replace('__VERSION__', version)
          .replace('[/*__PRECACHE__*/]', JSON.stringify(precache)),
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), serviceWorker()],
})
