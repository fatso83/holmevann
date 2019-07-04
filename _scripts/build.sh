#!/bin/bash

find docs -type f | xargs git update-index --no-assume-unchanged 2>/dev/null
bundle exec jekyll build
find docs -type f | git add -f
find docs -type f | xargs git update-index --no-assume-unchanged 2>/dev/null

