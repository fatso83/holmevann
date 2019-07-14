---
title: Bilder
layout: page
---
{% include index-slideshow.html %}

<div id="airbnb-injection"></div>

<template id="airbnb">
{% include airbnb.html %}
</template>

<script>
var hasTemplateSupport = typeof HTMLTemplateElement === "function";
var isNotNarrow = window.matchMedia('(min-width: 600px)').matches;

if(hasTemplateSupport && isNotNarrow) {
    var template = document.getElementById('airbnb');
    var clone = document.importNode(template.content, true);
    var target = document.getElementById('airbnb-injection');
    target.appendChild(clone);
}

</script>

