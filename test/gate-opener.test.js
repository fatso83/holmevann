const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { PassThrough } = require("node:stream");
const { webcrypto } = require("node:crypto");

const {
  buildGateRequestBody,
  decryptGateSecret,
  encryptGateSecret,
  initializeGateOpener,
  promptForHiddenValue,
  parseEncryptedSecret,
  validateGatePayload,
} = require("../assets/js/gate-opener.js");

function createGateOpenerDom() {
  const listeners = {};
  const elements = {
    form: {
      hidden: false,
      addEventListener(type, listener) {
        listeners[type] = listener;
      },
    },
    passwordInput: { value: "" },
    unlockButton: { disabled: false },
    openButton: {
      hidden: true,
      disabled: true,
      addEventListener() {},
    },
    forgetButton: {
      hidden: true,
      addEventListener() {},
    },
    status: {
      dataset: {},
      hidden: true,
      textContent: "",
    },
    endpointHint: {
      hidden: true,
      textContent: "",
    },
  };
  const selectors = {
    "[data-gate-unlock-form]": elements.form,
    "[data-gate-password]": elements.passwordInput,
    "[data-gate-unlock]": elements.unlockButton,
    "[data-gate-open]": elements.openButton,
    "[data-gate-forget]": elements.forgetButton,
    "[data-gate-status]": elements.status,
    "[data-gate-endpoint-hint]": elements.endpointHint,
  };

  return {
    elements,
    listeners,
    document: {
      querySelector(selector) {
        return selectors[selector] || null;
      },
    },
  };
}

test("parseEncryptedSecret rejects missing encryption fields", function () {
  assert.throws(function () {
    parseEncryptedSecret(
      JSON.stringify({
        version: 1,
        kdf: "PBKDF2",
        hash: "SHA-256",
        cipher: "AES-256-GCM",
        iterations: 210000,
      }),
    );
  }, /salt/);
});

test("decryptGateSecret returns a parsed code payload", async function () {
  const encrypted = await encryptGateSecret({
    payload: {
      code: "my-secret",
    },
    password: "correct horse",
    crypto: webcrypto,
  });

  const payload = await decryptGateSecret({
    encryptedSecret: encrypted,
    password: "correct horse",
    crypto: webcrypto,
  });

  assert.deepEqual(payload, { code: "my-secret" });
});

test("validateGatePayload rejects payloads without a string code", function () {
  assert.equal(validateGatePayload({ code: "my-secret" }), true);
  assert.equal(validateGatePayload({ code: "" }), false);
  assert.equal(validateGatePayload({ code: 123 }), false);
});

test("buildGateRequestBody serializes the code as form data", function () {
  const body = buildGateRequestBody({ code: "my secret" });

  assert.equal(body.toString(), "code=my+secret");
});

test("bom status box is hidden when it has no message", function () {
  const source = fs.readFileSync(path.join(__dirname, "..", "bom.md"), "utf8");

  assert.match(
    source,
    /\.gate-opener__status\[hidden\]\s*{\s*display:\s*none;/,
  );
  assert.match(source, /transition:\s*opacity 220ms ease;/);
  assert.match(
    source,
    /\.gate-opener__status\[data-fading="true"\]\s*{\s*opacity:\s*0;/,
  );
});

test("gate status fades out after ten seconds and is removed", function () {
  const dom = createGateOpenerDom();
  const scheduled = [];
  const cleared = [];

  initializeGateOpener({
    document: dom.document,
    window: {
      crypto: webcrypto,
      fetch() {},
      location: { search: "" },
      localStorage: {
        getItem() {
          return null;
        },
        setItem() {},
        removeItem() {},
      },
      setTimeout(callback, delay) {
        const timer = { callback, delay };
        scheduled.push(timer);
        return timer;
      },
      clearTimeout(timer) {
        cleared.push(timer);
      },
    },
    assetUrl: "/assets/secret.dat",
    endpoint: "/api/gate/open",
  });

  dom.listeners.submit({
    preventDefault() {},
  });

  assert.equal(dom.elements.status.textContent, "Skriv inn passord.");
  assert.equal(dom.elements.status.hidden, false);
  assert.equal(scheduled[0].delay, 10000);

  scheduled[0].callback();

  assert.equal(dom.elements.status.dataset.fading, "true");
  assert.equal(dom.elements.status.hidden, false);
  assert.equal(scheduled[1].delay, 220);

  scheduled[1].callback();

  assert.equal(dom.elements.status.textContent, "");
  assert.equal(dom.elements.status.hidden, true);
  assert.equal(dom.elements.status.dataset.fading, undefined);
  assert.equal(cleared.includes(scheduled[0]), true);
});

test("promptForHiddenValue writes the prompt without echoing input", async function () {
  const input = new PassThrough();
  const output = new PassThrough();
  let paused = false;
  let written = "";

  input.isTTY = true;
  input.setRawMode = function () {};
  input.pause = function () {
    paused = true;
    return this;
  };
  output.write = function (chunk) {
    written += chunk;
    return true;
  };

  const answerPromise = promptForHiddenValue({
    input,
    output,
    question: "Passord: ",
  });

  input.write("secret");
  input.write("\r");

  assert.equal(await answerPromise, "secret");
  assert.equal(written, "Passord: \n");
  assert.equal(paused, true);
});
