---
layout: post
title: "Neverending Story: kommende prosjekter 😍"
date: 2026-03-30 16:10:00 +0200
excerpt: "Viktig å ikke bli arbeidsledig, så det kverner alltid noe i bakhodet som kan forbedres. Noen synes faktisk sånt er gøy 😄 Her er en liste med greier jeg aldri blir ferdige med, men som jeg håper å komme i gang med i løpet av tiden som kommer. Må bare pusse opp huset først, komme ajour med noen onlinekurs, og bli et bedre menneske, så skal jeg nok få gjort det 😶"
tags:
  - hjemmeautomasjon
  - strøm
  - vann
  - prosjekt
  - lora
  - arduino
  - shelly
  - Netlify
  - edge computing
toc: true
---

En veldig kjapp liste over ting i pipelinen. Veldig mye relaterer seg til hjemmeautomasjon ("home automation"), ESP32, Shelly, etc.

## Fikse "Ring hytta varm"

Fra hytta ble bygget i 1994 og fram til personsøkernettet ble skrudd av i 1997 hadde vi "Ring hytta varm"-funksjon på Wallas-en. Vanlig mobilnett rakk ikke fram. Rundt 2024 begynte "LTE-M"-løsninger å dukke opp: LTE (4G) som kjører på det gamle 450 MHz mobilnettet og trenger mye dypere inn i fjellheimen.

Parafinkaminen vår fra finske Wallas er perfekt når den funker. De siste 5-6 årene har den derimot vært lite samarbeidsvillig, men i 2024/25 ble den bygget om innvendig (nytt kretskort, brenner, ++) slik at den 20 år gamle ovnen essensielt er elektronisk lik en ny ovn. Det muliggjør "Ring hytta varm" ved hjelp av en Sikom-boks jeg har kjøpt inn. Jeg koblet alt opp etter bruksanvisningen i sommer, men ... det funka ikke. Jeg skal prøve igjen til sommeren.

## Batteribeskyttelse ved auto-frakoble 220V fra 12V

Etter mye sparring med ChatGPT før jul har jeg funnet fram til at jeg essensielt bør bygge om hvordan jeg har koblet det elektriske 😄 Dvs. alt _fungerer_ i dag, men jeg kan oppnå mye ved å koble ting slik:

![flytdiagram](/assets/posts/flowchart-auto-disconnect.png)

Da får jeg

- bedre arkitektur: alt går via én felles DC-buss – og all strøm må gjennom shunten.
- full oversikt over strømforbruk via Victron SmartShunt
- BatteryProtect som fysisk bryter 12 V-forbruk. Dette vil igjen automatisk skru av 220V forbruk!
- nødbryter på strøm

## Overvåkning av drivstoff- og vanntanker

Det skal relativt lite til for å lage en liten dings som ved hjelp av ultralydsensorer kan måle vannstand i en tank. Tanken er å bruke et par slike i drivstofftanken til wallas-en og i vanntanken, koble dem til en LTE-M gateway via LoRa og dytte dataene ut på internett. Da kan man se status på dette direkte fra hjemmesiden 🤓 Trenger bare å lage noen "Edge Functions" i Netlify for å ta imot og vise dataene.

- Lora (for "Long Range") er en trådløs radioteknologi utviklet av Semtech for langdistansekommunikasjon med svært lavt strømforbruk. Det er en hjørnestein i IoT-applikasjoner (Internet of Things), og muliggjør dataoverføring over mange kilometer, ofte brukt i smarte byer, landbruk og industri.
- En arduino-kompatibel ESP32, en billig LoRa-modul og en ultralydsensor koster typ 200 kr. Med deep sleep og oppvåkning en gang i timen burde de fint kjøre et år uten behov for nytt batteri.

## Internett (via Starlink eller mobilnettet?)

Vi har lenge hatt parabol fra Allente (Canal Digital), men det koster helt sykt mye og parabolen kom ofte ut av posisjon. Nå har vi kabelbrudd og jeg måtte vurdere om det gav mening å fortsatt betale 700 kr/mnd for noe veldig få bruker. Mange vil gjerne strømme TV/serier, men vi har ikke dekning for 4G.

Jeg hadde lenge (høst 2021) planlagt et større prosjekt med kabling til nærmeste topp og 4G-antenne med Power-over-Ethernet og mye customelektronikk for å få til dette likevel, men så blåste taket av og viktigere ting måtte prioriteres ... 

### Starlink

Så dukket Starlink opp som et reellt alternativ. Lenge kostet det 1000 spenn i måneden, men nå er det tilgjengelig til halve prisen av det Allente skulle ha ... Robust, raskt og rimelig. 

Ulempen er høyt strømtrekk: det trekker over 100W i oppstart før det faller til &lt; 30 watt når det har stabilisert seg. 2 ampere er fremdeles alt for mye (50 Ah/døgn) til at det er levelig vinterstid, spesielt hvis vi skulle glemme å skru det av, så dette betinger to ting:

1. Automatisk frakobling av 220V (se over) så vi ikke dreper batteriene
2. Mulighet til å skru av/på 220V via brytere på veggen

Jeg må antagelig også bygge en egen lavstrøms, LTE-M/IoT-basert dings for å kunne fjernstyre alt annet. Ev. koble til fjernstarteren til Wallas-en (som er LTE-M-basert og har to releer man kan bruke for å kontrollere andre ting).


### Hva med mobilnettet?

Opprinnelig tanke innebar kort oppsummert 

- Industriell 4G ruter ([RUT241](https://www.kjell.com/no/produkter/nettverk/rutere/4g-ruter/teltonika-rut241-4g-ruter-med-modem-p65345)), mulig bygget inn i antennehus for minimal tap av signal
- 200 m CAT5-kabel ned til hytte med forsterkning etter 100 m (Power-over-Ethernet)
- Kan fore med egenmekket 24V/48V strømforsyning fra 12V
- Sette opp stang på fot oppe på fjellet der det er dekning
- ca kostnad 7-8000 kr? 

Ganske omfattende oppsett utendørs og relativt høy kostnad, men relativt enkelt innvendig pga lavt strømforbruk (220V ikke nødvendig). 

### Konklusjon (mai 2025)

Jeg går nok likevel for 4G-basert internett av følgende grunner:

1. Det kan gjøres rimeligere enn jeg tenkte: jeg hadde allerede en dupleks, retningsstyrt/Yagi antenne av typen Poynting LDPA-92. Bedre blir det ikke, men den er ganske stor og krever et skikkelig stativ med fjellfeste. 
2. Jeg trenger ikke å bygge så mye "custom" som jeg tenkte. Har funnet "ferdigvarianter" i 12V variant av PoE-injektorer og det meste.  

Har allerede kjøpt fjellfeste for mast, mast og antennefeste. Alt jeg trenger er å få tak i 12V-48V PoE injector -> kabel -> 48V utendørs ethernet extender m/PoE -> kabel -> PoE Splitter -> 12V plugg i ruter. Dvs en boks i hver ende. Samt plastkasser for værbeskyttelse 🙂


## Statusdisplay

Hadde vært digg om det var et panel på hytta som viste:

- om man hadde lavt/høyt strømtrekk
- om man brukte mye/lite/normal mengde vann og stipulering av gjenværende basert på forbruk
- status på vann og diesel/parafintank

## Starte varmekabler på vanntanken hjemmefra

Krever:

- LTE-M fjernstarter (typ NRF9151) som kan ta i mot kommandoer og starte andre ting over nettet (async arkitektur)
- LoRa-sendere på dingsene som gjør at vi kan benytte oppsettet fra automatisk avkobling 220V og 12V til å starte Victron-omformeren.
- Wifi-router/Starlink

## Automatisk åpne bom for andre enn meg

I dag må jeg manuelt være tilgjengelig når gjester skal til hytta, så jeg kan åpne bommen. Det er kjipt. Bare mitt registrerte telefonnummer fungerer. Men hva om jeg kunne få andre til å styre en av mine telefoner? 🤔

Min valgte tilnærming: lag en [Android app som ringer](https://itnext.io/android-dial-phone-programmatically-5ea3714d801d) når den får et signal. Den trenger ikke en gang en backend - det holder at den kan lese SMS eller motta en oppringning.
Signalet kan være

- SMS: "sesam lukk deg opp"
- noen ringer
- en websocket til en server/edge-node sender et signal (a la `{action: 'open-gate'}`).
