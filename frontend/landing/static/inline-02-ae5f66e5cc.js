
  (function () {
    /* the look this load is the one the head chose (<script id="ow-look">), so the page and its tab globe wear one hue */
    var turn = window.__owLook.turn, look = window.__owLook.look;
    function rgb(h, s, l) {
      h = ((h % 360) + 360) % 360; s /= 100; l /= 100;
      var a = s * Math.min(l, 1 - l);
      function channel(n) {
        var k = (n + h / 30) % 12;
        return Math.round(255 * (l - a * Math.max(-1, Math.min(Math.min(k - 3, 9 - k), 1))));
      }
      return [channel(0), channel(8), channel(4)].join(',');
    }
    function paint() {
      var chosen = getComputedStyle(document.documentElement).getPropertyValue('--ow-user-hue').trim();
      var base = chosen === '' ? look[0] : Number(chosen) + look[0] - 188.7;
      /* the tab's globe in this page's colour for a visitor (the person's own hue wins when signed in; oneway-hue.js) */
      if (window.owTabHue) window.owTabHue(chosen === '' ? base : Number(chosen));
      var hues = [base, base + look[1], base + look[2]];
      if (chosen !== '') hues[turn % 3] = Number(chosen);
      [rgb(hues[0], 94.5, 42.7), rgb(hues[1], 91.7, 76.3), rgb(hues[2], 92.1, 50.2)]
        .forEach(function (value, i) { document.documentElement.style.setProperty('--land-hue-' + i, value); });
    }
    paint();
    addEventListener('ow:hue', paint);
  })();
  