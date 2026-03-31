const test = require("node:test");
const assert = require("node:assert/strict");

const {
  classifySameOriginGetRequest,
  collectSameOriginAssetUrlsFromHtml,
  collectPdfProxyUrlsFromHtml,
  trackPrefetch,
  trackPdfPrefetch,
  ensureServiceWorkerResponse,
} = require("../assets/js/service-worker-pdf-utils.js");

test("collectPdfProxyUrlsFromHtml returns same-origin proxied pdf links", function () {
  const html = [
    '<a href="/.netlify/functions/pdf-proxy?url=https%3A%2F%2Fdocs.google.com%2Fdocument%2Fd%2Fabc%2Fexport%3Fformat%3Dpdf">One</a>',
    '<a href="http://localhost:8888/.netlify/functions/pdf-proxy?url=https%3A%2F%2Fdocs.google.com%2Fdocument%2Fd%2Fdef%2Fexport%3Fformat%3Dpdf">Two</a>',
    '<a href="/.netlify/functions/pdf-proxy?url=https%3A%2F%2Fdocs.google.com%2Fdocument%2Fd%2Fabc%2Fexport%3Fformat%3Dpdf">Duplicate</a>',
    '<a href="https://example.com/.netlify/functions/pdf-proxy?url=bad">Wrong origin</a>',
    '<a href="https://docs.google.com/document/d/edit">Wrong path</a>',
  ].join("");

  assert.deepEqual(
    collectPdfProxyUrlsFromHtml(
      html,
      "http://localhost:8888/important.html",
      "http://localhost:8888",
    ),
    [
      "http://localhost:8888/.netlify/functions/pdf-proxy?url=https%3A%2F%2Fdocs.google.com%2Fdocument%2Fd%2Fabc%2Fexport%3Fformat%3Dpdf",
      "http://localhost:8888/.netlify/functions/pdf-proxy?url=https%3A%2F%2Fdocs.google.com%2Fdocument%2Fd%2Fdef%2Fexport%3Fformat%3Dpdf",
    ],
  );
});

test("collectPdfProxyUrlsFromHtml tolerates empty or invalid input", function () {
  assert.deepEqual(
    collectPdfProxyUrlsFromHtml(
      "",
      "http://localhost:8888/",
      "http://localhost:8888",
    ),
    [],
  );

  assert.deepEqual(
    collectPdfProxyUrlsFromHtml(
      '<a href="not a url">Broken</a>',
      "http://localhost:8888/",
      "http://localhost:8888",
    ),
    [],
  );
});

test("collectSameOriginAssetUrlsFromHtml returns same-origin image and media urls", function () {
  const html = [
    '<img src="/assets/posts/2026-03-30-vannpumpe_thumbnails.avif" alt="">',
    '<img srcset="/assets/img/header-small.jpg 320w, /assets/img/header-large.jpg 1280w" src="/assets/img/header-fallback.jpg" alt="">',
    '<source srcset="http://localhost:8888/assets/img/hero.avif 1x, http://localhost:8888/assets/img/hero@2x.avif 2x">',
    '<video poster="/assets/img/video-poster.jpg"></video>',
    '<img src="https://example.com/assets/img/wrong-origin.jpg" alt="">',
    '<script src="/assets/js/register-service-worker.js"></script>',
  ].join("");

  assert.deepEqual(
    collectSameOriginAssetUrlsFromHtml(
      html,
      "http://localhost:8888/rental/",
      "http://localhost:8888",
    ),
    [
      "http://localhost:8888/assets/posts/2026-03-30-vannpumpe_thumbnails.avif",
      "http://localhost:8888/assets/img/header-fallback.jpg",
      "http://localhost:8888/assets/img/header-small.jpg",
      "http://localhost:8888/assets/img/header-large.jpg",
      "http://localhost:8888/assets/img/hero.avif",
      "http://localhost:8888/assets/img/hero@2x.avif",
      "http://localhost:8888/assets/img/video-poster.jpg",
    ],
  );
});

test("classifySameOriginGetRequest treats pdf-proxy navigations as pdf requests", function () {
  assert.equal(
    classifySameOriginGetRequest({
      request: {
        method: "GET",
        mode: "navigate",
        headers: new Headers(),
      },
      url: new URL(
        "https://www.holmevann.no/.netlify/functions/pdf-proxy?url=https%3A%2F%2Fdocs.google.com%2Fdocument%2Fd%2Fabc%2Fexport%3Fformat%3Dpdf",
      ),
      scopeOrigin: "https://www.holmevann.no",
      pdfProxyPath: "/.netlify/functions/pdf-proxy",
    }),
    "pdf",
  );
});

test("classifySameOriginGetRequest treats pdf-proxy range requests as pdf-range", function () {
  const headers = new Headers();
  headers.set("range", "bytes=0-99");

  assert.equal(
    classifySameOriginGetRequest({
      request: {
        method: "GET",
        mode: "same-origin",
        headers,
      },
      url: new URL(
        "https://www.holmevann.no/.netlify/functions/pdf-proxy?url=https%3A%2F%2Fdocs.google.com%2Fdocument%2Fd%2Fabc%2Fexport%3Fformat%3Dpdf",
      ),
      scopeOrigin: "https://www.holmevann.no",
      pdfProxyPath: "/.netlify/functions/pdf-proxy",
    }),
    "pdf-range",
  );
});

test("classifySameOriginGetRequest skips service-worker bypass requests", function () {
  const headers = new Headers();
  headers.set("x-holmevann-sw-bypass", "1");

  assert.equal(
    classifySameOriginGetRequest({
      request: {
        method: "GET",
        mode: "same-origin",
        headers,
      },
      url: new URL(
        "https://www.holmevann.no/.netlify/functions/pdf-proxy?url=https%3A%2F%2Fdocs.google.com%2Fdocument%2Fd%2Fabc%2Fexport%3Fformat%3Dpdf",
      ),
      scopeOrigin: "https://www.holmevann.no",
      pdfProxyPath: "/.netlify/functions/pdf-proxy",
    }),
    "skip",
  );
});

test("ensureServiceWorkerResponse returns an offline miss response for nullish values", async function () {
  const response = ensureServiceWorkerResponse(null);

  assert.equal(response.status, 503);
  assert.equal(response.statusText, "Offline and uncached");
  assert.equal(await response.text(), "");
});

test("trackPdfPrefetch reuses the in-flight prefetch promise for duplicate pdf urls", async function () {
  const statusByUrl = new Map();
  const pdfUrl = "http://localhost:8888/.netlify/functions/pdf-proxy?url=abc";
  let runCount = 0;
  let resolvePrefetch;

  const prefetchOperation = function () {
    runCount += 1;

    return new Promise(function (resolve) {
      resolvePrefetch = resolve;
    });
  };

  const firstPromise = trackPdfPrefetch(statusByUrl, pdfUrl, prefetchOperation);
  const secondPromise = trackPdfPrefetch(
    statusByUrl,
    pdfUrl,
    prefetchOperation,
  );

  assert.equal(runCount, 1);
  assert.strictEqual(firstPromise, secondPromise);
  assert.strictEqual(statusByUrl.get(pdfUrl), firstPromise);

  resolvePrefetch();
  await firstPromise;

  assert.equal(statusByUrl.has(pdfUrl), false);

  await trackPdfPrefetch(statusByUrl, pdfUrl, function () {
    runCount += 1;
    return Promise.resolve();
  });

  assert.equal(runCount, 2);
});

test("trackPrefetch reuses the in-flight prefetch promise for duplicate asset urls", async function () {
  const statusByUrl = new Map();
  const assetUrl = "http://localhost:8888/assets/img/header-img.jpg";
  let runCount = 0;
  let resolvePrefetch;

  const prefetchOperation = function () {
    runCount += 1;

    return new Promise(function (resolve) {
      resolvePrefetch = resolve;
    });
  };

  const firstPromise = trackPrefetch(statusByUrl, assetUrl, prefetchOperation);
  const secondPromise = trackPrefetch(statusByUrl, assetUrl, prefetchOperation);

  assert.equal(runCount, 1);
  assert.strictEqual(firstPromise, secondPromise);
  assert.strictEqual(statusByUrl.get(assetUrl), firstPromise);

  resolvePrefetch();
  await firstPromise;

  assert.equal(statusByUrl.has(assetUrl), false);
});
