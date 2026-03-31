require "minitest/autorun"

require_relative "../../scripts/lib/build_translation/providers"

class ProviderFactoryTest < Minitest::Test
  def test_builds_deepl_free_client
    client = BuildTranslation::Providers.build(
      provider_name: "deepl_free",
      auth_key: "test-key",
    )

    assert_instance_of BuildTranslation::Providers::DeepLFreeClient, client
  end

  def test_unknown_provider_raises
    error = assert_raises(ArgumentError) do
      BuildTranslation::Providers.build(
        provider_name: "unknown",
        auth_key: "test-key",
      )
    end

    assert_includes error.message, "Unknown translation provider"
  end
end
