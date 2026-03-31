require "fileutils"
require "nokogiri"
require "uri"

module BuildTranslation
  class SiteTranslator
    DEFAULT_TARGET_LANG = "EN".freeze
    DEFAULT_BATCH_SIZE = 25
    NON_PUBLIC_PATH_SEGMENTS = %w[
      test
      test-results
      node_modules
      docs
      scripts
      netlify
      coverage
      fixtures
      snapshots
    ].freeze

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
      @cache_store.retain_only!(documents.flat_map { |document| document.fetch(:units).map { |unit| unit.fetch(:hash) } })

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
      source_paths.map do |source_path|
        file_path = file_path_for_source_path(source_path)
        html = File.read(file_path)
        {
          file_path: file_path,
          source_path: source_path,
          html: html,
          units: @extractor.extract_units(html),
        }
      end
    end

    def source_paths
      paths = source_paths_from_sitemap
      paths = source_paths_from_build_glob if paths.empty?
      paths.uniq.sort
    end

    def source_paths_from_sitemap
      sitemap_path = File.join(@build_dir, "sitemap.xml")
      return [] unless File.exist?(sitemap_path)

      doc = Nokogiri::XML(File.read(sitemap_path))
      doc.remove_namespaces!

      doc.xpath("//url/loc").filter_map do |node|
        source_path_for_public_url(node.text.to_s.strip)
      end
    rescue Nokogiri::XML::SyntaxError
      []
    end

    def source_paths_from_build_glob
      Dir.glob(File.join(@build_dir, "**", "*.html")).filter_map do |file_path|
        source_path = source_path_for_file(file_path)
        source_path if public_translatable_source_path?(source_path)
      end
    end

    def source_path_for_public_url(url_text)
      return nil if url_text.empty?

      path = URI.parse(url_text).path
      return nil if path.nil? || path.empty?

      file_path = file_path_for_public_path(path)
      return nil unless file_path

      source_path = source_path_for_file(file_path)
      return nil unless public_translatable_source_path?(source_path)

      source_path
    rescue URI::InvalidURIError
      nil
    end

    def file_path_for_public_path(path)
      normalized = path.start_with?("/") ? path.delete_prefix("/") : path
      candidates = []

      if path == "/"
        candidates << File.join(@build_dir, "index.html")
      elsif path.end_with?("/")
        candidates << File.join(@build_dir, normalized, "index.html")
      else
        candidates << File.join(@build_dir, normalized)
        candidates << File.join(@build_dir, "#{normalized}.html") if File.extname(normalized).empty?
      end

      candidates.find { |candidate| File.file?(candidate) }
    end

    def file_path_for_source_path(source_path)
      file_path_for_public_path(source_path) || raise("Missing built file for #{source_path}")
    end

    def public_translatable_source_path?(source_path)
      return false if source_path.nil? || source_path.empty?
      return false if source_path.start_with?("/en/")
      return false if @link_mapper.english_path_for(source_path).nil?

      segments = source_path.split("/").reject(&:empty?)

      return false if segments.any? { |segment| segment.start_with?(".") }
      return false if segments.any? { |segment| NON_PUBLIC_PATH_SEGMENTS.include?(segment) }

      true
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
