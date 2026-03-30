# Offline Core Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Legg til offline-støtte for et definert kjernesett av sider, samt caching av andre samme-origin sider og assets etter at brukeren har besøkt dem online.

**Architecture:** Løsningen bygges med en service worker på rot, et lite registreringsskript som lastes på alle sider, og et manifest lenket fra en lokal override av Minima sin `head`-include. Service workeren precacher kjernesider og shell-assets, bruker `network-first` for samme-origin navigasjoner, bruker en asset-cache for samme-origin statiske filer, og returnerer en offline-fallback for ubesøkte ruter når nettverket mangler.

**Tech Stack:** Jekyll 4, Minima 2.5, Liquid, statiske assets under `assets/`, service worker i vanlig browser-API, lokal verifisering via `asdf exec bundle exec jekyll build` og lokal Jekyll-server.

---

### Task 1: Add PWA Entry Points To Every Page

**Files:**

- Create: `_includes/head.html`
- Create: `manifest.webmanifest`
- Create: `assets/js/register-service-worker.js`
- Reference: `vendor/bundle/ruby/3.4.0/gems/minima-2.5.2/_includes/head.html`

- [ ] **Step 1: Copy the current Minima head include into a local override**

Create [`_includes/head.html`](/Users/carlerik/dev/holmevann/_includes/head.html) using the existing Minima content as the base:

```liquid
<head>
  <meta charset="utf-8">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  {%- seo -%}
  <link rel="stylesheet" href="{{ "/assets/main.css" | relative_url }}">
  {%- feed_meta -%}
  {%- if jekyll.environment == 'production' and site.google_analytics -%}
    {%- include google-analytics.html -%}
  {%- endif -%}
</head>
```

Do not add new behavior yet. This step just makes the include explicit in the repo.

- [ ] **Step 2: Add the failing output check for PWA entry files**

Run:

```bash
asdf exec bundle exec jekyll build
test -f _site/manifest.webmanifest
test -f _site/assets/js/register-service-worker.js
```

Expected: FAIL because neither file exists yet.

- [ ] **Step 3: Create the manifest**

Create [`manifest.webmanifest`](/Users/carlerik/dev/holmevann/manifest.webmanifest) with a minimal same-origin configuration:

```json
{
  "name": "#holmevann1013moh",
  "short_name": "Holmevann",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#ffffff",
  "icons": [
    {
      "src": "/favicon.ico",
      "sizes": "48x48 32x32 16x16",
      "type": "image/x-icon"
    }
  ]
}
```

- [ ] **Step 4: Create the service worker registration script**

Create [`assets/js/register-service-worker.js`](/Users/carlerik/dev/holmevann/assets/js/register-service-worker.js):

```js
if ("serviceWorker" in navigator) {
  window.addEventListener("load", function () {
    navigator.serviceWorker
      .register("/service-worker.js")
      .catch(function (error) {
        console.warn("Service worker registration failed", error);
      });
  });
}
```

Keep the script tiny and defensive. No install prompt logic, no UI state yet.

- [ ] **Step 5: Wire manifest and registration script into the local head include**

Update [`_includes/head.html`](/Users/carlerik/dev/holmevann/_includes/head.html) to add:

```liquid
  <link rel="manifest" href="{{ "/manifest.webmanifest" | relative_url }}">
  <script defer src="{{ "/assets/js/register-service-worker.js" | relative_url }}"></script>
```

Place them after the stylesheet so the intent is obvious.

- [ ] **Step 6: Build and verify the PWA entry points now exist**

Run:

```bash
asdf exec bundle exec jekyll build
test -f _site/manifest.webmanifest
test -f _site/assets/js/register-service-worker.js
rg -n 'manifest.webmanifest|register-service-worker.js' _site/index.html
```

Expected: PASS. The build emits both files and the homepage references them.

- [ ] **Step 7: Commit the entry-point plumbing**

```bash
git add _includes/head.html manifest.webmanifest assets/js/register-service-worker.js
git commit -m "feat: add offline app entry points"
```

### Task 2: Add The Offline Fallback Page

**Files:**

- Create: `offline.md`
- Verify output: `_site/offline.html`

- [ ] **Step 1: Add the failing offline-page check**

Run:

```bash
asdf exec bundle exec jekyll build
test -f _site/offline.html
```

Expected: FAIL because the offline page does not exist yet.

- [ ] **Step 2: Create the offline fallback page**

Create [`offline.md`](/Users/carlerik/dev/holmevann/offline.md) with:

```markdown
---
layout: page
title: Offline
permalink: /offline.html
exclude: true
---

Du er offline akkurat nå.

De viktigste sidene på holmevann.no skal fortsatt fungere, og andre sider virker også hvis du har åpnet dem tidligere på denne enheten.

Eksterne kart, videoer, Google Docs og annet innhold fra andre nettsteder virker ikke nødvendigvis uten nett.
```

Keep the page plain. It is infrastructure, not a feature page.

- [ ] **Step 3: Build and verify the fallback page exists**

Run:

```bash
asdf exec bundle exec jekyll build
test -f _site/offline.html
rg -n 'Du er offline akkurat nå' _site/offline.html
```

Expected: PASS.

- [ ] **Step 4: Commit the fallback page**

```bash
git add offline.md
git commit -m "feat: add offline fallback page"
```

### Task 3: Implement Service Worker Precache And Runtime Caching

**Files:**

- Create: `service-worker.js`
- Reference: `manifest.webmanifest`
- Reference: `offline.md`

- [ ] **Step 1: Add the failing service-worker existence check**

Run:

```bash
asdf exec bundle exec jekyll build
test -f _site/service-worker.js
```

Expected: FAIL because the service worker does not exist yet.

- [ ] **Step 2: Create the initial service worker skeleton**

Create [`service-worker.js`](/Users/carlerik/dev/holmevann/service-worker.js):

```js
const CORE_CACHE = "holmevann-core-v1";
const PAGE_CACHE = "holmevann-pages-v1";
const ASSET_CACHE = "holmevann-assets-v1";

self.addEventListener("install", function () {});
self.addEventListener("activate", function () {});
self.addEventListener("fetch", function () {});
```

- [ ] **Step 3: Add core precache in install**

Expand the install handler to precache:

```js
const CORE_URLS = [
  "/",
  "/important.html",
  "/rental/",
  "/faq.html",
  "/map.html",
  "/offline.html",
  "/assets/main.css",
  "/assets/js/register-service-worker.js",
  "/favicon.ico",
];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CORE_CACHE).then(function (cache) {
      return cache.addAll(CORE_URLS);
    }),
  );
  self.skipWaiting();
});
```

Use the built output paths that Jekyll actually emits, not the source paths.

- [ ] **Step 4: Add cache cleanup in activate**

Implement:

```js
self.addEventListener("activate", function (event) {
  const valid = [CORE_CACHE, PAGE_CACHE, ASSET_CACHE];

  event.waitUntil(
    caches
      .keys()
      .then(function (keys) {
        return Promise.all(
          keys.map(function (key) {
            if (!valid.includes(key)) {
              return caches.delete(key);
            }
          }),
        );
      })
      .then(function () {
        return self.clients.claim();
      }),
  );
});
```

- [ ] **Step 5: Add a helper that recognizes same-origin requests**

Inside [`service-worker.js`](/Users/carlerik/dev/holmevann/service-worker.js), add small helpers:

```js
function isSameOrigin(url) {
  return url.origin === self.location.origin;
}

function isHtmlNavigation(request) {
  return request.mode === "navigate";
}
```

Avoid clever heuristics beyond this first pass.

- [ ] **Step 6: Implement network-first caching for navigations**

Add a fetch branch for same-origin HTML navigations:

```js
async function handleNavigation(request) {
  const cache = await caches.open(PAGE_CACHE);

  try {
    const response = await fetch(request);
    if (response && response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (_error) {
    const cached = await cache.match(request);
    if (cached) {
      return cached;
    }

    const core = await caches.open(CORE_CACHE);
    return (await core.match(request)) || (await core.match("/offline.html"));
  }
}
```

This is the key behavior for “visited pages should work offline”.

- [ ] **Step 7: Implement caching for same-origin static assets**

Add a fetch branch for same-origin asset requests using `stale-while-revalidate`:

```js
async function handleAsset(request) {
  const cache = await caches.open(ASSET_CACHE);
  const cached = await cache.match(request);

  const networkPromise = fetch(request)
    .then(function (response) {
      if (response && response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(function () {
      return null;
    });

  return cached || networkPromise;
}
```

Only use this for same-origin, non-navigation `GET` requests.

- [ ] **Step 8: Wire the fetch router**

Finish the fetch handler:

```js
self.addEventListener("fetch", function (event) {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== "GET" || !isSameOrigin(url)) {
    return;
  }

  if (isHtmlNavigation(request)) {
    event.respondWith(handleNavigation(request));
    return;
  }

  event.respondWith(handleAsset(request));
});
```

Do not intercept cross-origin traffic in this iteration.

- [ ] **Step 9: Build and inspect the emitted service worker**

Run:

```bash
asdf exec bundle exec jekyll build
test -f _site/service-worker.js
rg -n 'holmevann-core-v1|holmevann-pages-v1|holmevann-assets-v1|offline.html' _site/service-worker.js
```

Expected: PASS.

- [ ] **Step 10: Commit the caching implementation**

```bash
git add service-worker.js
git commit -m "feat: add offline caching service worker"
```

### Task 4: Verify Built Output And Browser Behavior

**Files:**

- Verify: `_site/index.html`
- Verify: `_site/important.html`
- Verify: `_site/rental/index.html`
- Verify: `_site/faq.html`
- Verify: `_site/map.html`
- Verify: `_site/offline.html`

- [ ] **Step 1: Run a full production-style build**

Run:

```bash
JEKYLL_ENV=production asdf exec bundle exec jekyll build
```

Expected: PASS.

- [ ] **Step 2: Confirm the built pages load the registration script and manifest**

Run:

```bash
rg -n 'manifest.webmanifest|register-service-worker.js' _site/index.html _site/important.html _site/faq.html _site/map.html _site/rental/index.html
```

Expected: PASS. Every checked page contains both references.

- [ ] **Step 3: Confirm the service worker precache list matches the actual output paths**

Run:

```bash
test -f _site/index.html
test -f _site/important.html
test -f _site/rental/index.html
test -f _site/faq.html
test -f _site/map.html
test -f _site/offline.html
```

Expected: PASS.

- [ ] **Step 4: Start the local site for manual browser verification**

Run:

```bash
asdf exec bundle exec jekyll serve --host localhost --config _config.yml,_config_dev.yml
```

Expected: PASS. The site serves on `http://localhost:4000`.

- [ ] **Step 5: Verify service worker registration in the browser**

Manual check in DevTools Application tab:

- Open `http://localhost:4000/`
- Confirm one service worker is registered and active
- Confirm caches named `holmevann-core-v1`, `holmevann-pages-v1`, and `holmevann-assets-v1` appear after navigation

- [ ] **Step 6: Verify the core offline experience**

Manual check:

- Visit `/`, `/important.html`, `/rental/`, `/faq.html`, and `/map.html` while online
- Switch DevTools to Offline
- Reload each page

Expected: PASS. All five pages still render.

- [ ] **Step 7: Verify visited-page runtime caching**

Manual check:

- While online, open a non-core same-origin page such as `/2026/03/30/vannpumpe.html`
- Switch DevTools to Offline
- Reload that same page

Expected: PASS. The page still renders because it was cached during the online visit.

- [ ] **Step 8: Verify fallback for an unvisited route**

Manual check:

- While still offline, navigate directly to a same-origin page you did not open earlier in the session

Expected: PASS. The site shows the offline fallback page instead of a browser network error.

- [ ] **Step 9: Verify third-party embeds degrade acceptably**

Manual check:

- Open `/map.html`, `/gallery.html`, and one post with third-party embeds while offline

Expected: PASS with caveats. Same-origin text and styling render; third-party content may fail to load, but the page itself remains usable.

- [ ] **Step 10: Commit the verified offline experience**

```bash
git add _includes/head.html manifest.webmanifest assets/js/register-service-worker.js offline.md service-worker.js
git commit -m "feat: add offline core browsing support"
```
