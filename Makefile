# Just check out https://makefile.site

# otherwise Make assumes that all install targets are files & folders
.PHONY: install deploy livereload build help list-targets

help: 
	@make print S="These are the possible make targets you can invoke"
	@make list-targets

install: 
	bundle install
	@# this is just to get the output as the final line
	@make check-dependencies

check-dependencies: 
	@command -v git-lfs > /dev/null || (make print S="You need to install Git LFS before committing changes" && exit 1)

deploy: check-dependencies
	git push

livereload:
	bundle exec jekyll serve --trace --livereload --host localhost

install-precommit:
	cp pre-commit .git/hooks/

# only for checking out the final build
# # only for checking out the final build
build:
	bundle exec jekyll build

### UTILS ###

#https://stackoverflow.com/a/26339924/200987
list-targets: 
	@LC_ALL=C $(MAKE) -pRrq -f $(firstword $(MAKEFILE_LIST)) : 2>/dev/null | awk -v RS= -F: '/(^|\n)# Files(\n|$$)/,/(^|\n)# Finished Make data base/ {if ($$1 !~ "^[#.]") {print $$1}}' | sort | grep -E -v -e '^[^[:alnum:]]' -e '^$@$$' | grep -v print

print:
	@printf "\033[01;35m%s\033[00m\n" "$(S)"

