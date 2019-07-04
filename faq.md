---
layout: page
title: Hyppige spørsmål
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
