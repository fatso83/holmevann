# Build-Time English Translation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generer en offentlig engelsk versjon av hele siten under `/en/` ved build-tid, med innholdsbasert cache i `_data/translations/en-cache.yml` slik at bare nytt eller endret innhold oversettes på nytt, og med engelske tag-sider under `/en/tags/...`.

**Architecture:** Løsningen bygger først den eksisterende norske Jekyll-siten til `_site/`, og kjører deretter et Ruby-basert post-build-steg som parser generert HTML, oversetter translatable tekstsegmenter via en cached oversettelsesadapter, og skriver ferdige engelske HTML-filer til `_site/en/...`. Vanlige engelske sider speiler den norske outputstien, mens norske tag-sider under `/tagger/...` skrives som engelske sider under `/en/tags/...` med uendret slug. Cachen lagres i repoet, mens engelsk output forblir bygget artefakt og ikke kildeinnhold.

**Tech Stack:** Jekyll 4, Ruby 3.4 via `asdf`, Netlify build hooks, YAML cache under `_data/translations/`, HTML-parsing i Ruby, Minitest for enhetstester, eventuell `nokogiri`-dependency for DOM-transformasjon.

---

## Current Execution Order

The repo already has the provider abstraction and a concrete DeepL Free client:

- [`scripts/lib/build_translation/providers.rb`](/Users/carlerik/dev/holmevann/scripts/lib/build_translation/providers.rb)
- [`scripts/lib/build_translation/providers/client.rb`](/Users/carlerik/dev/holmevann/scripts/lib/build_translation/providers/client.rb)
- [`scripts/lib/build_translation/providers/deepl_free_client.rb`](/Users/carlerik/dev/holmevann/scripts/lib/build_translation/providers/deepl_free_client.rb)

To turn that into a working translated build, execute the remaining work in this order:

1. Add `_data/translations/en-cache.yml` and `scripts/lib/build_translation/cache_store.rb`
2. Add `scripts/translate_site.rb` as the real translation entrypoint
3. Add `scripts/lib/build_translation/html_extractor.rb`
4. Add `scripts/lib/build_translation/link_mapper.rb`
5. Add `scripts/lib/build_translation/html_renderer.rb`
6. Wire the components together in `scripts/translate_site.rb`
7. Generate `_site/en/...` output and `_site/en/sitemap.xml`
8. Make `make build-translated` pass end-to-end

### Task 1: Add Translation Build Plumbing And Empty Cache

**Files:**

- Create: `_data/translations/en-cache.yml`
- Modify: `netlify.toml`
- Modify: `Makefile`

- [ ] **Step 1: Add the failing check for missing translation cache and build hook**

Run:

```bash
test -f _data/translations/en-cache.yml
rg -n "translate_site|jekyll build" netlify.toml Makefile
```

Expected: FAIL because the cache file does not exist and no translation build step is wired yet.

- [ ] **Step 2: Create the empty cache file**

Create [`_data/translations/en-cache.yml`](/Users/carlerik/dev/holmevann/_data/translations/en-cache.yml) with:

```yaml
entries: {}
```

Keep the initial structure explicit so later code does not need to guess the root shape.

- [ ] **Step 3: Add a dedicated local translation command**

Update [`Makefile`](/Users/carlerik/dev/holmevann/Makefile) to add a target that runs:

```make
translate-en:
	asdf exec bundle exec ruby scripts/translate_site.rb
```

Do not yet modify existing dev targets in this step.

- [ ] **Step 4: Add the Netlify build command**

Update [`netlify.toml`](/Users/carlerik/dev/holmevann/netlify.toml) to keep the existing headers block and add a build command that runs:

```toml
[build]
  command = "asdf exec bundle exec jekyll build && asdf exec bundle exec ruby scripts/translate_site.rb"
  publish = "_site"
```

Do not add translation-specific environment variables inline in the file. Those belong in Netlify site settings.

- [ ] **Step 5: Verify the cache file and build hook now exist**

Run:

```bash
test -f _data/translations/en-cache.yml
rg -n "translate_site\\.rb|jekyll build" netlify.toml Makefile
```

Expected: PASS. The cache file exists and both Netlify and local command wiring reference the translation script.

- [ ] **Step 6: Commit the build plumbing**

```bash
git add _data/translations/en-cache.yml netlify.toml Makefile
git commit -m "chore: add english translation build plumbing"
```

### Task 2: Add Cache Store And Provider Skeleton With Tests

**Files:**

- Create: `scripts/translate_site.rb`
- Create: `scripts/lib/build_translation/cache_store.rb`
- Create: `scripts/lib/build_translation/providers/deepl_client.rb`
- Test: `test/build_translation/cache_store_test.rb`

- [ ] **Step 1: Write the failing cache-store test**

Create [`test/build_translation/cache_store_test.rb`](/Users/carlerik/dev/holmevann/test/build_translation/cache_store_test.rb) with tests that prove:

```ruby
require "minitest/autorun"
require "tmpdir"
require "yaml"
require_relative "../../scripts/lib/build_translation/cache_store"

class CacheStoreTest < Minitest::Test
  def test_reads_existing_entry_by_hash
    Dir.mktmpdir do |dir|
      path = File.join(dir, "en-cache.yml")
      File.write(path, { "entries" => { "abc" => { "translated_text" => "Hello" } } }.to_yaml)

      store = BuildTranslation::CacheStore.new(path:)

      assert_equal "Hello", store.lookup("abc")["translated_text"]
    end
  end

  def test_upsert_persists_new_entry
    Dir.mktmpdir do |dir|
      path = File.join(dir, "en-cache.yml")
      File.write(path, { "entries" => {} }.to_yaml)

      store = BuildTranslation::CacheStore.new(path:)
      store.upsert(
        hash: "abc",
        source_text: "Hei",
        translated_text: "Hello",
        format: "text"
      )
      store.save!

      saved = YAML.load_file(path)
      assert_equal "Hello", saved.fetch("entries").fetch("abc").fetch("translated_text")
    end
  end
end
```

- [ ] **Step 2: Run the cache-store test to verify it fails**

Run:

```bash
asdf exec bundle exec ruby test/build_translation/cache_store_test.rb
```

Expected: FAIL because the cache store class does not exist yet.

- [ ] **Step 3: Implement the cache store**

Create [`scripts/lib/build_translation/cache_store.rb`](/Users/carlerik/dev/holmevann/scripts/lib/build_translation/cache_store.rb):

```ruby
require "yaml"
require "fileutils"
require "time"

module BuildTranslation
  class CacheStore
    def initialize(path:)
      @path = path
      @data = File.exist?(path) ? YAML.load_file(path) : { "entries" => {} }
      @data["entries"] ||= {}
    end

    def lookup(hash)
      @data.fetch("entries").fetch(hash, nil)
    end

    def upsert(hash:, source_text:, translated_text:, format:)
      @data.fetch("entries")[hash] = {
        "source_text" => source_text,
        "translated_text" => translated_text,
        "format" => format,
        "updated_at" => Time.now.utc.iso8601,
      }
    end

    def save!
      FileUtils.mkdir_p(File.dirname(@path))
      File.write(@path, YAML.dump(@data))
    end
  end
end
```

- [ ] **Step 4: Add a provider skeleton**

Create [`scripts/lib/build_translation/providers/deepl_client.rb`](/Users/carlerik/dev/holmevann/scripts/lib/build_translation/providers/deepl_client.rb) with a minimal adapter surface:

```ruby
module BuildTranslation
  module Providers
    class DeepLClient
      def initialize(auth_key:)
        @auth_key = auth_key
      end

      def translate_text(_text, format:)
        raise NotImplementedError, "DeepL translation not implemented yet for format=#{format}"
      end
    end
  end
end
```

Keep the interface tiny. The real HTTP logic comes later.

- [ ] **Step 5: Add a runnable script entrypoint that only loads dependencies**

Create [`scripts/translate_site.rb`](/Users/carlerik/dev/holmevann/scripts/translate_site.rb) with:

```ruby
$LOAD_PATH.unshift(File.expand_path("lib", __dir__))

require "build_translation/cache_store"
require "build_translation/providers/deepl_client"

abort "translate_site.rb not implemented yet"
```

- [ ] **Step 6: Run the cache-store test again**

Run:

```bash
asdf exec bundle exec ruby test/build_translation/cache_store_test.rb
```

Expected: PASS.

- [ ] **Step 7: Commit the cache foundation**

```bash
git add scripts/translate_site.rb scripts/lib/build_translation/cache_store.rb scripts/lib/build_translation/providers/deepl_client.rb test/build_translation/cache_store_test.rb
git commit -m "feat: add translation cache foundation"
```

### Task 3: Extract Translatable HTML Units With Hashing

**Files:**

- Create: `scripts/lib/build_translation/html_extractor.rb`
- Test: `test/build_translation/html_extractor_test.rb`
- Modify: `Gemfile` if an HTML parser dependency is required

- [ ] **Step 1: Write the failing extractor test**

Create [`test/build_translation/html_extractor_test.rb`](/Users/carlerik/dev/holmevann/test/build_translation/html_extractor_test.rb) with a realistic HTML sample proving that the extractor:

- returns visible text nodes
- returns supported attributes like `alt` and `placeholder`
- ignores script contents and URL attributes
- computes stable hashes for identical text

Use a sample like:

```ruby
html = <<~HTML
  <html lang="no">
    <body>
      <h1>Velkommen</h1>
      <img alt="Header image" src="/assets/img/header-img.jpg">
      <input placeholder="Skriv inn det du er interessert i">
      <script>console.log("do not translate me")</script>
    </body>
  </html>
HTML
```

- [ ] **Step 2: Run the extractor test to verify it fails**

Run:

```bash
asdf exec bundle exec ruby test/build_translation/html_extractor_test.rb
```

Expected: FAIL because the extractor does not exist yet.

- [ ] **Step 3: Add the HTML parser dependency if needed**

If Ruby stdlib parsing is not robust enough for real HTML, add `nokogiri` to [`Gemfile`](/Users/carlerik/dev/holmevann/Gemfile) and run:

```bash
pnpm --version
```

Do not use Node tooling here. Stay inside the repo’s Ruby toolchain.

Then install/update gems with:

```bash
asdf exec bundle install
```

- [ ] **Step 4: Implement the extractor**

Create [`scripts/lib/build_translation/html_extractor.rb`](/Users/carlerik/dev/holmevann/scripts/lib/build_translation/html_extractor.rb) that:

- parses HTML into a DOM
- walks translatable text nodes
- walks supported attributes
- normalizes whitespace before hashing
- computes a stable hash from normalized source text plus `format`

Expose a method shaped roughly like:

```ruby
def extract_units(html)
  [
    { hash: "...", text: "Velkommen", format: "text", kind: :text, path: [...] },
    { hash: "...", text: "Header image", format: "text", kind: :attribute, attribute: "alt", path: [...] }
  ]
end
```

- [ ] **Step 5: Run the extractor test again**

Run:

```bash
asdf exec bundle exec ruby test/build_translation/html_extractor_test.rb
```

Expected: PASS.

- [ ] **Step 6: Commit the extraction layer**

```bash
git add Gemfile Gemfile.lock scripts/lib/build_translation/html_extractor.rb test/build_translation/html_extractor_test.rb
git commit -m "feat: extract translatable html units"
```

### Task 4: Render English HTML And Rewrite Internal Links

**Files:**

- Create: `scripts/lib/build_translation/link_mapper.rb`
- Create: `scripts/lib/build_translation/html_renderer.rb`
- Test: `test/build_translation/link_mapper_test.rb`
- Test: `test/build_translation/html_renderer_test.rb`

- [ ] **Step 1: Write the failing link-mapper test**

Create [`test/build_translation/link_mapper_test.rb`](/Users/carlerik/dev/holmevann/test/build_translation/link_mapper_test.rb) with assertions like:

```ruby
assert_equal "/en/faq.html", mapper.english_href_for("/faq.html")
assert_equal "/en/rental/", mapper.english_href_for("/rental/")
assert_equal "/en/tags/fisk/", mapper.english_href_for("/tagger/fisk/")
assert_equal "/assets/main.css", mapper.english_href_for("/assets/main.css")
assert_equal "https://example.com", mapper.english_href_for("https://example.com")
```

- [ ] **Step 2: Write the failing renderer test**

Create [`test/build_translation/html_renderer_test.rb`](/Users/carlerik/dev/holmevann/test/build_translation/html_renderer_test.rb) that proves the renderer:

- replaces translated text
- sets `lang="en"`
- rewrites canonical to `/en/...`
- rewrites internal HTML links to `/en/...`
- leaves assets and external URLs alone

- [ ] **Step 3: Run both tests to verify they fail**

Run:

```bash
asdf exec bundle exec ruby test/build_translation/link_mapper_test.rb
asdf exec bundle exec ruby test/build_translation/html_renderer_test.rb
```

Expected: FAIL because neither class exists yet.

- [ ] **Step 4: Implement the link mapper**

Create [`scripts/lib/build_translation/link_mapper.rb`](/Users/carlerik/dev/holmevann/scripts/lib/build_translation/link_mapper.rb) that knows:

- which built `.html` or directory URLs receive an `/en` twin
- the special-case mapping from `/tagger/<slug>/` to `/en/tags/<slug>/`
- which URLs are same-origin assets and must stay untouched
- which URLs are external and must stay untouched

The mapper should operate on built output paths, not source paths.

- [ ] **Step 5: Implement the HTML renderer**

Create [`scripts/lib/build_translation/html_renderer.rb`](/Users/carlerik/dev/holmevann/scripts/lib/build_translation/html_renderer.rb) that:

- applies translated units back into the DOM
- sets `html[lang="en"]`
- rewrites supported internal links with the mapper
- updates canonical
- injects `hreflang` alternates if they are missing

- [ ] **Step 6: Run both tests again**

Run:

```bash
asdf exec bundle exec ruby test/build_translation/link_mapper_test.rb
asdf exec bundle exec ruby test/build_translation/html_renderer_test.rb
```

Expected: PASS.

- [ ] **Step 7: Commit the rendering layer**

```bash
git add scripts/lib/build_translation/link_mapper.rb scripts/lib/build_translation/html_renderer.rb test/build_translation/link_mapper_test.rb test/build_translation/html_renderer_test.rb
git commit -m "feat: render english html output"
```

### Task 5: Implement DeepL Translation And Cache-Backed Site Walk

**Files:**

- Modify: `scripts/lib/build_translation/providers/deepl_client.rb`
- Modify: `scripts/translate_site.rb`
- Test: `test/build_translation/translate_site_test.rb`

- [ ] **Step 1: Write the failing site-walk test**

Create [`test/build_translation/translate_site_test.rb`](/Users/carlerik/dev/holmevann/test/build_translation/translate_site_test.rb) that uses a temporary fake `_site/` tree and a fake translator object to prove:

- a Norwegian `_site/index.html` produces `_site/en/index.html`
- repeated text only causes one translation call
- cache hits skip translation calls on the second run

The fake translator should count calls so the test can assert the cache behavior directly.

- [ ] **Step 2: Run the site-walk test to verify it fails**

Run:

```bash
asdf exec bundle exec ruby test/build_translation/translate_site_test.rb
```

Expected: FAIL because the orchestration logic is not implemented yet.

- [ ] **Step 3: Implement the DeepL client**

Replace the provider skeleton in [`scripts/lib/build_translation/providers/deepl_client.rb`](/Users/carlerik/dev/holmevann/scripts/lib/build_translation/providers/deepl_client.rb) with a real HTTP client that:

- reads auth key from `ENV["DEEPL_AUTH_KEY"]`
- sends text translation requests to DeepL
- supports the formats needed by the extractor/renderer
- raises clear errors on non-success responses

Keep the HTTP code in this class only.

- [ ] **Step 4: Implement the translation script orchestration**

Expand [`scripts/translate_site.rb`](/Users/carlerik/dev/holmevann/scripts/translate_site.rb) so it:

- finds built HTML files under `_site/`
- skips `_site/en/`
- extracts translatable units
- resolves cache hits
- batches cache misses when practical
- asks the provider to translate misses
- stores new entries in `_data/translations/en-cache.yml`
- renders and writes `_site/en/...` output

- [ ] **Step 5: Run the site-walk test again**

Run:

```bash
asdf exec bundle exec ruby test/build_translation/translate_site_test.rb
```

Expected: PASS.

- [ ] **Step 6: Run the full unit test set**

Run:

```bash
asdf exec bundle exec ruby test/build_translation/cache_store_test.rb
asdf exec bundle exec ruby test/build_translation/html_extractor_test.rb
asdf exec bundle exec ruby test/build_translation/link_mapper_test.rb
asdf exec bundle exec ruby test/build_translation/html_renderer_test.rb
asdf exec bundle exec ruby test/build_translation/translate_site_test.rb
```

Expected: PASS.

- [ ] **Step 7: Commit the translation engine**

```bash
git add scripts/translate_site.rb scripts/lib/build_translation/providers/deepl_client.rb test/build_translation/translate_site_test.rb
git commit -m "feat: add cached deepl site translation"
```

### Task 6: Generate English Sitemap And Verify Real Site Output

**Files:**

- Modify: `scripts/translate_site.rb`
- Verify output: `_site/en/index.html`
- Verify output: `_site/en/faq.html`
- Verify output: `_site/en/rental/index.html`
- Verify output: `_site/en/tags/`
- Verify output: `_site/en/sitemap.xml`

- [ ] **Step 1: Add the failing verification for missing English output**

Run:

```bash
asdf exec bundle exec jekyll build
test -f _site/en/index.html
```

Expected: FAIL because the translation script has not yet been run in this verification step.

- [ ] **Step 2: Run the translation build end-to-end**

Run:

```bash
asdf exec bundle exec jekyll build
asdf exec bundle exec ruby scripts/translate_site.rb
```

Expected: PASS.

- [ ] **Step 3: Add english sitemap generation if not already present**

If [`scripts/translate_site.rb`](/Users/carlerik/dev/holmevann/scripts/translate_site.rb) does not yet create one, extend it to emit `_site/en/sitemap.xml` covering the generated English HTML pages.

- [ ] **Step 4: Verify the real generated output**

Run:

```bash
test -f _site/en/index.html
test -f _site/en/faq.html
test -f _site/en/rental/index.html
test -f _site/en/sitemap.xml
rg -n 'lang="en"' _site/en/index.html _site/en/faq.html
find _site/en/tags -name index.html | head -1
rg -n '/en/faq|/en/important|/en/rental|/en/tags/' _site/en/index.html _site/en/2026/03/30/neverending-story.html
```

Expected: PASS. The generated files exist, advertise `lang="en"`, and internal navigation points at English HTML pages, including the `/en/tags/...` special case for translated tag links.

- [ ] **Step 5: Verify cache reuse on a second run**

Run:

```bash
cp _data/translations/en-cache.yml /tmp/en-cache-before.yml
asdf exec bundle exec ruby scripts/translate_site.rb
cmp -s /tmp/en-cache-before.yml _data/translations/en-cache.yml
```

Expected: PASS when no source content changed. The second run should not rewrite the cache file.

- [ ] **Step 6: Commit the end-to-end output support**

```bash
git add scripts/translate_site.rb _data/translations/en-cache.yml
git commit -m "feat: generate english site output"
```

### Task 7: Document Required Environment And Operating Model

**Files:**

- Modify: `README.md`
- Reference: `netlify.toml`
- Reference: `_data/translations/en-cache.yml`

- [ ] **Step 1: Add the failing docs check**

Run:

```bash
rg -n "DEEPL_AUTH_KEY|translate-en|/en/" README.md
```

Expected: FAIL because the README does not yet document the translation pipeline.

- [ ] **Step 2: Update the README**

Add a short section to [`README.md`](/Users/carlerik/dev/holmevann/README.md) covering:

- that Norwegian remains canonical source content
- that English is generated at build time under `/en/`
- that cache lives in `_data/translations/en-cache.yml`
- that the required secret is `DEEPL_AUTH_KEY`
- how to run `make translate-en` locally after a build

- [ ] **Step 3: Verify the docs update**

Run:

```bash
rg -n "DEEPL_AUTH_KEY|translate-en|_data/translations/en-cache.yml|/en/" README.md
```

Expected: PASS.

- [ ] **Step 4: Commit the docs**

```bash
git add README.md
git commit -m "docs: explain english translation build"
```
