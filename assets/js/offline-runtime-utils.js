(function (global) {
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
    matchAssetInCaches,
    loadGoogleAnalytics,
  };

  global.HolmevannOfflineRuntimeUtils = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof self !== "undefined" ? self : globalThis);
