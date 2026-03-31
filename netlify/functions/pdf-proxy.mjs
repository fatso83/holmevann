const ALLOWED_HOSTS = new Set(["docs.google.com"]);
const ALLOWED_EXPORT_PATH = /^\/document\/d\/[^/]+\/export$/;
const PASSTHROUGH_HEADERS = [
  "accept-ranges",
  "cache-control",
  "content-disposition",
  "content-length",
  "content-range",
  "content-type",
  "etag",
  "last-modified",
  "vary",
];

function getUpstreamUrl(requestUrl) {
  const candidate = requestUrl.searchParams.get("url");

  if (!candidate) {
    return { error: new Response("Missing url parameter", { status: 400 }) };
  }

  let upstream;

  try {
    upstream = new URL(candidate);
  } catch (_error) {
    return { error: new Response("Invalid url parameter", { status: 400 }) };
  }

  if (upstream.protocol !== "https:") {
    return {
      error: new Response("Only https URLs are allowed", { status: 403 }),
    };
  }

  if (!ALLOWED_HOSTS.has(upstream.hostname)) {
    return { error: new Response("Host not allowed", { status: 403 }) };
  }

  if (!ALLOWED_EXPORT_PATH.test(upstream.pathname)) {
    return { error: new Response("Path not allowed", { status: 403 }) };
  }

  if (upstream.searchParams.get("format") !== "pdf") {
    return {
      error: new Response("Only PDF export URLs are allowed", { status: 403 }),
    };
  }

  return { upstream };
}

function buildUpstreamHeaders(request) {
  const headers = new Headers();
  const range = request.headers.get("range");
  const etag = request.headers.get("if-none-match");
  const modified = request.headers.get("if-modified-since");

  if (range) {
    headers.set("range", range);
  }

  if (etag) {
    headers.set("if-none-match", etag);
  }

  if (modified) {
    headers.set("if-modified-since", modified);
  }

  return headers;
}

function buildResponseHeaders(upstreamHeaders) {
  const headers = new Headers();

  for (const name of PASSTHROUGH_HEADERS) {
    const value = upstreamHeaders.get(name);

    if (value) {
      headers.set(name, value);
    }
  }

  headers.set("x-proxied-by", "holmevann-pdf-proxy");

  return headers;
}

export default async function handler(request) {
  const requestUrl = new URL(request.url);
  const { upstream, error } = getUpstreamUrl(requestUrl);

  if (error) {
    return error;
  }

  let upstreamResponse;

  try {
    upstreamResponse = await fetch(upstream, {
      method: "GET",
      headers: buildUpstreamHeaders(request),
    });
  } catch (_error) {
    return new Response("Upstream fetch failed", { status: 502 });
  }

  return new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
    headers: buildResponseHeaders(upstreamResponse.headers),
  });
}
