const test = require("node:test");
const assert = require("node:assert/strict");

const {
  initializeLanguagePreferenceUI,
  isScandinavianLanguage,
  pathToLanguage,
} = require("../assets/js/language-preference.js");

function createElement() {
  return {
    dataset: {},
    hidden: true,
    href: "",
    textContent: "",
    listeners: {},
    setAttribute: function (name, value) {
      this[name] = value;
    },
    addEventListener: function (eventName, handler) {
      this.listeners[eventName] = handler;
    },
  };
}

function createDocument(options) {
  const prompt = createElement();
  const action = createElement();
  const dismiss = createElement();
  const message = createElement();
  const toggle = createElement();
  const documentObject = {
    cookie: options.cookie || "",
    documentElement: {
      lang: options.lang,
    },
    querySelector: function (selector) {
      switch (selector) {
        case "[data-language-prompt]":
          return prompt;
        case "[data-language-prompt-action]":
          return action;
        case "[data-language-prompt-dismiss]":
          return dismiss;
        case "[data-language-prompt-message]":
          return message;
        case "[data-language-toggle]":
          return toggle;
        default:
          return null;
      }
    },
  };

  return {
    documentObject,
    prompt,
    action,
    dismiss,
    message,
    toggle,
  };
}

test("isScandinavianLanguage matches the expected browser languages", function () {
  assert.equal(isScandinavianLanguage("nb-NO"), true);
  assert.equal(isScandinavianLanguage("nn-NO"), true);
  assert.equal(isScandinavianLanguage("sv-SE"), true);
  assert.equal(isScandinavianLanguage("da-DK"), true);
  assert.equal(isScandinavianLanguage("en-US"), false);
});

test("pathToLanguage maps Norwegian pages to their English counterparts", function () {
  assert.equal(pathToLanguage("/", "en"), "/en/");
  assert.equal(pathToLanguage("/faq.html", "en"), "/en/faq.html");
  assert.equal(pathToLanguage("/rental/", "en"), "/en/rental/");
  assert.equal(pathToLanguage("/tagger/fisk/", "en"), "/en/tags/fisk/");
  assert.equal(pathToLanguage("/en/tags/fisk/", "no"), "/tagger/fisk/");
  assert.equal(pathToLanguage("/en/rental/", "no"), "/rental/");
});

test("initializeLanguagePreferenceUI silently stores Norwegian for Scandinavian browsers", function () {
  const elements = createDocument({
    lang: "no",
    cookie: "",
  });
  const windowObject = {
    location: {
      href: "https://www.holmevann.no/rental/",
    },
    navigator: {
      languages: ["nb-NO"],
      language: "nb-NO",
    },
  };

  initializeLanguagePreferenceUI({
    document: elements.documentObject,
    window: windowObject,
  });

  assert.equal(
    elements.documentObject.cookie.includes("holmevann-language=no"),
    true,
  );
  assert.equal(elements.prompt.hidden, true);
  assert.equal(elements.toggle.hidden, false);
  assert.equal(elements.toggle.textContent, "EN");
  assert.equal(elements.toggle.href, "https://www.holmevann.no/en/rental/");
});

test("initializeLanguagePreferenceUI prompts for English on Norwegian pages for non-Scandinavian browsers", function () {
  const elements = createDocument({
    lang: "no",
    cookie: "",
  });
  const windowObject = {
    location: {
      href: "https://www.holmevann.no/faq.html",
    },
    navigator: {
      languages: ["en-US"],
      language: "en-US",
    },
  };

  initializeLanguagePreferenceUI({
    document: elements.documentObject,
    window: windowObject,
  });

  assert.equal(elements.prompt.hidden, false);
  assert.equal(
    elements.message.textContent,
    "This site is available in English.",
  );
  assert.equal(elements.action.textContent, "View English");
  assert.equal(elements.action.href, "https://www.holmevann.no/en/faq.html");
  assert.equal(elements.dismiss.textContent, "Not now");
  assert.equal(elements.toggle.textContent, "EN");
});

test("initializeLanguagePreferenceUI stores English silently on English pages", function () {
  const elements = createDocument({
    lang: "en",
    cookie: "",
  });
  const windowObject = {
    location: {
      href: "https://www.holmevann.no/en/faq.html",
    },
    navigator: {
      languages: ["en-US"],
      language: "en-US",
    },
  };

  initializeLanguagePreferenceUI({
    document: elements.documentObject,
    window: windowObject,
  });

  assert.equal(
    elements.documentObject.cookie.includes("holmevann-language=en"),
    true,
  );
  assert.equal(elements.prompt.hidden, true);
  assert.equal(elements.toggle.textContent, "NO");
  assert.equal(elements.toggle.href, "https://www.holmevann.no/faq.html");
});
