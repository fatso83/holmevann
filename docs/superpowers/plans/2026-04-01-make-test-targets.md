# Make Test Targets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add first-class `make` targets for the Ruby Minitest suite and the Playwright E2E suite, document them in repo instructions, wire the fast Ruby and JS suites into `pre-push`, and keep Playwright as a manual smoke test that fails immediately when no local server is listening on the configured base URL port.

**Architecture:** Keep the repo’s existing fast test commands unchanged and wrap them in explicit `Makefile` targets so contributors can discover and run them consistently. Add a small Playwright `globalSetup` module that reads the configured base URL, probes the host and port with Node’s built-in networking primitives, and aborts before browser startup when no server is reachable. Preserve Playwright as a single manual smoke spec for cross-cutting user-visible behavior such as PDF offline caching and translated pages, while `pre-push` continues to run only fast deterministic suites.

**Tech Stack:** GNU Make, Ruby 3.4 via `asdf`, Bundler, Minitest, Playwright, Node.js built-in `net` and `URL`, Markdown docs.

---

**Planned File Responsibilities**

- `Makefile`: expose `test-ruby` and `test-e2e` as stable entry points and add them to `.PHONY`.
- `AGENTS.md`: document the supported test commands and tell future agents which verification targets to use.
- `pre-push`: keep the existing Ruby-version and Git LFS checks, then run the fast JS and Ruby suites before allowing a push.
- `test/e2e/playwright.config.js`: register the new global setup file while preserving the existing base URL behavior.
- `test/e2e/global-setup.js`: parse `PLAYWRIGHT_BASE_URL`, probe the target host and port, and throw a clear error before test execution if nothing is listening.
- `test/e2e/offline-pdf.spec.js`: remain the single manual Playwright smoke test, broadened as needed to cover basic service-worker and translation behavior in one place.
- `README.md`: mention the new `make` targets in the project’s local workflow section.
- `test/e2e/README.md`: document that `make test-e2e` is manual, assumes a running local server, now fails during setup when the target port is unavailable, and serves as the one high-level smoke test for service worker and translation changes.

### Task 1: Add The Ruby Make Target

**Files:**

- Modify: `Makefile`
- Reference: `AGENTS.md`
- Reference: `test/build_translation/cache_store_test.rb`

- [ ] **Step 1: Confirm the target does not exist yet**

Run:

```bash
make -n test-ruby
```

Expected: FAIL with “No rule to make target `test-ruby`”.

- [ ] **Step 2: Add `test-ruby` to `.PHONY`**

Update the `.PHONY` line in `Makefile` so it includes the new target names:

```make
.PHONY: install deploy livereload build build-translated translate-site help list-targets install-git-lfs check-dependencies install-precommit test-js test-ruby test-e2e
```

Keep the target names on the existing line instead of introducing a second `.PHONY` block.

- [ ] **Step 3: Add the `test-ruby` target**

Insert this target near `test-js` so the test commands stay grouped:

```make
test-ruby:
	@set -e; \
	for f in test/build_translation/*_test.rb; do \
		echo "Running $$f"; \
		asdf exec bundle exec ruby "$$f"; \
	done
```

Use `asdf exec bundle exec ruby` for every file to match the repo’s Ruby instructions and avoid system Ruby.

- [ ] **Step 4: Run the Ruby target**

Run:

```bash
make test-ruby
```

Expected: PASS. Each file under `test/build_translation/` is executed, and the command exits with `0`.

- [ ] **Step 5: Commit the Ruby target**

```bash
git add Makefile
git commit -m "build: add ruby test target"
```

### Task 2: Add Fast Test Enforcement To `pre-push`

**Files:**

- Modify: `pre-push`
- Reference: `Makefile`
- Reference: `test/build_translation/site_translator_test.rb`
- Reference: `test/service-worker-pdf-runtime.test.js`

- [ ] **Step 1: Confirm the hook does not run fast tests yet**

Run:

```bash
rg -n "node --test|test-ruby|bundle exec ruby" pre-push
```

Expected: FAIL because the hook currently only syncs `.ruby-version` and delegates to Git LFS.

- [ ] **Step 2: Add the fast-suite commands after the existing environment checks**

Update `pre-push` so that, after the `.ruby-version` sync logic and `git-lfs` availability check pass, it runs:

```bash
echo "pre-push: running fast JS tests" >&2
node --test test/*.test.js

echo "pre-push: running fast Ruby tests" >&2
make test-ruby
```

Keep these commands before `git lfs pre-push "$@"` so a failing fast suite blocks the push. Do not call Playwright from the hook.

- [ ] **Step 3: Verify the hook still delegates to Git LFS after the fast suites**

Run:

```bash
rg -n "node --test test/\\*\\.test\\.js|make test-ruby|git lfs pre-push" pre-push
```

Expected: PASS with all three commands present.

- [ ] **Step 4: Commit the hook change**

```bash
git add pre-push
git commit -m "test: run fast suites in pre-push"
```

### Task 3: Add Early Playwright Server Probing

**Files:**

- Create: `test/e2e/global-setup.js`
- Modify: `test/e2e/playwright.config.js`
- Modify: `test/e2e/offline-pdf.spec.js`
- Reference: `test/e2e/README.md`

- [ ] **Step 1: Confirm the global setup file does not exist yet**

Run:

```bash
test -f test/e2e/global-setup.js
```

Expected: FAIL because the setup file has not been created yet.

- [ ] **Step 2: Add the failing Playwright config lookup**

Run:

```bash
rg -n "globalSetup" test/e2e/playwright.config.js
```

Expected: FAIL because the config does not yet register any setup hook.

- [ ] **Step 3: Create the port-probing global setup**

Create `test/e2e/global-setup.js` with a focused connectivity check:

```js
const net = require("node:net");

function resolvePort(url) {
  if (url.port) return Number(url.port);
  return url.protocol === "https:" ? 443 : 80;
}

function waitForSocket(host, port, timeoutMs) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port });

    const fail = (message, error) => {
      socket.destroy();
      reject(new Error(error ? `${message}: ${error.message}` : message));
    };

    socket.setTimeout(timeoutMs);
    socket.once("connect", () => {
      socket.end();
      resolve();
    });
    socket.once("timeout", () =>
      fail(`Timed out connecting to ${host}:${port}`),
    );
    socket.once("error", (error) =>
      fail(`Could not connect to ${host}:${port}`, error),
    );
  });
}

module.exports = async function globalSetup(config) {
  const baseURL =
    config.projects[0]?.use?.baseURL || process.env.PLAYWRIGHT_BASE_URL;

  if (!baseURL) {
    throw new Error("PLAYWRIGHT_BASE_URL is not configured");
  }

  const url = new URL(baseURL);
  const port = resolvePort(url);

  await waitForSocket(url.hostname, port, 2_000);
};
```

Keep this file network-only. Do not launch a server, retry for a long time, or perform browser actions here.

- [ ] **Step 4: Register the global setup in Playwright**

Update `test/e2e/playwright.config.js`:

```js
const { defineConfig, devices } = require("@playwright/test");

module.exports = defineConfig({
  globalSetup: require.resolve("./global-setup"),
  testDir: ".",
  testMatch: ["offline-pdf.spec.js"],
  timeout: 30_000,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:8888",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
      },
    },
  ],
});
```

Only add `globalSetup`; do not change the existing suite selection or browser project.

- [ ] **Step 5: Verify the early failure path**

Run:

```bash
PLAYWRIGHT_BASE_URL=http://127.0.0.1:65530 npm --prefix test/e2e test -- --grep "offline pdf"
```

Expected: FAIL during global setup with a clear connection error before browser execution starts.

- [ ] **Step 6: Keep a single manual Playwright smoke test for service worker and translation behavior**

Adjust `test/e2e/offline-pdf.spec.js` so it stays the only Playwright spec, but its assertions describe the intended cross-cutting smoke coverage:

- a translated page or translated navigation path is reachable from the running site
- the page is controlled by the service worker
- a proxied PDF request is warmed into cache online
- the same proxied PDF request succeeds offline

Do not split this into multiple Playwright specs. The repo should keep one manual high-level E2E smoke test for now.

- [ ] **Step 7: Commit the Playwright setup**

```bash
git add test/e2e/global-setup.js test/e2e/playwright.config.js test/e2e/offline-pdf.spec.js
git commit -m "test: keep a single manual playwright smoke test"
```

### Task 4: Add The Playwright Make Target

**Files:**

- Modify: `Makefile`
- Reference: `test/e2e/package.json`
- Reference: `test/e2e/README.md`

- [ ] **Step 1: Confirm the target does not exist yet**

Run:

```bash
make -n test-e2e
```

Expected: FAIL with “No rule to make target `test-e2e`”.

- [ ] **Step 2: Add the `test-e2e` target**

Insert this target below `test-ruby`:

```make
test-e2e:
	PLAYWRIGHT_BASE_URL=$${PLAYWRIGHT_BASE_URL:-http://localhost:8888} npm --prefix test/e2e test -- --grep "offline pdf"
```

Keep the default URL aligned with `test/e2e/playwright.config.js`, while still allowing callers to override it.

Add a short comment immediately above the target stating that this suite is manual and intentionally not part of `pre-push`.

- [ ] **Step 3: Verify the early failure through `make`**

Run:

```bash
PLAYWRIGHT_BASE_URL=http://127.0.0.1:65530 make test-e2e
```

Expected: FAIL quickly from the Playwright global setup with the same socket error as the direct npm command.

- [ ] **Step 4: Verify the happy path with a running local server**

In another terminal, start the existing local server workflow, for example:

```bash
netlify dev
```

Then run:

```bash
make test-e2e
```

Expected: PASS. The suite attaches to `http://localhost:8888`, exercises the single manual smoke path for translated-page reachability plus offline PDF replay, and exits with `0`.

- [ ] **Step 5: Commit the new make target**

```bash
git add Makefile
git commit -m "build: add playwright test target"
```

### Task 5: Update Developer-Facing Documentation And Repo Instructions

**Files:**

- Modify: `AGENTS.md`
- Modify: `README.md`
- Modify: `test/e2e/README.md`

- [ ] **Step 1: Update `AGENTS.md` with the supported test commands and verification guidance**

Add a new section under the existing Ruby guidance, or a new `## Tests` section, that documents:

```md
## Tests

- Run fast JavaScript tests with `node --test test/*.test.js`
- Run fast Ruby tests with `make test-ruby`
- Run the manual Playwright smoke test with `make test-e2e`
- Use `make test-ruby` and `node --test test/*.test.js` for routine verification and `pre-push`
- Use `make test-e2e` when changes affect service worker behavior, PDF offline caching, or translated site flows
```

Make it explicit that `make test-e2e` requires a running local server and is not part of `pre-push`.

- [ ] **Step 2: Add the new test entry points to the main README**

Update the “Bygge prosjektet” section in `README.md` so it mentions:

```md
- Kjøre raske JavaScript-tester: `node --test test/*.test.js`
- Kjøre Ruby-testene: `make test-ruby`
- Kjøre den manuelle Playwright-smoketesten: `make test-e2e`
```

Keep the wording short and task-oriented like the rest of the list.

- [ ] **Step 3: Update the E2E README to mention the make target, early failure, and manual scope**

Replace the current “Run” example block in `test/e2e/README.md` with guidance that preserves the explicit npm command and also adds the new shortcut:

````md
Run:

```bash
make test-e2e
```

Equivalent direct command:

```bash
PLAYWRIGHT_BASE_URL=http://localhost:8888 npm --prefix test/e2e test -- --grep "offline pdf"
```

The Playwright global setup now checks that something is listening on the configured base URL port before starting the browser. If no server is available, the run fails immediately.
````

Add one sentence clarifying that this is the single manual smoke test for cross-cutting service worker and translation behavior, not a pre-push gate.

- [ ] **Step 4: Verify the docs and repo instructions reference real targets**

Run:

```bash
rg -n "make test-ruby|make test-e2e|node --test test/\\*\\.test\\.js|pre-push|manual" AGENTS.md README.md test/e2e/README.md
```

Expected: PASS with matches across `AGENTS.md`, `README.md`, and `test/e2e/README.md`.

- [ ] **Step 5: Commit the docs updates**

```bash
git add AGENTS.md README.md test/e2e/README.md
git commit -m "docs: document test commands and verification"
```

### Task 6: Final Verification

**Files:**

- Reference: `AGENTS.md`
- Reference: `pre-push`
- Reference: `Makefile`
- Reference: `test/e2e/playwright.config.js`
- Reference: `test/e2e/global-setup.js`
- Reference: `test/e2e/offline-pdf.spec.js`
- Reference: `README.md`
- Reference: `test/e2e/README.md`

- [ ] **Step 1: Run the fast JS suite directly**

Run:

```bash
node --test test/*.test.js
```

Expected: PASS.

- [ ] **Step 2: Run the Ruby regression suite through `make`**

Run:

```bash
make test-ruby
```

Expected: PASS with all Ruby Minitest files green.

- [ ] **Step 3: Run the Playwright missing-server check through `make`**

Run:

```bash
PLAYWRIGHT_BASE_URL=http://127.0.0.1:65530 make test-e2e
```

Expected: FAIL during setup with a connection error that names the host and port.

- [ ] **Step 4: Run the Playwright suite against the real local server**

With `netlify dev` already running on `http://localhost:8888`, run:

```bash
make test-e2e
```

Expected: PASS with the single manual smoke spec covering translated-page reachability, service worker control, and offline PDF replay.

- [ ] **Step 5: Review the final diff**

Run:

```bash
git diff -- AGENTS.md pre-push Makefile test/e2e/playwright.config.js test/e2e/global-setup.js test/e2e/offline-pdf.spec.js README.md test/e2e/README.md
```

Expected: Only the scoped make-target, hook, setup-hook, single-smoke-spec, and docs changes appear.

- [ ] **Step 6: Create the final commit**

```bash
git add AGENTS.md pre-push Makefile test/e2e/playwright.config.js test/e2e/global-setup.js test/e2e/offline-pdf.spec.js README.md test/e2e/README.md
git commit -m "build: add explicit test entry points and fast pre-push checks"
```
