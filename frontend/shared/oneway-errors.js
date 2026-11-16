/* OUR OWN ERROR REPORTING, THE BROWSER'S HALF (the founder, 2026-10-20; api/oneway/platform/errors.py).
   An uncaught error or an unhandled promise rejection is sent to POST /api/client-errors: its message, the file and line, and which
   surface it was on. Nothing else: no account, no address, no page data. At most five a page, each once. Written in ES5 so the oldest
   phones report too; the first script of the App, the OS, the landing and every site page. */
(function () {
  if (window.__owErrors) { return; }
  window.__owErrors = 1;
  var sent = 0, seen = {}, MAX = 5;
  function surface() {
    var p = String(location.pathname || '');
    if (/oneway-os/.test(p)) { return 'os'; }
    if (/oneway-app/.test(p)) { return 'app'; }
    if (p === '/' || /\/index\.html$/.test(p)) { return 'landing'; }
    return 'site';
  }
  function send(o) {
    var key = o.message + '|' + o.source + '|' + o.line + ':' + o.col;   /* a minified file is one line: its throw sites differ by column */
    if (sent >= MAX || seen[key]) { return; }
    seen[key] = 1;
    sent += 1;
    var body = JSON.stringify(o);
    try {
      if (navigator.sendBeacon && window.Blob && navigator.sendBeacon('/api/client-errors', new Blob([body], { type: 'application/json' }))) { return; }
    } catch (e) {}
    try {
      var x = new XMLHttpRequest();
      x.open('POST', '/api/client-errors', true);
      x.setRequestHeader('Content-Type', 'application/json');
      x.send(body);
    } catch (e2) {}
  }
  function report(message, source, line, col) {
    send({ message: String(message || '').slice(0, 500), source: String(source || '').slice(0, 300), line: line || 0, col: col || 0, surface: surface() });
  }
  if (window.addEventListener) {
    window.addEventListener('error', function (ev) {
      if (ev && ev.target && ev.target !== window && ev.target.nodeType === 1) { return; }   /* a picture or a script that failed to load is not an exception */
      report(ev && ev.message, ev && ev.filename, ev && ev.lineno, ev && ev.colno);
    }, true);
    /* WHERE A REJECTION CAME FROM: its first frame, file, line and column (the mail, 2026-11-11: "close@/frontend/shared/oneway-realtime.js"
       and "(forEach)" named the CALLER). Chrome's stack starts with "TypeError: message" and WebKit's starts with the frame itself,
       so line [1] was the throwing frame in one and its caller in the other. The first line that holds file:line:col is the frame.
       ONLY A LINE'S LAST FRAME_CHARS ARE READ: the frame sits at the end of its line, and on a whole line the pattern's time grew with
       the square of its length (the review, 2026-11-12: one 112 KB line took 2.7 s on the main thread, for up to 12 lines). */
    var FRAME = /(?:\(|@|\s)((?:https?:\/\/[^\s()]*?)?\/[^\s()@]*?):(\d+):(\d+)\)?\s*$/, FRAME_CHARS = 400;
    window.addEventListener('unhandledrejection', function (ev) {
      var r = ev && ev.reason;
      var lines = r && r.stack ? String(r.stack).split('\n') : [], at = '', line = 0, col = 0;
      for (var i = 0; i < lines.length && i < 12; i++) {
        var m = FRAME.exec(lines[i].slice(-FRAME_CHARS));
        if (m) { at = m[1]; line = +m[2] || 0; col = +m[3] || 0; break; }
      }
      if (!at && lines.length) { at = lines[0].indexOf('@') > 0 ? lines[0] : (lines[1] || ''); }
      report('unhandled rejection: ' + (r && r.message ? r.message : String(r)), at, line, col);
    });
  } else {
    var prev = window.onerror;
    window.onerror = function (m, s, l, c) { report(m, s, l, c); return prev ? prev.apply(this, arguments) : false; };
  }
})();
