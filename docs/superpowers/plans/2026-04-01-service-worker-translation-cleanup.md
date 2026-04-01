# Service Worker And Translation Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Forenkle service worker-koden og build-time-oversettingspipen ved å fjerne død kode, kutte unødvendige abstraksjoner, og gjøre den faktiske byggeflyten tydelig og eksplisitt.

**Architecture:** Service worker-delen skal beholde eksisterende runtime-oppførsel for offline navigasjon, asset-cache og PDF-cache, men miste kode som ikke deltar i noen faktisk flyt. Oversettingsdelen skal konsolideres rundt én eksplisitt entrypoint for build og oversetting, med enklere avhengighetsgraf i Ruby-koden og mindre cache-metadata som ikke brukes. Planen prioriterer semantisk opprydding før eventuell modulisering.

**Tech Stack:** Jekyll 4, Ruby 3.4 via `asdf`, Node test runner, Minitest, Netlify build config, service worker Cache API.

---

### Task 1: Remove Dead Service Worker Core-Page Prefetch Code

**Files:**

- Modify: `service-worker.js`
- Test: `test/service-worker-pdf-runtime.test.js`
- Test: `test/service-worker-pdf-utils.test.js`
- Verify build output: `_site/service-worker.js`

- [ ] **Step 1: Confirm the dead code is still present before removing it**

Run:

```bash
rg -n "isPrefetchableCorePageUrl|prefetchSameOriginAssetUrlsFromCorePages|prefetchPdfUrlsFromCorePages" service-worker.js
```

Expected: PASS with matches in `service-worker.js`.

- [ ] **Step 2: Remove the unused alias and unused core-page prefetch functions**

Update [`service-worker.js`](/Users/carlerik/dev/holmevann/service-worker.js) to delete:

```js
function isPrefetchableCorePageUrl(url) {
  return isCoreHtmlUrl(url);
}
```

and both unused helpers:

```js
async function prefetchSameOriginAssetUrlsFromCorePages(cache) { ... }
async function prefetchPdfUrlsFromCorePages(cache) { ... }
```

Do not change `handleNavigation`, install-time caching, or PDF request handling in this task.

- [ ] **Step 3: Re-run the grep to prove the dead code is gone**

Run:

```bash
rg -n "isPrefetchableCorePageUrl|prefetchSameOriginAssetUrlsFromCorePages|prefetchPdfUrlsFromCorePages" service-worker.js
```

Expected: FAIL with no matches.

- [ ] **Step 4: Run the JavaScript unit tests**

Run:

```bash
node --test test/*.test.js
```

Expected: PASS.

- [ ] **Step 5: Run the real site build and inspect the generated artifact**

Run:

```bash
asdf exec bundle exec jekyll build
rg -n "isPrefetchableCorePageUrl|prefetchSameOriginAssetUrlsFromCorePages|prefetchPdfUrlsFromCorePages" _site/service-worker.js
```

Expected: Jekyll build passes, and the generated service worker no longer contains the removed code.

- [ ] **Step 6: Commit the cleanup**

```bash
git add service-worker.js
git commit -m "refactor: remove dead service worker prefetch code"
```

### Task 2: Collapse Duplicate PDF Prefetch Abstraction

**Files:**

- Modify: `assets/js/service-worker-pdf-utils.js`
- Modify: `service-worker.js`
- Modify: `test/service-worker-pdf-utils.test.js`

- [ ] **Step 1: Confirm the wrapper exists and is only a pass-through**

Run:

```bash
rg -n "trackPdfPrefetch|trackPrefetch" assets/js/service-worker-pdf-utils.js service-worker.js test/service-worker-pdf-utils.test.js
```

Expected: PASS with `trackPdfPrefetch` defined once, called once in production code, and tested separately.

- [ ] **Step 2: Replace `trackPdfPrefetch` usage with `trackPrefetch` directly**

Update [`service-worker.js`](/Users/carlerik/dev/holmevann/service-worker.js) so PDF prefetch uses:

```js
self.HolmevannServiceWorkerPdfUtils.trackPrefetch(...)
```

Then remove `trackPdfPrefetch` from [`assets/js/service-worker-pdf-utils.js`](/Users/carlerik/dev/holmevann/assets/js/service-worker-pdf-utils.js) and from the exported API.

- [ ] **Step 3: Merge the duplicate tests**

Update [`test/service-worker-pdf-utils.test.js`](/Users/carlerik/dev/holmevann/test/service-worker-pdf-utils.test.js) to keep one generic in-flight deduplication test for `trackPrefetch`, and delete the separate PDF-specific wrapper test.

- [ ] **Step 4: Run the JavaScript unit tests**

Run:

```bash
node --test test/*.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit the abstraction cleanup**

```bash
git add assets/js/service-worker-pdf-utils.js service-worker.js test/service-worker-pdf-utils.test.js
git commit -m "refactor: remove duplicate pdf prefetch wrapper"
```

### Task 3: Make The Translation Build Flow Explicit

**Files:**

- Modify: `Makefile`
- Modify: `netlify.toml`
- Delete: `_plugins/english_translation.rb`
- Modify: `README.md`
- Verify output: `_site/en/`

- [ ] **Step 1: Confirm the current flow is inconsistent**

Run:

```bash
rg -n "translate-site|build-translated|HOLMEVANN_SKIP_TRANSLATION_HOOK|english_translation" Makefile netlify.toml README.md _plugins
```

Expected: PASS showing that `translate-site` exists, `build-translated` does not run translation, and a hook still auto-loads the translation script.

- [ ] **Step 2: Make `build-translated` the one explicit local entrypoint**

Update [`Makefile`](/Users/carlerik/dev/holmevann/Makefile) so:

```make
build-translated:
	asdf exec bundle exec jekyll build
	asdf exec bundle exec ruby scripts/translate_site.rb
```

Keep `translate-site` only if it remains useful as a standalone maintenance command. If it adds no operational value after this change, remove it in the same task.

- [ ] **Step 3: Make Netlify use the same explicit pipeline**

Update [`netlify.toml`](/Users/carlerik/dev/holmevann/netlify.toml) so the production build command matches the local explicit flow:

```toml
[build]
  command = "asdf exec bundle exec jekyll build && asdf exec bundle exec ruby scripts/translate_site.rb"
```

Do not add a second implicit translation path.

- [ ] **Step 4: Remove the hidden Jekyll hook**

Delete [`_plugins/english_translation.rb`](/Users/carlerik/dev/holmevann/_plugins/english_translation.rb) entirely if no remaining command path depends on it.

This also removes the need for `HOLMEVANN_SKIP_TRANSLATION_HOOK`.

- [ ] **Step 5: Update docs to match the real command path**

Update [`README.md`](/Users/carlerik/dev/holmevann/README.md) so local translated builds are documented via `make build-translated` or the equivalent explicit two-step command, not via hidden Jekyll side effects.

- [ ] **Step 6: Verify the explicit translated build end-to-end**

Run:

```bash
asdf exec bundle exec jekyll build
asdf exec bundle exec ruby scripts/translate_site.rb
test -f _site/en/index.html
test -f _site/en/sitemap.xml
```

Expected: PASS.

- [ ] **Step 7: Inspect the generated output directly**

Run:

```bash
rg -n 'hreflang="en"|href="/en/' _site/en/index.html _site/en/faq.html _site/en/rental/index.html
```

Expected: PASS with translated-link and hreflang output present.

- [ ] **Step 8: Commit the pipeline cleanup**

```bash
git add Makefile netlify.toml README.md
git rm _plugins/english_translation.rb
git commit -m "refactor: make translation build flow explicit"
```

### Task 4: Remove The Translation Provider Factory Layer

**Files:**

- Modify: `scripts/translate_site.rb`
- Delete: `scripts/lib/build_translation/providers.rb`
- Delete: `test/build_translation/provider_factory_test.rb`

- [ ] **Step 1: Confirm the provider factory only wraps one implementation**

Run:

```bash
rg -n "deepl_free|Providers.build|Unknown translation provider" scripts test
```

Expected: PASS showing one provider implementation and one factory test.

- [ ] **Step 2: Inline the concrete provider in the translation entrypoint**

Update [`scripts/translate_site.rb`](/Users/carlerik/dev/holmevann/scripts/translate_site.rb) to require the concrete client directly and instantiate:

```ruby
BuildTranslation::Providers::DeepLFreeClient.new(auth_key: auth_key)
```

Remove the factory call.

- [ ] **Step 3: Delete the unused factory layer**

Delete:

- [`scripts/lib/build_translation/providers.rb`](/Users/carlerik/dev/holmevann/scripts/lib/build_translation/providers.rb)
- [`test/build_translation/provider_factory_test.rb`](/Users/carlerik/dev/holmevann/test/build_translation/provider_factory_test.rb)

Do not touch `providers/client.rb` in this task if it still serves as a clear abstract interface for the concrete client.

- [ ] **Step 4: Run the Ruby tests**

Run:

```bash
asdf exec bundle exec ruby test/build_translation/cache_store_test.rb
asdf exec bundle exec ruby test/build_translation/html_extractor_test.rb
asdf exec bundle exec ruby test/build_translation/html_renderer_test.rb
asdf exec bundle exec ruby test/build_translation/link_mapper_test.rb
asdf exec bundle exec ruby test/build_translation/deepl_free_client_test.rb
asdf exec bundle exec ruby test/build_translation/site_translator_test.rb
```

Expected: PASS.

- [ ] **Step 5: Commit the dependency-graph cleanup**

```bash
git add scripts/translate_site.rb scripts/lib/build_translation/providers/client.rb scripts/lib/build_translation/providers/deepl_free_client.rb
git rm scripts/lib/build_translation/providers.rb test/build_translation/provider_factory_test.rb
git commit -m "refactor: inline translation provider wiring"
```

### Task 5: Remove Unused Translation Cache Metadata

**Files:**

- Modify: `scripts/lib/build_translation/cache_store.rb`
- Modify: `test/build_translation/cache_store_test.rb`
- Modify: `test/build_translation/site_translator_test.rb`
- Verify output: `_data/translations/en-cache.yml`

- [ ] **Step 1: Confirm `updated_at` is only written, not read**

Run:

```bash
rg -n "updated_at" scripts test
```

Expected: PASS showing writes and test assertions, but no operational reads.

- [ ] **Step 2: Remove `updated_at` from cache entries**

Update [`scripts/lib/build_translation/cache_store.rb`](/Users/carlerik/dev/holmevann/scripts/lib/build_translation/cache_store.rb) so `upsert` stores only:

```ruby
{
  "source_text" => source_text,
  "translated_text" => translated_text,
  "format" => format,
}
```

If this makes `require "time"` unnecessary, remove that require in the same change.

- [ ] **Step 3: Simplify the cache tests**

Update:

- [`test/build_translation/cache_store_test.rb`](/Users/carlerik/dev/holmevann/test/build_translation/cache_store_test.rb)
- [`test/build_translation/site_translator_test.rb`](/Users/carlerik/dev/holmevann/test/build_translation/site_translator_test.rb)

Remove expectations and fixture fields tied only to `updated_at`.

- [ ] **Step 4: Run the Ruby tests**

Run:

```bash
asdf exec bundle exec ruby test/build_translation/cache_store_test.rb
asdf exec bundle exec ruby test/build_translation/site_translator_test.rb
```

Expected: PASS.

- [ ] **Step 5: Regenerate the cache through the real pipeline and inspect it**

Run:

```bash
asdf exec bundle exec jekyll build
asdf exec bundle exec ruby scripts/translate_site.rb
rg -n "updated_at" _data/translations/en-cache.yml
```

Expected: build and translation pass, and the cache file no longer contains `updated_at`.

- [ ] **Step 6: Commit the cache schema cleanup**

```bash
git add scripts/lib/build_translation/cache_store.rb test/build_translation/cache_store_test.rb test/build_translation/site_translator_test.rb _data/translations/en-cache.yml
git commit -m "refactor: remove unused translation cache metadata"
```

### Task 6: Optional Follow-Up To Separate Analytics From Offline Runtime Utilities

**Files:**

- Modify: `assets/js/offline-runtime-utils.js`
- Create: `assets/js/google-analytics-runtime.js`
- Modify: `_includes/google-analytics.html`
- Modify: `test/offline-runtime-utils.test.js`
- Create: `test/google-analytics-runtime.test.js`

- [ ] **Step 1: Decide whether this separation is worth the extra file**

If the goal is only reducing code size or file count, skip this task. If the goal is clearer runtime ownership, continue.

- [ ] **Step 2: Move `loadGoogleAnalytics` into its own browser-only helper**

Create [`assets/js/google-analytics-runtime.js`](/Users/carlerik/dev/holmevann/assets/js/google-analytics-runtime.js) and move the DOM-specific analytics boot logic there.

Remove `loadGoogleAnalytics` from [`assets/js/offline-runtime-utils.js`](/Users/carlerik/dev/holmevann/assets/js/offline-runtime-utils.js).

- [ ] **Step 3: Update the include and tests**

Update [`_includes/google-analytics.html`](/Users/carlerik/dev/holmevann/_includes/google-analytics.html) to load the new file, then move the corresponding tests into a dedicated file.

- [ ] **Step 4: Run the JavaScript unit tests and build**

Run:

```bash
node --test test/*.test.js
asdf exec bundle exec jekyll build
```

Expected: PASS.

- [ ] **Step 5: Commit only if the resulting module split is still net simpler**

```bash
git add assets/js/offline-runtime-utils.js assets/js/google-analytics-runtime.js _includes/google-analytics.html test/offline-runtime-utils.test.js test/google-analytics-runtime.test.js
git commit -m "refactor: split analytics runtime from offline helpers"
```
