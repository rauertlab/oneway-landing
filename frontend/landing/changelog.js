/* THE CHANGELOG'S ENTRIES (founder/870), drawn from frontend/landing/changelog.json where the page's list is empty (the
   published copy carries them already, written by tools/landing_static.py). Newest first; a date as words, then his words.
   Plain ES5 and XMLHttpRequest, so the oldest browsers the site keeps (Safari 12, Chrome 70) draw it too. */
(function () {
  var list = document.getElementById('changelog');
  if (!list || list.children.length) return;
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  function said(d) { var p = String(d || '').split('-'); return p.length === 3 ? MONTHS[+p[1] - 1] + ' ' + (+p[2]) + ', ' + p[0] : String(d || ''); }
  var x = new XMLHttpRequest();
  x.open('GET', list.getAttribute('data-changelog') || '/frontend/landing/changelog.json');
  x.onload = function () {
    var j; try { j = JSON.parse(x.responseText); } catch (e) { return; }
    var es = ((j && j.entries) || []).slice().sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; });
    es.forEach(function (e) {
      var li = document.createElement('li'); li.className = 'cl-entry';
      var t = document.createElement('time'); t.setAttribute('datetime', e.date); t.textContent = said(e.date);
      var p = document.createElement('p'); p.className = 't-body'; p.textContent = e.words || '';
      li.appendChild(t); li.appendChild(p); list.appendChild(li);
    });
  };
  x.send();
})();
