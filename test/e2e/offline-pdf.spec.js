const { test, expect } = require("@playwright/test");

const PDF_LINK_SELECTOR = 'a[href*="/.netlify/functions/pdf-proxy?url="]';
const ROOT_PATH = "/";
const ENGLISH_RENTAL_PATH = "/en/rental/";
const ENGLISH_IMPORTANT_PATH = "/en/important.html";
const EXPECTED_WARM_PATHS = ["/", "/en/", "/en/rental/", "/en/important.html"];

async function waitForServiceWorkerControl(page) {
  await page.waitForFunction(async function () {
    if (!("serviceWorker" in navigator)) {
      return false;
    }

    const registration = await navigator.serviceWorker.getRegistration();
    return Boolean(
      registration &&
      registration.active &&
      registration.active.state === "activated",
    );
  });

  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (
      await page.evaluate(function () {
        return Boolean(navigator.serviceWorker.controller);
      })
    ) {
      return;
    }

    await page.reload({
      waitUntil: "networkidle",
    });
  }

  await page.waitForFunction(function () {
    return Boolean(navigator.serviceWorker.controller);
  });
}

async function getCacheEntriesByName(page) {
  return page.evaluate(async function () {
    const entriesByCache = {};

    for (const cacheName of await caches.keys()) {
      const cache = await caches.open(cacheName);
      const requests = await cache.keys();

      entriesByCache[cacheName] = requests.map(function (request) {
        const url = new URL(request.url);
        return url.pathname + url.search;
      });
    }

    return entriesByCache;
  });
}

function findMissingPaths(entriesByCache, expectedPaths) {
  const cachedPaths = new Set(Object.values(entriesByCache).flat());

  return expectedPaths.filter(function (path) {
    return !cachedPaths.has(path);
  });
}

async function waitForWarmCacheState(page, expectedPaths, timeoutMs) {
  const start = Date.now();
  let entriesByCache = {};
  let missingPaths = expectedPaths.slice();

  while (Date.now() - start <= timeoutMs) {
    entriesByCache = await getCacheEntriesByName(page);
    missingPaths = findMissingPaths(entriesByCache, expectedPaths);

    if (missingPaths.length === 0) {
      return {
        entriesByCache,
        missingPaths,
        ready: true,
      };
    }

    await page.waitForTimeout(250);
  }

  return {
    entriesByCache,
    missingPaths,
    ready: false,
  };
}

async function fetchPdfFromPage(page, pdfHref) {
  return page.evaluate(async function (href) {
    try {
      const response = await fetch(href);
      const buffer = await response.arrayBuffer();

      return {
        ok: response.ok,
        status: response.status,
        contentType: response.headers.get("content-type"),
        byteLength: buffer.byteLength,
      };
    } catch (error) {
      return {
        ok: false,
        status: 0,
        contentType: null,
        byteLength: 0,
        error: String(error),
      };
    }
  }, pdfHref);
}

async function gotoUntilOk(page, path, options) {
  const attempts = (options && options.attempts) || 5;
  const delayMs = (options && options.delayMs) || 250;
  let lastResponse = null;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    lastResponse = await page.goto(path, {
      waitUntil: "networkidle",
    });

    if (lastResponse && lastResponse.ok()) {
      return lastResponse;
    }

    await page.waitForTimeout(delayMs);
  }

  return lastResponse;
}

test("offline pdf smoke covers root warmup, english rental, and english important", async function ({
  browser,
  baseURL,
}, testInfo) {
  test.skip(!baseURL, "A running local server is required.");

  const warmupTimeoutMs = Number(
    process.env.PLAYWRIGHT_CACHE_WARMUP_MS || "3000",
  );
  const debugServiceWorker = process.env.PLAYWRIGHT_DEBUG_SW === "1";
  const recordHar = process.env.PLAYWRIGHT_RECORD_HAR === "1";
  const context = await browser.newContext({
    baseURL,
    recordHar: recordHar
      ? {
          mode: "minimal",
          path: testInfo.outputPath("offline-english-cache.har"),
        }
      : undefined,
  });
  const page = await context.newPage();

  if (debugServiceWorker) {
    page.on("console", function (message) {
      console.log(
        ["[browser:" + message.type() + "]", message.text()].join(" "),
      );
    });
  }

  try {
    const homeResponse = await gotoUntilOk(page, ROOT_PATH, {
      attempts: 6,
      delayMs: 500,
    });
    expect(homeResponse).toBeTruthy();
    expect(homeResponse.ok()).toBe(true);

    await waitForServiceWorkerControl(page);

    const warmup = await waitForWarmCacheState(
      page,
      EXPECTED_WARM_PATHS,
      warmupTimeoutMs,
    );

    await testInfo.attach("cache-state-before-offline.json", {
      body: JSON.stringify(warmup, null, 2),
      contentType: "application/json",
    });

    console.log(
      JSON.stringify(
        {
          cacheWarmupReady: warmup.ready,
          missingPaths: warmup.missingPaths,
        },
        null,
        2,
      ),
    );

    await context.setOffline(true);

    const rentalResponse = await page.goto(ENGLISH_RENTAL_PATH, {
      waitUntil: "domcontentloaded",
    });
    expect(rentalResponse).toBeTruthy();
    expect(rentalResponse.status()).toBe(200);
    await expect(page).toHaveURL(new RegExp(`${ENGLISH_RENTAL_PATH}$`));
    await expect(page.locator("main")).toContainText(/rental|tenant|arrival/i);

    const importantResponse = await page.goto(ENGLISH_IMPORTANT_PATH, {
      waitUntil: "domcontentloaded",
    });
    expect(importantResponse).toBeTruthy();
    expect(importantResponse.status()).toBe(200);
    await expect(page).toHaveURL(new RegExp(`${ENGLISH_IMPORTANT_PATH}$`));

    const pdfLink = page.locator(PDF_LINK_SELECTOR).first();
    await expect(pdfLink).toBeVisible();

    const pdfHref = await pdfLink.getAttribute("href");
    expect(pdfHref).toBeTruthy();

    const offlinePdfResult = await fetchPdfFromPage(page, pdfHref);

    expect(
      offlinePdfResult.ok,
      offlinePdfResult.error || "offline english pdf fetch should succeed",
    ).toBe(true);
    expect(offlinePdfResult.status).toBe(200);
    expect(offlinePdfResult.contentType || "").toContain("application/pdf");
    expect(offlinePdfResult.byteLength).toBeGreaterThan(0);
  } finally {
    await context.close().catch(function () {
      return undefined;
    });
  }
});
