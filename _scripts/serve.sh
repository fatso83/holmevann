#!/bin/bash

find docs -type f -exec git update-index --assume-unchanged {} \; 2>/dev/null
bundle exec jekyll serve


