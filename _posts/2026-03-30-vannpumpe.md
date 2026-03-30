---
layout: post
title: "2024 #latergram: nedsenket pumpe"
date: 2026-03-30 12:20:00 +0200
Xexcerpt: En lang og strabasiøs ferd for smooth påfylling
---

<figure>
<a href="https://photos.app.goo.gl/svAdqtA3WAyvmi5w5">
{% cloudinary post /assets/posts/2026-03-30-vannpumpe_thumbnails.avif  %}
</a>
<figcaption>#latergram</figcaption>
</figure>
Etter siste besøk innså jeg at noen som det er litt gøyalt å lese om greier vi gjør, og da har jeg jo faktisk glemt å nevne en av de større infrastrukturoppgraderingene jeg har gjort
i nyere tid, så jeg laget en [liten bildehistorie i Google Photos](https://photos.app.goo.gl/svAdqtA3WAyvmi5w5) om ferden fra snøskutertransport av pumper vinteren 2024 til varmekabler i full drift med pumping 30. november 2024.

# Odysseen

Vinteren 2023/2024 begynte jeg å undersøke muligheten for å få en smoothere måte å fylle på vann vinterstid på hytta. Opprigging av pumper, vannslanger, m.m. vinterstid var ganske strevsomt og vi hadde etterhvert samlet mye "morsomme" historier. Jeg ville ha noe som andre kunne greie å fylle opp vinterstid også, uten alt for mye innsats og styr.

Summa summarum: jeg fikk tips om en nedsenkbar pumpe av god kvalitet (ca 12000 kr), fikk et metallverksted til å lage et custom stativ, fikk shippa inn fridykkerutstyr (med blybelte og ABC-utstyr), pumpa, varmekabler og 50 meter PU-rør vinterstid på snøskuter, bygget en slags putekasse hjemme på Majorstua til å være "sentral", fikk laget lokk i sink til den og bar alt demontert inn på ryggen i juli. I august var familien oppe, jeg fridykket rundt i det altfor langrunne vannet til jeg fant en liten renne som hadde en frostfri dybde (ca 2m) og la pumpa ned der. 50 m med kabel opp til vannkanten ble installert, holdt nede av tunge steiner og i vannkanten borret jeg fester i fjellet. Litt senere kom en kar fra Krøderen Elektro opp på fjellet og gjorde det elektriske på styringen (220V koblinger er litt for avansert/ulovlig for meg) og jeg fikk testa at det fungerte!

## Suksess!

Den 30. november 2024 var tykk is omsider lagt seg på vannet og endelig var dagen kommet for å teste at konseptet fungerte. Jeg og Fredrik koblet til varmekabler , fyrte opp aggregatet og til slutt koblet til pumpa etter en halvtime. Suksess!

Hvordan man nå kobler til alt er dokumentert i bruksanvisningen til hytta per juli 2025.

# Tekniske notater

- Vi har en Victron Phoenix 1600 VAC 220V strømforsyning som kan ta topper på nesten 3 kW. Det var _ikke tilstrekkelig_ 🤯 Oppgradering til 70 mm<sup>2</sup> kabel hjalp ikke stort [til tross for store lovnader](https://community.victronenergy.com/t/red-blinking-led-not-described-in-the-manual/7186/12).
- Pumpa drar visstnok bare 1100 W, men det er _kontinuerlig_. Ved oppstart drar motoren mange ganger det. Den må derfor kjøres på aggregat, men i det minste tar det bare 45 min på å fylle tanken.
- De regulerbare varmekablene står det at bare skal dra 10W/m, men det var bare i fantasien! Ved oppstart hadde de så lav motstand at de dro 5-6 kW. Jeg måtte bruke aggregat for å håndtere oppstarten og bytte til strøm fra hytta etterpå. Da dro de 1200 watt kontinuerlig 🤯 Etter den erfaringen og etter å ha sjekket litt grunnleggende Ohms-lover (<span style="font-weight: 600;">P=I<sup>2</sup> &times; R</span>) o.l. har jeg kjøpte meg en spenningsregulator som står på hytta. Det er en svart boks man kan koble mellom strømmen fra hytta og kabelen. Da kan man f.eks. senke spenningen til 100V som vil senke forbruket til 1/4 til det har stabilisert seg etter et halvt minutt og så gradvis skru det opp til 220V over 20 sekunder-ish. Den fungerer ikke på pumpa - kan ødelegge den (induktiv vs resistiv last eller noe slikt ...).
