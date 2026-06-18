const test = require("node:test");
const assert = require("node:assert/strict");
const { PassThrough } = require("node:stream");
const { webcrypto } = require("node:crypto");

const {
  buildGateRequestBody,
  decryptGateSecret,
  encryptGateSecret,
  promptForHiddenValue,
  parseEncryptedSecret,
  validateGatePayload,
} = require("../assets/js/gate-opener.js");

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
