const http = require("node:http");
const https = require("node:https");

function requestBaseUrl(url, timeoutMs) {
  const transport = url.protocol === "https:" ? https : http;

  return new Promise((resolve, reject) => {
    const request = transport.request(
      url,
      {
        method: "GET",
        timeout: timeoutMs,
      },
      (response) => {
        response.resume();
        resolve(response);
      },
    );

    request.once("timeout", () => {
      request.destroy(new Error(`Timed out requesting ${url.href}`));
    });
    request.once("error", (error) => {
      reject(new Error(`Could not load ${url.href}: ${error.message}`));
    });

    request.end();
  });
}

module.exports = async function globalSetup(config) {
  const baseURL =
    config.projects[0]?.use?.baseURL || process.env.PLAYWRIGHT_BASE_URL;

  if (!baseURL) {
    throw new Error("PLAYWRIGHT_BASE_URL is not configured");
  }

  const url = new URL(baseURL);
  const response = await requestBaseUrl(url, 2_000);

  if (response.statusCode >= 400) {
    throw new Error(
      `Base URL ${url.href} returned HTTP ${response.statusCode}`,
    );
  }
};
