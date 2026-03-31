#!/usr/bin/env bash

set -euo pipefail

node --test test/*.test.js

if command -v asdf >/dev/null 2>&1; then
  asdf exec bundle install
  asdf exec bundle exec jekyll build
else
  bundle install
  bundle exec jekyll build
fi
