# Just check out https://makefile.site

# otherwise Make assumes that all install targets are files & folders
.PHONY: install deploy livereload build build-translated translate-site help list-targets install-git-lfs check-dependencies install-precommit

help: 
	@make print S="These are the possible make targets you can invoke"
	@make list-targets

install: 
	bundle install
	@make install-precommit
	@make install-git-lfs
	@# this is just to get the output as the final line
	@make check-dependencies
	./chrome-devtools.sh

check-dependencies: 
	@command -v git-lfs > /dev/null || (make print S="You need to install Git LFS before committing changes" && exit 1)

install-git-lfs:
	@command -v git-lfs > /dev/null || (make print S="Git LFS is required. Install it before running 'make install'" && exit 1)
	@git lfs install --local --skip-repo > /dev/null || (make print S="Failed to run 'git lfs install --local --skip-repo'. Fix Git LFS and rerun 'make install'" && exit 1)

deploy: check-dependencies
	git push

livereload:
	JEKYLL_ENV=development asdf exec bundle exec jekyll serve -w --trace --livereload --host localhost --config _config.yml,_config_dev.yml

netlify-dev:
	# JEKYLL_ENV is supplied by Netlify's environment config.
	# Configure the development-context value with `netlify env:set` so netlify dev
	# does not inherit the production value from the project settings.
	netlify dev -c "asdf exec bundle exec jekyll serve -w --trace --host localhost --config _config.yml,_config_dev.yml,_config_netlify_dev.yml" --target-port 4000 --no-open

install-precommit:
	cp pre-commit pre-push .git/hooks/

# only for checking out the final build
build:
	asdf exec bundle exec jekyll build

translate-site:
	@test -f scripts/translate_site.rb || (make print S="Missing scripts/translate_site.rb. Implement the translation pipeline before using this target." && exit 1)
	asdf exec bundle exec ruby scripts/translate_site.rb

build-translated: build

### UTILS ###

#https://stackoverflow.com/a/26339924/200987
list-targets: 
	@LC_ALL=C $(MAKE) -pRrq -f $(firstword $(MAKEFILE_LIST)) : 2>/dev/null | awk -v RS= -F: '/(^|\n)# Files(\n|$$)/,/(^|\n)# Finished Make data base/ {if ($$1 !~ "^[#.]") {print $$1}}' | sort | grep -E -v -e '^[^[:alnum:]]' -e '^$@$$' | grep -v print

print:
	@printf "\033[01;35m%s\033[00m\n" "$(S)"
