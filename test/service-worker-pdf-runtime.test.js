const test = require("node:test");
const assert = require("node:assert/strict");

let runtime = {};

try {
  runtime = require("../assets/js/service-worker-pdf-runtime.js");
} catch (_error) {
  runtime = {};
}

const {
  buildPartialContentResponse,
  handlePdfRangeRequest,
  handlePdfRequest,
  parseSingleRangeHeader,
} = runtime;

function createMemoryCache() {
  const store = new Map();

  return {
    async match(key) {
      const cacheKey = typeof key === "string" ? key : key.url;
      const response = store.get(cacheKey);
      return response ? response.clone() : null;
    },
    async put(key, response) {
      const cacheKey = typeof key === "string" ? key : key.url;
      store.set(cacheKey, response.clone());
    },
  };
}

function createDeps(overrides) {
  const cache = createMemoryCache();
  const deps = {
    Response,
    Headers,
    pdfCacheName: "holmevann-pdf-v1",
    async openCache(cacheName) {
      assert.equal(cacheName, "holmevann-pdf-v1");
      return cache;
    },
    ensureServiceWorkerResponse(value) {
      if (value instanceof Response) {
        return value;
      }

      return new Response("", {
        status: 503,
        statusText: "Offline and uncached",
      });
    },
    async fetch() {
      throw new Error("fetch not stubbed");
    },
  };

  return {
    cache,
    deps: Object.assign(deps, overrides),
  };
}

test("service-worker-pdf-runtime exports the expected entry points", function () {
  assert.equal(typeof handlePdfRequest, "function");
  assert.equal(typeof handlePdfRangeRequest, "function");
  assert.equal(typeof parseSingleRangeHeader, "function");
  assert.equal(typeof buildPartialContentResponse, "function");
});

test("handlePdfRequest returns a cached full pdf when offline", async function () {
  assert.equal(typeof handlePdfRequest, "function");
  const request = new Request(
    "https://www.holmevann.no/.netlify/functions/pdf-proxy?url=abc",
  );
  const { cache, deps } = createDeps({
    async fetch() {
      throw new Error("offline");
    },
  });

  await cache.put(
    request.url,
    new Response("cached pdf", {
      status: 200,
      headers: {
        "content-type": "application/pdf",
      },
    }),
  );

  const response = await handlePdfRequest(deps, request);

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "application/pdf");
  assert.equal(await response.text(), "cached pdf");
});

test("handlePdfRequest caches a successful 200 pdf response", async function () {
  assert.equal(typeof handlePdfRequest, "function");
  const request = new Request(
    "https://www.holmevann.no/.netlify/functions/pdf-proxy?url=abc",
  );
  const { cache, deps } = createDeps({
    async fetch() {
      return new Response("live pdf", {
        status: 200,
        headers: {
          "content-type": "application/pdf",
        },
      });
    },
  });

  const response = await handlePdfRequest(deps, request);
  const cached = await cache.match(request.url);

  assert.equal(response.status, 200);
  assert.equal(await response.text(), "live pdf");
  assert.ok(cached);
  assert.equal(await cached.text(), "live pdf");
});

test("handlePdfRequest preserves the original request while adding the bypass header", async function () {
  assert.equal(typeof handlePdfRequest, "function");
  const request = new Request(
    "https://www.holmevann.no/.netlify/functions/pdf-proxy?url=abc",
    {
      headers: {
        accept: "application/pdf",
      },
      mode: "same-origin",
      credentials: "same-origin",
    },
  );
  let seenRequest = null;
  const { deps } = createDeps({
    async fetch(nextRequest) {
      seenRequest = nextRequest;
      return new Response("live pdf", {
        status: 200,
        headers: {
          "content-type": "application/pdf",
        },
      });
    },
  });

  await handlePdfRequest(deps, request);

  assert.ok(seenRequest instanceof Request);
  assert.equal(seenRequest.url, request.url);
  assert.equal(seenRequest.method, request.method);
  assert.equal(seenRequest.headers.get("accept"), "application/pdf");
  assert.equal(seenRequest.headers.get("x-holmevann-sw-bypass"), "1");
});

test("handlePdfRangeRequest passes through upstream 206 responses without caching them", async function () {
  assert.equal(typeof handlePdfRangeRequest, "function");
  const request = new Request(
    "https://www.holmevann.no/.netlify/functions/pdf-proxy?url=abc",
    {
      headers: {
        range: "bytes=0-3",
      },
    },
  );
  const { cache, deps } = createDeps({
    async fetch() {
      return new Response("part", {
        status: 206,
        headers: {
          "content-type": "application/pdf",
          "content-range": "bytes 0-3/10",
        },
      });
    },
  });

  const response = await handlePdfRangeRequest(deps, request);
  const cached = await cache.match(request.url);

  assert.equal(response.status, 206);
  assert.equal(await response.text(), "part");
  assert.equal(cached, null);
});

test("handlePdfRangeRequest caches a full 200 pdf and returns a synthetic 206", async function () {
  assert.equal(typeof handlePdfRangeRequest, "function");
  const request = new Request(
    "https://www.holmevann.no/.netlify/functions/pdf-proxy?url=abc",
    {
      headers: {
        range: "bytes=1-3",
      },
    },
  );
  const { cache, deps } = createDeps({
    async fetch() {
      return new Response("abcdef", {
        status: 200,
        headers: {
          "content-type": "application/pdf",
          etag: '"etag-1"',
        },
      });
    },
  });

  const response = await handlePdfRangeRequest(deps, request);
  const cached = await cache.match(request.url);

  assert.equal(response.status, 206);
  assert.equal(response.headers.get("content-range"), "bytes 1-3/6");
  assert.equal(response.headers.get("accept-ranges"), "bytes");
  assert.equal(response.headers.get("content-type"), "application/pdf");
  assert.equal(await response.text(), "bcd");
  assert.ok(cached);
  assert.equal(await cached.text(), "abcdef");
});

test("handlePdfRangeRequest serves a cached range when offline", async function () {
  assert.equal(typeof handlePdfRangeRequest, "function");
  const request = new Request(
    "https://www.holmevann.no/.netlify/functions/pdf-proxy?url=abc",
    {
      headers: {
        range: "bytes=2-4",
      },
    },
  );
  const { cache, deps } = createDeps({
    async fetch() {
      throw new Error("offline");
    },
  });

  await cache.put(
    request.url,
    new Response("abcdef", {
      status: 200,
      headers: {
        "content-type": "application/pdf",
      },
    }),
  );

  const response = await handlePdfRangeRequest(deps, request);

  assert.equal(response.status, 206);
  assert.equal(response.headers.get("content-range"), "bytes 2-4/6");
  assert.equal(await response.text(), "cde");
});

test("handlePdfRequest returns a 503 response when the pdf is uncached and offline", async function () {
  assert.equal(typeof handlePdfRequest, "function");
  const request = new Request(
    "https://www.holmevann.no/.netlify/functions/pdf-proxy?url=abc",
  );
  const { deps } = createDeps({
    async fetch() {
      throw new Error("offline");
    },
  });

  const response = await handlePdfRequest(deps, request);

  assert.equal(response.status, 503);
  assert.equal(response.statusText, "Offline and uncached");
});

test("handlePdfRangeRequest returns 416 for invalid ranges against a cached full pdf", async function () {
  assert.equal(typeof handlePdfRangeRequest, "function");
  const request = new Request(
    "https://www.holmevann.no/.netlify/functions/pdf-proxy?url=abc",
    {
      headers: {
        range: "bytes=20-30",
      },
    },
  );
  const { cache, deps } = createDeps({
    async fetch() {
      throw new Error("offline");
    },
  });

  await cache.put(
    request.url,
    new Response("abcdef", {
      status: 200,
      headers: {
        "content-type": "application/pdf",
      },
    }),
  );

  const response = await handlePdfRangeRequest(deps, request);

  assert.equal(response.status, 416);
  assert.equal(response.headers.get("content-range"), "bytes */6");
});

test("parseSingleRangeHeader supports open and suffix ranges", function () {
  assert.equal(typeof parseSingleRangeHeader, "function");
  assert.deepEqual(parseSingleRangeHeader("bytes=1-3", 10), {
    start: 1,
    end: 3,
  });
  assert.deepEqual(parseSingleRangeHeader("bytes=4-", 10), {
    start: 4,
    end: 9,
  });
  assert.deepEqual(parseSingleRangeHeader("bytes=-4", 10), {
    start: 6,
    end: 9,
  });
  assert.equal(parseSingleRangeHeader("bytes=20-30", 10), null);
});
