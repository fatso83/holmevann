# Repo for Holmevann
> [holmevann.kopseng.no](http://holmevann.kopseng.no)

Dette repoet inneholder hjemmesiden for hytta vår på Holmevann.
Her er både guider til hvordan man gjør diverse ting, dokumenter til apparater, tips og kanskje prosjektblogger med tiden.

Siden dette har drøyet litt for lenge med å materialisere seg så starter vi bare veldig 
enkelt med noen lenker og simple dokumenter. Med tiden blir det kanskje en Markdown-drevet site med offlinestøtte via Service Workers så man kan lese guidene uten dekning, men det er først når jeg får tid (lol).

## Building
Se [GitHub](https://help.github.com/articles/setting-up-your-github-pages-site-locally-with-jekyll/) for hvordan man installerer og bygger dette. Viktigste kommandoer er i hvertfall:
- `bundle install` (install dependencies)
- `bundle exec jekyll build` (deploy/prod build)
- `bundle exec jekyll serve --trace --livereload --host localhost` (development)

## Deploy
```
# Assumes a new production build has finished
git add .
git diff --staged
git commit 
git push
```

## Dependencies
- `apt-get install git-lfs # to avoid binary bloat` 
