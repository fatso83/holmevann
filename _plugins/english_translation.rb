Jekyll::Hooks.register :site, :post_write do |site|
  next if ENV["HOLMEVANN_SKIP_TRANSLATION_HOOK"] == "1"

  translation_script = File.expand_path("../scripts/translate_site.rb", __dir__)
  load translation_script
end
