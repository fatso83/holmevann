# Hjemmesiden for hytta på Holmevann

> [holmevann.no](https://www.holmevann.no)

Dette repoet inneholder kildekoden og dataene for hjemmesiden jeg har satt opp for hytta vår på Holmevann.
Her er både guider til hvordan man gjør diverse ting, dokumenter til apparater, tips og kanskje prosjektblogger med tiden.

Tanken med å legge det ut er at andre også kan lære av det og lage sin egen variant.

Siden dette har drøyet litt for lenge med å materialisere seg så starter vi bare veldig
enkelt med noen lenker og simple dokumenter. Med tiden blir det kanskje en Markdown-drevet site med offlinestøtte via Service Workers så man kan lese guidene uten dekning, men det er først når jeg får tid (lol).

## Bygge prosjektet

- Installere: `make install`
- Utvikle lokalt med live-reload: `make livereload`
- Liste opp andre muligheter: `make` (eller `make help`)

Se [GitHub Pages](https://help.github.com/articles/setting-up-your-github-pages-site-locally-with-jekyll/) for mer bakgrunnsinfo, f.eks. om du vil sette det opp på eget domene.

## Legge ut ny versjon

Commit endringene dine:

```
git add .
git diff --staged
git commit
```

Så pusher du ut endringene: `make deploy`

## Avhengigheter

- [Bundler](https://bundler.io/) for avhengigheter i Ruby
- [Git LFS](https://git-lfs.com/) for å unngå at repoet vokser for fort



```mermaid
info
```



```mermaid
graph TD;
    A-->B;
    A-->C;
    B-->D;
    C-->D;
```

```mermaid

flowchart TB

subgraph A["A) Power topology — all current measured by SmartShunt"]
  BAT["12 V Battery"]

  SHUNT["Victron SmartShunt<br/>(system −)"]

  BUSP["System + bus"]
  BUSM["System − bus<br/>(after shunt)"]

  BAT -->|"+"| BUSP
  BAT -->|"-"| SHUNT --> BUSM

  PV["Solar panels"] --> MPPT["Victron MPPT 75/15<br/>(charger only)"]
  MPPT -->|"+"| BUSP
  MPPT -->|"-"| BUSM

  BP["Victron Smart BatteryProtect<br/>(MOSFET switch)"]
  DCBUS["12 V consumer bus<br/>(router / Starlink / lights)"]

  BUSP --> BP --> DCBUS
  BUSM --> DCBUS

  INVDC["Phoenix Inverter DC input"]
  BUSP --> INVDC
  BUSM --> INVDC
end

subgraph B["B) Control / logic"]
  S["Shelly (2 channels)<br/>CH1 = MASTER<br/>CH2 = INVERTER"]

  S -. "CH1 MASTER" .-> BP
  SHUNT -. "SOC control (VE.Direct)" .-> BP

  COIL["Interlock relay coil<br/>(powered from BP load side)"]
  ICONTACT["Interlock contact<br/>(series)"]
  INVREM["Phoenix REMOTE H/L"]

  BP -. "BP ON enables" .-> COIL
  COIL -. "closes contact" .-> ICONTACT

  S -. "CH2 INVERTER" .-> ICONTACT
  ICONTACT -. "shorts REMOTE H–L only if<br/>BP ON AND CH2 ON" .-> INVREM
end

NOTE["Behaviour<br/>• All charge/load current goes via shunt → correct SOC<br/>• BP protects battery (LVD or SOC)<br/>• CH1 master: 12 V + allows inverter<br/>• CH2 inverter: 230 V only<br/>• Inverter cannot be ON unless 12 V is ON"]
INVREM --> NOTE

```