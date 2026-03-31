require "minitest/autorun"

require_relative "../../scripts/lib/build_translation/html_extractor"
require_relative "../../scripts/lib/build_translation/html_renderer"
require_relative "../../scripts/lib/build_translation/link_mapper"

class HtmlRendererTest < Minitest::Test
  def test_applies_translations_sets_lang_and_rewrites_links
    html = <<~HTML
      <!DOCTYPE html>
      <html lang="no">
        <head>
          <title>Velkommen</title>
          <link rel="canonical" href="https://www.holmevann.no/faq.html">
          <meta name="description" content="Hytta ved vannet">
        </head>
        <body>
          <h1>Velkommen</h1>
          <a href="/faq.html">Spørsmål og svar</a>
          <a href="/tagger/fisk/">#fisk</a>
          <img alt="Header image" src="/assets/img/header-img.jpg">
        </body>
      </html>
    HTML

    extractor = BuildTranslation::HtmlExtractor.new
    units = extractor.extract_units(html)
    translations = units.each_with_object({}) do |unit, acc|
      acc[unit.fetch(:hash)] = "EN: #{unit.fetch(:text)}"
    end

    rendered = BuildTranslation::HtmlRenderer.new(
      link_mapper: BuildTranslation::LinkMapper.new(site_url: "https://www.holmevann.no"),
    ).render(
      html: html,
      units: units,
      translations_by_hash: translations,
      source_path: "/faq.html",
    )

    assert_includes rendered, '<html lang="en">'
    assert_includes rendered, "EN: Velkommen"
    assert_includes rendered, 'href="/en/faq.html"'
    assert_includes rendered, 'href="/en/tags/fisk/"'
    assert_includes rendered, 'href="https://www.holmevann.no/en/faq.html"'
    assert_includes rendered, 'hreflang="no"'
    assert_includes rendered, 'hreflang="en"'
    assert_includes rendered, 'alt="EN: Header image"'
  end
end
