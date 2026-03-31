module BuildTranslation
  module Providers
    class Client
      def translate_texts(texts:, target_lang:, source_lang: nil)
        raise NotImplementedError, "#{self.class} must implement #translate_texts"
      end

      def translate_text(text:, target_lang:, source_lang: nil)
        payload = translate_texts(
          texts: [text],
          target_lang: target_lang,
          source_lang: source_lang,
        )

        payload.fetch("translations").fetch(0).fetch("text")
      end
    end
  end
end
