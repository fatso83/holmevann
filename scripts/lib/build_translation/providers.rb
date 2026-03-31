require_relative "providers/client"
require_relative "providers/deepl_free_client"

module BuildTranslation
  module Providers
    module_function

    def build(provider_name:, auth_key:, **options)
      case provider_name
      when "deepl_free"
        DeepLFreeClient.new(auth_key: auth_key, **options)
      else
        raise ArgumentError, "Unknown translation provider: #{provider_name}"
      end
    end
  end
end
