require "uri"

module BuildTranslation
  class LinkMapper
    def initialize(site_url:)
      @site_url = site_url
      @site_uri = URI.parse(site_url)
    end

    def english_href_for(href)
      return href if href.nil? || href.empty?

      uri = URI.parse(href)

      if uri.absolute?
        return href unless same_origin?(uri)

        mapped_path = map_path(uri.path)
        return href unless mapped_path

        uri.path = mapped_path
        return uri.to_s
      end

      return href unless href.start_with?("/")

      mapped_path = map_path(uri.path)
      return href unless mapped_path

      suffix = +""
      suffix << "?#{uri.query}" if uri.query
      suffix << "##{uri.fragment}" if uri.fragment
      "#{mapped_path}#{suffix}"
    rescue URI::InvalidURIError
      href
    end

    def english_path_for(source_path)
      map_path(source_path)
    end

    def absolute_url(path)
      URI.join(@site_url.end_with?("/") ? @site_url : "#{@site_url}/", path.delete_prefix("/")).to_s
    end

    private

    def same_origin?(uri)
      uri.scheme == @site_uri.scheme && uri.host == @site_uri.host && uri.port == @site_uri.port
    end

    def map_path(path)
      return nil if path.nil? || path.empty?
      return path if path.start_with?("/en/")
      return "/en/" if path == "/"

      if path.start_with?("/tagger/")
        return "/en/tags/#{path.delete_prefix('/tagger/')}"
      end

      return nil unless translatable_html_path?(path)

      "/en#{path}"
    end

    def translatable_html_path?(path)
      return false if path.start_with?("/assets/", "/.netlify/functions/", "/.well-known/")
      return true if path.end_with?("/")
      return true if path.end_with?(".html")

      !File.extname(path).empty? ? false : true
    end
  end
end
