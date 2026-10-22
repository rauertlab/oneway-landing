(function(){
      var el = document.getElementById('owSplash'), mark = document.querySelector('.hero-mark');
      if (!el || !mark || typeof XMLHttpRequest === 'undefined') return;
      function place(){
        var box = el.parentNode.getBoundingClientRect(), m = mark.getBoundingClientRect();
        if (!m.width) return;
        var w = el.offsetWidth;
        var left = Math.min(m.right - box.left - w * 0.35, box.width - w - 4);
        el.style.left = Math.max(4, left) + 'px';
        el.style.top = (m.bottom - box.top - el.offsetHeight * 0.18) + 'px';   /* it catches the wordmark's corner, as Minecraft's splash does, and leaves its letters */
      }
      function fade(){ el.style.opacity = (window.scrollY || 0) > 40 ? '0' : '1'; el.style.pointerEvents = (window.scrollY || 0) > 40 ? 'none' : 'auto'; }
      /* the platform's one public read, asked as oneway-bar.js asks it (an XMLHttpRequest: the published copy's shim answers fetch('/api/')
         itself, for the copy GitHub Pages serves, where there is no platform) */
      var x = new XMLHttpRequest(); x.open('GET', '/api/oneway/platform/public');
      x.onload = function(){ var s = null; try { s = x.status === 200 ? JSON.parse(x.responseText) : null; } catch (e) { s = null; } show(s); };
      x.send();
      function show(s){
        if (!s || !s.open) return;
        var x = s.app && s.os ? 'Oneway' : s.app ? 'The Oneway App' : s.os ? 'Oneway OS' : '';
        if (!x) return;
        el.querySelector('.ow-splash__x').textContent = x + ' is as of now open for sign up,';
        el.setAttribute('aria-label', x + ' is as of now open for sign up. Go learn the ecosystem! Selective server test launch.');
        el.hidden = false; place(); fade();
        if (mark.complete === false) mark.addEventListener('load', place);
        window.addEventListener('resize', place); window.addEventListener('scroll', fade, { passive: true });
      }
    })();