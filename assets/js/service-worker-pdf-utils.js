(function (global) {
  const PDF_PROXY_PATH = "/.netlify/functions/pdf-proxy";
  const ASSET_TAG_ATTRIBUTE_NAMES = {
    img: ["src", "srcset"],
    source: ["src", "srcset"],
    video: ["poster"],
  };

  function extractHrefValues(html) {
    const hrefPattern = /href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi;
    const values = [];
    let match;

    while ((match = hrefPattern.exec(html))) {
      values.push(match[1] || match[2] || match[3] || "");
    }

    return values;
  }

  function extractTagAttributeValues(html, tagName, attributeName) {
    const escapedTagName = tagName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const escapedAttributeName = attributeName.replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&",
    );
    const pattern = new RegExp(
      "<" +
        escapedTagName +
        "\\b[^>]*\\b" +
        escapedAttributeName +
        "\\s*=\\s*(?:\"([^\"]*)\"|'([^']*)'|([^\\s>]+))",
      "gi",
    );
    const values = [];
    let match;

    while ((match = pattern.exec(html))) {
      values.push(match[1] || match[2] || match[3] || "");
    }

    return values;
  }

  function extractSrcsetUrls(value) {
    if (typeof value !== "string" || value.length === 0) {
      return [];
    }

    return value
      .split(",")
      .map(function (entry) {
        return entry.trim().split(/\s+/, 1)[0];
      })
      .filter(Boolean);
  }

  function collectSameOriginAssetUrlsFromHtml(html, baseUrl, scopeOrigin) {
    if (typeof html !== "string" || html.length === 0) {
      return [];
    }

    const urls = new Set();

    Object.entries(ASSET_TAG_ATTRIBUTE_NAMES).forEach(function (entry) {
      const tagName = entry[0];
      const attributeNames = entry[1];

      attributeNames.forEach(function (attributeName) {
        const values = extractTagAttributeValues(html, tagName, attributeName);
        const candidates =
          attributeName === "srcset"
            ? values.flatMap(extractSrcsetUrls)
            : values;

        candidates.forEach(function (candidate) {
          try {
            const url = new URL(candidate, baseUrl);

            if (url.origin !== scopeOrigin) {
              return;
            }

            urls.add(url.href);
          } catch (_error) {
            return;
          }
        });
      });
    });

    return Array.from(urls);
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

  function trackPrefetch(statusByUrl, url, prefetchOperation) {
    if (statusByUrl.has(url)) {
      return statusByUrl.get(url);
    }

    const prefetchPromise = Promise.resolve(prefetchOperation()).finally(
      function () {
        statusByUrl.delete(url);
      },
    );

    statusByUrl.set(url, prefetchPromise);

    return prefetchPromise;
  }

  function classifySameOriginGetRequest(options) {
    const request = options && options.request;
    const url = options && options.url;
    const scopeOrigin = options && options.scopeOrigin;
    const pdfProxyPath = options && options.pdfProxyPath;
    const acceptHeader =
      request && request.headers && typeof request.headers.get === "function"
        ? request.headers.get("accept") || ""
        : "";
    const isHtmlDocumentRequest =
      request &&
      (request.mode === "navigate" ||
        request.destination === "document" ||
        acceptHeader.includes("text/html"));

    if (!request || !url || request.method !== "GET") {
      return "skip";
    }

    if (
      request.headers &&
      request.headers.get("x-holmevann-sw-bypass") === "1"
    ) {
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

    return isHtmlDocumentRequest ? "navigation" : "asset";
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
    collectSameOriginAssetUrlsFromHtml,
    collectPdfProxyUrlsFromHtml,
    trackPrefetch,
    ensureServiceWorkerResponse,
  };

  global.HolmevannServiceWorkerPdfUtils = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof self !== "undefined" ? self : globalThis);
