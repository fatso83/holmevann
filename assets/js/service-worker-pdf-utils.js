(function (global) {
  const PDF_PROXY_PATH = "/.netlify/functions/pdf-proxy";

  function extractHrefValues(html) {
    const hrefPattern = /href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi;
    const values = [];
    let match;

    while ((match = hrefPattern.exec(html))) {
      values.push(match[1] || match[2] || match[3] || "");
    }

    return values;
  }

  function collectPdfProxyUrlsFromHtml(html, baseUrl, scopeOrigin) {
    if (typeof html !== "string" || html.length === 0) {
      return [];
    }

    const urls = new Set();

    for (const href of extractHrefValues(html)) {
      try {
        const url = new URL(href, baseUrl);

        if (url.origin !== scopeOrigin) {
          continue;
        }

        if (url.pathname !== PDF_PROXY_PATH) {
          continue;
        }

        urls.add(url.href);
      } catch (_error) {
        continue;
      }
    }

    return Array.from(urls);
  }

  function trackPdfPrefetch(statusByUrl, pdfUrl, prefetchOperation) {
    if (statusByUrl.has(pdfUrl)) {
      return statusByUrl.get(pdfUrl);
    }

    const prefetchPromise = Promise.resolve(prefetchOperation()).finally(
      function () {
        statusByUrl.delete(pdfUrl);
      },
    );

    statusByUrl.set(pdfUrl, prefetchPromise);

    return prefetchPromise;
  }

  function classifySameOriginGetRequest(options) {
    const request = options && options.request;
    const url = options && options.url;
    const scopeOrigin = options && options.scopeOrigin;
    const pdfProxyPath = options && options.pdfProxyPath;

    if (!request || !url || request.method !== "GET") {
      return "skip";
    }

    if (url.origin !== scopeOrigin) {
      return "skip";
    }

    if (url.pathname === pdfProxyPath) {
      return request.headers && request.headers.has("range")
        ? "pdf-range"
        : "pdf";
    }

    return request.mode === "navigate" ? "navigation" : "asset";
  }

  function ensureServiceWorkerResponse(value) {
    if (value instanceof Response) {
      return value;
    }

    return new Response("", {
      status: 503,
      statusText: "Offline and uncached",
    });
  }

  const api = {
    PDF_PROXY_PATH,
    classifySameOriginGetRequest,
    collectPdfProxyUrlsFromHtml,
    trackPdfPrefetch,
    ensureServiceWorkerResponse,
  };

  global.HolmevannServiceWorkerPdfUtils = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof self !== "undefined" ? self : globalThis);
