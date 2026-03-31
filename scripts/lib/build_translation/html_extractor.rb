require "digest"
require "nokogiri"

module BuildTranslation
  class HtmlExtractor
    SUPPORTED_ATTRIBUTES = %w[alt placeholder aria-label title].freeze

    def extract_units(html)
      doc = Nokogiri::HTML5.parse(html)
      units = []

      doc.traverse do |node|
        if text_node?(node)
          text = normalize_text(node.text)
          next if text.empty?

          units << {
            kind: :text,
            text: text,
            format: "text",
            hash: hash_for(text, "text"),
            locator: {
              parent_xpath: node.parent.path,
              child_index: node.parent.children.index(node),
            },
          }
        elsif node.element?
          extract_attribute_units(node, units)
        end
      end

      units
    end

    private

    def extract_attribute_units(node, units)
      SUPPORTED_ATTRIBUTES.each do |attribute|
        next unless node.key?(attribute)

        text = normalize_text(node[attribute])
        next if text.empty?

        units << {
          kind: :attribute,
          text: text,
          format: "text",
          hash: hash_for(text, "text"),
          locator: {
            xpath: node.path,
            attribute: attribute,
          },
        }
      end

      return unless node.name == "meta"
      return unless %w[description og:title og:description twitter:title twitter:description].include?(node["name"]) ||
                    %w[og:title og:description twitter:title twitter:description].include?(node["property"])

      text = normalize_text(node["content"])
      return if text.empty?

      units << {
        kind: :attribute,
        text: text,
        format: "text",
        hash: hash_for(text, "text"),
        locator: {
          xpath: node.path,
          attribute: "content",
        },
      }
    end

    def text_node?(node)
      return false unless node.text?
      return false if node.parent.nil?
      return false if %w[script style noscript].include?(node.parent.name)

      true
    end

    def normalize_text(text)
      text.to_s.gsub(/\s+/, " ").strip
    end

    def hash_for(text, format)
      Digest::SHA256.hexdigest("#{format}\0#{text}")
    end
  end
end
