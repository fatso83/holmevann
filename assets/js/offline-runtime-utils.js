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

  function isEnglishPath(pathname) {
    return /^\/en(?:\/|$)/.test(pathname || "");
  }

  function buildOfflineFallbackHtml(options) {
    const pathname = (options && options.pathname) || "/";
    const english = isEnglishPath(pathname);
    const homeHref = english ? "/en/" : "/";
    const links = english
      ? [
          ["Home", "/en/"],
          ["Questions & Answers", "/en/faq.html"],
          ["Important info", "/en/important.html"],
          ["Map", "/en/map.html"],
          ["Rental", "/en/rental/"],
        ]
      : [
          ["Hjem", "/"],
          ["Spørsmål & svar", "/faq.html"],
          ["Viktig informasjon", "/important.html"],
          ["Kart", "/map.html"],
          ["Leie", "/rental/"],
        ];
    const title = english ? "Offline" : "Offline";
    const intro = english
      ? "You are offline right now."
      : "Du er offline akkurat nå.";
    const body = english
      ? "The main pages on holmevann.no should still work, and other pages will also work if you have opened them earlier on this device."
      : "De viktigste sidene på holmevann.no skal fortsatt fungere, og andre sider virker også hvis du har åpnet dem tidligere på denne enheten.";
    const note = english
      ? "External maps, videos, Google Docs, and other content from third-party sites will not necessarily work without a network connection."
      : "Eksterne kart, videoer, Google Docs og annet innhold fra andre nettsteder virker ikke nødvendigvis uten nett.";
    const linksMarkup = links
      .map(function (entry) {
        return '<li><a href="' + entry[1] + '">' + entry[0] + "</a></li>";
      })
      .join("");

    return [
      "<!DOCTYPE html>",
      '<html lang="' + (english ? "en" : "no") + '">',
      "<head>",
      '  <meta charset="utf-8">',
      '  <meta name="viewport" content="width=device-width, initial-scale=1">',
      "  <title>" + title + " | #holmevann1013moh</title>",
      '  <link rel="stylesheet" href="/assets/main.css">',
      "</head>",
      "<body>",
      '  <header class="site-header" role="banner">',
      '    <div class="wrapper">',
      '      <a class="site-title" rel="author" href="' +
        homeHref +
        '">#holmevann1013moh</a>',
      "    </div>",
      "  </header>",
      '  <main class="page-content" aria-label="Content">',
      '    <div class="wrapper">',
      '      <article class="post">',
      '        <header class="post-header"><h1 class="post-title">' +
        title +
        "</h1></header>",
      '        <div class="post-content">',
      "          <p>" + intro + "</p>",
      "          <p>" + body + "</p>",
      "          <p>" + note + "</p>",
      "          <ul>" + linksMarkup + "</ul>",
      "        </div>",
      "      </article>",
      "    </div>",
      "  </main>",
      "</body>",
      "</html>",
    ].join("\n");
  }

  function buildOfflineFallbackResponse(options) {
    return new Response(buildOfflineFallbackHtml(options), {
      status: 200,
      headers: {
        "content-type": "text/html; charset=utf-8",
      },
    });
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
    buildOfflineFallbackHtml,
    buildOfflineFallbackResponse,
    cacheHtmlResponseVariants,
    getHtmlCacheKeys,
    isEnglishPath,
    matchAssetInCaches,
    matchHtmlInCaches,
    loadGoogleAnalytics,
  };

  global.HolmevannOfflineRuntimeUtils = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof self !== "undefined" ? self : globalThis);
