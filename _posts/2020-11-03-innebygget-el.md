---
layout: post
title: "220V i stikkontakten"
date: 2020-11-03 18:30:00 +0100
tags:
  - strøm
  - elektriker
  - oppgradering
toc: true
---

Denne helgen har jeg fått en elektriker til å gå over
alt det elektriske jeg har gjort selv i sommer. Det holdt
ikke bare for ham å sjekke at det var OK: han endte med
å åpne veggen og legge alle de eksponerte kablene inn i
veggen. Plutselig var alle hullene i ytterveggen og de
30 metrene med kabel ut og under hytta ikke lenger
nødvendige ... whoops, sveitserost for nothing 🙈

I det minste er anlegget nå komplett, og jeg kan endelig
gå over hytteguiden og oppdatere den, for nå går det ikke
lenger en skjøteledning fra hemsen, men inne i veggen! For
å bruke tv-en eller støvsugeren trenger man nå kun å skru på omformeren :)

Wallas-en (parafinkaminen) viste seg å ha en defekt jeg ikke kunne fikse selv,
så den må tas ned til jul for reparasjon. Oh, well. Ingen som skal på besøk før den tid.

## Det elektriske anlegget oppsummert

Uten å vise matematikken så har jeg i praksis energi for 5-6 dager uten sol med 1000 Wh forbruk (relativt høyt)
før jeg trenger å starte aggregatet ved <a href="#voltage">50%</a>. Om solen skinner for fullt lader jeg
ca 1000W/67A (860W+140W) på maksimum. Det er mer enn aggregatet (50A)!
I tåke lades det opptil 100W (hvorav minst halvparten er fra det gamle anlegget!)

- 4x [Concorde Sun Xtender PVX-2580L][sun xtender] (258Ah@C20, 305Ah@C100)
- 1x Varta 136Ah
- alle batterier parallelkoblet (12V)
- 3x330W solcellepanel seriekoblet på taket (120V) og 1x140W panel montert vertikalt mot syd (ca 18V)
- "kinaomformer" á 1000W kontinuerlig (2000W peak)
- [Victron 250V/60A][victron 60] (for nye paneler) og [Victron 75/15][victron 15] (for gammelt). Begge MPPT.
- [Canadus HD-1224][canadus] desulfaterer for maksimal levetid på batterier

### Litt lengre og kjedeligere

Jeg hadde opprinnelig bare ett Sun Xtender batteri. Denne modellen er en type
"deep discharge"-batteri som er spesielt robust; det skal tåle kulde
og veldig dype utladninger uten å ta skade av det. Det veier også nesten 80kg!

Det er antagelig fra 2013 eller eldre, men i fin form: jeg fikk målt det til 98% av
ny kapasitet hos Sunwind i 2018.
Jeg kjøpte så et ekstra Varta batteri en gang noen leieboere gikk tom for strøm og slet
med å lade batteriet. Det skulle egentlig bare være backup, men er nå en del av riggen.
Jeg kjøpte så et brukt Sun Xtender til, men det viste seg å være et bomkjøp. Det var meget slitt;
jeg målte det til [60% kapasitet][test bad battery] og med meget dårlig effekt (tålte ikke 300W i 30 min).
I tillegg har jeg kjøpt 2 Sun Xtender til - også brukt, men disse målte jeg til [> 90 prosent kapasitet][test good battery].

Så med de gamle batteriene regner jeg med ca 1000Ah
teoretisk kapasitet, men siden batteriene helst ikke skal tappes under 50% (aller helst holde det over 70%)
blir det _i praksis_ 500Ah@12V eller 6000Wh.

### Hvorfor brukte batterier

Økonomi og tidsperspektiv. Jeg trengte å øke batterikapasiteten på hytta
og så at det ville bli veldig dyrt å kjøpe en ny batteripakke. Litiumbatterier
var per 2019 enda ikke konkurransedyktig på [pris (men nesten!)][price per kwh],
selv om man i praksis bare trenger
halvparten så mye kapasitet med litium siden de kan lades helt ut. Jeg så derimot
at litiumbatterier vil være "det riktige"/mest økonomiske valget om bare et par år.
Da ville det kanskje gi mening å oppgradere til 48V i samme slengen.
Samtidig hadde jeg to AGM batterier som var nesten nye - det ville være dumt
å bare kaste dem, så derfor så jeg på muligheter for å bruke det jeg hadde
og skaffe kapasiteten jeg trengte på et rimelig vis. Ett nytt PVX-2580 koster
ca 12000 kr (10K på tilbud). Jeg fikk kjøpt 3 stk til 9000kr med en snittkapasitet
på 80%. Med andre ord nesten 70% rabatt på Ah/kr. Totalt kom [oppgraderingen](https://www.holmevann.no/2020/08/10/oppgraderinger.html) av anlegget med solceller, kabler, regulatorer, rigg og flere batterier på ca 25000 kr.
Det er veldig mye billigere enn jeg kunne se på nett.

Det er vanligvis ikke anbefalt å blande batterier av forskjellig type, modell, årstall, etc.
Riktignok er det _veldig viktig at batteriene er like når man seriekobler_ dem, men det er
ikke _så_ viktig når man parallelkobler. Selv et slitent batteri kan bidra positivt koblet i
parallel, så lenge spenningskurven og toppspenningen er relativt lik. Er den ikke
det kan ulik motstand i batteriene gjøre at belastningen blir ujevn. Da får man kortere
levetid på batteriene. For min del så jeg at dette ikke ville være noe stort problem:
jeg har nesten like batterier, strømtrekket er lite (2-5A), og siden jeg har så
mye effekt på ladesiden så vil batteriene nesten alltid være > 95% ladet.
Da blir slitasjen minimal. Siden jeg har et tidsperspektiv på 5 år, så
tenker jeg at dette vil gå helt fint.

## Addendum: prisnotater

Prisen per kWh har visstnok falt med 82% fra 2012 til 2020 eller 90% fra
[2008 til 2022][price 2008-2022] og skal [per 2023][price per kwh] være på
ca 150USD/kWh. I 2030 er prisen antatt å ligge på rundt halvparten av dette igjen: 75USD/kWh.
![graf](https://www.energy.gov/sites/default/files/styles/full_article_width/public/2023-01/FOTW_1272.png?itok=Hducr2em). Kan anta at prisen i 2019 antagelig var tilsvarende 200 USD/kWh, så med
dagens priser er det en no-brainer å oppgradere til LiPo eller andre varianter.

## Referanser

- <a name="voltage"/>50% = 12,2V - ref [Sun Xtender Technical Manual, Appendix C][sun xtender pdf]

[sun xtender]: http://www.sunxtender.com/solarbattery.php?id=11
[sun xtender pdf]: http://www.sunxtender.com/pdfs/Sun_Xtender_Battery_Technical_Manual.pdf
[victron 60]: https://www.victronenergy.com/solar-charge-controllers/smartsolar-250-85-250-100
[victron 15]: https://www.victronenergy.com/solar-charge-controllers/smartsolar-mppt-75-10-75-15-100-15-100-20
[canadus]: https://canadus.com/canadus-hd-1224/
[test bad battery]: https://www.evernote.com/shard/s16/sh/2ca356d6-9bf0-4aa9-903f-f673a88a5a45/5610d2e6e6d1ed15579cfae5f7948021
[test good battery]: https://www.evernote.com/shard/s16/sh/a4d2926f-dea8-4ba5-9472-1bea4c39abcc/535cd79c5c1ed966d71344bad9ff7b61
[price per kwh]: https://lawnlove.com/blog/lithium-ion-battery-cost/#hours
[price 2008-2022]: https://www.energy.gov/eere/vehicles/articles/fotw-1272-january-9-2023-electric-vehicle-battery-pack-costs-2022-are-nearly
