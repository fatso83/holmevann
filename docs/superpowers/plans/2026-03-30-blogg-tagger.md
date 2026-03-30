# Bloggtagger Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Legg til tagger på bloggposter via front matter, generer en statisk side per tag på `/tagger/<slug>/`, og vis klikkbare tag-lenker på hver post.

**Architecture:** Løsningen bygges som en liten Jekyll-generator i `_plugins/` som leser `tags` fra `site.posts`, normaliserer verdiene, og registrerer én virtuell side per tag. En egen tag-layout renderer postlisten for én tag, mens eksisterende post-layout utvides med klikkbare tag-lenker som peker til de genererte sidene.

**Tech Stack:** Jekyll 4, Liquid, Ruby plugins i `_plugins/`, Minima-layouts, Sass, lokal verifisering via `bundle exec jekyll build` og `http://localhost:4000`.

---

### Task 1: Seed Representative Tag Data In Posts

**Files:**

- Modify: `_posts/2026-03-30-vannpumpe.md:1-6`
- Modify: `_posts/2026-03-30-neverending-story.md:1-9`
- Modify: `_posts/2025-02-05-nedetid.md:1-5`

- [ ] **Step 1: Add representative tags to one post that currently has none**

Update [`_posts/2026-03-30-vannpumpe.md`](/Users/carlerik/dev/holmevann/_posts/2026-03-30-vannpumpe.md#L1) so the front matter becomes:

```yaml
---
layout: post
title: "2024 #latergram: nedsenket pumpe"
date: 2026-03-30 12:20:00 +0200
tags:
  - vann
  - strøm
  - vinterdrift
Xexcerpt: En lang og strabasiøs ferd for smooth påfylling
---
```

- [ ] **Step 2: Normalize the existing inline tag syntax into a YAML list**

Update [`_posts/2026-03-30-neverending-story.md`](/Users/carlerik/dev/holmevann/_posts/2026-03-30-neverending-story.md#L1) so the single-line `tags:` value becomes a real YAML list and includes one tag with a space:

```yaml
tags:
  - arduino
  - lora
  - diy
  - strøm
  - hjemmeautomasjon
  - framtidige prosjekter
```

Remove or rename the old English/raw variants (`220v`, `homeautomation`, `lte-m`, `shelly`) only if they do not serve the intended taxonomy. Keep the list small and intentional.

- [ ] **Step 3: Add tags to a second post so at least one tag page has multiple posts**

Update [`_posts/2025-02-05-nedetid.md`](/Users/carlerik/dev/holmevann/_posts/2025-02-05-nedetid.md#L1) with:

```yaml
tags:
  - vinterdrift
  - utleie
  - tak
```

This creates an initial shared tag (`vinterdrift`) across multiple posts.

- [ ] **Step 4: Run the first failing integration check**

Run:

```bash
bundle exec jekyll build >/tmp/jekyll-tags-build.log && test -f _site/tagger/strom/index.html
```

Expected: FAIL because the site can build, but `_site/tagger/strom/index.html` does not exist yet.

- [ ] **Step 5: Commit the post fixture setup**

```bash
git add _posts/2026-03-30-vannpumpe.md _posts/2026-03-30-neverending-story.md _posts/2025-02-05-nedetid.md
git commit -m "test: add representative blog tags"
```

### Task 2: Generate Static Tag Pages During Jekyll Build

**Files:**

- Create: `_plugins/tag_pages.rb`
- Modify: `_config.yml` only if plugin loading requires explicit config, otherwise leave it untouched

- [ ] **Step 1: Create the failing implementation target**

Create [`_plugins/tag_pages.rb`](/Users/carlerik/dev/holmevann/_plugins/tag_pages.rb) with a minimal skeleton that Jekyll loads, but that does not yet emit pages:

```ruby
module Holmevann
  class TagPagesGenerator < Jekyll::Generator
    safe true
    priority :low

    def generate(site)
    end
  end
end
```

Run:

```bash
bundle exec jekyll build >/tmp/jekyll-tags-build.log && test -f _site/tagger/strom/index.html
```

Expected: FAIL because the generator is loaded but still creates no tag pages.

- [ ] **Step 2: Implement normalization helpers and a generated page type**

Replace the skeleton with a complete generator using `Jekyll::PageWithoutAFile`:

```ruby
module Holmevann
  class TagPage < Jekyll::PageWithoutAFile
    def initialize(site:, base:, dir:, tag_name:, posts:)
      @site = site
      @base = base
      @dir = dir
      @name = "index.html"

      process(@name)
      read_yaml(File.join(base, "_layouts"), "tag.html")
      data["title"] = "Tag: #{tag_name}"
      data["tag_name"] = tag_name
      data["posts"] = posts
      data["permalink"] = "/#{dir}/"
    end
  end

  class TagPagesGenerator < Jekyll::Generator
    safe true
    priority :low

    def generate(site)
      grouped_posts(site).each_value do |entry|
        site.pages << TagPage.new(
          site: site,
          base: site.source,
          dir: File.join("tagger", entry[:slug]),
          tag_name: entry[:name],
          posts: entry[:posts]
        )
      end
    end

    private

    def grouped_posts(site)
      site.posts.docs.each_with_object({}) do |post, acc|
        raw_tags(post).each do |tag_name|
          slug = Jekyll::Utils.slugify(tag_name, mode: "latin")
          next if slug.empty?

          acc[slug] ||= { name: tag_name, slug: slug, posts: [] }
          acc[slug][:posts] << post unless acc[slug][:posts].include?(post)
        end
      end
    end

    def raw_tags(post)
      value = post.data["tags"]
      values = value.is_a?(Array) ? value : Array(value)

      values
        .map { |tag| tag.to_s.strip }
        .reject(&:empty?)
        .uniq { |tag| Jekyll::Utils.slugify(tag.downcase, mode: "latin") }
    end
  end
end
```

- [ ] **Step 3: Build and verify the generated files exist**

Run:

```bash
bundle exec jekyll build >/tmp/jekyll-tags-build.log
test -f _site/tagger/strom/index.html
test -f _site/tagger/vinterdrift/index.html
test -f _site/tagger/framtidige-prosjekter/index.html
```

Expected: PASS. All three generated pages should exist.

- [ ] **Step 4: Commit the generator**

```bash
git add _plugins/tag_pages.rb
git commit -m "feat: generate static tag pages"
```

### Task 3: Render Tag Pages And Link Tags From Blog Posts

**Files:**

- Create: `_layouts/tag.html`
- Modify: `_layouts/post.html:10-35`
- Reference: `_layouts/home.html:8-29`

- [ ] **Step 1: Add the tag page layout**

Create [`_layouts/tag.html`](/Users/carlerik/dev/holmevann/_layouts/tag.html) by reusing the post-list structure from [`_layouts/home.html`](/Users/carlerik/dev/holmevann/_layouts/home.html#L8):

```html
---
layout: default
---

<article class="post">
  <header class="post-header">
    <h1 class="post-title">{{ page.title | escape }}</h1>
  </header>

  <ul class="post-list">
    {%- assign date_format = site.minima.date_format | default: "%b %-d, %Y" -%}
    {%- for post in page.posts -%}
    <li>
      <span class="post-meta">{{ post.date | date: date_format }}</span>
      <h3>
        <a class="post-link" href="{{ post.url | relative_url }}">
          {{ post.title | escape }}
        </a>
      </h3>
      {%- if site.show_excerpts -%} {{ post.excerpt }}
      <a href="{{ post.url | relative_url }}">(Les mer)</a>
      {%- endif -%}
    </li>
    {%- endfor -%}
  </ul>
</article>
```

- [ ] **Step 2: Add tag links to the post layout**

Modify [`_layouts/post.html`](/Users/carlerik/dev/holmevann/_layouts/post.html#L10) so tags render right below the existing `<p class="post-meta">`:

```liquid
    {%- if page.tags and page.tags.size > 0 -%}
    <p class="post-tags">
      {%- for tag in page.tags -%}
      {%- assign tag_slug = tag | downcase | slugify: "latin" -%}
      <a class="tag-link" href="{{ '/tagger/' | append: tag_slug | append: '/' | relative_url }}">
        #{{ tag }}
      </a>
      {%- endfor -%}
    </p>
    {%- endif -%}
```

- [ ] **Step 3: Run the first content check for generated HTML**

Run:

```bash
bundle exec jekyll build >/tmp/jekyll-tags-build.log
rg -n "Tag: strøm|2024 #latergram: nedsenket pumpe|Neverending Story" _site/tagger/strom/index.html
rg -n "/tagger/strom/|/tagger/vinterdrift/" _site/2026/03/30/vannpumpe.html
```

Expected: PASS. The tag page should list the correct posts, and the post page should contain clickable tag URLs.

- [ ] **Step 4: Commit the layouts**

```bash
git add _layouts/tag.html _layouts/post.html
git commit -m "feat: render blog tags in pages and posts"
```

### Task 4: Add Minimal Styling For Tag Links

**Files:**

- Modify: `assets/main.scss:157-193`

- [ ] **Step 1: Add minimal styles for the tag section**

Append styles to [`assets/main.scss`](/Users/carlerik/dev/holmevann/assets/main.scss#L157):

```scss
.post-tags {
  margin-top: -0.5rem;
  margin-bottom: 1rem;
}

.tag-link {
  display: inline-block;
  margin-right: 0.5rem;
  margin-bottom: 0.35rem;
  padding: 0.15rem 0.45rem;
  border-radius: 999px;
  background: #f2f4f7;
  color: #1f2937;
  text-decoration: none;
}

.tag-link:hover,
.tag-link:focus {
  background: #e5e7eb;
  text-decoration: underline;
}
```

- [ ] **Step 2: Build and verify that the CSS is compiled**

Run:

```bash
bundle exec jekyll build >/tmp/jekyll-tags-build.log
rg -n "\\.post-tags|\\.tag-link" _site/assets/main.css
```

Expected: PASS. The generated CSS should include both selectors.

- [ ] **Step 3: Commit the styling**

```bash
git add assets/main.scss
git commit -m "style: add blog tag link styling"
```

### Task 5: Validate The Feature End-To-End On Localhost

**Files:**

- Verify: `_site/tagger/strom/index.html`
- Verify: `_site/tagger/vinterdrift/index.html`
- Verify: `_site/tagger/framtidige-prosjekter/index.html`
- Verify: `_site/2026/03/30/vannpumpe.html`
- Verify: `_site/2025/02/05/nedetid.html` or equivalent generated post path
- Reference: `Makefile:23-24`

- [ ] **Step 1: Ensure the local Jekyll server is running on port 4000**

If it is not already running, start it in a separate terminal:

```bash
make livereload
```

Expected: PASS. Jekyll serves the site on `http://localhost:4000`.

- [ ] **Step 2: Verify HTTP 200 for the key tag pages**

Run:

```bash
curl -I http://localhost:4000/tagger/strom/
curl -I http://localhost:4000/tagger/vinterdrift/
curl -I http://localhost:4000/tagger/framtidige-prosjekter/
```

Expected: PASS. Each response should return `HTTP/1.1 200 OK`.

- [ ] **Step 3: Verify localhost page content over HTTP**

Run:

```bash
curl -s http://localhost:4000/tagger/strom/ | rg "2024 #latergram: nedsenket pumpe|Neverending Story"
curl -s http://localhost:4000/tagger/vinterdrift/ | rg "2024 #latergram: nedsenket pumpe|Hvorfor hytta ikke er tilgjengelig for utleie"
curl -s http://localhost:4000/tagger/framtidige-prosjekter/ | rg "Neverending Story"
curl -s http://localhost:4000/2026/03/30/vannpumpe.html | rg "/tagger/strom/|/tagger/vinterdrift/"
```

Expected: PASS. The tag pages should list the expected posts, and the post page should contain working tag links.

- [ ] **Step 4: Do one manual browser check**

Open `http://localhost:4000/2026/03/30/vannpumpe.html` in a browser and manually confirm:

- the post shows the tag pills
- clicking `#strøm` lands on `/tagger/strom/`
- the tag page is readable and uses the normal site chrome

- [ ] **Step 5: Run a clean final build before handoff**

Run:

```bash
bundle exec jekyll build
```

Expected: PASS with no Liquid or plugin errors.

- [ ] **Step 6: Commit the finished feature**

```bash
git add _posts _plugins/tag_pages.rb _layouts/tag.html _layouts/post.html assets/main.scss
git commit -m "feat: add static blog tag pages"
```
