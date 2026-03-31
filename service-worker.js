const CORE_CACHE = "holmevann-core-v2";
const PAGE_CACHE = "holmevann-pages-v2";
const ASSET_CACHE = "holmevann-assets-v2";
const PDF_CACHE = "holmevann-pdf-v1";

const CORE_URLS = [
  "/",
  "/important.html",
  "/rental/",
  "/faq.html",
  "/map.html",
  "/offline.html",
  "/assets/main.css",
  "/assets/js/register-service-worker.js",
  "/favicon.ico",
];

function isSameOrigin(url) {
  return url.origin === self.location.origin;
}

function isHtmlNavigation(request) {
  return request.mode === "navigate";
}

function isPdfProxyRequest(url) {
  return url.pathname === "/.netlify/functions/pdf-proxy";
}

function isRangeRequest(request) {
  return request.headers.has("range");
}

function parseSingleRangeHeader(headerValue, totalLength) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(headerValue || "");

  if (!match) {
    return null;
  }

  const startText = match[1];
  const endText = match[2];

  if (startText === "" && endText === "") {
    return null;
  }

  let start;
  let end;

  if (startText === "") {
    const suffixLength = Number(endText);

    if (!Number.isFinite(suffixLength) || suffixLength <= 0) {
      return null;
    }

    start = Math.max(totalLength - suffixLength, 0);
    end = totalLength - 1;
  } else {
    start = Number(startText);
    end = endText === "" ? totalLength - 1 : Number(endText);
  }

  if (!Number.isInteger(start) || !Number.isInteger(end)) {
    return null;
  }

  if (start < 0 || end < start || start >= totalLength) {
    return null;
  }

  return {
    start,
    end: Math.min(end, totalLength - 1),
  };
}

function buildPartialContentResponse(response, range, totalLength, buffer) {
  const headers = new Headers();
  const contentType = response.headers.get("content-type") || "application/pdf";
  const etag = response.headers.get("etag");
  const lastModified = response.headers.get("last-modified");
  const cacheControl = response.headers.get("cache-control");
  const sliced = buffer.slice(range.start, range.end + 1);

  headers.set("accept-ranges", "bytes");
  headers.set(
    "content-range",
    "bytes " + range.start + "-" + range.end + "/" + totalLength,
  );
  headers.set("content-length", String(sliced.byteLength));
  headers.set("content-type", contentType);

  if (etag) {
    headers.set("etag", etag);
  }

  if (lastModified) {
    headers.set("last-modified", lastModified);
  }

  if (cacheControl) {
    headers.set("cache-control", cacheControl);
  }

  return new Response(sliced, {
    status: 206,
    statusText: "Partial Content",
    headers,
  });
}

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CORE_CACHE).then(function (cache) {
      return cache.addAll(CORE_URLS);
    }),
  );
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  const valid = [CORE_CACHE, PAGE_CACHE, ASSET_CACHE, PDF_CACHE];

  event.waitUntil(
    caches
      .keys()
      .then(function (keys) {
        return Promise.all(
          keys.map(function (key) {
            if (!valid.includes(key)) {
              return caches.delete(key);
            }
            return Promise.resolve(false);
          }),
        );
      })
      .then(function () {
        return self.clients.claim();
      }),
  );
});

async function handleNavigation(request) {
  const pageCache = await caches.open(PAGE_CACHE);

  try {
    const response = await fetch(request);
    if (response && response.ok) {
      pageCache.put(request, response.clone());
    }
    return response;
  } catch (_error) {
    const cachedPage = await pageCache.match(request);
    if (cachedPage) {
      return cachedPage;
    }

    const coreCache = await caches.open(CORE_CACHE);
    return (await coreCache.match(request)) || coreCache.match("/offline.html");
  }
}

async function handleAsset(request) {
  const assetCache = await caches.open(ASSET_CACHE);
  const cached = await assetCache.match(request);

  const networkPromise = fetch(request)
    .then(function (response) {
      if (response && response.ok) {
        assetCache.put(request, response.clone());
      }
      return response;
    })
    .catch(function () {
      return null;
    });

  return cached || networkPromise;
}

async function handlePdfRequest(request) {
  const pdfCache = await caches.open(PDF_CACHE);
  const cached = await pdfCache.match(request.url);

  const networkPromise = fetch(request)
    .then(async function (response) {
      if (response && response.ok && response.status === 200) {
        await pdfCache.put(request.url, response.clone());
      }

      return response;
    })
    .catch(function () {
      return null;
    });

  if (cached) {
    return cached;
  }

  return (await networkPromise) || Response.error();
}

async function handlePdfRangeRequest(request) {
  const pdfCache = await caches.open(PDF_CACHE);

  try {
    const response = await fetch(request);

    if (response && response.status === 206) {
      return response;
    }

    if (response && response.ok && response.status === 200) {
      const buffer = await response.clone().arrayBuffer();
      const totalLength = buffer.byteLength;
      const range = parseSingleRangeHeader(
        request.headers.get("range"),
        totalLength,
      );

      if (!range) {
        return new Response(null, {
          status: 416,
          statusText: "Range Not Satisfiable",
          headers: {
            "content-range": "bytes */" + totalLength,
          },
        });
      }

      await pdfCache.put(request.url, response.clone());

      return buildPartialContentResponse(response, range, totalLength, buffer);
    }

    return response;
  } catch (_error) {
    const cachedResponse = await pdfCache.match(request.url);

    if (!cachedResponse) {
      return Response.error();
    }

    const buffer = await cachedResponse.arrayBuffer();
    const totalLength = buffer.byteLength;
    const range = parseSingleRangeHeader(
      request.headers.get("range"),
      totalLength,
    );

    if (!range) {
      return new Response(null, {
        status: 416,
        statusText: "Range Not Satisfiable",
        headers: {
          "content-range": "bytes */" + totalLength,
        },
      });
    }

    return buildPartialContentResponse(
      cachedResponse,
      range,
      totalLength,
      buffer,
    );
  }
}

self.addEventListener("fetch", function (event) {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== "GET" || !isSameOrigin(url)) {
    return;
  }

  if (isHtmlNavigation(request)) {
    event.respondWith(handleNavigation(request));
    return;
  }

  if (isPdfProxyRequest(url)) {
    event.respondWith(
      isRangeRequest(request)
        ? handlePdfRangeRequest(request)
        : handlePdfRequest(request),
    );
    return;
  }

  event.respondWith(handleAsset(request));
});
