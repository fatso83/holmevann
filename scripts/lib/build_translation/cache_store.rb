require "fileutils"
require "set"
require "time"
require "yaml"

module BuildTranslation
  class CacheStore
    def initialize(path:)
      @path = path
      @data = if File.exist?(path)
                YAML.load_file(path) || {}
              else
                {}
              end
      @data["entries"] ||= {}
      @dirty = false
    end

    def lookup(hash)
      @data.fetch("entries").fetch(hash, nil)
    end

    def upsert(hash:, source_text:, translated_text:, format:)
      next_value = {
        "source_text" => source_text,
        "translated_text" => translated_text,
        "format" => format,
        "updated_at" => Time.now.utc.iso8601,
      }
      current_value = lookup(hash)

      return current_value if current_value == next_value

      @data.fetch("entries")[hash] = next_value
      @dirty = true
      next_value
    end

    def retain_only!(hashes)
      active_hashes = hashes.to_set
      before = @data.fetch("entries").length
      @data["entries"].select! { |hash, _entry| active_hashes.include?(hash) }
      changed = @data.fetch("entries").length != before
      @dirty ||= changed
      changed
    end

    def save!
      return false unless @dirty

      FileUtils.mkdir_p(File.dirname(@path))
      File.write(@path, YAML.dump(@data))
      @dirty = false
      true
    end
  end
end
