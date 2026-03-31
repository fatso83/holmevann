# Holmevann E2E Tests

This directory contains manual Playwright coverage for the proxied PDF offline path.
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

- the page becomes controlled by the service worker
- a real proxied PDF URL is fetched once online and cached
- the same proxied PDF URL still succeeds after the browser context is offline

What this does not verify:

- synthetic `206` generation for range requests
- invalid range handling
- uncached miss behavior

Those remain covered by the Node regression tests.
