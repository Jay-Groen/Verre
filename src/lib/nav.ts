/** Iets waar je naartoe kunt navigeren: coördinaten en/of een naam of adres. */
export interface NavTarget {
  lat?: number
  lng?: number
  name?: string
  /** Extra context voor zoeken op naam, zoals de stad. */
  near?: string
}

export const canNavigate = (t?: NavTarget) => !!t && ((t.lat !== undefined && t.lng !== undefined) || !!t.name?.trim())

/**
 * Link die op telefoons de kaarten-app opent met een route ernaartoe.
 * Google Maps' universele link werkt op Android, iOS en desktop; op Apple-apparaten
 * gebruiken we Apple Kaarten, dat daar altijd geïnstalleerd is.
 */
export function navUrl(t: NavTarget): string {
  const hasPos = t.lat !== undefined && t.lng !== undefined
  const q = hasPos ? `${t.lat},${t.lng}` : [t.name, t.near].filter(Boolean).join(', ')
  const apple = /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent) && 'ontouchend' in document
  if (apple) return `https://maps.apple.com/?daddr=${encodeURIComponent(q)}&dirflg=r`
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}&travelmode=transit`
}
