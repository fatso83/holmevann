const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const netlifyTomlPath = path.join(__dirname, "..", "netlify.toml");

function getBuildCommand() {
  const source = fs.readFileSync(netlifyTomlPath, "utf8");
  const match = source.match(/^\s*command\s*=\s*"([^"]+)"/m);

  assert.ok(match, "netlify.toml must define a build command");
  return match[1];
}

test("netlify build command installs gems before running the translated build", function () {
  const command = getBuildCommand();

  assert.match(command, /\bbundle install\b/);
  assert.match(command, /\bbundle exec jekyll build\b/);
  assert.match(command, /\bbundle exec ruby scripts\/translate_site\.rb\b/);
});

test("netlify build command does not depend on asdf", function () {
  const command = getBuildCommand();

  assert.doesNotMatch(command, /\basdf\b/);
});
