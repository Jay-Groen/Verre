export type Currency = 'JPY' | 'EUR'

export interface Place {
  name: string
  lat?: number
  lng?: number
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
  notes?: string
  color: string
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
  /** Hoeveel yen je krijgt voor 1 euro. */
  jpyPerEur: number
  budgetEUR?: number
  stops: Stop[]
  activities: Activity[]
  ideas: Idea[]
  expenses: Expense[]
  packing: PackItem[]
  updatedAt: string
}
