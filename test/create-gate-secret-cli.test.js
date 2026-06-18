const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");
const { webcrypto } = require("node:crypto");

const { decryptGateSecret } = require("../assets/js/gate-opener.js");

const execFileAsync = promisify(execFile);

test("create-gate-secret uses ASSET_SECRET without prompting for a password", async function () {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "holmevann-secret-"));
  const output = path.join(tempDir, "secret.dat");

  const result = await execFileAsync(
    process.execPath,
    [
      "scripts/create-gate-secret.js",
      "--code",
      "my-secret",
      "--output",
      output,
    ],
    {
      cwd: path.resolve(__dirname, ".."),
      env: {
        ...process.env,
        ASSET_SECRET: "env-password",
      },
    },
  );

  assert.doesNotMatch(result.stdout, /Passord/);
  assert.match(result.stdout, /Skrev /);

  const encrypted = JSON.parse(fs.readFileSync(output, "utf8"));
  const payload = await decryptGateSecret({
    encryptedSecret: encrypted,
    password: "env-password",
    crypto: webcrypto,
  });

  assert.deepEqual(payload, { code: "my-secret" });
});
