---
layout: page
title: Spørsmål & svar
---

<form id="tag-filter" style="margin-bottom: 1em; display:inline-block">
    <label>Søk: <input autofocus required autocomplete="off"
        type="text" name="search" id="search" style="width: 14em;"
        placeholder="Skriv inn det du er interessert i" />
    </label>
</form>
<!-- had to move this outside of the form to prevent it from being invoked as the submit action-->
<div style="display:inline"><button id="clear-form-button">Tøm</button></div>
<div>Forslag: <span id="suggestions"></span></div>

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
        <div class="visually-hidden">{{qa.tags | join: " "}}</div>
    </div>
{% endfor %}
</div>

<script>
const filter = document.getElementById('tag-filter')
const accordion =  document.getElementById('accordion')
const tabs = accordion.getElementsByClassName('accordion__tab')

const myHistory = {
    _listeners: [],
    notify(){ 
        const path = location.href
        this._listeners.map(l => l(path)) 
    },
    listen(listener) { this._listeners.push(listener)},
    push(path){
       history.pushState(null,null,path)
       this.notify();
    }
}
window.addEventListener("popstate", (event) => {
   myHistory.notify(); 
});


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

function setupSearch(){
    /** @type {HTMLInputElement} */
    const search = document.getElementById('search')
    const suggestions = document.getElementById('suggestions')
    const clearFormButton = document.getElementById('clear-form-button')

    function getUrl(){
        return new URL(location.href)
    }

    function filterSuggestions(searchTerm){
        Array.from(tabs).forEach( (tab) => {
            const tags = tab.dataset.tags.length ? tab.dataset.tags.split(',') : []
            const lowerCaseSearchTerm = searchTerm.toLowerCase()

            if(tab.innerText.toLowerCase().includes(lowerCaseSearchTerm)) {
                tab.classList.remove('hide')
            } else if(tags.some( tag => lowerCaseSearchTerm.includes(tag))) {
                tab.classList.remove('hide')
            } else {
                tab.classList.add('hide')
            }
        })
    }


    function filterBySearchParamInUrl() {
        const searchParam = getUrl().searchParams.get('search')
        search.value = searchParam;
        filterSuggestions(search.value)
    }

    filterBySearchParamInUrl();
    myHistory.listen(filterBySearchParamInUrl)

    search.oninput = e => {
        filterSuggestions(search.value)
    }

    filter.onsubmit = e => {
        filterSuggestions(search.value)
        e.preventDefault();
    }
    

    clearFormButton.onclick = e => {
        console.log('clear button clicked')
        search.value = ''
        filter.submit();
    }

    // render suggestions
    const links = []
    for(const word of ['kjøkken', 'transport', 'vinter', 'vin', 'barn', 'leker']) {
        const link = document.createElement('a')
        const url = getUrl()
        url.searchParams.set('search', word)
        url.hash = ''
        link.href=url.toString();
        link.innerText = word
        link.className = "search__suggestion"
        links.push(link)
    }
    suggestions.append(...links)
    // avoid re-rendering the page by hooking into urls
    suggestions.onclick = e => {
        e.preventDefault();

        const url = new URL(e.target.href);
        const href = e.target.href;
        const newPath = href.replace(url.origin, '')
        myHistory.push(newPath)
    }
}

function unhideAll(){
    Array.from(tabs).forEach( tab => {
        tab.classList.remove('hide')
    })
}

window.addEventListener('DOMContentLoaded', function() {
    autoExpandFaqItemInURL();
    setupSearch();
    window.onhashchange = autoExpandFaqItemInURL;
});


</script>
