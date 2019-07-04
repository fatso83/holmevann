---
layout: page
title: Hyppige spørsmål
---

{% for qa in site.data.faqs.no %}
  <h3>{{ qa.q }}</h3>
  <p>{{ qa.a }}</p>
{% endfor %}
