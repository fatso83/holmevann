(function (global) {
  function toUrl(input) {
    if (!input) {
      return null;
    }

    if (input instanceof URL) {
      return input;
    }

    const value = typeof input === "string" ? input : input.url;

    if (!value) {
      return null;
    }

    return new URL(value, "https://offline.holmevann.local");
  }

  function getHtmlCacheKeys(input) {
    const url = toUrl(input);

    if (!url) {
      return [];
    }

    const cacheKeys = [];
    const pathname = url.pathname;
    const search = url.search;
    const hasFileExtension = /\/[^/]+\.[^/]+$/.test(pathname);

    cacheKeys.push(pathname + search);

    if (pathname.endsWith(".html")) {
      const withoutHtml = pathname.slice(0, -".html".length) || "/";

      cacheKeys.push(withoutHtml + search);
    } else if (!pathname.endsWith("/") && !hasFileExtension) {
      cacheKeys.push(pathname + ".html" + search);
    }

    return Array.from(new Set(cacheKeys));
  }

  async function matchAssetInCaches(cacheNames, request, openCache) {
    for (const cacheName of cacheNames) {
      const cache = await openCache(cacheName);
      const cachedResponse = await cache.match(request);

      if (cachedResponse) {
        return cachedResponse;
      }
    }

    return null;
  }

  async function matchHtmlInCaches(cacheNames, request, openCache) {
    const cacheKeys = getHtmlCacheKeys(request);

    for (const cacheName of cacheNames) {
      const cache = await openCache(cacheName);

      for (const cacheKey of cacheKeys) {
        const cachedResponse = await cache.match(cacheKey);

        if (cachedResponse) {
          return cachedResponse;
        }
      }
    }

    return null;
  }

  async function cacheHtmlResponseVariants(cache, request, response) {
    const cacheKeys = getHtmlCacheKeys(request);

    await Promise.all(
      cacheKeys.map(function (cacheKey) {
        return cache.put(cacheKey, response.clone());
      }),
    );
  }

  function loadGoogleAnalytics(options) {
    const documentObject = options && options.document;
    const windowObject = options && options.window;
    const measurementId = options && options.measurementId;
    const navigatorObject = windowObject && windowObject.navigator;

    if (!documentObject || !windowObject || !measurementId) {
      return false;
    }

    if (navigatorObject && navigatorObject.onLine === false) {
      return false;
    }

    const dataLayer = (windowObject.dataLayer = windowObject.dataLayer || []);
    windowObject.gtag = function () {
      dataLayer.push(arguments);
    };

    const script = documentObject.createElement("script");
    script.async = true;
    script.src = "https://www.googletagmanager.com/gtag/js?id=" + measurementId;

    if (!documentObject.head || !documentObject.head.appendChild) {
      return false;
    }

    documentObject.head.appendChild(script);
    windowObject.gtag("js", new Date());
    windowObject.gtag("config", measurementId);

    return true;
  }

  const api = {
    cacheHtmlResponseVariants,
    getHtmlCacheKeys,
    matchAssetInCaches,
    matchHtmlInCaches,
    loadGoogleAnalytics,
  };

  global.HolmevannOfflineRuntimeUtils = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof self !== "undefined" ? self : globalThis);
