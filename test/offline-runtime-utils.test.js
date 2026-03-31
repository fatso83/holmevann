const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildOfflineFallbackHtml,
  buildOfflineFallbackResponse,
  matchAssetInCaches,
  matchHtmlInCaches,
  getHtmlCacheKeys,
  isEnglishPath,
  loadGoogleAnalytics,
} = require("../assets/js/offline-runtime-utils.js");

test("matchAssetInCaches falls back to later caches when the first cache misses", async function () {
  const request = { url: "https://www.holmevann.no/assets/main.css" };
  const expectedResponse = { ok: true, source: "core-cache" };
  const openedCacheNames = [];

  const response = await matchAssetInCaches(
    ["holmevann-assets-v2", "holmevann-core-v2"],
    request,
    async function (cacheName) {
      openedCacheNames.push(cacheName);

      return {
        match: async function () {
          return cacheName === "holmevann-core-v2" ? expectedResponse : null;
        },
      };
    },
  );

  assert.deepEqual(openedCacheNames, [
    "holmevann-assets-v2",
    "holmevann-core-v2",
  ]);
  assert.strictEqual(response, expectedResponse);
});

test("getHtmlCacheKeys returns aliases with and without the .html suffix", function () {
  assert.deepEqual(getHtmlCacheKeys("https://www.holmevann.no/map.html"), [
    "/map.html",
    "/map",
  ]);

  assert.deepEqual(getHtmlCacheKeys("https://www.holmevann.no/map"), [
    "/map",
    "/map.html",
  ]);
});

test("matchHtmlInCaches finds an html page through its alias key", async function () {
  const expectedResponse = { ok: true, source: "core-cache" };
  const matchCalls = [];

  const response = await matchHtmlInCaches(
    ["holmevann-pages-v3", "holmevann-core-v3"],
    { url: "https://www.holmevann.no/map" },
    async function () {
      return {
        match: async function (cacheKey) {
          matchCalls.push(cacheKey);

          return cacheKey === "/map.html" ? expectedResponse : null;
        },
      };
    },
  );

  assert.deepEqual(matchCalls, ["/map", "/map.html"]);
  assert.strictEqual(response, expectedResponse);
});

test("isEnglishPath detects english route prefixes only", function () {
  assert.equal(isEnglishPath("/en/"), true);
  assert.equal(isEnglishPath("/en/faq.html"), true);
  assert.equal(isEnglishPath("/english/faq.html"), false);
  assert.equal(isEnglishPath("/faq.html"), false);
});

test("buildOfflineFallbackHtml renders english copy and /en links for english routes", function () {
  const html = buildOfflineFallbackHtml({
    pathname: "/en/faq.html",
  });

  assert.match(html, /<html lang="en">/);
  assert.match(html, /You are offline right now\./);
  assert.match(html, /href="\/en\/"/);
  assert.match(html, /href="\/en\/faq\.html"/);
  assert.match(html, /href="\/en\/important\.html"/);
  assert.doesNotMatch(html, /href="\/faq\.html"/);
});

test("buildOfflineFallbackResponse renders norwegian links for norwegian routes", async function () {
  const response = buildOfflineFallbackResponse({
    pathname: "/faq.html",
  });
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.equal(
    response.headers.get("content-type"),
    "text/html; charset=utf-8",
  );
  assert.match(html, /<html lang="no">/);
  assert.match(html, /Du er offline akkurat n[åa]\./);
  assert.match(html, /href="\/faq\.html"/);
  assert.doesNotMatch(html, /href="\/en\/faq\.html"/);
});

test("loadGoogleAnalytics skips initialization when the browser is offline", function () {
  const appendedScripts = [];
  const windowObject = {
    navigator: {
      onLine: false,
    },
  };
  const documentObject = {
    head: {
      appendChild: function (node) {
        appendedScripts.push(node);
      },
    },
    createElement: function (tagName) {
      return {
        tagName,
      };
    },
  };

  const initialized = loadGoogleAnalytics({
    document: documentObject,
    window: windowObject,
    measurementId: "G-TEST123",
  });

  assert.equal(initialized, false);
  assert.deepEqual(appendedScripts, []);
  assert.equal(windowObject.dataLayer, undefined);
});

test("loadGoogleAnalytics appends the gtag script and initializes dataLayer when online", function () {
  const appendedScripts = [];
  const windowObject = {
    navigator: {
      onLine: true,
    },
  };
  const documentObject = {
    head: {
      appendChild: function (node) {
        appendedScripts.push(node);
      },
    },
    createElement: function (tagName) {
      return {
        tagName,
      };
    },
  };

  const initialized = loadGoogleAnalytics({
    document: documentObject,
    window: windowObject,
    measurementId: "G-TEST123",
  });

  assert.equal(initialized, true);
  assert.equal(appendedScripts.length, 1);
  assert.equal(appendedScripts[0].async, true);
  assert.equal(
    appendedScripts[0].src,
    "https://www.googletagmanager.com/gtag/js?id=G-TEST123",
  );
  assert.equal(Array.isArray(windowObject.dataLayer), true);
  assert.equal(windowObject.dataLayer.length, 2);
  assert.deepEqual(Array.from(windowObject.dataLayer[1]), [
    "config",
    "G-TEST123",
  ]);
});
