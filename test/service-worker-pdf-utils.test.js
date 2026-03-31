const test = require("node:test");
const assert = require("node:assert/strict");

const {
  collectPdfProxyUrlsFromHtml,
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

test("ensureServiceWorkerResponse returns an offline miss response for nullish values", async function () {
  const response = ensureServiceWorkerResponse(null);

  assert.equal(response.status, 503);
  assert.equal(response.statusText, "Offline and uncached");
  assert.equal(await response.text(), "");
});
