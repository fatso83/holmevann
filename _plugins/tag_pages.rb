module Holmevann
  class TagPage < Jekyll::PageWithoutAFile
    def initialize(site:, base:, dir:, tag_name:, posts:)
      @site = site
      @base = base
      @dir = dir
      @name = "index.html"

      process(@name)
      @data = {}
      self.content = ""
      data["layout"] = "tag"
      data["exclude"] = true
      data["title"] = "Tag: #{tag_name}"
      data["tag_name"] = tag_name
      data["posts"] = posts
      data["permalink"] = "/#{dir}/"
    end
  end

  class TagPagesGenerator < Jekyll::Generator
    safe true
    priority :low

    def generate(site)
      grouped_posts(site).each_value do |entry|
        site.pages << TagPage.new(
          site: site,
          base: site.source,
          dir: "tagger/#{entry[:slug]}",
          tag_name: entry[:name],
          posts: entry[:posts]
        )
      end
    end

    private

    def grouped_posts(site)
      ordered_posts(site).each_with_object({}) do |post, acc|
        raw_tags(post).each do |tag_name|
          slug = slug_for(tag_name)
          next if slug.empty?

          acc[slug] ||= { name: tag_name, slug: slug, posts: [] }
          acc[slug][:posts] << post unless acc[slug][:posts].include?(post)
        end
      end
    end

    def ordered_posts(site)
      site.posts.docs.sort_by { |post| [-post.date.to_f, post.path] }
    end

    def raw_tags(post)
      value = post.data["tags"]
      values = value.is_a?(Array) ? value : Array(value)

      values
        .map { |tag| tag.to_s.strip }
        .reject(&:empty?)
        .uniq { |tag| slug_for(tag.downcase) }
    end

    def slug_for(tag_name)
      Jekyll::Utils.slugify(tag_name, mode: "latin")
    end
  end
end
