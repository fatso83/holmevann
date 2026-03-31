require "fileutils"

module BuildTranslation
  class SiteTranslator
    DEFAULT_TARGET_LANG = "EN".freeze
    DEFAULT_BATCH_SIZE = 25

    def initialize(build_dir:, cache_store:, extractor:, renderer:, link_mapper:, provider:, batch_size: DEFAULT_BATCH_SIZE)
      @build_dir = build_dir
      @cache_store = cache_store
      @extractor = extractor
      @renderer = renderer
      @link_mapper = link_mapper
      @provider = provider
      @batch_size = batch_size
    end

    def run
      documents = collect_documents
      translations_by_hash = resolve_translations(documents)

      english_paths = documents.map do |document|
        english_path = @link_mapper.english_path_for(document.fetch(:source_path))
        rendered = @renderer.render(
          html: document.fetch(:html),
          units: document.fetch(:units),
          translations_by_hash: translations_by_hash,
          source_path: document.fetch(:source_path),
        )

        write_document(english_path, rendered)
        english_path
      end

      write_sitemap(english_paths)
      @cache_store.save!
    end

    private

    def collect_documents
      html_files.map do |file_path|
        html = File.read(file_path)
        {
          file_path: file_path,
          source_path: source_path_for_file(file_path),
          html: html,
          units: @extractor.extract_units(html),
        }
      end
    end

    def html_files
      Dir.glob(File.join(@build_dir, "**", "*.html")).reject do |path|
        path.include?("/en/")
      end.sort
    end

    def resolve_translations(documents)
      translations_by_hash = {}
      missing_units = {}

      documents.each do |document|
        document.fetch(:units).each do |unit|
          hash = unit.fetch(:hash)
          if (cached = @cache_store.lookup(hash))
            translations_by_hash[hash] = cached.fetch("translated_text")
          else
            missing_units[hash] ||= unit
          end
        end
      end

      missing_units.values.each_slice(@batch_size) do |batch|
        response = @provider.translate_texts(
          texts: batch.map { |unit| unit.fetch(:text) },
          target_lang: DEFAULT_TARGET_LANG,
        )
        translations = response.fetch("translations")

        batch.zip(translations).each do |unit, translation|
          translated_text = translation.fetch("text")
          translations_by_hash[unit.fetch(:hash)] = translated_text
          @cache_store.upsert(
            hash: unit.fetch(:hash),
            source_text: unit.fetch(:text),
            translated_text: translated_text,
            format: unit.fetch(:format),
          )
        end
      end

      translations_by_hash
    end

    def write_document(english_path, content)
      destination = output_file_path_for_english_path(english_path)
      FileUtils.mkdir_p(File.dirname(destination))
      File.write(destination, content)
    end

    def write_sitemap(english_paths)
      destination = File.join(@build_dir, "en", "sitemap.xml")
      FileUtils.mkdir_p(File.dirname(destination))
      urls = english_paths.uniq.sort.map do |path|
        "  <url><loc>#{escape_xml(@link_mapper.absolute_url(path))}</loc></url>"
      end

      File.write(
        destination,
        <<~XML,
          <?xml version="1.0" encoding="UTF-8"?>
          <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
          #{urls.join("\n")}
          </urlset>
        XML
      )
    end

    def source_path_for_file(file_path)
      relative = file_path.delete_prefix("#{@build_dir}/")
      if relative == "index.html"
        "/"
      elsif relative.end_with?("/index.html")
        "/#{relative.delete_suffix('index.html')}"
      else
        "/#{relative}"
      end
    end

    def output_file_path_for_english_path(english_path)
      if english_path == "/en/"
        File.join(@build_dir, "en", "index.html")
      elsif english_path.end_with?("/")
        File.join(@build_dir, english_path.delete_prefix("/"), "index.html")
      else
        File.join(@build_dir, english_path.delete_prefix("/"))
      end
    end

    def escape_xml(value)
      value
        .gsub("&", "&amp;")
        .gsub("<", "&lt;")
        .gsub(">", "&gt;")
        .gsub('"', "&quot;")
        .gsub("'", "&apos;")
    end
  end
end
