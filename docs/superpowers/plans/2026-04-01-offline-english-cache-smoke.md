# Offline English Cache Smoke Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a stable Playwright smoke test that proves translated English pages and one English PDF work offline after warming the cache from `/`, then use that reproducer plus HAR evidence to debug and fix the offline caching bug.

**Architecture:** First harden the HTML cache-key normalization boundary in the offline runtime helpers, because production passes `Request` objects while the current unit tests mostly pass strings. Then extend the existing Playwright smoke to warm the service worker from `/`, assert cache readiness, switch the browser offline, and verify both `/en/rental/` and one proxied PDF from the English important page. Finally, use the failing smoke and optional HAR capture to isolate whether the bug is in route normalization, cache warmup timing, or translated-page prefetch behavior before changing service-worker logic.

**Tech Stack:** Jekyll 4, Ruby 3.4 via `asdf`, Node test runner, Playwright, service worker Cache API, Netlify local function proxy.

---

### Task 1: Harden HTML Cache-Key Input Handling

**Files:**

- Modify: `assets/js/offline-runtime-utils.js`
- Test: `test/offline-runtime-utils.test.js`

- [ ] **Step 1: Add failing tests that exercise `Request` inputs exactly like production**

Update [`test/offline-runtime-utils.test.js`](/Users/carlerik/dev/holmevann/test/offline-runtime-utils.test.js) with focused tests for:

```js
new Request("https://www.holmevann.no/en/rental/");
new Request("https://www.holmevann.no/en/important/");
new Request("https://www.holmevann.no/en/important.html");
```

Each test should assert the normalized cache keys explicitly, for example:

```js
assert.deepEqual(
  getHtmlCacheKeys(new Request("https://www.holmevann.no/en/important/")),
  ["/en/important/"],
);
```

Also add one negative test that passes an unsupported input shape and expects a thrown `TypeError`.

- [ ] **Step 2: Run the unit file to verify the new coverage fails before implementation**

Run:

```bash
node --test test/offline-runtime-utils.test.js
```

Expected: FAIL, either because `Request` is not handled the way production uses it or because unsupported input is silently accepted.

- [ ] **Step 3: Add explicit type assertions and input normalization to `getHtmlCacheKeys`**

Update [`assets/js/offline-runtime-utils.js`](/Users/carlerik/dev/holmevann/assets/js/offline-runtime-utils.js) so `getHtmlCacheKeys` only accepts:

- `string`
- `URL`
- `Request`

Reject ad-hoc objects with a `.url` field unless they are actual `Request` instances. Keep the existing aliasing behavior for:

- `.html` pages
- extensionless non-directory pages like `/map`
- directory routes like `/en/rental/`

Use a thrown `TypeError` for unsupported input.

- [ ] **Step 4: Run the JavaScript unit suite**

Run:

```bash
node --test test/*.test.js
```

Expected: PASS.

- [ ] **Step 5: Record the impact boundary before editing service worker logic**

Run:

```bash
gitnexus impact --help >/dev/null 2>&1 || true
```

Then, using the GitNexus MCP tool, run upstream impact analysis for:

- `handleNavigation`
- `cacheHtmlResponseVariants`

Expected: report the direct callers, affected processes, and risk level before editing those symbols in later tasks.

### Task 2: Replace The E2E Smoke With The Real Offline English Flow

**Files:**

- Modify: `test/e2e/offline-pdf.spec.js`
- Modify: `test/e2e/README.md`
- Verify: `Makefile`

- [ ] **Step 1: Keep `make test-e2e` as the stable entrypoint**

Confirm [`Makefile`](/Users/carlerik/dev/holmevann/Makefile) already runs the Playwright smoke:

```bash
rg -n "test-e2e|offline pdf" Makefile test/e2e/playwright.config.js test/e2e/offline-pdf.spec.js
```

Expected: PASS showing that `make test-e2e` runs the existing Playwright test.

- [ ] **Step 2: Rewrite the smoke flow around root-page warmup**

Update [`test/e2e/offline-pdf.spec.js`](/Users/carlerik/dev/holmevann/test/e2e/offline-pdf.spec.js) so the test does this in order:

1. visit `/`
2. wait for service worker registration and control
3. wait a few seconds only if deterministic cache polling is not enough
4. verify the English rental page and English important page have reached cache
5. switch the browser context offline
6. navigate to `/en/rental/` and assert success
7. access `/en/important.html` or `/en/important/` via the same route shape the browser actually uses
8. fetch one proxied PDF link from that English page and assert `200`, `application/pdf`, and nonzero bytes

Prefer helper names that describe behavior, for example:

```js
waitForServiceWorkerControl(page);
waitForCachedHtmlRoute(page, "/en/rental/");
waitForCachedPdfFromPage(page, "/en/important.html");
fetchPdfFromPage(page, pdfHref);
```

- [ ] **Step 3: Make the smoke assert cache readiness instead of sleeping blindly**

Use `page.evaluate` with Cache Storage APIs to inspect whether:

- the English rental route is cached in either the core or page cache
- the English important page is cached in either the core or page cache
- one English PDF proxy URL is cached in the PDF cache

Only keep a short fallback wait if the service worker needs time to finish background prefetch after the initial navigation.

- [ ] **Step 4: Run the Playwright smoke to establish the current failure**

Run:

```bash
make test-e2e
```

Expected: FAIL in the currently broken scenario, ideally at the offline `/en/rental/` navigation or the offline English PDF fetch.

- [ ] **Step 5: Update the manual test documentation**

Update [`test/e2e/README.md`](/Users/carlerik/dev/holmevann/test/e2e/README.md) so it explains the new smoke path:

- cache warms from `/`
- translated English navigation is verified offline
- one proxied English PDF is verified offline

### Task 3: Add Debugging Hooks For Cache Warmup And HAR Capture

**Files:**

- Modify: `test/e2e/playwright.config.js`
- Modify: `test/e2e/offline-pdf.spec.js`
- Modify: `test/e2e/README.md`
- Optional modify: `service-worker.js`
- Optional modify: `assets/js/register-service-worker.js`

- [ ] **Step 1: Add optional HAR capture support for the Playwright run**

Update the Playwright setup so a debug environment variable can enable HAR recording without making the normal smoke noisy. One acceptable pattern is:

```js
use: {
  baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:8888",
  trace: "retain-on-failure",
}
```

and a browser context or test helper that conditionally records HAR when something like `PLAYWRIGHT_RECORD_HAR=1` is set.

- [ ] **Step 2: Expose cache-debug evidence from the smoke**

Extend the Playwright test to log or attach:

- cache names present after warmup
- cache keys that match `/en/rental/`, `/en/important/`, or `/en/important.html`
- the resolved proxied PDF URL chosen for the English page

Prefer Playwright test attachments or concise console output from the test before adding production logging.

- [ ] **Step 3: Add service-worker logging only if test-side evidence is insufficient**

If the Playwright-side cache inspection still leaves ambiguity, add minimal debug logs in [`service-worker.js`](/Users/carlerik/dev/holmevann/service-worker.js) or [`assets/js/register-service-worker.js`](/Users/carlerik/dev/holmevann/assets/js/register-service-worker.js) behind a localhost-only or explicit debug guard.

Useful log points:

- when install-time core caching finishes
- when `handleNavigation` caches an HTML response
- when PDF prefetch starts and finishes

- [ ] **Step 4: Re-run the failing smoke with HAR enabled**

Run:

```bash
PLAYWRIGHT_RECORD_HAR=1 make test-e2e
```

Expected: FAIL, but now with enough recorded evidence to compare the service worker’s expected cache state with the actual network and HAR sequence.

### Task 4: Fix The Root Cause In The Service Worker

**Files:**

- Modify: `service-worker.js`
- Modify: `assets/js/offline-runtime-utils.js`
- Optional modify: `assets/js/service-worker-pdf-utils.js`
- Test: `test/offline-runtime-utils.test.js`
- Test: `test/e2e/offline-pdf.spec.js`

- [ ] **Step 1: Analyze the failing reproducer before changing behavior**

Use the failing Playwright assertions, cache dumps, and HAR output to answer:

- Was `/en/rental/` cached before offline mode?
- Was the English important route cached as `/en/important.html`, `/en/important/`, both, or neither?
- Was the selected English PDF proxy URL cached before offline mode?
- Did warmup from `/` ever trigger prefetch for the English important page?

Write down the single root-cause hypothesis before editing code.

- [ ] **Step 2: Implement the smallest fix that matches the evidence**

Likely fix areas:

- route normalization in [`assets/js/offline-runtime-utils.js`](/Users/carlerik/dev/holmevann/assets/js/offline-runtime-utils.js)
- install-time core-page alias caching in [`service-worker.js`](/Users/carlerik/dev/holmevann/service-worker.js)
- translated-page warmup or HTML-derived PDF prefetch in [`service-worker.js`](/Users/carlerik/dev/holmevann/service-worker.js)

Do not combine multiple speculative fixes. Implement one coherent change set tied to the proven hypothesis.

- [ ] **Step 3: Re-run the fast checks**

Run:

```bash
node --test test/*.test.js
```

Expected: PASS.

- [ ] **Step 4: Re-run the real artifact path**

Run:

```bash
asdf current ruby
asdf exec bundle exec jekyll build
```

Expected: PASS, with `asdf` reporting Ruby `3.4.8` for this repo and the site building successfully.

- [ ] **Step 5: Re-run the Playwright smoke without debug noise**

Run:

```bash
make test-e2e
```

Expected: PASS. The smoke should prove:

- `/` warms the caches
- offline `/en/rental/` navigation works
- one English proxied PDF from the important page works offline

- [ ] **Step 6: Inspect the built output directly if route shape is part of the bug**

Run:

```bash
rg -n 'href="/en/important|href="/en/rental/|Instructions in English|pdf-proxy' _site/en/index.html _site/en/important.html _site/en/rental/index.html
```

Expected: PASS, showing the generated translated output and the concrete route/link forms that the service worker must support.

### Task 5: Final Verification And Scope Check

**Files:**

- Modify only if needed after verification

- [ ] **Step 1: Confirm the final changed-symbol scope**

Use the GitNexus MCP `detect_changes` tool with `scope: "all"` before committing.

Expected: the affected symbols and processes should line up with offline cache helpers, the service worker, and the Playwright smoke only.

- [ ] **Step 2: Summarize evidence for completion**

Capture the final evidence set:

- unit tests pass
- Jekyll build passes under `asdf`
- `make test-e2e` passes
- optional HAR or debug output shows the English route and PDF path are served from cache when offline

- [ ] **Step 3: Commit in focused units**

Suggested commit sequence:

```bash
git add test/offline-runtime-utils.test.js assets/js/offline-runtime-utils.js
git commit -m "test: cover request-based html cache keys"

git add test/e2e/offline-pdf.spec.js test/e2e/playwright.config.js test/e2e/README.md
git commit -m "test: add offline english cache smoke"

git add service-worker.js assets/js/offline-runtime-utils.js assets/js/service-worker-pdf-utils.js
git commit -m "fix: cache translated english pages for offline use"
```

Only use the third commit if the root-cause fix actually touches those files.
