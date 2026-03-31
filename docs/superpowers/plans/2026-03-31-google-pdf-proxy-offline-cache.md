# Google PDF Proxy Offline Cache Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route public Google Docs PDF export links through a same-origin Netlify Function so the in-progress service worker can cache them with stale-while-revalidate and serve the last cached version offline.

**Architecture:** Add a standard Netlify Function under `netlify/functions/` that validates and proxies only allowed Google Docs PDF export URLs. Extend the existing root service worker to special-case proxied PDF requests, forward live `Range` requests online, and synthesize byte ranges from a cached full PDF when offline. Replace the current exported Google Docs PDF links in site content with function-prefixed URLs so no template helper is required.

**Tech Stack:** Jekyll 4, Liquid, Markdown/YAML content, Netlify Functions (JavaScript module), browser Service Worker Cache API, local verification with `asdf exec bundle exec jekyll build` and runtime verification with `netlify dev` or a Netlify deploy preview.

---

### Task 1: Add The Netlify PDF Proxy Function

**Files:**

- Create: `netlify/functions/pdf-proxy.mjs`
- Reference: `service-worker.js`
- Reference: `important.md`
- Reference: `rental/index.md`
- Reference: `_data/faqs/no.yml`

- [ ] **Step 1: Add the failing function existence check**

Run:

```bash
test -f netlify/functions/pdf-proxy.mjs
```

Expected: FAIL because the function file does not exist yet.

- [ ] **Step 2: Create the function skeleton**

Create `netlify/functions/pdf-proxy.mjs`:

```js
const ALLOWED_HOSTS = new Set(["docs.google.com"]);
const ALLOWED_EXPORT_PATH = /^\/document\/d\/[^/]+\/export$/;
const PASSTHROUGH_HEADERS = [
  "accept-ranges",
  "cache-control",
  "content-length",
  "content-range",
  "content-type",
  "etag",
  "last-modified",
];

export default async function handler(request) {
  return new Response("Not implemented", { status: 501 });
}
```

Keep the constants top-level so the validation rules stay obvious.

- [ ] **Step 3: Implement URL validation**

Replace the placeholder with validation that:

- reads `url` from the query string
- rejects missing or malformed values with `400`
- rejects non-HTTPS URLs with `403`
- rejects hosts other than `docs.google.com` with `403`
- rejects paths that are not `/document/d/<id>/export` with `403`
- rejects requests whose upstream query does not contain `format=pdf` with `403`

Use a helper so the logic stays isolated:

```js
function getUpstreamUrl(requestUrl) {
  const candidate = requestUrl.searchParams.get("url");
  if (!candidate) {
    return { error: new Response("Missing url parameter", { status: 400 }) };
  }

  let upstream;

  try {
    upstream = new URL(candidate);
  } catch (_error) {
    return { error: new Response("Invalid url parameter", { status: 400 }) };
  }

  if (upstream.protocol !== "https:") {
    return {
      error: new Response("Only https URLs are allowed", { status: 403 }),
    };
  }

  if (!ALLOWED_HOSTS.has(upstream.hostname)) {
    return { error: new Response("Host not allowed", { status: 403 }) };
  }

  if (!ALLOWED_EXPORT_PATH.test(upstream.pathname)) {
    return { error: new Response("Path not allowed", { status: 403 }) };
  }

  if (upstream.searchParams.get("format") !== "pdf") {
    return {
      error: new Response("Only PDF export URLs are allowed", { status: 403 }),
    };
  }

  return { upstream };
}
```

- [ ] **Step 4: Proxy the upstream request and forward request headers**

Fetch the upstream URL with selective header forwarding:

```js
function buildUpstreamHeaders(request) {
  const headers = new Headers();
  const range = request.headers.get("range");
  const etag = request.headers.get("if-none-match");
  const modified = request.headers.get("if-modified-since");

  if (range) headers.set("range", range);
  if (etag) headers.set("if-none-match", etag);
  if (modified) headers.set("if-modified-since", modified);

  return headers;
}
```

Use those headers in the fetch call:

```js
const upstreamResponse = await fetch(upstream, {
  method: "GET",
  headers: buildUpstreamHeaders(request),
});
```

Do not redirect the browser to Google. The function must return the PDF bytes from your own origin.

- [ ] **Step 5: Pass through the PDF-relevant response headers**

Return a new `Response` that streams the upstream body and preserves the relevant headers:

```js
function buildResponseHeaders(upstreamHeaders) {
  const headers = new Headers();

  for (const name of PASSTHROUGH_HEADERS) {
    const value = upstreamHeaders.get(name);
    if (value) {
      headers.set(name, value);
    }
  }

  headers.set("x-proxied-by", "holmevann-pdf-proxy");
  return headers;
}

return new Response(upstreamResponse.body, {
  status: upstreamResponse.status,
  statusText: upstreamResponse.statusText,
  headers: buildResponseHeaders(upstreamResponse.headers),
});
```

The function should transparently pass through `200`, `206`, `304`, and upstream error statuses.

- [ ] **Step 6: Smoke-check the Jekyll build still works with the new function directory present**

Run:

```bash
asdf exec bundle exec jekyll build
test -f _site/service-worker.js
```

Expected: PASS. Jekyll ignores the Netlify function source and still builds the site successfully.

- [ ] **Step 7: Commit the function**

```bash
git add netlify/functions/pdf-proxy.mjs
git commit -m "feat: add google pdf proxy function"
```

### Task 2: Extend The Service Worker For Proxied PDFs

**Files:**

- Modify: `service-worker.js`
- Reference: `netlify/functions/pdf-proxy.mjs`

- [ ] **Step 1: Add the failing grep for a dedicated PDF cache**

Run:

```bash
rg -n "PDF_CACHE|pdf-proxy|Range" service-worker.js
```

Expected: FAIL because the current service worker has no dedicated PDF logic.

- [ ] **Step 2: Add a dedicated cache and route matcher**

Update `service-worker.js` to introduce a separate cache and route predicate:

```js
const PDF_CACHE = "holmevann-pdf-v1";

function isPdfProxyRequest(url) {
  return url.pathname === "/.netlify/functions/pdf-proxy";
}

function isRangeRequest(request) {
  return request.headers.has("range");
}
```

Add `PDF_CACHE` to the `valid` cache list in `activate`.

- [ ] **Step 3: Add a stale-while-revalidate handler for full PDF responses**

Implement a dedicated handler for non-range PDF requests:

```js
async function handlePdfRequest(request) {
  const pdfCache = await caches.open(PDF_CACHE);
  const cached = await pdfCache.match(request);

  const networkPromise = fetch(request)
    .then(async function (response) {
      if (response && response.ok && response.status === 200) {
        await pdfCache.put(request, response.clone());
      }
      return response;
    })
    .catch(function () {
      return null;
    });

  return cached || networkPromise;
}
```

Do not store `206` responses. Cache only a complete `200` PDF for later offline reuse.

- [ ] **Step 4: Add offline range support backed by the cached full PDF**

Implement a range-aware handler that:

- forwards `Range` requests to the network when online
- skips caching `206` partial responses
- on offline failure, looks up the cached full PDF by the same request URL
- reads the cached body into an `ArrayBuffer`
- slices the requested byte range
- returns a synthetic `206 Partial Content` response with correct `Content-Range`, `Content-Length`, and `Accept-Ranges`

Use helpers to keep the parsing contained:

```js
function parseSingleRangeHeader(headerValue, totalLength) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(headerValue || "");
  if (!match) return null;

  const startText = match[1];
  const endText = match[2];

  let start;
  let end;

  if (startText === "" && endText === "") {
    return null;
  }

  if (startText === "") {
    const suffixLength = Number(endText);
    if (!Number.isFinite(suffixLength) || suffixLength <= 0) return null;
    start = Math.max(totalLength - suffixLength, 0);
    end = totalLength - 1;
  } else {
    start = Number(startText);
    end = endText === "" ? totalLength - 1 : Number(endText);
  }

  if (!Number.isInteger(start) || !Number.isInteger(end)) return null;
  if (start < 0 || end < start || start >= totalLength) return null;

  return {
    start,
    end: Math.min(end, totalLength - 1),
  };
}
```

Return `416` for invalid ranges instead of serving corrupt bytes.

- [ ] **Step 5: Route PDF proxy requests before the generic asset handler**

Update the fetch event:

```js
if (isPdfProxyRequest(url)) {
  event.respondWith(
    isRangeRequest(request)
      ? handlePdfRangeRequest(request)
      : handlePdfRequest(request),
  );
  return;
}
```

This route check must happen before `handleAsset(request)` so PDFs do not get treated like generic same-origin assets.

- [ ] **Step 6: Bump cache names to invalidate older runtime behavior**

Increment the existing cache version suffixes in `service-worker.js` so browsers replace the previous worker and cache layout cleanly after deploy.

- [ ] **Step 7: Commit the service worker changes**

```bash
git add service-worker.js
git commit -m "feat: cache proxied pdfs offline"
```

### Task 3: Rewrite Existing Google Docs PDF Links

**Files:**

- Modify: `important.md`
- Modify: `rental/index.md`
- Modify: `_data/faqs/no.yml`
- Reference: `faq.md`

- [ ] **Step 1: Add the failing search for proxied links**

Run:

```bash
rg -n "/\\.netlify/functions/pdf-proxy\\?url=" important.md rental/index.md _data/faqs/no.yml
```

Expected: FAIL because the current content still points at raw Google URLs.

- [ ] **Step 2: Rewrite the direct PDF export links in `important.md`**

Replace each raw Google Docs export URL with a same-origin proxied URL:

```html
<a
  href="/.netlify/functions/pdf-proxy?url=https%3A%2F%2Fdocs.google.com%2Fdocument%2Fd%2F1NpuBRGMA6w90_756cMcHjl3q-KFJMSvRIDl7vA4wqi8%2Fexport%3Fformat%3Dpdf"
></a>
```

Percent-encode the entire upstream URL after `url=`. Do not leave literal `?` and `&` characters unescaped inside the nested URL.

- [ ] **Step 3: Rewrite the export links in `rental/index.md`**

Update the two current exported PDF links the same way. Leave the editable Google Doc link under the `Turtips` section unchanged because it is not a PDF export URL in the current content.

- [ ] **Step 4: Rewrite the export links in `_data/faqs/no.yml`**

Update only the exported PDF URLs in the FAQ answers. Leave the deep `edit#heading=...` Google Docs link unchanged because it is used as a document anchor, not as a PDF download.

- [ ] **Step 5: Rebuild and verify the generated HTML now uses the proxy URLs**

Run:

```bash
asdf exec bundle exec jekyll build
rg -n "/\\.netlify/functions/pdf-proxy\\?url=" _site/important.html _site/rental/index.html _site/faq.html
rg -n "docs.google.com/document/.+/export\\?format=pdf" _site/important.html _site/rental/index.html _site/faq.html
```

Expected:

- first `rg` PASS with proxied links present
- second `rg` FAIL because raw export URLs should no longer be emitted in those pages

- [ ] **Step 6: Commit the content rewrite**

```bash
git add important.md rental/index.md _data/faqs/no.yml
git commit -m "feat: proxy google pdf links"
```

### Task 4: Verify Runtime Behavior With Netlify Functions Enabled

**Files:**

- Verify: `netlify/functions/pdf-proxy.mjs`
- Verify: `service-worker.js`
- Verify: `_site/important.html`
- Verify: `_site/rental/index.html`
- Verify: `_site/faq.html`

- [ ] **Step 1: Start a Netlify-aware local server**

Run:

```bash
netlify dev
```

Expected: Netlify starts a local server that serves both the Jekyll site and `/.netlify/functions/pdf-proxy`.

If the Netlify CLI is unavailable locally, skip local runtime checks and use a deploy preview for this task instead.

- [ ] **Step 2: Confirm the proxy endpoint returns a PDF online**

Open this URL in a browser:

```text
http://localhost:8888/.netlify/functions/pdf-proxy?url=https%3A%2F%2Fdocs.google.com%2Fdocument%2Fd%2F1NpuBRGMA6w90_756cMcHjl3q-KFJMSvRIDl7vA4wqi8%2Fexport%3Fformat%3Dpdf
```

Expected: Browser shows or downloads a PDF with a same-origin URL.

- [ ] **Step 3: Confirm the function rejects disallowed URLs**

Open:

```text
http://localhost:8888/.netlify/functions/pdf-proxy?url=https%3A%2F%2Fexample.com%2Ffoo.pdf
```

Expected: `403` response.

- [ ] **Step 4: Verify stale-while-revalidate behavior for a full PDF**

In DevTools:

- visit a proxied PDF while online
- confirm the response is `200`
- confirm a cache entry is created for the proxied URL in the `holmevann-pdf-*` cache
- go offline
- revisit the same proxied URL

Expected: the last cached PDF still opens offline.

- [ ] **Step 5: Verify range-based browser viewing still works**

While online:

- open a proxied PDF in the browser viewer
- jump to a later page
- confirm `Range` requests are sent and answered with `206`

Expected: browser PDF viewing still works without the proxy forcing a full re-download for every navigation.

- [ ] **Step 6: Verify offline fallback for range requests backed by a cached full PDF**

After a full `200` PDF has been cached:

- go offline
- reopen the same proxied PDF in a fresh tab
- confirm the viewer still renders pages instead of failing immediately

Expected: the service worker serves synthetic byte ranges from the cached full PDF.

- [ ] **Step 7: Verify stale content refreshes on a later online visit**

After an upstream PDF changes in place:

- load the proxied PDF online once
- close and reopen it while offline to confirm the old copy still exists
- reconnect to the network
- open the same proxied URL again

Expected: the stale cached copy is usable offline, and the cache refreshes on a later online visit.

- [ ] **Step 8: Commit only if runtime verification required code adjustments**

```bash
git status --short
```

Expected: no new changes after verification. If fixes were needed, commit them with a focused message such as:

```bash
git add netlify/functions/pdf-proxy.mjs service-worker.js
git commit -m "fix: harden proxied pdf offline behavior"
```
