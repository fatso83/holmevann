# Repository Instructions

## Ruby

- This repo uses `asdf` for Ruby version selection.
- Expected Ruby version is defined in [`.tool-versions`](/Users/carlerik/dev/holmevann/.tool-versions) and is currently `3.4.8`.
- Verify that `asdf` sees the correct version with `asdf current ruby`.
- Prefer `asdf exec bundle exec ...` for repo commands so you do not accidentally hit macOS system Ruby.
- Example build command: `asdf exec bundle exec jekyll build`
- Example local dev command: `asdf exec bundle exec jekyll serve`

## Notes

- On this machine, plain `ruby` and `bundle` may resolve to `/usr/bin/*` and use system Ruby `2.6`, which does not match the repo setup.

## Verification

- If a change affects generated site output, service worker behavior, translation output, translation caches, or other build/runtime pipeline artifacts, do not stop at unit tests alone.
- In those cases, verification must include the real end-to-end command path that produces the affected artifacts.
- For site output changes, run `asdf exec bundle exec jekyll build`.
- For translation pipeline changes, run `asdf exec bundle exec ruby scripts/translate_site.rb` after a fresh build.
- When the bug surface is in generated files or caches, inspect the resulting `_site/` output and/or `_data/translations/en-cache.yml` directly and report that evidence.
