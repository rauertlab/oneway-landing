
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
      var base = look[0];   /* the look's own lead; a signed-in person's hue takes one glow below, never rotates the look */
      /* the tab's globe in this page's colour for a visitor (the person's own hue wins when signed in; oneway-hue.js) */
      if (window.owTabHue) window.owTabHue(chosen === '' ? base : Number(chosen));
      /* the globe under the wordmark wears the tab globe's colour, hsl(h 92% 58%) of the same hue (founder/1082: "have the same
         dynamic coloring"; tools/make_tab_globes.cjs), and follows it when the hue changes (ow:hue below) */
      document.documentElement.style.setProperty('--land-globe', rgb(chosen === '' ? base : Number(chosen), 92, 58));
      var hues = [base, base + look[1], base + look[2]];
      if (chosen !== '') hues[turn % 3] = Number(chosen);
      [rgb(hues[0], 94.5, 42.7), rgb(hues[1], 91.7, 76.3), rgb(hues[2], 92.1, 50.2)]
        .forEach(function (value, i) { document.documentElement.style.setProperty('--land-hue-' + i, value); });
    }
    /* THE MONTH'S HUE, MIXED IN (founder/891: "should show on app guest screens and the apps landing page hue mixed with others";
       founder/980): motion's OW.hue.month() names it; one glow of four, never the lead (founder/976). Absent, the glow is clear. */
    function month() {
      try {
        var m = window.OW && OW.hue && OW.hue.month ? OW.hue.month() : null, x = m && /^#?([0-9a-f]{6})$/i.exec(String(m.hex || ''));
        if (x) document.documentElement.style.setProperty('--land-month', [0, 2, 4].map(function (i) { return parseInt(x[1].substr(i, 2), 16); }).join(','));
      } catch (_) {}
    }
    paint(); month();
    addEventListener('ow:hue', paint);
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', month);
  })();
  