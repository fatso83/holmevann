# Holmevann E2E Tests

This directory contains manual Playwright coverage for the offline English-cache smoke path.
It is the single manual smoke test for cross-cutting service worker and translation behavior, not a pre-push gate.

Requirements:

- a local server already running at `http://localhost:8888`
- the server must serve the site and `/.netlify/functions/pdf-proxy`
- Playwright dependencies installed under `test/e2e/`
- global setup now fails early if nothing is listening and responding on the configured base URL

Recommended local server:

```bash
netlify dev
```

Install:

```bash
npm --prefix test/e2e install
npx playwright install chromium
```

Run:

```bash
make test-e2e
```

Direct npm equivalent:

```bash
PLAYWRIGHT_BASE_URL=http://localhost:8888 npm --prefix test/e2e test -- --grep "offline pdf"
```

What this verifies:

- the root page becomes controlled by the service worker
- core English routes warm into cache from the root page
- offline navigation to `/en/rental/` succeeds
- offline navigation to `/en/important.html` succeeds
- a real proxied PDF URL from the English important page still succeeds after the browser context is offline

What this does not verify:

- synthetic `206` generation for range requests
- invalid range handling
- uncached miss behavior

Those remain covered by the Node regression tests.

Useful diagnostics:

- Playwright keeps a trace on failure via `trace: "retain-on-failure"`
- the smoke attaches `cache-state-before-offline.json` to the failing test output
- optional HAR recording is available with `PLAYWRIGHT_RECORD_HAR=1`
