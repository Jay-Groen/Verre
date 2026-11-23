/** ISO 4217-valutacode, bijv. 'EUR' of 'JPY'. */
export type Currency = string

/** Bijlage (ticket, bevestiging) bij een boeking. */
export interface Attachment {
  id: string
  name: string
  type: string
  size: number
  /** Pad in Supabase Storage (cloud) of sleutel in IndexedDB (lokaal). */
  path: string
  where: 'cloud' | 'local'
}

/** Boekingsgegevens, gedeeld door verblijven, vervoer en activiteiten. */
export interface Booking {
  /** Bevestigingsnummer of reserveringscode. */
  ref?: string
  /** Link naar de boeking of het ticket. */
  url?: string
  /** Uiterste datum om te boeken of kosteloos te annuleren. */
  deadline?: string
  files?: Attachment[]
}

export interface Place {
  name: string
  lat?: number
  lng?: number
  /** Openingstijden, bijv. 'Mo-Fr 09:00-17:00; Su off' (OpenStreetMap-notatie). */
  hours?: string
}

/** Een stop op de route: een stad waar je overnacht, met je verblijf. */
export interface Stop {
  id: string
  city: string
  /** Aankomstdatum (YYYY-MM-DD), eerste nacht. */
  start: string
  /** Vertrekdatum (YYYY-MM-DD), dag dat je uitcheckt. */
  end: string
  stayName?: string
  stayAddress?: string
  lat?: number
  lng?: number
  checkIn?: string
  checkOut?: string
  stayCost?: number
  stayCurrency: Currency
  booked: boolean
  booking?: Booking
  notes?: string
  color: string
  /** Wie het verblijf heeft betaald (voor kosten verdelen). */
  paidBy?: string
}

export const TRANSPORT_MODES = ['Vlucht', 'Trein', 'Bus', 'Auto', 'Boot', 'Anders'] as const
export type TransportMode = (typeof TRANSPORT_MODES)[number]
export const MODE_ICON: Record<TransportMode, string> = {
  Vlucht: '✈️',
  Trein: '🚄',
  Bus: '🚌',
  Auto: '🚗',
  Boot: '⛴️',
  Anders: '🧭',
}

/**
 * Vervoer naar een stop. Het vertrekpunt volgt uit de route: de vorige stop,
 * of thuis voor de eerste stop. `toId: 'home'` is de terugreis.
 */
export interface Leg {
  id: string
  toId: string
  mode: TransportMode
  date: string
  depart?: string
  arrive?: string
  /** Reisduur in uren; nodig als vertrek en aankomst in een andere tijdzone liggen. */
  durationH?: number
  /** Bijv. 'KLM KL861' of 'Shinkansen Nozomi 23'. */
  carrier?: string
  /** Totale kosten voor alle reizigers. */
  cost?: number
  currency: Currency
  booked: boolean
  booking?: Booking
  notes?: string
  paidBy?: string
}

export interface Activity {
  id: string
  date: string
  time?: string
  title: string
  place?: Place
  durationH: number
  cost?: number
  currency: Currency
  notes?: string
  /** Gezet als deze activiteit uit een idee is ontstaan. */
  ideaId?: string
  order: number
  /** undefined = niet nodig om te reserveren. */
  reserve?: 'todo' | 'booked'
  booking?: Booking
  paidBy?: string
}

export const IDEA_CATEGORIES = [
  'Bezienswaardigheid',
  'Eten & drinken',
  'Natuur',
  'Cultuur',
  'Winkelen',
  'Uitgaan',
  'Dagtrip',
  'Overig',
] as const
export type IdeaCategory = (typeof IDEA_CATEGORIES)[number]

export interface Idea {
  id: string
  title: string
  city?: string
  category: IdeaCategory
  link?: string
  notes?: string
  place?: Place
  durationH: number
  cost?: number
  currency: Currency
  /** 1 = must-do, 2 = graag, 3 = als er tijd is */
  priority: 1 | 2 | 3
  dropped: boolean
  /** Wie dit idee leuk vindt (e-mailadres of naam). */
  votes?: string[]
}

export const EXPENSE_CATEGORIES = [
  'Vervoer',
  'Verblijf',
  'Eten',
  'Activiteiten',
  'Winkelen',
  'Overig',
] as const
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number]

export interface Expense {
  id: string
  title: string
  amount: number
  currency: Currency
  category: ExpenseCategory
  paid: boolean
  paidBy?: string
  /** Over wie de kosten verdeeld worden; leeg = iedereen. */
  splitAmong?: string[]
}

export interface PackItem {
  id: string
  text: string
  group: string
  done: boolean
}

export interface Trip {
  id: string
  name: string
  startDate: string
  endDate: string
  travelers: number
  /** Namen van de reizigers, voor kosten verdelen. */
  people?: string[]
  /** Valuta waarin je rekent (meestal EUR). */
  homeCurrency: Currency
  /** Valuta op de bestemming. */
  localCurrency: Currency
  /** Hoeveel lokale valuta je krijgt voor 1 eenheid thuisvaluta. */
  rate: number
  /** Budget in thuisvaluta. */
  budget?: number
  stops: Stop[]
  legs: Leg[]
  activities: Activity[]
  ideas: Idea[]
  expenses: Expense[]
  packing: PackItem[]
  updatedAt: string
}
