import type { Activity, Idea, PackItem, Stop, Trip } from './types'
import { STOP_COLORS, uid } from './lib/plan'

/** Algemene startlijst; per reis aan te vullen. */
const PACKING: Record<string, string[]> = {
  'Te regelen vóór vertrek': [
    'Paspoort of ID-kaart geldig (sommige landen: 6 maanden na terugkomst)',
    'Visum of reistoestemming nodig?',
    'Reisverzekering',
    'Vaccinaties checken',
    'Mobiel internet (eSIM of bundel)',
    'Pinpas en creditcard werken in het buitenland',
  ],
  Documenten: ['Paspoort / ID-kaart', 'Vlieg- of treintickets', 'Verblijfsbevestigingen', 'Kopie paspoort (digitaal)'],
  Elektronica: ['Stekker-adapter', 'Powerbank (in handbagage)', 'Telefoonoplader', 'Koptelefoon'],
  Kleding: ['Goede wandelschoenen', 'Regenjas', 'Zwemkleding'],
  Overig: ['Toilettas', 'Medicijnen', 'Zonnebrand', 'Herbruikbare waterfles'],
}

export function defaultPacking(): PackItem[] {
  return Object.entries(PACKING).flatMap(([group, items]) =>
    items.map((text) => ({ id: uid(), text, group, done: false })),
  )
}

export function sampleJapanTrip(): Trip {
  const stop = (
    i: number,
    city: string,
    start: string,
    end: string,
    stayName: string,
    lat: number,
    lng: number,
    stayCost: number,
    booked: boolean,
  ): Stop => ({
    id: uid(),
    city,
    start,
    end,
    stayName,
    lat,
    lng,
    checkIn: '15:00',
    checkOut: '11:00',
    stayCost,
    stayCurrency: 'JPY',
    booked,
    color: STOP_COLORS[i % STOP_COLORS.length],
  })

  const stops = [
    stop(0, 'Tokyo', '2027-04-01', '2027-04-06', 'Hotel in Shinjuku', 35.6938, 139.7034, 110000, true),
    stop(1, 'Hakone', '2027-04-06', '2027-04-07', 'Ryokan met onsen', 35.2324, 139.1069, 48000, true),
    stop(2, 'Kyoto', '2027-04-07', '2027-04-11', 'Machiya bij Gion', 35.0037, 135.7756, 96000, false),
    stop(3, 'Osaka', '2027-04-11', '2027-04-14', 'Hotel in Namba', 34.6659, 135.5013, 54000, false),
    stop(4, 'Tokyo', '2027-04-14', '2027-04-15', 'Hotel bij Haneda', 35.5494, 139.7798, 18000, false),
  ]

  let order = 0
  const act = (
    date: string,
    title: string,
    lat: number,
    lng: number,
    time?: string,
    durationH = 2,
    cost?: number,
  ): Activity => ({
    id: uid(),
    date,
    time,
    title,
    place: { name: title, lat, lng },
    durationH,
    cost,
    currency: 'JPY',
    order: order++,
  })

  const activities: Activity[] = [
    act('2027-04-01', 'Inchecken & ramen in Shinjuku', 35.6938, 139.7034, '17:00', 2),
    act('2027-04-02', 'Sensō-ji in Asakusa', 35.7148, 139.7967, '08:30', 2),
    act('2027-04-02', 'Ueno-park (kersenbloesem)', 35.7156, 139.7745, '11:00', 2.5),
    act('2027-04-02', 'Shibuya Crossing & Sky', 35.6595, 139.7005, '17:30', 2, 2500),
    act('2027-04-03', 'teamLab Planets', 35.6491, 139.7898, '10:00', 2, 3800),
    act('2027-04-04', 'Meiji-jingū & Harajuku', 35.6764, 139.6993, '09:30', 3),
    act('2027-04-06', 'Hakone Loop: kabelbaan & piratenschip', 35.2443, 139.0234, '11:00', 4, 6100),
    act('2027-04-08', 'Fushimi Inari (vroeg!)', 34.9671, 135.7727, '07:00', 3),
    act('2027-04-08', 'Kiyomizu-dera', 34.9949, 135.785, '11:00', 2, 500),
    act('2027-04-09', 'Arashiyama bamboebos', 35.017, 135.6713, '08:00', 3),
    act('2027-04-09', 'Kinkaku-ji', 35.0394, 135.7292, '13:30', 1.5, 500),
    act('2027-04-12', 'Dagtrip Nara: herten & Tōdai-ji', 34.6851, 135.843, '09:00', 6, 1500),
    act('2027-04-12', 'Dōtonbori street food', 34.6687, 135.5013, '19:00', 2),
    act('2027-04-13', 'Osaka Castle', 34.6873, 135.5262, '10:00', 2, 600),
  ]

  const idea = (
    title: string,
    city: string | undefined,
    category: Idea['category'],
    priority: Idea['priority'],
    durationH: number,
    lat?: number,
    lng?: number,
    cost?: number,
    notes?: string,
  ): Idea => ({
    id: uid(),
    title,
    city,
    category,
    priority,
    durationH,
    place: lat !== undefined ? { name: title, lat, lng } : undefined,
    cost,
    currency: 'JPY',
    notes,
    dropped: false,
  })

  const ideas: Idea[] = [
    idea('Ghibli Museum', 'Tokyo', 'Cultuur', 1, 3, 35.6962, 139.5704, 1000, 'Tickets gaan de 10e van de maand ervoor online.'),
    idea('Tsukiji Outer Market ontbijt', 'Tokyo', 'Eten & drinken', 2, 2, 35.6655, 139.7707),
    idea('Akihabara', 'Tokyo', 'Winkelen', 3, 3, 35.6984, 139.7731),
    idea('Nishiki Market', 'Kyoto', 'Eten & drinken', 2, 1.5, 35.005, 135.765),
    idea('Avondwandeling door Gion', 'Kyoto', 'Cultuur', 1, 2, 35.0037, 135.7756),
    idea('Universal Studios Japan', 'Osaka', 'Uitgaan', 2, 9, 34.6654, 135.4323, 9800, 'Neemt een hele dag in beslag.'),
    idea('Chūreitō-pagode met uitzicht op Fuji', 'Fujiyoshida', 'Natuur', 1, 4, 35.5013, 138.8013),
    idea('Himeji Castle', 'Himeji', 'Dagtrip', 2, 4, 34.8394, 134.6939, 1000),
    idea('Kaiseki-diner', undefined, 'Eten & drinken', 2, 2.5, undefined, undefined, 15000),
  ]

  return {
    id: uid(),
    name: 'Japan 2027 🌸',
    startDate: '2027-04-01',
    endDate: '2027-04-15',
    travelers: 2,
    homeCurrency: 'EUR',
    localCurrency: 'JPY',
    rate: 165,
    budget: 6500,
    stops,
    activities,
    ideas,
    expenses: [
      { id: uid(), title: 'Vliegtickets (2 p.)', amount: 1700, currency: 'EUR', category: 'Vervoer', paid: true },
      { id: uid(), title: 'JR Pass 7 dagen (2 p.)', amount: 100000, currency: 'JPY', category: 'Vervoer', paid: false },
      { id: uid(), title: 'Reisverzekering', amount: 60, currency: 'EUR', category: 'Overig', paid: true },
      { id: uid(), title: 'eSIM 15 dagen', amount: 25, currency: 'EUR', category: 'Overig', paid: false },
    ],
    packing: defaultPacking(),
    updatedAt: new Date().toISOString(),
  }
}
