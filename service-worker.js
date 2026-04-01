importScripts("/assets/js/offline-runtime-utils.js");
importScripts("/assets/js/service-worker-pdf-utils.js");
importScripts("/assets/js/service-worker-pdf-runtime.js");

const CORE_CACHE = "holmevann-core-v3";
const PAGE_CACHE = "holmevann-pages-v3";
const ASSET_CACHE = "holmevann-assets-v3";
const PDF_CACHE = "holmevann-pdf-v1";
const PREFETCHING_ASSET_URLS = new Map();
const PREFETCHING_PDF_URLS = new Map();

const CORE_URLS = [
  "/",
  "/en/",
  "/important.html",
  "/en/important.html",
  "/rental/",
  "/en/rental/",
  "/faq.html",
  "/en/faq.html",
  "/map.html",
  "/en/map.html",
  "/assets/main.css",
  "/assets/js/offline-runtime-utils.js",
  "/assets/js/register-service-worker.js",
  "/assets/js/service-worker-pdf-utils.js",
  "/favicon.ico",
];

function isCoreHtmlUrl(url) {
  return url === "/" || url.endsWith("/") || url.endsWith(".html");
}

async function prefetchPdfUrl(pdfCache, pdfUrl) {
  try {
    const response = await fetch(
      new Request(pdfUrl, {
        headers: {
          "x-holmevann-sw-bypass": "1",
        },
      }),
    );

    if (response && response.ok && response.status === 200) {
      await pdfCache.put(pdfUrl, response.clone());
    }
  } catch (_error) {
    return;
  }
}

async function prefetchAssetUrl(assetCache, assetUrl) {
  try {
    const response = await fetch(assetUrl);

    if (response && response.ok && response.status === 200) {
      await assetCache.put(assetUrl, response.clone());
    }
  } catch (_error) {
    return;
  }
}

async function prefetchSameOriginAssetUrlsFromHtml(html, baseUrl) {
  const assetUrls =
    self.HolmevannServiceWorkerPdfUtils.collectSameOriginAssetUrlsFromHtml(
      html,
      baseUrl,
      self.location.origin,
    );

  if (!assetUrls.length) {
    return;
  }

  const assetCache = await caches.open(ASSET_CACHE);

  await Promise.all(
    assetUrls.map(async function (assetUrl) {
      if (await assetCache.match(assetUrl)) {
        return;
      }

      await self.HolmevannServiceWorkerPdfUtils.trackPrefetch(
        PREFETCHING_ASSET_URLS,
        assetUrl,
        async function () {
          if (await assetCache.match(assetUrl)) {
            return;
          }

          await prefetchAssetUrl(assetCache, assetUrl);
        },
      );
    }),
  );
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

      await self.HolmevannServiceWorkerPdfUtils.trackPrefetch(
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

async function cacheCoreHtmlVariants(cache) {
  await Promise.all(
    CORE_URLS.filter(isCoreHtmlUrl).map(async function (url) {
      const response = await cache.match(url);

      if (!response || !response.ok) {
        return;
      }

      await self.HolmevannOfflineRuntimeUtils.cacheHtmlResponseVariants(
        cache,
        url,
        response,
      );
    }),
  );
}

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CORE_CACHE).then(async function (cache) {
      console.log("Starting caching of core urls ...");
      await cache.addAll(CORE_URLS);
      await cacheCoreHtmlVariants(cache);
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
      background = Promise.all([
        self.HolmevannOfflineRuntimeUtils.cacheHtmlResponseVariants(
          pageCache,
          request,
          response.clone(),
        ),
        response
          .clone()
          .text()
          .then(function (html) {
            return Promise.all([
              prefetchSameOriginAssetUrlsFromHtml(html, request.url),
              prefetchPdfUrlsFromHtml(html, request.url),
            ]);
          }),
      ]).catch(function () {
        return Promise.resolve();
      });
    }

    return {
      response,
      background,
    };
  } catch (_error) {
    const cachedPage =
      await self.HolmevannOfflineRuntimeUtils.matchHtmlInCaches(
        [PAGE_CACHE, CORE_CACHE],
        request,
        caches.open.bind(caches),
      );

    if (cachedPage) {
      return {
        response: cachedPage,
        background: Promise.resolve(),
      };
    }

    return {
      response: self.HolmevannOfflineRuntimeUtils.buildOfflineFallbackResponse({
        pathname: new URL(request.url).pathname,
      }),
      background: Promise.resolve(),
    };
  }
}

async function handleAsset(request) {
  const assetCache = await caches.open(ASSET_CACHE);
  const cached = await self.HolmevannOfflineRuntimeUtils.matchAssetInCaches(
    [ASSET_CACHE, CORE_CACHE],
    request,
    caches.open.bind(caches),
  );

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

function createPdfRuntimeDeps() {
  return {
    fetch: self.fetch.bind(self),
    openCache: caches.open.bind(caches),
    pdfCacheName: PDF_CACHE,
    ensureServiceWorkerResponse:
      self.HolmevannServiceWorkerPdfUtils.ensureServiceWorkerResponse,
  };
}

self.addEventListener("fetch", function (event) {
  const request = event.request;
  const url = new URL(request.url);
  const requestType =
    self.HolmevannServiceWorkerPdfUtils.classifySameOriginGetRequest({
      request,
      url,
      scopeOrigin: self.location.origin,
      pdfProxyPath: self.HolmevannServiceWorkerPdfUtils.PDF_PROXY_PATH,
    });

  if (requestType === "skip") {
    return;
  }

  if (requestType === "navigation") {
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

  if (requestType === "pdf" || requestType === "pdf-range") {
    event.respondWith(
      (requestType === "pdf-range"
        ? self.HolmevannServiceWorkerPdfRuntime.handlePdfRangeRequest(
            createPdfRuntimeDeps(),
            request,
          )
        : self.HolmevannServiceWorkerPdfRuntime.handlePdfRequest(
            createPdfRuntimeDeps(),
            request,
          )
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
