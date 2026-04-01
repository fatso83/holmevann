Jekyll::Hooks.register :site, :post_write do |site|
  # this only runs during development
  next unless site.config["serving"]

  translation_script = File.expand_path("../scripts/translate_site.rb", __dir__)
  load translation_script
end
