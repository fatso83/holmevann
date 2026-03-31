(function (global) {
  function buildBypassHeaders(sourceHeaders) {
    const headers = new Headers();

    if (!sourceHeaders || !sourceHeaders.forEach) {
      headers.set("x-holmevann-sw-bypass", "1");
      return headers;
    }

    sourceHeaders.forEach(function (value, key) {
      headers.set(key, value);
    });
    headers.set("x-holmevann-sw-bypass", "1");

    return headers;
  }

  function buildBypassRequest(request) {
    return new Request(request, {
      headers: buildBypassHeaders(request.headers),
    });
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
    const contentType =
      response.headers.get("content-type") || "application/pdf";
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

  function buildRangeNotSatisfiableResponse(totalLength) {
    return new Response(null, {
      status: 416,
      statusText: "Range Not Satisfiable",
      headers: {
        "content-range": "bytes */" + totalLength,
      },
    });
  }

  async function handlePdfRequest(deps, request) {
    const pdfCache = await deps.openCache(deps.pdfCacheName);
    const cached = await pdfCache.match(request.url);

    const networkPromise = deps
      .fetch(buildBypassRequest(request))
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

    return deps.ensureServiceWorkerResponse(await networkPromise);
  }

  async function handlePdfRangeRequest(deps, request) {
    const pdfCache = await deps.openCache(deps.pdfCacheName);
    const upstreamRequest = buildBypassRequest(request);

    try {
      const response = await deps.fetch(upstreamRequest);

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
          return buildRangeNotSatisfiableResponse(totalLength);
        }

        await pdfCache.put(request.url, response.clone());

        return buildPartialContentResponse(
          response,
          range,
          totalLength,
          buffer,
        );
      }

      return response;
    } catch (_error) {
      const cachedResponse = await pdfCache.match(request.url);

      if (!cachedResponse) {
        return deps.ensureServiceWorkerResponse(null);
      }

      const buffer = await cachedResponse.arrayBuffer();
      const totalLength = buffer.byteLength;
      const range = parseSingleRangeHeader(
        request.headers.get("range"),
        totalLength,
      );

      if (!range) {
        return buildRangeNotSatisfiableResponse(totalLength);
      }

      return buildPartialContentResponse(
        cachedResponse,
        range,
        totalLength,
        buffer,
      );
    }
  }

  const api = {
    buildPartialContentResponse,
    handlePdfRangeRequest,
    handlePdfRequest,
    parseSingleRangeHeader,
  };

  global.HolmevannServiceWorkerPdfRuntime = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof self !== "undefined" ? self : globalThis);
