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
