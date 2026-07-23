const test = require("node:test");
const assert = require("node:assert/strict");

const globalSetup = require("../test/e2e/global-setup.js");

test("global setup exits before server checks when e2e skip is set", async function () {
  const previousSkip = process.env.HOLMEVANN_SKIP_E2E;
  const previousBaseUrl = process.env.PLAYWRIGHT_BASE_URL;
  const previousExit = process.exit;
  let exitCode = null;

  process.env.HOLMEVANN_SKIP_E2E = "1";
  delete process.env.PLAYWRIGHT_BASE_URL;
  process.exit = function (code) {
    exitCode = code;
    throw new Error("process.exit");
  };

  try {
    await assert.rejects(
      globalSetup({
        projects: [
          {
            use: {},
          },
        ],
      }),
      /process\.exit/,
    );
    assert.equal(exitCode, 0);
  } finally {
    process.exit = previousExit;

    if (previousSkip === undefined) {
      delete process.env.HOLMEVANN_SKIP_E2E;
    } else {
      process.env.HOLMEVANN_SKIP_E2E = previousSkip;
    }

    if (previousBaseUrl === undefined) {
      delete process.env.PLAYWRIGHT_BASE_URL;
    } else {
      process.env.PLAYWRIGHT_BASE_URL = previousBaseUrl;
    }
  }
});
