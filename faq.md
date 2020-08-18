---
layout: page
title: Spørsmål & svar
---

<div class="accordion">
{% for qa in site.data.faqs.no %}
    <div class="accordion__tab">
        <input type="checkbox" id="{{qa.q | slugify}}" />
        <label class="accordion__tab-label" for="{{qa.q | slugify}}">{{qa.q}}</label>
        <div class="accordion__tab-content">{{qa.a}}</div>
    </div>
{% endfor %}
</div>

<script>
// Auto-expand FAQ item based on anchor link
(function autoExpandFaqItemInURL(){
    var hashText = location.hash.slice(1); // trim off #. empty string can also be sliced
    if (!hashText) return;

    var id = decodeURIComponent(hashText)
    var inputNode = document.getElementById(id);
    if (!inputNode) {
        console.error("Unable to find anchor with id: " + id);
        return;
    }

    inputNode.checked = true;
})();
</script>
