require "minitest/autorun"
require "tmpdir"
require "yaml"

require_relative "../../scripts/lib/build_translation/cache_store"

class CacheStoreTest < Minitest::Test
  def test_reads_existing_entry_by_hash
    Dir.mktmpdir do |dir|
      path = File.join(dir, "en-cache.yml")
      File.write(
        path,
        {
          "entries" => {
            "abc123" => {
              "source_text" => "Hei",
              "translated_text" => "Hello",
              "format" => "text",
            },
          },
        }.to_yaml,
      )

      store = BuildTranslation::CacheStore.new(path:)

      assert_equal "Hello", store.lookup("abc123").fetch("translated_text")
    end
  end

  def test_upsert_persists_new_entry
    Dir.mktmpdir do |dir|
      path = File.join(dir, "en-cache.yml")
      File.write(path, { "entries" => {} }.to_yaml)

      store = BuildTranslation::CacheStore.new(path:)
      store.upsert(
        hash: "abc123",
        source_text: "Hei",
        translated_text: "Hello",
        format: "text",
      )

      store.save!

      saved = YAML.load_file(path)
      entry = saved.fetch("entries").fetch("abc123")
      assert_equal "Hei", entry.fetch("source_text")
      assert_equal "Hello", entry.fetch("translated_text")
      assert_equal "text", entry.fetch("format")
      refute_nil entry.fetch("updated_at")
    end
  end

  def test_save_is_noop_when_nothing_changed
    Dir.mktmpdir do |dir|
      path = File.join(dir, "en-cache.yml")
      File.write(path, { "entries" => {} }.to_yaml)

      store = BuildTranslation::CacheStore.new(path:)
      before = File.mtime(path)
      sleep 1
      store.save!
      after = File.mtime(path)

      assert_equal before, after
    end
  end

  def test_retain_only_removes_entries_not_in_active_set
    Dir.mktmpdir do |dir|
      path = File.join(dir, "en-cache.yml")
      File.write(
        path,
        {
          "entries" => {
            "keep" => {
              "source_text" => "Keep me",
              "translated_text" => "Keep me",
              "format" => "text",
              "updated_at" => "2026-04-01T00:00:00Z",
            },
            "drop" => {
              "source_text" => "Drop me",
              "translated_text" => "Drop me",
              "format" => "text",
              "updated_at" => "2026-04-01T00:00:00Z",
            },
          },
        }.to_yaml,
      )

      store = BuildTranslation::CacheStore.new(path:)

      assert_equal true, store.retain_only!(%w[keep])
      store.save!

      saved = YAML.load_file(path)
      assert_equal ["keep"], saved.fetch("entries").keys
    end
  end
end
