/** Kosten verdelen: wie heeft wat betaald, en wie moet wie terugbetalen. */

export interface Share {
  /** Bedrag in thuisvaluta. */
  amount: number
  paidBy: string
  /** Over wie de kosten verdeeld worden. */
  among: string[]
}

export interface Transfer {
  from: string
  to: string
  amount: number
}

/** Saldo per persoon: positief = krijgt geld terug, negatief = moet betalen. */
export function balances(people: string[], shares: Share[]): Record<string, number> {
  const bal: Record<string, number> = Object.fromEntries(people.map((p) => [p, 0]))
  for (const s of shares) {
    const among = s.among.filter((p) => p in bal)
    if (!(s.paidBy in bal) || among.length === 0) continue
    bal[s.paidBy] += s.amount
    for (const p of among) bal[p] -= s.amount / among.length
  }
  return bal
}

/** Zo min mogelijk overboekingen: grootste schuldenaar betaalt steeds de grootste ontvanger. */
export function settle(bal: Record<string, number>): Transfer[] {
  const pos = Object.entries(bal).filter(([, v]) => v > 0.005).map(([p, v]) => ({ p, v }))
  const neg = Object.entries(bal).filter(([, v]) => v < -0.005).map(([p, v]) => ({ p, v: -v }))
  const out: Transfer[] = []
  while (pos.length && neg.length) {
    pos.sort((a, b) => b.v - a.v)
    neg.sort((a, b) => b.v - a.v)
    const amount = Math.min(pos[0].v, neg[0].v)
    out.push({ from: neg[0].p, to: pos[0].p, amount })
    pos[0].v -= amount
    neg[0].v -= amount
    if (pos[0].v < 0.005) pos.shift()
    if (neg[0].v < 0.005) neg.shift()
  }
  return out
}

/** Namen van de reizigers; zonder ingevulde namen 'Reiziger 1', 'Reiziger 2', … */
export const peopleOf = (trip: { people?: string[]; travelers: number }) =>
  trip.people?.length ? trip.people : Array.from({ length: trip.travelers }, (_, i) => `Reiziger ${i + 1}`)
