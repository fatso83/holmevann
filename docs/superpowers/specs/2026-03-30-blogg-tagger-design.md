# Design: Tagger For Bloggposter

## Bakgrunn

Siten er en Jekyll 4-side med bloggposter i `_posts/`, standard layout-filer i `_layouts/`, og lokal utvikling via `bundle exec jekyll serve` på `http://localhost:4000`.

Målet er å kunne merke bloggposter med en eller flere tagger direkte i front matter, og få én ferdiggenerert, statisk side per tag med ren URL.

## Mål

- Bloggposter kan ha null, én eller flere tagger i front matter.
- Hver unik tag får en statisk side på `/tagger/<slug>/`.
- Hver post kan vises på flere tag-sider.
- Taggene skal være klikkbare på selve bloggposten.
- Tag-sidene skal være enkle og bestå av overskrift og postliste.
- Løsningen skal kunne valideres lokalt på `http://localhost:4000`.

## Utenfor Scope

- Tagger for FAQ eller andre innholdstyper enn bloggposter.
- Egne tag-beskrivelser, hero-tekst eller metadata per tag.
- Klientsidefiltrering som erstatning for egne tag-sider.
- Sentral definisjon av tagger i datafil.

## Anbefalt Løsning

Løsningen implementeres som en liten Jekyll-generator som leser `tags` fra postenes front matter og oppretter en egen side per unik tag under `/tagger/<slug>/`.

Dette passer repoet bedre enn manuelle tag-sider fordi:

- repoet kjører Jekyll 4, ikke GitHub Pages safe mode
- Netlify/Jekyll-oppsettet tåler en liten custom generator
- ønsket er at nye tag-sider skal oppstå automatisk når en post får en ny tag

## Datamodell

Tagger defineres direkte i front matter i hver post:

```yaml
---
layout: post
title: Eksempel
tags:
  - vann
  - vinter
  - strøm
---
```

Regler:

- `tags` er valgfritt.
- Verdien skal være en liste med strenger.
- Tomme verdier ignoreres.
- Tagger behandles case-insensitivt når URL og gruppering bygges.
- Slug genereres fra tag-navnet med Jekyll/Liquid-kompatibel slugifisering.

Eksempler:

- `Vinter` og `vinter` grupperes som samme tag.
- `To skritt tilbake` blir `/tagger/to-skritt-tilbake/`.
- Norske tegn skal slugifiseres stabilt, for eksempel `ø` til `o`.

## Arkitektur

### 1. Postdata

Eksisterende poster i `_posts/` utvides gradvis med `tags` i front matter. Poster uten `tags` fortsetter å fungere uendret.

### 2. Generator

En ny generator i `_plugins/` skal:

- iterere over `site.posts`
- lese `post.data["tags"]`
- normalisere og slugifisere tagger
- gruppere poster per tag
- opprette en virtuell Jekyll-side per tag

Hver genererte side skal eksponere:

- visningsnavn for tag
- slug
- liste over poster for taggen

Generatoren bør være defensiv:

- ignorere `nil`, tom streng og tomme lister
- tåle at `tags` feilaktig er en streng ved å pakke den om til liste eller ignorere den eksplisitt
- unngå duplikater hvis samme tag er oppgitt flere ganger på én post

### 3. Tag-layout

En egen layout, for eksempel `_layouts/tag.html`, viser:

- sideoverskrift med tag-navn
- enkel liste over tilhørende poster
- dato, tittel og ingress på tilsvarende måte som i `_layouts/home.html`

Tag-siden trenger ikke introtekst, ekstra navigasjon eller søk.

### 4. Tag-lenker På Poster

`_layouts/post.html` utvides med en liten seksjon som viser postens tagger som lenker til de genererte tag-sidene.

Plassering:

- anbefalt rett under dato/meta, siden taggene beskriver posten og fungerer som navigasjon

Atferd:

- seksjonen rendres bare når `page.tags` finnes og ikke er tom
- hver tag lenker til `/tagger/<slug>/`

### 5. Stil

Kun minimal styling er nødvendig:

- tag-lenker bør se bevisst ut som navigasjon
- spacing rundt tagseksjonen bør følge eksisterende stil
- tag-sidens postliste bør gjenbruke dagens postlisteuttrykk så langt det er rimelig

## Foreslått Filstruktur

Nye eller endrede filer:

- Opprett: `_plugins/tag_pages.rb`
- Opprett: `_layouts/tag.html`
- Opprett eller endre stil i `assets/_sass/_minima-overrides.scss` eller `assets/main.scss`
- Endre: `_layouts/post.html`
- Endre: utvalgte poster i `_posts/` for å legge til `tags`

Valgfritt:

- Opprett en liten inkluder, for eksempel `_includes/tag-links.html`, hvis tag-renderingen i post-layouten blir mer enn noen få linjer

## Dataflyt

1. En post får `tags` i front matter.
2. Jekyll bygger `site.posts`.
3. Generatoren leser alle poster og bygger et internt tag-oppslag.
4. Generatoren registrerer én side per tag.
5. `tag.html` renderer listen for den aktuelle taggen.
6. `post.html` renderer klikkbare lenker tilbake til tag-sidene.

## URL- og Innholdsregler

- URL-format: `/tagger/<slug>/`
- Ingen side skal genereres for en tag uten poster.
- Listen på tag-siden sorteres likt som `site.posts`, altså nyeste først.
- Sidetittel bør være enkel, for eksempel `Tag: vinter`.

## Risikoer Og Avklaringer

### Risiko: Ulik stavemåte på samme tag

Siden tagger kommer direkte fra front matter og ikke fra en sentral katalog, kan `vinter`, `Vinter` og `winter` bli brukt inkonsistent.

Tiltak:

- generatoren samler tags case-insensitivt
- redaksjonelt bør samme språkform brukes konsekvent

### Risiko: Slug-kollisjoner

To ulike tagger kan i teorien ende med samme slug etter normalisering.

Tiltak:

- dette er lite sannsynlig i praksis med et lite tag-sett
- implementasjonen bør likevel ha en eksplisitt strategi, helst første tag vinner og build logger en tydelig advarsel

### Risiko: Manglende støtte i deploy-miljø

Custom generator er avhengig av at builden faktisk kjører Jekyll med `_plugins/`.

Tiltak:

- lokal verifikasjon først
- deretter verifisering i vanlig deploy-flyt

## Validering

Etter implementasjon skal løsningen verifiseres lokalt mot `http://localhost:4000`.

Minimumssjekker:

1. Start eller bruk lokal Jekyll-server på `http://localhost:4000`.
2. Åpne en post med tags og verifiser at tag-lenkene vises.
3. Klikk en tag og verifiser at URL blir `/tagger/<slug>/`.
4. Verifiser at tag-siden viser riktig poster, i riktig rekkefølge.
5. Verifiser at en post med flere tagger dukker opp på flere tag-sider.
6. Verifiser at poster uten tags fortsatt renderer normalt.
7. Verifiser minst én tag med mellomrom eller norske tegn i navnet.

Praktisk kontroll kan gjøres både med nettleser og enkel HTTP-sjekk mot localhost.

## Akseptansekriterier

- Minst én post kan merkes med flere tagger via front matter.
- Hver unik tag genererer en statisk side med ren URL.
- Tag-lenker er synlige på post-siden.
- Tag-sider viser enkel postliste med dato, tittel og ingress.
- Poster uten tags påvirkes ikke negativt.
- Løsningen fungerer lokalt på `http://localhost:4000`.

## Anbefalt Neste Steg

Når denne spesifikasjonen er godkjent, bør neste steg være en konkret implementasjonsplan som bryter arbeidet ned i små oppgaver for:

- generator
- layout
- styling
- oppdatering av eksempelposter
- lokal validering på `http://localhost:4000`
