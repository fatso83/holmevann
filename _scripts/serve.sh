#!/bin/bash

find docs -type f | xargs git update-index --assume-unchanged 2>/dev/null
bundle exec jekyll serve


