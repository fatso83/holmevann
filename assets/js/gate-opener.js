(function (global) {
  var DEFAULT_ITERATIONS = 210000;
  var SECRET_STORAGE_KEY = "holmevann-gate-secret";

  function getCrypto(cryptoObject) {
    var candidate = cryptoObject || global.crypto;

    if (!candidate || !candidate.subtle || !candidate.getRandomValues) {
      throw new Error("Web Crypto API is not available");
    }

    return candidate;
  }

  function bytesToBase64(bytes) {
    if (typeof Buffer !== "undefined") {
      return Buffer.from(bytes).toString("base64");
    }

    var binary = "";

    for (var i = 0; i < bytes.length; i += 1) {
      binary += String.fromCharCode(bytes[i]);
    }

    return global.btoa(binary);
  }

  function base64ToBytes(value) {
    if (typeof Buffer !== "undefined") {
      return new Uint8Array(Buffer.from(value, "base64"));
    }

    var binary = global.atob(value);
    var bytes = new Uint8Array(binary.length);

    for (var i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }

    return bytes;
  }

  function encodeText(value) {
    return new TextEncoder().encode(value);
  }

  function decodeText(bytes) {
    return new TextDecoder().decode(bytes);
  }

  function validateGatePayload(payload) {
    return (
      Boolean(payload) &&
      typeof payload.code === "string" &&
      payload.code.trim().length > 0
    );
  }

  function parseEncryptedSecret(input) {
    var encryptedSecret = typeof input === "string" ? JSON.parse(input) : input;
    var required = [
      "version",
      "kdf",
      "hash",
      "cipher",
      "iterations",
      "salt",
      "iv",
      "ciphertext",
    ];

    required.forEach(function (field) {
      if (
        encryptedSecret[field] === undefined ||
        encryptedSecret[field] === null ||
        encryptedSecret[field] === ""
      ) {
        throw new Error("Encrypted secret is missing " + field);
      }
    });

    if (encryptedSecret.version !== 1) {
      throw new Error("Unsupported encrypted secret version");
    }

    if (
      encryptedSecret.kdf !== "PBKDF2" ||
      encryptedSecret.hash !== "SHA-256" ||
      encryptedSecret.cipher !== "AES-256-GCM"
    ) {
      throw new Error("Unsupported encrypted secret algorithm");
    }

    if (
      !Number.isInteger(encryptedSecret.iterations) ||
      encryptedSecret.iterations < 100000
    ) {
      throw new Error("Encrypted secret iterations are too low");
    }

    return encryptedSecret;
  }

  async function deriveGateKey(options) {
    var cryptoObject = getCrypto(options.crypto);
    var keyMaterial = await cryptoObject.subtle.importKey(
      "raw",
      encodeText(options.password),
      "PBKDF2",
      false,
      ["deriveKey"],
    );

    return cryptoObject.subtle.deriveKey(
      {
        name: "PBKDF2",
        hash: "SHA-256",
        salt: options.salt,
        iterations: options.iterations,
      },
      keyMaterial,
      {
        name: "AES-GCM",
        length: 256,
      },
      false,
      options.usages,
    );
  }

  async function encryptGateSecret(options) {
    var cryptoObject = getCrypto(options.crypto);
    var payload = options.payload;
    var password = options.password || "";
    var iterations = options.iterations || DEFAULT_ITERATIONS;
    var salt = options.salt || cryptoObject.getRandomValues(new Uint8Array(16));
    var iv = options.iv || cryptoObject.getRandomValues(new Uint8Array(12));

    if (!password) {
      throw new Error("Password is required");
    }

    if (!validateGatePayload(payload)) {
      throw new Error("Gate payload must include a non-empty code");
    }

    var key = await deriveGateKey({
      crypto: cryptoObject,
      password: password,
      salt: salt,
      iterations: iterations,
      usages: ["encrypt"],
    });
    var ciphertext = await cryptoObject.subtle.encrypt(
      {
        name: "AES-GCM",
        iv: iv,
      },
      key,
      encodeText(JSON.stringify(payload)),
    );

    return {
      version: 1,
      kdf: "PBKDF2",
      hash: "SHA-256",
      cipher: "AES-256-GCM",
      iterations: iterations,
      salt: bytesToBase64(salt),
      iv: bytesToBase64(iv),
      ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
    };
  }

  async function decryptGateSecret(options) {
    var cryptoObject = getCrypto(options.crypto);
    var encryptedSecret = parseEncryptedSecret(options.encryptedSecret);
    var salt = base64ToBytes(encryptedSecret.salt);
    var iv = base64ToBytes(encryptedSecret.iv);
    var ciphertext = base64ToBytes(encryptedSecret.ciphertext);
    var key = await deriveGateKey({
      crypto: cryptoObject,
      password: options.password || "",
      salt: salt,
      iterations: encryptedSecret.iterations,
      usages: ["decrypt"],
    });
    var plaintext = await cryptoObject.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: iv,
      },
      key,
      ciphertext,
    );
    var payload = JSON.parse(decodeText(new Uint8Array(plaintext)));

    if (!validateGatePayload(payload)) {
      throw new Error("Decrypted secret is not a valid gate payload");
    }

    return payload;
  }

  function buildGateRequestBody(payload) {
    var body = new URLSearchParams();
    body.set("code", payload.code);
    return body;
  }

  function promptForHiddenValue(options) {
    var input = options.input;
    var output = options.output;
    var question = options.question || "";
    var answer = "";
    var previousRawMode =
      typeof input.isRaw === "boolean" ? input.isRaw : false;

    return new Promise(function (resolve, reject) {
      function cleanup() {
        input.removeListener("data", onData);

        if (typeof input.setRawMode === "function") {
          input.setRawMode(previousRawMode);
        }

        if (typeof input.pause === "function") {
          input.pause();
        }

        output.write("\n");
      }

      function finish() {
        cleanup();
        resolve(answer);
      }

      function abort() {
        cleanup();
        reject(new Error("Avbrutt"));
      }

      function onData(chunk) {
        var value = String(chunk);

        for (var i = 0; i < value.length; i += 1) {
          var character = value[i];

          if (character === "\u0003") {
            abort();
            return;
          }

          if (
            character === "\r" ||
            character === "\n" ||
            character === "\u0004"
          ) {
            finish();
            return;
          }

          if (character === "\u007f" || character === "\b") {
            answer = answer.slice(0, -1);
            continue;
          }

          if (character >= " ") {
            answer += character;
          }
        }
      }

      output.write(question);

      if (typeof input.setRawMode === "function") {
        input.setRawMode(true);
      }

      if (typeof input.setEncoding === "function") {
        input.setEncoding("utf8");
      }

      if (typeof input.resume === "function") {
        input.resume();
      }

      input.on("data", onData);
    });
  }

  function setStatus(statusElement, message, tone) {
    if (!statusElement) {
      return;
    }

    statusElement.textContent = message;
    statusElement.dataset.tone = tone || "";
    statusElement.hidden = !message;
  }

  function readStoredPayload(windowObject) {
    try {
      var stored = windowObject.localStorage.getItem(SECRET_STORAGE_KEY);
      var payload = stored ? JSON.parse(stored) : null;

      return validateGatePayload(payload) ? payload : null;
    } catch (_error) {
      return null;
    }
  }

  function storePayload(windowObject, payload) {
    windowObject.localStorage.setItem(
      SECRET_STORAGE_KEY,
      JSON.stringify(payload),
    );
  }

  function clearStoredPayload(windowObject) {
    windowObject.localStorage.removeItem(SECRET_STORAGE_KEY);
  }

  function initializeGateOpener(options) {
    var documentObject = options.document;
    var windowObject = options.window;
    var endpoint = options.endpoint;
    var assetUrl = options.assetUrl;
    var cryptoObject = options.crypto || windowObject.crypto;
    var fetchFunction = options.fetch || windowObject.fetch.bind(windowObject);
    var form = documentObject.querySelector("[data-gate-unlock-form]");
    var passwordInput = documentObject.querySelector("[data-gate-password]");
    var unlockButton = documentObject.querySelector("[data-gate-unlock]");
    var openButton = documentObject.querySelector("[data-gate-open]");
    var forgetButton = documentObject.querySelector("[data-gate-forget]");
    var status = documentObject.querySelector("[data-gate-status]");
    var payload = readStoredPayload(windowObject);

    function render() {
      var unlocked = validateGatePayload(payload);

      if (form) {
        form.hidden = unlocked;
      }

      if (openButton) {
        openButton.hidden = !unlocked;
        openButton.disabled = !unlocked;
      }

      if (forgetButton) {
        forgetButton.hidden = !unlocked;
      }
    }

    async function loadEncryptedSecret() {
      var response = await fetchFunction(assetUrl, {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("Kunne ikke hente kryptert hemmelighet");
      }

      return parseEncryptedSecret(await response.text());
    }

    if (form) {
      form.addEventListener("submit", function (event) {
        event.preventDefault();

        if (!passwordInput || !passwordInput.value) {
          setStatus(status, "Skriv inn passord.", "error");
          return;
        }

        unlockButton.disabled = true;
        setStatus(status, "Låser opp ...", "");

        loadEncryptedSecret()
          .then(function (encryptedSecret) {
            return decryptGateSecret({
              encryptedSecret: encryptedSecret,
              password: passwordInput.value,
              crypto: cryptoObject,
            });
          })
          .then(function (decryptedPayload) {
            payload = decryptedPayload;
            storePayload(windowObject, payload);
            passwordInput.value = "";
            setStatus(status, "Klar til å åpne bom.", "success");
            render();
          })
          .catch(function () {
            payload = null;
            setStatus(
              status,
              "Feil passord eller ugyldig hemmelighet.",
              "error",
            );
            render();
          })
          .finally(function () {
            unlockButton.disabled = false;
          });
      });
    }

    if (openButton) {
      openButton.addEventListener("click", function () {
        if (!validateGatePayload(payload)) {
          setStatus(status, "Lås opp med passord først.", "error");
          render();
          return;
        }

        openButton.disabled = true;
        setStatus(status, "Sender ...", "");

        fetchFunction(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
          },
          body: buildGateRequestBody(payload),
        })
          .then(function (response) {
            if (!response.ok) {
              throw new Error("Gate endpoint failed");
            }

            return response.text();
          })
          .then(function () {
            setStatus(status, "Bomåpning er sendt.", "success");
          })
          .catch(function () {
            setStatus(status, "Kunne ikke åpne bom.", "error");
          })
          .finally(function () {
            openButton.disabled = false;
          });
      });
    }

    if (forgetButton) {
      forgetButton.addEventListener("click", function () {
        payload = null;
        clearStoredPayload(windowObject);
        setStatus(status, "Lagret hemmelighet er fjernet.", "");
        render();
      });
    }

    render();
  }

  var api = {
    buildGateRequestBody: buildGateRequestBody,
    decryptGateSecret: decryptGateSecret,
    encryptGateSecret: encryptGateSecret,
    initializeGateOpener: initializeGateOpener,
    parseEncryptedSecret: parseEncryptedSecret,
    promptForHiddenValue: promptForHiddenValue,
    validateGatePayload: validateGatePayload,
  };

  global.HolmevannGateOpener = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof self !== "undefined" ? self : globalThis);
