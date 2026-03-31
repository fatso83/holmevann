$LOAD_PATH.unshift(File.expand_path("lib", __dir__))

require "yaml"

require "build_translation/cache_store"
require "build_translation/html_extractor"
require "build_translation/html_renderer"
require "build_translation/link_mapper"
require "build_translation/providers"
require "build_translation/site_translator"

auth_key = ENV["DEEPL_AUTH_KEY"]

site_config = YAML.load_file(File.expand_path("../_config.yml", __dir__)) || {}
site_url = site_config.fetch("url", "https://www.holmevann.no")
build_dir = File.expand_path("../_site", __dir__)
cache_path = File.expand_path("../_data/translations/en-cache.yml", __dir__)

link_mapper = BuildTranslation::LinkMapper.new(site_url: site_url)

BuildTranslation::SiteTranslator.new(
  build_dir: build_dir,
  cache_store: BuildTranslation::CacheStore.new(path: cache_path),
  extractor: BuildTranslation::HtmlExtractor.new,
  renderer: BuildTranslation::HtmlRenderer.new(link_mapper: link_mapper),
  link_mapper: link_mapper,
  provider: BuildTranslation::Providers.build(
    provider_name: "deepl_free",
    auth_key: auth_key,
  ),
).run
