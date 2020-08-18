---
layout: page
title: Spørsmål & svar
---

<div class="accordion">
{% for qa in site.data.faqs.no %}
    <div class="accordion__tab">
        <input type="checkbox" id="{{qa.q | slugify}}" />
        <div class="accordion__tab-label-box" >
            <a href="#{{qa.q | slugify}}" class="accordion__tab-link">🔗</a>
            <label class="accordion__tab-label" for="{{qa.q | slugify}}">{{qa.q}}</label>
        </div>
        <div class="accordion__tab-content">{{qa.a}}</div>
    </div>
{% endfor %}
</div>

<script>
// Auto-expand FAQ item based on anchor link
function autoExpandFaqItemInURL(){
    var hashText = location.hash.slice(1); // trim off #. empty string can also be sliced
    if (!hashText) return;

    var id = decodeURIComponent(hashText)
    var inputNode = document.getElementById(id);
    if (!inputNode) {
        console.error("Unable to find anchor with id: " + id);
        return;
    }

    console.debug("Expanding node with id " + id)
    inputNode.checked = true;
}

autoExpandFaqItemInURL();
window.onhashchange = autoExpandFaqItemInURL;


</script>
