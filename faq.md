---
layout: page
title: Spørsmål & svar
---


<form id="tag-filter">
    <!-- manual tags listing -->
    <label>
        <input type="radio" name="tag" value="" checked />
        Ingen valg
    </label>
    <label>
        <input type="radio" name="tag" value="kitchen" />
        Kjøkken
    </label>
    <label>
        <input type="radio" name="tag" value="winter" />
        Vinter
    </label>
    <label>
        <input type="radio" name="tag" value="transport" />
        Transport
    </label>
</form>
<!--</div>-->

<div class="accordion" id="accordion">
{% for qa in site.data.faqs.no %}
    <div class="accordion__tab" data-tags="{{qa.tags | join: ","}}">
        {% assign q_id = qa.q | slugify: "latin" %}
        <input type="checkbox" id="{{q_id }}" />
        <div class="accordion__tab-label-box" >
            <a href="#{{q_id}}" class="accordion__tab-link">🔗</a>
            <label class="accordion__tab-label" for="{{q_id}}">{{qa.q}}</label>
        </div>
        <div class="accordion__tab-content">{{qa.a}}</div>
    </div>
{% endfor %}
</div>

<script>
// Auto-expand FAQ item based on anchor link
function autoExpandFaqItemInURL(){
    const hashText = location.hash.slice(1); // trim off #. empty string can also be sliced
    if (!hashText) return;

    const id = decodeURIComponent(hashText)
    const inputNode = document.getElementById(id);
    if (!inputNode) {
        console.error("Unable to find anchor with id: " + id);
        return;
    }

    console.debug("Expanding node with id " + id)
    inputNode.checked = true;
}

function setupFilter(){
    const filter = document.getElementById('tag-filter')
    const accordion =  document.getElementById('accordion')
    filter.onclick =  (e) => { 
        const tag = new FormData(filter).get('tag')
        const tabs = accordion.getElementsByClassName('accordion__tab')
        Array.from(tabs).forEach( tab => {
            tab.classList.remove('hide')
            if(!tag) {
                return
            }
            const tags = tab.dataset.tags.split(',')
            if(!tags.includes(tag)) {
                tab.classList.add('hide')
            }
        })

    }
}


autoExpandFaqItemInURL();
setupFilter();
window.onhashchange = autoExpandFaqItemInURL;


</script>
