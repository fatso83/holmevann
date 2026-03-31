# Design: Build-Time English Translation

## Bakgrunn

`holmevann.no` er en statisk Jekyll-side publisert via Netlify. Innholdet er i dag i praksis norskspråklig, men brukeren ønsker en offentlig engelsk versjon under `/en/` som genereres automatisk ved build-tid.

To krav styrer løsningen:

- Engelsk skal være maskinoversatt som standard, uten manuell vedlikehold av en parallell innholdstrestruktur.
- Oversettelseskostnad skal holdes nede ved å gjenbruke tidligere oversettelser, slik at bare endret innhold oversettes på nytt.

Brukeren har eksplisitt valgt at oversettelsescachen skal ligge i [`_data/translations/en-cache.yml`](/Users/carlerik/dev/holmevann/_data/translations/en-cache.yml).

## Mål

- Generere en offentlig engelsk versjon av hele siten under `/en/`.
- Dekke vanlige sider, blogginnlegg, tag-sider, FAQ-siden og annen output som bygges av Jekyll.
- Oversette bare tekst som faktisk har endret seg siden forrige oversettelse.
- Lagre og gjenbruke oversettelser i [`_data/translations/en-cache.yml`](/Users/carlerik/dev/holmevann/_data/translations/en-cache.yml).
- Beholde norsk som eneste manuelle kildeinnhold.
- La Netlify-bygget produsere både norsk og engelsk output uten at engelske sider må committes som kildefiler.
- La norske tag-sider fortsette under `/tagger/...`, men eksponere engelske tag-sider under `/en/tags/...`.

## Utenfor Scope

- Manuell redigering eller kuratering av engelsk tekst som del av første iterasjon.
- Flere språk enn engelsk.
- Oversettelse av binære filer, PDF-er, bilder, video eller tredjepartsinnhold som embeddes fra andre domener.
- Full CMS- eller i18n-omlegging av Jekyll-kildekodene.
- Automatisk oversettelse i nettleseren ved request-tid.
- Oversettelse av RSS/feed i første iterasjon dersom det skaper uforholdsmessig mye ekstra kompleksitet.

## Vurderte Tilnærminger

### 1. Oversette kildesidene før Jekyll-build

Dette ville innebære å lese Markdown, YAML-data og template-strenger, oversette disse, og deretter generere et parallelt engelsk kildeunivers som Jekyll bygger.

Fordel:

- Tett integrert med Jekyll-kildene.

Ulemper:

- Høy kompleksitet for innlegg, tag-sider, FAQ-data og layout-strenger.
- Krever at vi modellerer mange ulike kildeformater og Jekyll-konvensjoner eksplisitt.
- Øker risikoen for at engelsk blir en slags sekundær kildebase.

### 2. Oversette ferdig bygget HTML og skrive engelsk output under `/en/`

Jekyll bygger først dagens norske side til `_site/`. Deretter går en post-build-oversetter gjennom HTML-outputen, trekker ut translatable tekstnoder og relevante attributter, oversetter dem med cache, og skriver engelske HTML-filer til `_site/en/...`.

Fordel:

- Treffer faktisk sluttproduktet, inkludert FAQ-rendering, tag-sider, header/footer og annen layout-output.
- Krever ingen parallell modellering av posts, pages og data i Jekyll.
- Gjør “hele siten” realistisk i én løsning.

Ulemper:

- Krever robust HTML-transformasjon og lenkeomskriving etter build.
- Sitemap og canonical-lenker må håndteres eksplisitt.

### 3. Proxy/request-time oversettelse på Netlify

Runtime-oversettelse via Edge Functions eller lignende.

Fordel:

- Ingen ekstra bygget output å lagre.

Ulemper:

- Dårligere cache-kontroll, svakere SEO og høyere operasjonell kompleksitet.
- Feil retning for en liten statisk side.

## Anbefalt Løsning

Løsningen bygges som en post-build oversettelsespipeline:

1. Jekyll bygger dagens norske site som normalt.
2. Et Ruby-skript går gjennom generert HTML i `_site/`.
3. Skriptet trekker ut translatable tekstnoder og relevante attributter fra hver HTML-side.
4. Hver oversettelsesenhet hashes og slås opp i [`_data/translations/en-cache.yml`](/Users/carlerik/dev/holmevann/_data/translations/en-cache.yml).
5. Bare cache-miss sendes til oversettelsesleverandøren.
6. Skriptet skriver ferdige engelske HTML-sider til `_site/en/...`, oppdaterer interne lenker, setter `lang="en"` og korrigerer SEO-relevante head-elementer.

Dette holder norsk som eneste manuelle kilde, dekker hele den faktiske nettsiden, og gir reell kostnadsreduksjon ved at identiske tekstsegmenter ikke oversettes mer enn én gang.

## Arkitektur

### 1. Buildrekkefølge

Netlify-builden får to trinn:

1. `asdf exec bundle exec jekyll build`
2. `asdf exec bundle exec ruby scripts/translate_site.rb`

Lokalt kan samme oversettelsestrinn kjøres manuelt etter build når man vil oppdatere `/en`-output eller cachen.

### 2. Oversettelses-cache

Oversettelsescachen lagres i [`_data/translations/en-cache.yml`](/Users/carlerik/dev/holmevann/_data/translations/en-cache.yml).

Hver entry skal minst inneholde:

- `hash`: stabil hash av norsk kildetekst + metadata som påvirker oversettelsen
- `source_text`: originaltekst
- `translated_text`: engelsk resultat
- `format`: hvilken type tekst dette er, for eksempel `text` eller `html`
- `updated_at`: når entryen sist ble skrevet

Hashen skal ikke være filbasert. Den skal være innholdsbasert på selve oversettelsesenheten. Dermed kan identisk tekst som “Les mer”, “Vi bruker cookies”, eller gjentatt FAQ-tekst gjenbrukes på tvers av sider.

### 3. Hva Som Skal Oversettes

Pipeline skal oversette synlig samme-origin HTML-output, ikke rå filer som Markdown eller YAML.

Følgende skal være med:

- tekstnoder i `<body>`
- relevante attributter som `title`, `alt`, `placeholder`, `aria-label`
- tekst som ligger i HTML-attributter og brukes som UI-data, for eksempel FAQ-sidens søkeforslag og tag-attributter der dette er nødvendig for brukeropplevelsen
- `<title>` og relevante SEO-felter i `<head>` som representerer menneskelig lesbar tekst

Følgende skal ikke oversettes:

- script-kode som kode
- URL-er
- filstier
- maskinelle meta-verdier uten synlig brukerbetydning
- tredjepartsressurser

### 4. HTML-Transformasjon

HTML skal parses som DOM, ikke håndteres med ren strengsubstitusjon.

Transformasjonen skal:

- oversette tekstnoder og støttede attributter
- bevare markup-struktur, lenker, script-tagger og stylesheets
- sette `<html lang="en">`
- skrive output til tilsvarende sti under `/en/`

Eksempler:

- `_site/index.html` -> `_site/en/index.html`
- `_site/faq.html` -> `_site/en/faq.html`
- `_site/rental/index.html` -> `_site/en/rental/index.html`
- `_site/2026/03/30/neverending-story.html` -> `_site/en/2026/03/30/neverending-story.html`
- `_site/tagger/fisk/index.html` -> `_site/en/tags/fisk/index.html`

### 5. Lenkeomskriving

Interne samme-origin HTML-lenker i engelske sider skal omskrives til engelske mål når en engelsk kopi finnes.

Eksempler:

- `/faq` -> `/en/faq`
- `/important.html` -> `/en/important.html`
- `/rental/` -> `/en/rental/`
- `/tagger/fisk/` -> `/en/tags/fisk/`

Lenker til assets skal ikke flyttes til `/en/assets/...`; de skal fortsatt peke til samme originale asset-URL-er.

Lenker til tredjepartsdomener eller til ikke-oversatte ressurstyper skal stå urørt.

Tag-ruting får et bevisst spesialtilfelle i engelsk versjon:

- norsk beholder dagens prefiks `/tagger/`
- engelsk bruker prefiks `/en/tags/`
- eksisterende slug beholdes uendret

Det betyr at første iterasjon ikke forsøker å oversette selve sluggen. For eksempel blir `/tagger/fisk/` til `/en/tags/fisk/`, ikke `/en/tags/fishing/`. Dette holder løsningen stabil og billig, fordi vi slipper egen slug-oversettelse, slug-cache og risiko for URL-endringer når maskinoversettelsen varierer.

### 6. SEO-justeringer

Siden Jekylls eksisterende SEO-output genereres for norske URL-er, må engelske HTML-filer korrigeres etterpå.

Minimum:

- oppdatere canonical til engelsk URL for den engelske siden
- legge inn `hreflang="no"` og `hreflang="en"` mellom de to variantene når begge finnes
- sørge for at `<title>` og eventuell beskrivelse er engelskspråklig i den engelske HTML-filen

Sitemap må også håndteres eksplisitt. Anbefalt minimum i første iterasjon er å generere et enkelt engelsk sitemap i `_site/en/sitemap.xml`. Hvis det viser seg enkelt, kan top-level sitemap senere utvides til å inkludere `/en`-URL-ene også.

### 7. Feilhåndtering

Hvis oversettelses-API-et feiler på enkeltsegmenter eller hele kjøringen, skal builden feile tydelig i produksjon fremfor å publisere en halvveis inkonsistent engelsk site.

Lokalt kan vi støtte en mer tolerant modus senere, men første versjon bør være enkel og eksplisitt:

- cache-hit: bruk cache
- cache-miss + vellykket API-svar: skriv cache og fortsett
- cache-miss + API-feil: avbryt med tydelig feil

### 8. Leverandørvalg

Implementasjonen bør ha en liten leverandøradapter, men første versjon trenger bare én konkret provider.

Anbefaling:

- implementer én enkel adapter for DeepL i første iterasjon
- kapsle HTTP-kallet i en egen Ruby-klasse slik at bytte av leverandør senere er mulig uten å endre resten av pipelinen

Dette er nok abstraksjon uten å overdesigne.

## Foreslått Filstruktur

Nye eller endrede filer:

- Opprett: `scripts/translate_site.rb`
- Opprett: `scripts/lib/build_translation/cache_store.rb`
- Opprett: `scripts/lib/build_translation/html_extractor.rb`
- Opprett: `scripts/lib/build_translation/html_renderer.rb`
- Opprett: `scripts/lib/build_translation/link_mapper.rb`
- Opprett: `scripts/lib/build_translation/providers/deepl_client.rb`
- Opprett: `_data/translations/en-cache.yml`
- Opprett: `test/build_translation/cache_store_test.rb`
- Opprett: `test/build_translation/link_mapper_test.rb`
- Opprett: `test/build_translation/html_renderer_test.rb`
- Endre: `netlify.toml`
- Endre: `Makefile`
- Endre: `Gemfile` dersom HTML-parser eller annen avhengighet må legges til

## Dataflyt

1. Jekyll bygger dagens norske site til `_site/`.
2. Oversettelsesskriptet finner alle samme-origin HTML-filer i `_site/`, men ignorerer allerede generert `_site/en/`.
3. For hver HTML-fil parses DOM-en, og translatable enheter trekkes ut.
4. Hver enhet hashes og slås opp i [`_data/translations/en-cache.yml`](/Users/carlerik/dev/holmevann/_data/translations/en-cache.yml).
5. Cache-treff brukes direkte.
6. Cache-miss sendes til oversettelsesleverandøren og lagres i cachen.
7. DOM-en rendres tilbake til engelsk HTML.
8. Interne HTML-lenker omskrives til `/en/...` der det finnes engelsk motpart.
9. Filen skrives til parallell sti under `_site/en/`.
10. Til slutt genereres engelsk sitemap og eventuelle felles oversiktsfiler som trengs for `/en`.

For tag-sider betyr dette at norsk output under `_site/tagger/...` speiles til engelsk output under `_site/en/tags/...`.

## Risikoer Og Avklaringer

### Risiko: Maskinoversatt HTML ødelegger markup

Hvis hele HTML-fragmenter sendes naivt til API-et, kan oversettelsen skade markup eller attributter.

Tiltak:

- trekk ut tekstinnhold og bare de attributtene vi eksplisitt støtter
- behold DOM-struktur lokalt
- test mot realistiske HTML-eksempler fra FAQ og vanlige sider

### Risiko: Engelske sider peker tilbake til norske sider

Uten lenkeomskriving vil `/en`-sider bli et tynt lag over norsk navigasjon.

Tiltak:

- bygg en eksplisitt map fra norsk outputsti til engelsk outputsti
- omskriv interne HTML-lenker i engelske sider når engelsk mål finnes

### Risiko: SEO-signaler peker fortsatt til norsk

Jekylls nåværende SEO-tag genererer canonical og metadata for originalside.

Tiltak:

- korriger canonical og alternates i post-build-steget
- generer minimum et engelsk sitemap

### Risiko: Små endringer retrigger for mye oversettelse

Hvis hele dokumenter hashes som én enhet, blir cachen lite effektiv.

Tiltak:

- hash på segmentnivå, ikke filnivå
- gjenbruk identiske segmenter på tvers av sider

### Risiko: For mye kompleksitet i første versjon

“Hele siten” kan lett gli over i full i18n-plattform.

Tiltak:

- bygg kun én target-locale (`en`)
- bruk én provider
- oversett bare HTML-output
- unngå manuelle override-systemer i første iterasjon

## Validering

Minimumssjekker etter implementasjon:

1. Kjør `asdf exec bundle exec jekyll build`.
2. Kjør `asdf exec bundle exec ruby scripts/translate_site.rb`.
3. Verifiser at `_site/en/index.html`, `_site/en/faq.html`, `_site/en/rental/index.html` og minst ett engelsk blogginnlegg finnes.
4. Verifiser at engelske sider har `lang="en"`.
5. Verifiser at engelsk homepage lenker til `/en/...` for interne HTML-sider.
6. Verifiser at cachefilen oppdateres ved nytt innhold, men forblir uendret når innholdet ikke har endret seg.
7. Verifiser at en ny build uten innholdsendringer ikke gjør nye API-kall.
8. Verifiser at FAQ-siden faktisk viser engelske spørsmål, svar, søkeforslag og labels i generert HTML.

## Akseptansekriterier

- Hele den publiserte HTML-siten får en engelsk variant under `/en/`.
- Engelsk genereres automatisk under build, ikke ved request-tid.
- Norsk forblir eneste manuelle innholdskilde.
- Oversettelser gjenbrukes fra [`_data/translations/en-cache.yml`](/Users/carlerik/dev/holmevann/_data/translations/en-cache.yml).
- Bare nye eller endrede tekstsegmenter krever nye API-kall.
- Interne navigasjonslenker på engelske sider peker til engelske HTML-sider der disse finnes.
- Engelske sider annonserer seg som engelske med korrekt `lang` og oppdatert canonical.
