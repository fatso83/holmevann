importScripts("/assets/js/service-worker-pdf-utils.js");

const CORE_CACHE = "holmevann-core-v2";
const PAGE_CACHE = "holmevann-pages-v2";
const ASSET_CACHE = "holmevann-assets-v2";
const PDF_CACHE = "holmevann-pdf-v1";
const PREFETCHING_PDF_URLS = new Map();

const CORE_URLS = [
  "/",
  "/important.html",
  "/rental/",
  "/faq.html",
  "/map.html",
  "/offline.html",
  "/assets/main.css",
  "/assets/js/register-service-worker.js",
  "/assets/js/service-worker-pdf-utils.js",
  "/favicon.ico",
];

const CORE_PAGE_URLS = [
  "/",
  "/important.html",
  "/rental/",
  "/faq.html",
  "/map.html",
];

function isSameOrigin(url) {
  return url.origin === self.location.origin;
}

function isHtmlNavigation(request) {
  return request.mode === "navigate";
}

function isPdfProxyRequest(url) {
  return url.pathname === self.HolmevannServiceWorkerPdfUtils.PDF_PROXY_PATH;
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

async function prefetchPdfUrl(pdfCache, pdfUrl) {
  try {
    const response = await fetch(pdfUrl);

    if (response && response.ok && response.status === 200) {
      await pdfCache.put(pdfUrl, response.clone());
    }
  } catch (_error) {
    return;
  }
}

async function prefetchPdfUrlsFromHtml(html, baseUrl) {
  const pdfUrls =
    self.HolmevannServiceWorkerPdfUtils.collectPdfProxyUrlsFromHtml(
      html,
      baseUrl,
      self.location.origin,
    );

  if (!pdfUrls.length) {
    return;
  }

  const pdfCache = await caches.open(PDF_CACHE);

  await Promise.all(
    pdfUrls.map(async function (pdfUrl) {
      if (await pdfCache.match(pdfUrl)) {
        return;
      }

      await self.HolmevannServiceWorkerPdfUtils.trackPdfPrefetch(
        PREFETCHING_PDF_URLS,
        pdfUrl,
        async function () {
          if (await pdfCache.match(pdfUrl)) {
            return;
          }

          await prefetchPdfUrl(pdfCache, pdfUrl);
        },
      );
    }),
  );
}

async function prefetchPdfUrlsFromCorePages(cache) {
  await Promise.all(
    CORE_PAGE_URLS.map(async function (url) {
      const response = await cache.match(url);

      if (!response || !response.ok) {
        return;
      }

      const html = await response.clone().text();
      await prefetchPdfUrlsFromHtml(
        html,
        new URL(url, self.location.origin).href,
      );
    }),
  );
}

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CORE_CACHE).then(async function (cache) {
      console.log("Starting caching of core urls ...");
      await cache.addAll(CORE_URLS);
      console.log("Core urls cached. Starting prefetching of PDF's");
      await prefetchPdfUrlsFromCorePages(cache);
      console.log("PDF prefetching finished");
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
    let background = Promise.resolve();

    if (response && response.ok) {
      await pageCache.put(request, response.clone());
      background = response
        .clone()
        .text()
        .then(function (html) {
          return prefetchPdfUrlsFromHtml(html, request.url);
        })
        .catch(function () {
          return Promise.resolve();
        });
    }

    return {
      response,
      background,
    };
  } catch (_error) {
    const cachedPage = await pageCache.match(request);
    if (cachedPage) {
      return {
        response: cachedPage,
        background: Promise.resolve(),
      };
    }

    const coreCache = await caches.open(CORE_CACHE);
    return {
      response:
        (await coreCache.match(request)) ||
        (await coreCache.match("/offline.html")),
      background: Promise.resolve(),
    };
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

  return self.HolmevannServiceWorkerPdfUtils.ensureServiceWorkerResponse(
    await networkPromise,
  );
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
      return self.HolmevannServiceWorkerPdfUtils.ensureServiceWorkerResponse(
        null,
      );
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
    const navigation = handleNavigation(request);

    event.respondWith(
      navigation.then(function (result) {
        return self.HolmevannServiceWorkerPdfUtils.ensureServiceWorkerResponse(
          result && result.response,
        );
      }),
    );
    event.waitUntil(
      navigation.then(function (result) {
        return result.background;
      }),
    );
    return;
  }

  if (isPdfProxyRequest(url)) {
    event.respondWith(
      (isRangeRequest(request)
        ? handlePdfRangeRequest(request)
        : handlePdfRequest(request)
      ).then(function (response) {
        return self.HolmevannServiceWorkerPdfUtils.ensureServiceWorkerResponse(
          response,
        );
      }),
    );
    return;
  }

  event.respondWith(
    handleAsset(request).then(function (response) {
      return self.HolmevannServiceWorkerPdfUtils.ensureServiceWorkerResponse(
        response,
      );
    }),
  );
});
