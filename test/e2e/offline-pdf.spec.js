const { test, expect } = require("@playwright/test");

const PDF_LINK_SELECTOR = 'a[href*="/.netlify/functions/pdf-proxy?url="]';
const PDF_CACHE_NAME = "holmevann-pdf-v1";
const RENTAL_PATH = "/rental/";

async function waitForServiceWorkerControl(page) {
  await page.waitForFunction(async function () {
    const registration = await navigator.serviceWorker.getRegistration();
    return Boolean(registration);
  });

  await page.reload();

  await page.waitForFunction(function () {
    return Boolean(navigator.serviceWorker.controller);
  });
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

test("offline pdf replay works after the cache is warmed", async function ({
  page,
  context,
  baseURL,
}) {
  test.skip(!baseURL, "A running local server is required.");

  await page.goto(RENTAL_PATH, {
    waitUntil: "networkidle",
  });
  await waitForServiceWorkerControl(page);

  const pdfLink = page.locator(PDF_LINK_SELECTOR).first();
  await expect(pdfLink).toBeVisible();
  const pdfHref = await pdfLink.getAttribute("href");

  expect(pdfHref).toBeTruthy();

  const onlineResult = await fetchPdfFromPage(page, pdfHref);

  expect(
    onlineResult.ok,
    onlineResult.error || "online fetch should succeed",
  ).toBe(true);
  expect(onlineResult.status).toBe(200);
  expect(onlineResult.contentType || "").toContain("application/pdf");
  expect(onlineResult.byteLength).toBeGreaterThan(0);

  const cachedUrls = await page.evaluate(async function (cacheName) {
    const cache = await caches.open(cacheName);
    const requests = await cache.keys();

    return requests.map(function (request) {
      return request.url;
    });
  }, PDF_CACHE_NAME);

  expect(
    cachedUrls.some(function (url) {
      return url.includes("/.netlify/functions/pdf-proxy?url=");
    }),
  ).toBe(true);

  await context.setOffline(true);

  const offlineResult = await fetchPdfFromPage(page, pdfHref);

  expect(
    offlineResult.ok,
    offlineResult.error || "offline fetch should be replayed from cache",
  ).toBe(true);
  expect(offlineResult.status).toBe(200);
  expect(offlineResult.contentType || "").toContain("application/pdf");
  expect(offlineResult.byteLength).toBeGreaterThan(0);
});
