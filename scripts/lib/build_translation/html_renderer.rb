require "nokogiri"

module BuildTranslation
  class HtmlRenderer
    def initialize(link_mapper:)
      @link_mapper = link_mapper
    end

    def render(html:, units:, translations_by_hash:, source_path:)
      doc = Nokogiri::HTML5.parse(html)

      apply_translations(doc, units, translations_by_hash)
      rewrite_links(doc)
      set_language(doc)
      rewrite_canonical(doc)
      inject_hreflang(doc, source_path)

      doc.to_html
    end

    private

    def apply_translations(doc, units, translations_by_hash)
      units.each do |unit|
        translation = translations_by_hash.fetch(unit.fetch(:hash), unit.fetch(:text))

        case unit.fetch(:kind)
        when :text
          apply_text_translation(doc, unit.fetch(:locator), translation)
        when :attribute
          apply_attribute_translation(doc, unit.fetch(:locator), translation)
        end
      end
    end

    def apply_text_translation(doc, locator, translation)
      parent = doc.at_xpath(locator.fetch(:parent_xpath))
      return unless parent

      node = parent.children[locator.fetch(:child_index)]
      return unless node&.text?

      node.content = translation
    end

    def apply_attribute_translation(doc, locator, translation)
      node = doc.at_xpath(locator.fetch(:xpath))
      return unless node

      node[locator.fetch(:attribute)] = translation
    end

    def rewrite_links(doc)
      doc.css("[href]").each do |node|
        next unless node["href"]

        node["href"] = @link_mapper.english_href_for(node["href"])
      end
    end

    def set_language(doc)
      html = doc.at_css("html")
      html["lang"] = "en" if html
    end

    def rewrite_canonical(doc)
      canonical = doc.at_css('link[rel="canonical"]')
      return unless canonical && canonical["href"]

      canonical["href"] = @link_mapper.english_href_for(canonical["href"])
    end

    def inject_hreflang(doc, source_path)
      head = doc.at_css("head")
      return unless head

      doc.css('link[rel="alternate"][hreflang]').remove

      no_link = Nokogiri::XML::Node.new("link", doc)
      no_link["rel"] = "alternate"
      no_link["hreflang"] = "no"
      no_link["href"] = @link_mapper.absolute_url(source_path)

      en_link = Nokogiri::XML::Node.new("link", doc)
      en_link["rel"] = "alternate"
      en_link["hreflang"] = "en"
      en_link["href"] = @link_mapper.absolute_url(@link_mapper.english_path_for(source_path))

      head.add_child(no_link)
      head.add_child(en_link)
    end
  end
end
