require "json"
require "minitest/autorun"
require "webrick"

require_relative "../../scripts/lib/build_translation/providers/deepl_free_client"

class DeepLFreeClientTest < Minitest::Test
  def setup
    @captured_request = {}
    @server = WEBrick::HTTPServer.new(
      Port: 0,
      BindAddress: "127.0.0.1",
      Logger: WEBrick::Log.new(File::NULL),
      AccessLog: [],
    )
    @server.mount_proc "/v2/translate" do |request, response|
      @captured_request = {
        path: request.path,
        method: request.request_method,
        auth_header: request["authorization"],
        content_type: request["content-type"],
        body: request.body,
      }

      response.status = 200
      response["Content-Type"] = "application/json"
      response.body = JSON.generate(
        {
          translations: [
            {
              text: "Hello world!",
              detected_source_language: "NO",
            },
          ],
        },
      )
    end

    @server_thread = Thread.new { @server.start }
    sleep 0.05
    port = @server.listeners.first.addr[1]
    @base_url = "http://127.0.0.1:#{port}/v2"
  end

  def teardown
    @server.shutdown
    @server_thread.join
  end

  def test_translate_texts_posts_json_and_returns_parsed_payload
    client = BuildTranslation::Providers::DeepLFreeClient.new(
      auth_key: "test-key",
      base_url: @base_url,
    )

    result = client.translate_texts(
      texts: ["Hei verden!"],
      target_lang: "EN",
    )

    assert_equal "POST", @captured_request.fetch(:method)
    assert_equal "/v2/translate", @captured_request.fetch(:path)
    assert_equal "DeepL-Auth-Key test-key", @captured_request.fetch(:auth_header)
    assert_equal "application/json", @captured_request.fetch(:content_type)

    payload = JSON.parse(@captured_request.fetch(:body))
    assert_equal ["Hei verden!"], payload.fetch("text")
    assert_equal "EN", payload.fetch("target_lang")

    assert_equal(
      ["Hello world!"],
      result.fetch("translations").map { |entry| entry.fetch("text") },
    )
  end

  def test_missing_auth_key_falls_back_to_source_text
    client = BuildTranslation::Providers::DeepLFreeClient.new(auth_key: "")

    result = client.translate_texts(
      texts: ["Hei verden!"],
      target_lang: "EN",
    )

    assert_equal ["Hei verden!"], result.fetch("translations").map { |entry| entry.fetch("text") }
  end
end
