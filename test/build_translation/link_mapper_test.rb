require "minitest/autorun"

require_relative "../../scripts/lib/build_translation/link_mapper"

class LinkMapperTest < Minitest::Test
  def setup
    @mapper = BuildTranslation::LinkMapper.new(site_url: "https://www.holmevann.no")
  end

  def test_rewrites_root_relative_html_paths_to_english
    assert_equal "/en/faq.html", @mapper.english_href_for("/faq.html")
    assert_equal "/en/rental/", @mapper.english_href_for("/rental/")
    assert_equal "/en/tags/fisk/", @mapper.english_href_for("/tagger/fisk/")
  end

  def test_leaves_assets_and_external_urls_unchanged
    assert_equal "/assets/main.css", @mapper.english_href_for("/assets/main.css")
    assert_equal "https://example.com", @mapper.english_href_for("https://example.com")
  end

  def test_rewrites_same_origin_absolute_urls
    assert_equal(
      "https://www.holmevann.no/en/faq.html",
      @mapper.english_href_for("https://www.holmevann.no/faq.html"),
    )
  end

  def test_leaves_netlify_function_links_same_origin_without_english_prefix
    href = "/.netlify/functions/pdf-proxy?url=https%3A%2F%2Fexample.com%2Fguide.pdf"
    assert_equal href, @mapper.english_href_for(href)

    absolute_href = "https://www.holmevann.no/.netlify/functions/pdf-proxy?url=https%3A%2F%2Fexample.com%2Fguide.pdf"
    assert_equal absolute_href, @mapper.english_href_for(absolute_href)
  end
end
