/* THE CHANGELOG'S ENTRIES (founder/870), drawn from frontend/landing/changelog.json where the page's list is empty (the
   published copy carries them already, written by tools/landing_static.py). Newest first; a date as words, then his words.
   An entry may also carry a title (its heading) and sections, each a title and a list of items (founder/1024: one update
   written in sections that new items can join); tools/landing_static.py draws the same shape, so both copies agree.
   Plain ES5 and XMLHttpRequest, so the oldest browsers the site keeps (Safari 12, Chrome 70) draw it too. */
(function () {
  var list = document.getElementById('changelog');
  if (!list || list.children.length) return;
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  function said(d) { var p = String(d || '').split('-'); return p.length === 3 ? MONTHS[+p[1] - 1] + ' ' + (+p[2]) + ', ' + p[0] : String(d || ''); }
  function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
  var x = new XMLHttpRequest();
  x.open('GET', list.getAttribute('data-changelog') || '/frontend/landing/changelog.json');
  x.onload = function () {
    var j; try { j = JSON.parse(x.responseText); } catch (e) { return; }
    var es = ((j && j.entries) || []).slice().sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; });
    es.forEach(function (e) {
      var li = el('li', 'cl-entry');
      var t = el('time', '', said(e.date)); t.setAttribute('datetime', e.date); li.appendChild(t);
      if (e.title) li.appendChild(el('h2', 'cl-title t-sub', e.title));
      if (e.words) li.appendChild(el('p', 't-body', e.words));
      var secs = e.sections && e.sections.length ? e.sections : [];
      for (var i = 0; i < secs.length; i++) {
        var s = secs[i], items = (s && s.items) || [];
        if (!items.length) continue;
        var box = el('div', 'cl-sec');
        if (s.title) box.appendChild(el(e.title ? 'h3' : 'h2', 'cl-sec-title', s.title));
        var ul = el('ul', 'cl-items');
        for (var k = 0; k < items.length; k++) ul.appendChild(el('li', 't-body', String(items[k])));
        box.appendChild(ul); li.appendChild(box);
      }
      list.appendChild(li);
    });
  };
  x.send();
})();
