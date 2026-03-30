const CORE_CACHE = "holmevann-core-v1";
const PAGE_CACHE = "holmevann-pages-v1";
const ASSET_CACHE = "holmevann-assets-v1";

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

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CORE_CACHE).then(function (cache) {
      return cache.addAll(CORE_URLS);
    }),
  );
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  const valid = [CORE_CACHE, PAGE_CACHE, ASSET_CACHE];

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

  event.respondWith(handleAsset(request));
});
