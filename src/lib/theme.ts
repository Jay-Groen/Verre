import { useEffect, useState } from 'react'

export type Theme = 'light' | 'dark'
const KEY = 'verre.theme'
const media = () => window.matchMedia('(prefers-color-scheme: dark)')

/** Gekozen thema, of null als de gebruiker de browserinstelling volgt. */
function stored(): Theme | null {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'light' || v === 'dark' ? v : null
  } catch {
    return null
  }
}

const system = (): Theme => (media().matches ? 'dark' : 'light')

function apply(t: Theme) {
  document.documentElement.dataset.theme = t
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t === 'dark' ? '#22396a' : '#3d5a98')
}

/**
 * Licht/donker: standaard volgens de browser, met een knop om te wisselen.
 * Een eigen keuze wordt onthouden; zonder keuze volgt de app wijzigingen in de browser.
 */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => stored() ?? system())

  useEffect(() => apply(theme), [theme])

  useEffect(() => {
    const m = media()
    const onChange = () => {
      if (!stored()) setTheme(system())
    }
    m.addEventListener('change', onChange)
    return () => m.removeEventListener('change', onChange)
  }, [])

  const toggle = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    try {
      // Kies je weer hetzelfde als de browser, volg dan voortaan gewoon de browser.
      if (next === system()) localStorage.removeItem(KEY)
      else localStorage.setItem(KEY, next)
    } catch {
      /* ignore */
    }
    setTheme(next)
  }

  return { theme, toggle }
}
