# Design: Offline Core Experience

## Bakgrunn

Siten er en statisk Jekyll 4-side som bygges til `_site/` og publiseres på `holmevann.no`. Dagens løsning har ingen service worker, ingen web app manifest, og ingen strategi for å gjøre innhold tilgjengelig uten nett.

Brukerbehovet er ikke "eksporter siden som en mappe", men at en vanlig besøkende på `holmevann.no` skal kunne lese et definert kjernesett av sider uten dekning etter å ha besøkt siden online minst én gang. I tillegg skal andre sider på samme domene bli tilgjengelige offline dersom brukeren faktisk har besøkt dem tidligere.

## Mål

- Kjernesidene skal være tilgjengelige offline etter første vellykkede besøk online.
- Følgende sider inngår i kjernesettet:
  - `/`
  - `/important`
  - `/rental/`
  - `/faq`
  - `/map`
- Andre sider på samme domene skal bli tilgjengelige offline etter at brukeren har besøkt dem.
- Samme-origin statiske assets som HTML, CSS, JS og lokale bilder skal caches slik at besøkte sider kan rendres offline.
- Dersom brukeren navigerer offline til en side som verken er i kjernesettet eller tidligere besøkt, skal de få en enkel offline-fallback i stedet for en nettleserfeil.

## Utenfor Scope

- Å gjøre eksterne PDF-er fra Google Docs tilgjengelige offline.
- Å gjøre Google Maps-iframe, Google Photos/Public Album, Airbnb-embed, Dropbox-videoer, Yr eller andre tredjepartsressurser tilgjengelige offline.
- Full precache av hele nettstedet ved første besøk.
- Push-varsler, bakgrunnssynk, offline skjema-innsending eller annen avansert PWA-funksjonalitet.
- Egen redesign av sider for app-lignende installasjon.

## Anbefalt Løsning

Løsningen implementeres som en liten PWA-grunnmur med:

- en service worker registrert på alle sider
- et web app manifest
- precache av et lite, definert kjernesett
- runtime-caching av samme-origin navigasjoner og samme-origin statiske assets
- en enkel offline-fallback-side for ukjente eller ubesøkte ruter

Dette matcher behovet bedre enn å forsøke å cache "alt" ved første sidevisning. Siten er liten nok til at dette er praktisk, men den inneholder også mange tredjepartsavhengigheter som aldri vil kunne bli robust offline uten innholdsmigrering. Kjernesettet gir forutsigbarhet, mens runtime-cache gjør resten gradvis bedre uten å blåse opp første last.

## Arkitektur

### 1. Registrering

Alle sider skal laste et lite klientskript som registrerer service workeren dersom nettleseren støtter det og siden går over `https` eller `localhost`.

Registreringen bør ligge i repoet og injiseres via lokal override av Minima sin `head`-include, slik at løsningen blir eksplisitt kontrollert i kodebasen og ikke avhenger av temaets interne filer.

### 2. Manifest

Et enkelt `manifest.webmanifest` legges på rot og lenkes fra `<head>`.

Manifestet trengs ikke for offline-cache i seg selv, men gjør PWA-oppsettet komplett og gir en stabil plass å definere navn, start-URL og ikonreferanser. Dette er nyttig både for installasjon og for at løsningen skal være lett å forstå og vedlikeholde.

### 3. Precache Av Kjernesider

Service workeren skal ved installasjon cache:

- kjernesidene (`/`, `/important`, `/rental/`, `/faq`, `/map`)
- offline-fallback-siden
- minimum nødvendige samme-origin shell-assets, typisk:
  - `/assets/main.css`
  - service worker-registreringsskriptet
  - favicon og eventuelle manifest-refererte ikoner som faktisk brukes

Precache-listen skal være liten og bevisst. Målet er ikke å få "hele siten" offline med én gang, men å gjøre de viktigste sidene stabile og raske.

### 4. Runtime-Caching Av HTML

Navigasjoner til samme-origin HTML-sider som ikke er i precache skal håndteres av service workeren.

Anbefalt strategi:

- `network-first` for navigasjoner, med fallback til cache

Begrunnelse:

- Når brukeren er online, får de ferskest mulig innhold.
- Når brukeren er offline, kan tidligere besøkte sider leses fra cache.
- Når verken nettverk eller cache finnes, returneres offline-fallback-siden.

Dette gir ønsket adferd for "andre besøkte sider skal være tilgjengelige offline dersom du har vært innom dem tidligere".

### 5. Runtime-Caching Av Samme-Origin Assets

Service workeren skal også cache samme-origin assets som tilhører besøkte sider, for eksempel:

- CSS
- JavaScript
- bilder under `/assets/` og `/rental/`
- eventuelle samme-origin mediafiler som faktisk lastes

Anbefalt strategi:

- `stale-while-revalidate` eller `cache-first` for statiske assets

Hovedpoenget er at en side som tidligere har vært åpnet skal kunne rendres med tilhørende lokale bilder og stilark når nett mangler.

### 6. Eksterne Ressurser

Service workeren skal ikke forsøke å cache tredjepartsressurser som del av denne første iterasjonen.

Følgende skal behandles som online-only:

- Google Docs PDF-lenker
- Google Maps iframes
- Google Photos / `lh3.googleusercontent.com`
- Airbnb embed-script
- Dropbox-videoer
- Yr, eksterne webkameraer og andre tredjepartslenker

Ved offline bruk er det akseptabelt at slike embeds ikke fungerer. De må feile stille eller fremstå som vanlige eksterne lenker, men resten av siden skal fortsatt være lesbar.

### 7. Offline-Fallback

Det opprettes en enkel offline-side som sier:

- at brukeren er offline
- at bare kjernesidene og tidligere besøkte sider er tilgjengelige
- at eksternt innhold ikke nødvendigvis virker uten nett

Fallback-siden skal være en vanlig Jekyll-side, slik at den får samme stilark og navigasjon som resten av siten og er enkel å vedlikeholde.

### 8. Cache-Versionering Og Opprydding

Service workeren skal bruke eksplisitte cache-navn med versjon, for eksempel:

- `holmevann-pages-v1`
- `holmevann-assets-v1`
- `holmevann-core-v1`

Ved aktivering skal gamle cache-versjoner som ikke lenger brukes slettes. Dette hindrer akkumulering av utdatert innhold og gjør fremtidige endringer enklere å rulle ut.

## Foreslått Filstruktur

Nye eller endrede filer:

- Opprett: `service-worker.js`
- Opprett: `manifest.webmanifest`
- Opprett: `assets/js/register-service-worker.js`
- Opprett: `_includes/head.html`
- Opprett: `offline.md`
- Endre: `_config.yml` kun hvis manifest eller offline-side trenger eksplisitt konfigurasjon, ellers la være

Mulig, men ikke nødvendig i første omgang:

- Opprett egne ikoner for manifest dersom eksisterende `favicon.ico` ikke er tilstrekkelig

## Dataflyt

1. Brukeren besøker `holmevann.no` online.
2. Nettleseren laster registreringsskriptet og registrerer service workeren.
3. Service workeren installeres og precacher kjernesidene og nødvendige shell-assets.
4. Når brukeren senere åpner andre sider på samme origin, caches HTML og lokale assets via runtime-strategiene.
5. Når brukeren mister nett:
   - kjernesider lastes fra precache
   - tidligere besøkte samme-origin sider lastes fra runtime-cache
   - ukjente sider får offline-fallback
   - eksterne embeds og lenker forblir utilgjengelige

## Regler For Hva Som Caches

- Bare samme-origin ressurser skal håndteres aktivt av service workeren i denne iterasjonen.
- Query-parametere på samme-origin navigasjoner skal håndteres defensivt slik at cache ikke fragmenteres unødvendig.
- POST/PUT/DELETE og annen muterende trafikk er irrelevant og skal ignoreres.
- HTML-navigasjoner og assets skilles i egne cacher for enklere kontroll og feilsøking.

## Risikoer Og Avklaringer

### Risiko: Forventning om at eksterne dokumenter også virker offline

Brukere kan oppfatte "offline støtte" som at alt de kan klikke på virker uten nett.

Tiltak:

- vær eksplisitt i fallback-siden og eventuelt i dokumentasjon om at tredjepartsressurser ikke inngår ennå
- ta PDF-migrering i en senere iterasjon

### Risiko: Cloudinary / bildetaggen bruker absolutte URLs

Bygget HTML viser at lokale bilder i dag rendres med absolutte samme-origin URL-er som `http://localhost:4000/assets/...` ved lokal build. På produksjon vil de være samme-origin under `https://www.holmevann.no/...`, noe som er kompatibelt med service worker-caching, men dette bør verifiseres eksplisitt.

Tiltak:

- test i produksjonslignende build at bilde-URL-er faktisk ligger på samme origin

### Risiko: Offline-cache blir liggende med gammelt innhold

Uten cache-versjonering og opprydding kan brukere få utdaterte sider lenge.

Tiltak:

- bruk versjonerte cache-navn
- slett gamle cacher i `activate`

### Risiko: Ukjent same-origin navigasjon uten cache

Hvis brukeren åpner en ny side offline som aldri er besøkt, vil `network-first` ellers ende i feil.

Tiltak:

- returner offline-fallback ved cache-miss

## Validering

Etter implementasjon skal løsningen verifiseres lokalt og i nettleser.

Minimumssjekker:

1. Bygg siten med `asdf exec bundle exec jekyll build`.
2. Verifiser at `service-worker.js`, `manifest.webmanifest` og offline-siden finnes i `_site/`.
3. Start lokal server over `http://localhost:4000` eller tilsvarende og verifiser at service workeren registreres.
4. Besøk kjernesidene online, slå deretter av nettverk i DevTools og verifiser at de fortsatt virker.
5. Besøk en ikke-kjerne-side online, slå av nettverk, og verifiser at den siden fortsatt virker offline.
6. Naviger offline til en side som aldri er besøkt og som ikke er i kjernesettet, og verifiser at offline-fallback vises.
7. Verifiser at eksterne embeds ikke krasjer siden selv om de ikke virker offline.

## Akseptansekriterier

- Siten registrerer en service worker på støttede klienter.
- Kjernesidene er tilgjengelige offline etter én vellykket online-økt.
- Andre samme-origin sider blir tilgjengelige offline når de har vært besøkt online tidligere.
- Samme-origin statiske assets for besøkte sider lastes fra cache offline.
- Ubesøkte sider utenfor kjernesettet viser en kontrollert offline-fallback i stedet for nettleserfeil.
- Eksterne ressurser forsøkes ikke gjort offline i denne iterasjonen.

## Anbefalt Neste Steg

Når denne spesifikasjonen er godkjent, bør neste steg være en konkret implementasjonsplan for:

- registrering og manifest
- service worker med precache og runtime-cache
- offline-fallback-side
- lokal og manuell verifikasjon i nettleser
