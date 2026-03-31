require "fileutils"
require "minitest/autorun"
require "tmpdir"

require_relative "../../scripts/lib/build_translation/cache_store"
require_relative "../../scripts/lib/build_translation/html_extractor"
require_relative "../../scripts/lib/build_translation/html_renderer"
require_relative "../../scripts/lib/build_translation/link_mapper"
require_relative "../../scripts/lib/build_translation/site_translator"

class SiteTranslatorTest < Minitest::Test
  FakeProvider = Struct.new(:calls) do
    def translate_texts(texts:, target_lang:, source_lang: nil)
      calls << {
        texts: texts,
        target_lang: target_lang,
        source_lang: source_lang,
      }

      {
        "translations" => texts.map do |text|
          { "text" => "EN: #{text}" }
        end,
      }
    end
  end

  def test_generates_english_site_and_reuses_cache
    Dir.mktmpdir do |dir|
      build_dir = File.join(dir, "_site")
      cache_path = File.join(dir, "_data", "translations", "en-cache.yml")
      FileUtils.mkdir_p(File.join(build_dir, "tagger", "fisk"))

      File.write(
        File.join(build_dir, "index.html"),
        <<~HTML,
          <!DOCTYPE html>
          <html lang="no">
            <head>
              <title>Velkommen</title>
              <link rel="canonical" href="https://www.holmevann.no/">
            </head>
            <body>
              <h1>Velkommen</h1>
              <a href="/tagger/fisk/">#fisk</a>
            </body>
          </html>
        HTML
      )
      File.write(
        File.join(build_dir, "tagger", "fisk", "index.html"),
        <<~HTML,
          <!DOCTYPE html>
          <html lang="no">
            <head>
              <title>Tag: fisk</title>
              <link rel="canonical" href="https://www.holmevann.no/tagger/fisk/">
            </head>
            <body>
              <h1>Tag: fisk</h1>
              <a href="/">Til forsiden</a>
            </body>
          </html>
        HTML
      )

      provider = FakeProvider.new([])
      translator = BuildTranslation::SiteTranslator.new(
        build_dir: build_dir,
        cache_store: BuildTranslation::CacheStore.new(path: cache_path),
        extractor: BuildTranslation::HtmlExtractor.new,
        renderer: BuildTranslation::HtmlRenderer.new(
          link_mapper: BuildTranslation::LinkMapper.new(site_url: "https://www.holmevann.no"),
        ),
        link_mapper: BuildTranslation::LinkMapper.new(site_url: "https://www.holmevann.no"),
        provider: provider,
      )

      translator.run

      assert File.exist?(File.join(build_dir, "en", "index.html"))
      assert File.exist?(File.join(build_dir, "en", "tags", "fisk", "index.html"))
      assert File.exist?(File.join(build_dir, "en", "sitemap.xml"))
      assert_includes File.read(File.join(build_dir, "en", "index.html")), 'href="/en/tags/fisk/"'
      assert_includes File.read(File.join(build_dir, "en", "tags", "fisk", "index.html")), 'href="/en/"'
      refute_empty provider.calls

      previous_call_count = provider.calls.length

      second_provider = FakeProvider.new([])
      second_translator = BuildTranslation::SiteTranslator.new(
        build_dir: build_dir,
        cache_store: BuildTranslation::CacheStore.new(path: cache_path),
        extractor: BuildTranslation::HtmlExtractor.new,
        renderer: BuildTranslation::HtmlRenderer.new(
          link_mapper: BuildTranslation::LinkMapper.new(site_url: "https://www.holmevann.no"),
        ),
        link_mapper: BuildTranslation::LinkMapper.new(site_url: "https://www.holmevann.no"),
        provider: second_provider,
      )

      second_translator.run

      assert_equal 0, second_provider.calls.length
      assert_equal previous_call_count, provider.calls.length
    end
  end
end
