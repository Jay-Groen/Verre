# Verre

Verre is een web-app om een reis overzichtelijk te plannen: verzamel ideeën, zie meteen waar ze in je planning passen, en houd dagen, verblijven, kaart, budget en paklijst op één plek bij.

## Wat zit erin

- **Planning**: een kaart per dag met de stad waar je bent, reisdagen, geplande activiteiten (sleep ze naar een andere dag of volgorde) en een balk die laat zien hoe vol de dag is.
- **Ideeën**: alles wat je tegenkomt, per stad gegroepeerd. Bij elk idee zie je of het al ingepland is, op welke dagen het nog past (met vrije uren), of de dagen in die stad vol zitten, of dat de plek niet op je route ligt.
- **Route & verblijven**: je steden in volgorde, met hotel, check-in/out, kosten en of het al geboekt is. Je krijgt een waarschuwing bij nachten zonder verblijf of dubbele boekingen.
- **Kaart**: verblijven, activiteiten en open ideeën op een OpenStreetMap-kaart, voor de hele reis of per dag. Zonder plekken start de kaart op je huidige locatie.
- **Budget**: kosten in de valuta van je bestemming én je eigen valuta (met actuele wisselkoers via frankfurter.dev), met verblijven en activiteiten automatisch meegeteld, per categorie en afgezet tegen je budget.
- **Paklijst**: een afvinklijst met een algemene startlijst.
- **Licht en donker**: volgt de instelling van je browser, met een knop rechtsboven om te wisselen.

## Starten

```bash
npm install
npm run dev
```

Zonder verdere instellingen draait de app **lokaal**: alles wordt in je browser bewaard.

## Accounts (Supabase)

1. Maak een gratis project aan op [supabase.com](https://supabase.com).
2. Open **SQL Editor**, plak de inhoud van `supabase/schema.sql` erin en klik op **Run**.
3. Kopieer `.env.example` naar `.env.local` en vul `VITE_SUPABASE_URL` en `VITE_SUPABASE_ANON_KEY` in (te vinden onder **Project Settings → API**).
4. Zet onder **Authentication → URL Configuration** je app-adres (bijv. `http://localhost:5173`) bij de redirect-URL's.
5. Herstart `npm run dev`. De app vraagt nu om in te loggen (met een inloglink of wachtwoord) en slaat reizen op in je account. Reizen die je eerder lokaal maakte, kun je met één klik naar je account overzetten.

## Techniek

React + TypeScript + Vite, Zustand voor de state, Leaflet/OpenStreetMap voor de kaart, Nominatim om plekken op te zoeken en Supabase voor login en opslag. Een reis wordt opgeslagen als één JSON-document (`trips.data`), met row-level security zodat iedereen alleen zijn eigen reizen ziet.
