require "json"
require "net/http"
require "uri"

require_relative "client"

module BuildTranslation
  module Providers
    class DeepLFreeClient < Client
      DEFAULT_BASE_URL = "https://api-free.deepl.com/v2".freeze

      def initialize(auth_key:, base_url: DEFAULT_BASE_URL)
        if auth_key.nil? || auth_key.strip.empty?
          raise ArgumentError, "DEEPL_AUTH_KEY is required for DeepL Free"
        end

        @auth_key = auth_key
        @base_url = base_url
      end

      def translate_texts(texts:, target_lang:, source_lang: nil)
        response = post_json(
          "/translate",
          {
            text: texts,
            target_lang: target_lang,
            source_lang: source_lang,
          }.compact,
        )

        JSON.parse(response.body)
      end

      private

      def post_json(path, payload)
        uri = URI.join(@base_url.end_with?("/") ? @base_url : "#{@base_url}/", path.delete_prefix("/"))
        request = Net::HTTP::Post.new(uri)
        request["Content-Type"] = "application/json"
        request["Authorization"] = "DeepL-Auth-Key #{@auth_key}"
        request.body = JSON.generate(payload)

        response = Net::HTTP.start(
          uri.hostname,
          uri.port,
          use_ssl: uri.scheme == "https",
        ) do |http|
          http.request(request)
        end

        unless response.is_a?(Net::HTTPSuccess)
          raise "DeepL Free request failed with #{response.code}: #{response.body}"
        end

        response
      end
    end
  end
end
