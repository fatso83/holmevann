/**
 * Builds a TOC based on the H2 headers in the page content section
 * Replaces the node with id 'toc-insert'
 */
(function insertToc() {
  var tocElem = document.getElementById("toc-insert");
  if (!tocElem) return;

  function nameIdTuple(e) {
    console.log(e);
    return [e.id, e.innerText];
  }

  var map = Array.prototype.map;
  var level2Headers = document.querySelectorAll(".page-content h2[id]");
  var tocList = map.call(level2Headers, nameIdTuple);
  var nav = document.createElement("nav");
  var list = document.createElement("ol");
  nav.appendChild(list);

  tocList.forEach(function addListElem(tocElem) {
    console.log(tocElem);
    var li = document.createElement("li");
    li.innerHTML = "<a href='#" + tocElem[0] + "'>" + tocElem[1] + "</a>";
    list.appendChild(li);
  });

  tocElem.replaceWith(nav);
})();
