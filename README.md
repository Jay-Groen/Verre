# Verre

Verre is een web-app om een reis overzichtelijk te plannen: verzamel ideeën, zie meteen waar ze in je planning passen, en houd dagen, verblijven, kaart, budget en paklijst op één plek bij.

## Wat zit erin

- **Planning**: een tijdlijn per dag met de stad waar je bent, vervoer, geplande activiteiten (sleep ze naar een andere dag of volgorde) en een balk die laat zien hoe vol de dag is. Activiteiten zonder tijd krijgen een geschatte tijd, met de reistijd (lopen of OV) tussen plekken; te krappe overstappen worden gemarkeerd.
- **Ideeën**: alles wat je tegenkomt, per stad gegroepeerd. Bij elk idee zie je of het al ingepland is, op welke dagen het nog past (met vrije uren), of de dagen in die stad vol zitten, of dat de plek niet op je route ligt.
- **Route & verblijven**: je steden in volgorde, met hotel, check-in/out, kosten en of het al geboekt is, en het vervoer ertussen (vlucht, trein, bus, auto, boot) inclusief heen- en terugreis. Je krijgt een waarschuwing bij nachten zonder verblijf of dubbele boekingen.
- **Boekingen**: alles wat geboekt moet worden op één lijst (verblijven, vervoer, activiteiten met reservering), met deadlines, bevestigingsnummers, links en bijlagen zoals tickets en PDF's.
- **Kaart**: verblijven, activiteiten en open ideeën op een OpenStreetMap-kaart, voor de hele reis of per dag. Zonder plekken start de kaart op je huidige locatie.
- **Budget**: kosten in de valuta van je bestemming én je eigen valuta (met actuele wisselkoers via frankfurter.dev), met verblijven en activiteiten automatisch meegeteld, per categorie en afgezet tegen je budget.
- **Paklijst**: een afvinklijst met een algemene startlijst.
- **Vandaag**: tijdens de reis opent Verre op vandaag: wat er nu en straks gepland staat, je verblijf van vannacht met route ernaartoe, je tickets en een vooruitblik op morgen.
- **Navigeren**: met één tik een route naar een activiteit of verblijf in Google Maps of Apple Kaarten.
- **Weer**: per dag de verwachting (tot ~15 dagen vooruit) of, verder weg, het weer van dezelfde periode in een eerder jaar (via Open-Meteo).
- **Snel ideeën toevoegen**: plak een link van Google Maps, Apple Kaarten, OpenStreetMap, TripAdvisor of een blog; naam, plek en stad worden waar mogelijk automatisch ingevuld.
- **Openingstijden**: bij een plek in te vullen (of automatisch uit OpenStreetMap); je krijgt een waarschuwing als je iets plant op een dag of tijd dat het dicht is, en ideeën stellen geen dichte dagen meer voor.
- **Stemmen**: medereizigers geven ideeën een duim; sorteer op wat het populairst is.
- **Kosten verdelen**: geef aan wie wat heeft betaald en over wie het verdeeld wordt; Verre rekent uit wie wie hoeveel moet terugbetalen.
- **Exporteren**: alles naar je agenda (.ics), of een printbare reisgids (ook als PDF).
- **Dupliceren**: kopieer een reis als sjabloon naar nieuwe datums.
- **Offline**: na één bezoek opent de gebouwde app ook zonder internet; je reizen staan als kopie op je apparaat, wijzigingen worden opgeslagen zodra je weer online bent, en bijlagen kun je vooraf op je apparaat zetten.
- **Delen**: nodig medereizigers uit met hun e-mailadres; zij zien en bewerken dezelfde reis, en wijzigingen komen live binnen.
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
5. Laat onder **Authentication → Sign In / Providers → Email** de optie **Confirm email** aan staan: delen werkt op e-mailadres, dus dat adres moet bevestigd zijn.
6. Herstart `npm run dev`. De app vraagt nu om in te loggen (met een inloglink of wachtwoord) en slaat reizen op in je account. Reizen die je eerder lokaal maakte, kun je met één klik naar je account overzetten.

## Techniek

React + TypeScript + Vite, Zustand voor de state, Leaflet/OpenStreetMap voor de kaart, Nominatim om plekken op te zoeken en Supabase voor login en opslag. Een reis wordt opgeslagen als één JSON-document (`trips.data`), met row-level security zodat je alleen je eigen reizen en de met jou gedeelde reizen ziet. Bijlagen staan in de privé-bucket `documents` in Supabase Storage (zonder account in IndexedDB in je browser).

Heb je het schema al eerder gedraaid? Draai `supabase/schema.sql` dan opnieuw: het is veilig om te herhalen en voegt delen, live bijwerken en de bucket voor bijlagen toe.
