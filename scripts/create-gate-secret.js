#!/usr/bin/env node

const fs = require("node:fs/promises");
const fsSync = require("node:fs");
const path = require("node:path");
const readline = require("node:readline");
const { stdin, stdout } = require("node:process");
const { webcrypto } = require("node:crypto");

const {
  encryptGateSecret,
  promptForHiddenValue,
} = require("../assets/js/gate-opener.js");

let pipedAnswers = null;

function parseArgs(argv) {
  const args = {
    output: path.join("assets", "secret.dat"),
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === "--code") {
      args.code = argv[i + 1];
      i += 1;
    } else if (arg === "--output") {
      args.output = argv[i + 1];
      i += 1;
    } else if (arg === "--help" || arg === "-h") {
      args.help = true;
    } else {
      throw new Error("Unknown argument: " + arg);
    }
  }

  return args;
}

function usage() {
  return [
    "Usage: node scripts/create-gate-secret.js [--code my-secret] [--output assets/secret.dat]",
    "",
    "Prompts for code and password when omitted, then writes an encrypted Web Crypto envelope.",
    "Set ASSET_SECRET to provide the encryption password non-interactively.",
  ].join("\n");
}

function ask(question) {
  if (!stdin.isTTY) {
    if (!pipedAnswers) {
      pipedAnswers = fsSync.readFileSync(0, "utf8").split(/\r?\n/);
    }

    stdout.write(question);
    return Promise.resolve(pipedAnswers.shift() || "");
  }

  const rl = readline.createInterface({
    input: stdin,
    output: stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

function askHidden(question) {
  if (!stdin.isTTY) {
    return ask(question);
  }

  return promptForHiddenValue({
    input: stdin,
    output: stdout,
    question,
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    stdout.write(usage() + "\n");
    return;
  }

  const code = args.code || (await ask("Kode: "));
  const password = process.env.ASSET_SECRET || (await askHidden("Passord: "));
  const confirmPassword = process.env.ASSET_SECRET
    ? password
    : await askHidden("Gjenta passord: ");

  if (password !== confirmPassword) {
    throw new Error("Passordene er ikke like");
  }

  const encrypted = await encryptGateSecret({
    payload: {
      code,
    },
    password,
    crypto: webcrypto,
  });
  const outputPath = path.resolve(args.output);

  await fs.mkdir(path.dirname(outputPath), {
    recursive: true,
  });
  await fs.writeFile(outputPath, JSON.stringify(encrypted, null, 2) + "\n");
  stdout.write("Skrev " + outputPath + "\n");
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
