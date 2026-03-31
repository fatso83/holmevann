require "minitest/autorun"

require_relative "../../scripts/lib/build_translation/html_extractor"

class HtmlExtractorTest < Minitest::Test
  def test_extracts_visible_text_and_supported_attributes
    html = <<~HTML
      <!DOCTYPE html>
      <html lang="no">
        <head>
          <title>Velkommen</title>
          <meta name="description" content="Hytta ved vannet">
        </head>
        <body>
          <h1>Velkommen</h1>
          <img alt="Header image" src="/assets/img/header-img.jpg">
          <input placeholder="Skriv inn det du er interessert i">
          <a href="/faq">Spørsmål og svar</a>
          <script>console.log("do not translate me")</script>
        </body>
      </html>
    HTML

    units = BuildTranslation::HtmlExtractor.new.extract_units(html)

    assert_equal(
      ["Header image", "Hytta ved vannet", "Skriv inn det du er interessert i", "Spørsmål og svar", "Velkommen", "Velkommen"],
      units.map { |unit| unit.fetch(:text) }.sort,
    )
    refute_includes units.map { |unit| unit.fetch(:text) }, 'console.log("do not translate me")'
    assert units.all? { |unit| unit.fetch(:hash).is_a?(String) && !unit.fetch(:hash).empty? }
  end

  def test_same_text_produces_same_hash
    html = <<~HTML
      <html>
        <body>
          <h1>Velkommen</h1>
          <p>Velkommen</p>
        </body>
      </html>
    HTML

    units = BuildTranslation::HtmlExtractor.new.extract_units(html)
    hashes = units.select { |unit| unit.fetch(:text) == "Velkommen" }.map { |unit| unit.fetch(:hash) }

    assert_equal [hashes.first, hashes.first], hashes
  end
end
