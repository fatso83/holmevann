(function (global) {
  var LANGUAGE_COOKIE = "holmevann-language";
  var PROMPT_COOKIE = "holmevann-language-prompt";
  var COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

  function isScandinavianLanguage(language) {
    if (!language) {
      return false;
    }

    return /^(nb|no|nn|sv|da)(-|$)/i.test(language);
  }

  function readCookie(name, cookieString) {
    var source = cookieString || "";
    var parts = source.split("; ");

    for (var i = 0; i < parts.length; i += 1) {
      var part = parts[i];

      if (part.indexOf(name + "=") === 0) {
        return decodeURIComponent(part.slice(name.length + 1));
      }
    }

    return "";
  }

  function writeCookie(documentObject, name, value, maxAgeSeconds) {
    documentObject.cookie =
      name +
      "=" +
      encodeURIComponent(value) +
      "; path=/; max-age=" +
      String(maxAgeSeconds) +
      "; samesite=lax";
  }

  function pathToLanguage(pathname, targetLanguage) {
    if (!pathname) {
      return "/";
    }

    if (targetLanguage === "en") {
      if (pathname === "/") {
        return "/en/";
      }

      if (pathname === "/en") {
        return "/en/";
      }

      if (pathname.indexOf("/en/") === 0) {
        return pathname;
      }

      if (pathname.indexOf("/tagger/") === 0) {
        return "/en/tags/" + pathname.slice("/tagger/".length);
      }

      if (
        pathname.indexOf("/assets/") === 0 ||
        pathname.indexOf("/.well-known/") === 0
      ) {
        return pathname;
      }

      return "/en" + pathname;
    }

    if (pathname === "/en/") {
      return "/";
    }

    if (pathname === "/en") {
      return "/";
    }

    if (pathname.indexOf("/en/tags/") === 0) {
      return "/tagger/" + pathname.slice("/en/tags/".length);
    }

    if (pathname.indexOf("/en/") === 0) {
      return pathname.slice(3);
    }

    return pathname;
  }

  function buildLanguageUrl(currentUrl, targetLanguage) {
    var nextUrl = new URL(currentUrl.toString());
    nextUrl.pathname = pathToLanguage(nextUrl.pathname, targetLanguage);
    return nextUrl;
  }

  function setToggleLink(documentObject, currentUrl, currentLanguage) {
    var toggle = documentObject.querySelector("[data-language-toggle]");
    if (!toggle) {
      return;
    }

    var targetLanguage = currentLanguage === "en" ? "no" : "en";
    var targetUrl = buildLanguageUrl(currentUrl, targetLanguage);

    toggle.href = targetUrl.toString();
    toggle.textContent = targetLanguage === "en" ? "EN" : "NO";
    toggle.hidden = false;
    toggle.setAttribute(
      "aria-label",
      targetLanguage === "en" ? "Switch to English" : "Switch to Norwegian",
    );
    toggle.dataset.languageTarget = targetLanguage;
  }

  function hidePrompt(documentObject) {
    var prompt = documentObject.querySelector("[data-language-prompt]");
    if (!prompt) {
      return;
    }

    prompt.hidden = true;
  }

  function showPrompt(documentObject, currentUrl) {
    var prompt = documentObject.querySelector("[data-language-prompt]");
    var action = documentObject.querySelector("[data-language-prompt-action]");
    var dismiss = documentObject.querySelector(
      "[data-language-prompt-dismiss]",
    );
    var message = documentObject.querySelector(
      "[data-language-prompt-message]",
    );

    if (!prompt || !action || !dismiss || !message) {
      return;
    }

    var englishUrl = buildLanguageUrl(currentUrl, "en");

    message.textContent = "This site is available in English.";
    action.textContent = "View English";
    action.href = englishUrl.toString();
    action.dataset.languageTarget = "en";
    dismiss.textContent = "Not now";
    prompt.hidden = false;
  }

  function initializeLanguagePreferenceUI(options) {
    var documentObject = options.document;
    var windowObject = options.window;
    var currentUrl = new URL(windowObject.location.href);
    var currentLanguage = (
      documentObject.documentElement.lang || "no"
    ).toLowerCase();
    var browserLanguage =
      (windowObject.navigator.languages &&
        windowObject.navigator.languages[0]) ||
      windowObject.navigator.language ||
      "";
    var storedLanguage = readCookie(LANGUAGE_COOKIE, documentObject.cookie);
    var promptDismissed = readCookie(PROMPT_COOKIE, documentObject.cookie);
    var browserIsScandinavian = isScandinavianLanguage(browserLanguage);

    setToggleLink(documentObject, currentUrl, currentLanguage);

    if (storedLanguage === "en" || storedLanguage === "no") {
      hidePrompt(documentObject);
      return;
    }

    if (browserIsScandinavian) {
      writeCookie(documentObject, LANGUAGE_COOKIE, "no", COOKIE_MAX_AGE);
      hidePrompt(documentObject);
      return;
    }

    if (currentLanguage === "en") {
      writeCookie(documentObject, LANGUAGE_COOKIE, "en", COOKIE_MAX_AGE);
      hidePrompt(documentObject);
      return;
    }

    if (promptDismissed === "1") {
      hidePrompt(documentObject);
      return;
    }

    showPrompt(documentObject, currentUrl);
  }

  function attachHandlers(options) {
    var documentObject = options.document;
    var windowObject = options.window;
    var prompt = documentObject.querySelector("[data-language-prompt]");
    var action = documentObject.querySelector("[data-language-prompt-action]");
    var dismiss = documentObject.querySelector(
      "[data-language-prompt-dismiss]",
    );
    var toggle = documentObject.querySelector("[data-language-toggle]");

    function rememberLanguage(targetLanguage) {
      writeCookie(
        documentObject,
        LANGUAGE_COOKIE,
        targetLanguage,
        COOKIE_MAX_AGE,
      );
      writeCookie(documentObject, PROMPT_COOKIE, "1", COOKIE_MAX_AGE);
    }

    if (action) {
      action.addEventListener("click", function () {
        var targetLanguage = action.dataset.languageTarget || "en";
        rememberLanguage(targetLanguage);
      });
    }

    if (dismiss) {
      dismiss.addEventListener("click", function () {
        writeCookie(documentObject, PROMPT_COOKIE, "1", COOKIE_MAX_AGE);
        hidePrompt(documentObject);
      });
    }

    if (toggle) {
      toggle.addEventListener("click", function () {
        var targetLanguage = toggle.dataset.languageTarget || "en";
        rememberLanguage(targetLanguage);
      });
    }

    if (prompt && prompt.hidden) {
      hidePrompt(documentObject);
    }
  }

  function boot() {
    if (!global.document || !global.window) {
      return;
    }

    initializeLanguagePreferenceUI({
      document: global.document,
      window: global.window,
    });
    attachHandlers({
      document: global.document,
      window: global.window,
    });
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = {
      attachHandlers: attachHandlers,
      buildLanguageUrl: buildLanguageUrl,
      initializeLanguagePreferenceUI: initializeLanguagePreferenceUI,
      isScandinavianLanguage: isScandinavianLanguage,
      pathToLanguage: pathToLanguage,
      readCookie: readCookie,
      writeCookie: writeCookie,
    };
  }

  if (global && global.document && global.window) {
    if (global.document.readyState === "loading") {
      global.document.addEventListener("DOMContentLoaded", boot);
    } else {
      boot();
    }
  }
})(typeof window !== "undefined" ? window : globalThis);
