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
  %% =========================
  %% A) DC POWER (solid concept)
  %% =========================
  subgraph A["A) DC power (solid lines conceptually)"]
    BAT["12 V Battery\n(+ / -)"]
    BP["Victron Smart BatteryProtect\nIN+/IN-\nLOAD+/LOAD-"]
    LOADS["12 V Loads\n(Router / Starlink / lights / etc.)"]

    BAT -->|"Battery + / - (power)"| BP
    BP -->|"BP LOAD + / - (power)"| LOADS
  end

  %% =========================
  %% B) CONTROL / LOGIC (dashed concept)
  %% =========================
  subgraph B["B) Control / logic (dashed lines conceptually)"]
    SHELLY["Shelly (dry contact)\nRelay: COM/NO\n(acts like a switch)"]
    IRELAY["Interlock relay\nCoil: powered from BP LOAD\nContact: series with inverter REMOTE"]
    INV["Phoenix Inverter Smart 12/1600\nREMOTE H / REMOTE L"]

    %% Shelly turns BatteryProtect ON/OFF via BP remote
    SHELLY -. "Short BP REMOTE H-L = ON\nOpen = OFF" .-> BP

    %% Interlock relay coil powered only when BP LOAD is alive
    BP -. "BP LOAD powers relay coil\n(only alive when BP ON)" .-> IRELAY

    %% Inverter remote path goes through interlock contact
    SHELLY -. "Optional inverter command\n(2nd Shelly channel or switch)" .-> IRELAY
    IRELAY -. "Interlock contact closes ONLY if BP ON\nthen can short INV REMOTE H-L" .-> INV
  end

  %% =========================
  %% Behaviour note
  %% =========================
  NOTE["Behaviour:\nInverter can only be ON if BatteryProtect is ON.\nIf BatteryProtect turns OFF (manual or low voltage),\ninterlock relay drops out and forces inverter OFF."]
  INV --> NOTE

```