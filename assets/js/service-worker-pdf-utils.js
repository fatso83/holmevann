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

  const api = {
    PDF_PROXY_PATH,
    collectPdfProxyUrlsFromHtml,
  };

  global.HolmevannServiceWorkerPdfUtils = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof self !== "undefined" ? self : globalThis);
