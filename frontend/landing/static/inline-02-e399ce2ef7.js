
  (function () {
    /* MORE COLOURS ON EACH LOAD (founder/790: "introduce more variety for color options of the landing page. when
       randomlly loading on"). Each look is a base hue and the two offsets of its other glows; the three glows keep the
       landing's own lightnesses (deep, light, middle) on its black, so every look is still the landing's room. The
       eight added looks are my reading of his "more variety" (for his eye). */
    var looks = [
      [188.7, 66.4, 209], // The familiar teal, violet and amber combination.
      [218, 90, 215],     // Deep blue with violet and warm light.
      [310, 120, 225],    // Pink with green and blue.
      [145, 90, 225],     // Green with blue and warm light.
      [38, 185, 95],      // Gold with deep blue and green.
      [350, 40, 250],     // Crimson with peach light and blue.
      [200, 330, 80],     // Azure with aqua light and violet.
      [160, 120, 40],     // Emerald with lavender light and sky.
      [330, 75, 270],     // Rose with gold light and blue.
      [250, 200, 70],     // Indigo with lime light and magenta.
      [12, 300, 180],     // Ember with orchid light and cyan.
      [180, 150, 60],     // Lagoon teal with pink light and blue.
      [275, 245, 120]     // Violet with sea-green light and coral.
    ];
    var turn = Math.floor(Math.random() * looks.length);
    /* the first load of a visit is the random one; each reload in the same tab then steps to the next look. The saved
       turn was read as Number(null) = 0 when nothing was saved yet, so every first load drew look 0 (measured
       2026-10-16: 14 of 14 fresh loads were the teal look); only a turn actually saved is followed now */
    try {
      var saved = sessionStorage.getItem('ow_landing_palette_turn');
      var savedTurn = saved === null ? NaN : Number(saved);
      if (Number.isFinite(savedTurn) && savedTurn >= 0) turn = savedTurn % looks.length;
      sessionStorage.setItem('ow_landing_palette_turn', String(turn + 1));
    } catch (_) {}
    var look = looks[turn];
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
  