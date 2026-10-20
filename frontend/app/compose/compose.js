/* THE COMPOSER: what Create writes with, and adding a photo.
   Moved whole from frontend/app/popit-live.js by tools/boot_split.mjs (the boot split, PLAN §2 App boot row):
   oneway-app.html loads it with OW.need('compose') when its screen first opens; index.html loads it by tag. */
(function (global) {
  'use strict';
  var OW = global.OW;
  var _u = OW._u;
  var FEED_READS = _u.FEED_READS,
      data = _u.data,
      doc = _u.doc,
      esc = _u.esc,
      mk = _u.mk,
      setIcon = _u.setIcon;


  /* 4.4 — DISCOVERY. "Discover should not become endless scrolling. The purpose
     is meaningful discovery." (EXPERIENCE.md) So: a few grouped, reasoned
     suggestions with a hard ceiling — never a river, never a ranked stream.

     THE WHY IS THE SURFACE. A suggestion without a reason is a recommendation
     engine, which this deliberately is not — the runtime returns a `why` on
     every item ("a gallery from Jake") and it LEADS the row rather than sitting
     under it as small print. That reason is also the whole legal and ethical
     position: nothing here is surfaced because it performs well.

     NOTHING HERE ACTS. Discovery exposes possible relationships and never
     creates one — opening is all a row does; the graph changes only on a
     chosen act elsewhere. */
  /* DISCOVERY IS THE ONE SURFACE THAT MUST WORK BEFORE YOU EXIST. Its whole
     job is showing a stranger what is out here, and a door in front of it asks
     someone to commit to a platform they have not been allowed to look at.
     Signed out it reads the PUBLIC catalogue — the same Centers, minus the
     three groups that are relationships ("through people you know" cannot mean
     anything yet), and each one still walks into a real public window. */
  OW.live.readMedia = function (opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      var input = doc.createElement('input');
      input.type = 'file';
      input.accept = opts.accept || 'image/*,video/*';
      if (opts.multiple !== false) input.multiple = true;
      input.style.display = 'none';
      doc.body.appendChild(input);
      /* CLOSING THE PICKER IS AN ANSWER TOO. Without this a person who opened
         it and changed their mind left the promise waiting forever, and the
         control that opened it stuck on its busy word. */
      input.addEventListener('cancel', function () {
        input.remove();
        resolve({ items: [], refused: [] });
      });
      input.addEventListener('change', function () {
        var files = Array.prototype.slice.call(input.files || []);
        input.remove();
        if (!files.length) { resolve({ items: [], refused: [] }); return; }
        /* EVERY UPLOAD OPENS THE EDITOR (founder/831): each file is placed in its frame (a post's 4:5, 1:1 or 1.91:1,
           a video's 9:16 too) before anything is stored. Cancel is an answer: nothing is kept and nothing uploads. */
        if (opts.edit !== false && typeof OW.editMedia === 'function') {
          OW.editMedia(files, { frame: opts.frame || 'post', videoFrame: opts.videoFrame || 'postVideo',
                                title: opts.title || 'New post' }).then(function (done) {
            var items = [], refused = [];
            (done || []).forEach(function (r, i) {
              var it = coFromEdit(r, files[i]);
              if (coBytes(it.src) > CO_MAX_BYTES) {
                refused.push({ name: it.name, why: 'too big \u2014 keep it under about '
                  + Math.round(CO_MAX_BYTES / (1024 * 1024)) + 'MB' });
              } else items.push(it);
            });
            resolve({ items: items, refused: refused, cancelled: !done });
          });
          return;
        }
        var items = [], refused = [], left = files.length;
        files.forEach(function (f) {
          var fr = new global.FileReader();
          fr.onerror = function () {
            refused.push({ name: f.name, why: 'could not be read' });
            if (!--left) resolve({ items: items, refused: refused });
          };
          fr.onload = function () {
            var src = String(fr.result || '');
            var isVid = /^data:video\//i.test(src);
            var take = function (out) {
              if (coBytes(out) > CO_MAX_BYTES) {
                refused.push({ name: f.name, why: 'too big — keep it under about '
                  + Math.round(CO_MAX_BYTES / (1024 * 1024)) + 'MB' });
              } else {
                items.push({ src: out, kind: isVid ? 'video' : 'photo', name: f.name });
              }
              if (!--left) resolve({ items: items, refused: refused });
            };
            if (isVid) take(src); else coShrink(src, take);
          };
          fr.readAsDataURL(f);
        });
      });
      input.click();
    });
  };

  /* THE ONE DOOR FOR BYTES. `POST /api/oneway/media` stores a file and answers
     a CONTRACTED media item — its `kind` from the SERVER's sniff of the bytes,
     never our guess — which a Post takes exactly as it is.

     This filed every file into a Gallery first (`/api/galleries/{gid}/upload`,
     making one when none was named). Galleries are retired, not migrated
     (founder, 2026-08-26, kept in api/oneway/manifest.py), and a file no longer
     needs an object to own it before it can exist. */
  OW.live.uploadMedia = function (dataUrl, opts) {
    opts = opts || {};
    return data.post('/api/oneway/media', coMediaBody({ src: dataUrl, origin: opts.origin, kind: opts.kind,
                                                        crop: opts.crop, trim: opts.trim, poster: opts.poster }))
      .then(function (u) {
        var item = u.ok && (u.data || {}).media;
        if (!item || !item.url) return { ok: false, error: (u.error || 'the file was refused') };
        return { ok: true, item: item };
      });
  };

  /* PICK AND STORE, for a surface that wants the bytes filed immediately.
     Sequential on purpose: a phone uploading eight photos at once competes with
     itself and the failure is a stall nobody can explain. */
  OW.live.pickMedia = function (opts) {
    opts = opts || {};
    return OW.live.readMedia(opts).then(function (res) {
      var out = { stored: [], refused: res.refused.slice() };
      return res.items.reduce(function (chain, it, i) {
        return chain.then(function () {
          if (typeof opts.onProgress === 'function') opts.onProgress(i + 1, res.items.length);
          return OW.live.uploadMedia(it.src, it).then(function (u) {
            if (u.ok) out.stored.push(u.item);
            else out.refused.push({ name: it.name, why: u.error });
          });
        });
      }, Promise.resolve()).then(function () {
        if (typeof opts.onDone === 'function') opts.onDone(out);
        return out;
      });
    });
  };

  /* ── THE IMAGE-SHRINK UNIT, WHOLE ───────────────────────────────────────
     `CO_MAX_BYTES`, `coBytes` and `coShrink` are one unit: coShrink consults
     both, and every caller of all three is in THIS file. An extraction had
     moved the cap and the shrinker into app/create/create.js while leaving
     coBytes and all eight call sites here — and create.js loads eight scripts
     later, so the references could never resolve. Create opened on
     `coShrink is not defined`. Kept together so the split cannot recur. */
  /* the runtime's own cap is 64MB ("a phone video, not a film"); the base64
     body is ~4/3 of that, so the client refuses earlier and says why rather
     than letting the person wait out an upload that ends in a 413 */
  var CO_MAX_BYTES = 44 * 1024 * 1024;

  /* RESIZE, AND NEVER ONTO A BLACK GROUND. A canvas starts fully transparent
     and JPEG has no alpha, so every transparent pixel of a PNG — a logo, a
     cut-out, a screenshot with rounded corners — encodes as BLACK. A PNG
     already under the cap is passed through UNTOUCHED, which keeps its alpha
     and costs nothing; anything that must be resized is composited onto white
     first. This is the whole reason this function is shared rather than copied. */
  function coShrink(dataUrl, cb) {
    var isPng = /^data:image\/png/i.test(dataUrl);
    if (isPng && coBytes(dataUrl) <= CO_MAX_BYTES) { cb(dataUrl); return; }
    var img = new global.Image();
    img.onload = function () {
      var MAX = 1600;
      var w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
      if (!w || !h) { cb(dataUrl); return; }
      var scale = Math.min(1, MAX / Math.max(w, h));
      var cv = doc.createElement('canvas');
      cv.width = Math.round(w * scale); cv.height = Math.round(h * scale);
      var cx = cv.getContext('2d');
      cx.fillStyle = '#fff';
      cx.fillRect(0, 0, cv.width, cv.height);   /* never a black ground */
      cx.drawImage(img, 0, 0, cv.width, cv.height);
      try { cb(cv.toDataURL('image/jpeg', 0.9)); }
      catch (_) { cb(dataUrl); }        /* tainted canvas — send the original */
    };
    img.onerror = function () { cb(dataUrl); };
    img.src = dataUrl;
  }

  /* WHAT POST /api/oneway/media IS SENT for one piece: the bytes, where they came from, and a video's frame (its
     crop, the part that plays and its poster: the file is kept whole, api/oneway/social/routes.py upload_media) */
  function coMediaBody(p) {
    var b = { data: p.src, origin: p.origin || 'uploaded' };
    if (p.kind === 'video') {
      if (p.crop) b.crop = p.crop;
      if (p.trim) b.trim = p.trim;
      if (p.poster) b.poster = p.poster;
    }
    return b;
  }
  /* A PICK FROM THE EDITOR (oneway-editor.js): a photo is already cut to its frame; a video keeps its file and
     carries its frame beside it. `file` is what was chosen, so Edit opens the original again, never a crop of a crop. */
  function coFromEdit(r, file) {
    var vid = r.kind === 'video';
    return { src: r.dataUrl, kind: vid ? 'video' : 'photo', origin: 'uploaded', name: (file && file.name) || r.name || '',
             file: vid ? r.blob : (file || null), frame: r.frame, crop: vid ? r.crop : null, trim: vid ? r.trim : null,
             poster: vid ? r.poster : '' };
  }

  /* the editor's mark: the crop corners, as Photos draws its Edit */
  var CO_EDIT_MARK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" '
    + 'stroke-linejoin="round" aria-hidden="true"><path d="M6 2v14a2 2 0 0 0 2 2h14"/><path d="M18 22V8a2 2 0 0 0-2-2H2"/></svg>';

  function coBytes(dataUrl) {
    var i = String(dataUrl || '').indexOf(',');
    return i < 0 ? 0 : Math.floor((dataUrl.length - i - 1) * 3 / 4);
  }

  /* WHAT AN IMPORTED URL IS. Extension only, because import takes a LINK and
     there are no bytes to inspect — a Gallery holds references, so this is the
     only signal available at pick time. */
  function coKind(url) {
    return /\.(mp4|m4v|mov|webm|ogv)(\?|#|$)/i.test(String(url || ''))
      ? 'video' : 'photo';
  }

  function composer(host, opts) {
    opts = opts || {};
    var picks = [];            /* {src, kind, external} — held HERE, not on a server */
    var step = 0;
    var title = '', caption = '';
    var place = '';            /* '' = your profile only */
    var places = [];
    /* the platforms it can also go to, per Center it could belong to, and the
       ones chosen (founder/503) */
    var reachFor = {}, outTo = {};
    var posting = false;       /* on the upload screen (founder/493) */
    var audience = 'everyone'; /* who can see it — the post door's own three */
    var sub = '';              /* the Post screen's own page: where · who · platforms */
    function placeOf(cid) {
      var hit = null;
      places.forEach(function (p) { if (p && p.id === cid) hit = p; });
      return hit;
    }
    function reachOf(cid) {
      if (!cid) return [];
      if (reachFor[cid] === undefined) {
        reachFor[cid] = null;                               /* asked, not answered */
        OW.reach.targets(cid, placeOf(cid)).then(function (ts) {
          reachFor[cid] = ts || [];
          if ((picks.length || (posting && textPost)) && step !== 5) paintStage();
        });
      }
      return reachFor[cid] || [];
    }
    /* ── WHO YOU ARE SENDING IT TO ──────────────────────────────────────
       Founder, 2026-09-07: *"it does feel like Snapchat, and they can
       seamlessly send things to their friends through messages. There's
       basically no friction."*

       A camera app's primary act is SEND TO A PERSON. This surface could
       photograph, film, trim, name and publish — and the only destinations it
       had were your own profile and a Center. There was no way to give the
       thing you just made to somebody. That is not a missing feature of the
       camera; it is the missing half of what a camera is for. */
    var friends = [];          /* [{email, name}] — people you follow */
    var sendTo = [];           /* the ones chosen, by email */
    var stream = null, video = null, rec = null, chunks = [], facing = 'environment';
    /* whether the microphone was actually granted — a silent video is still
       a video, and the person is told rather than left wondering. */
    var hasAudio = true;

    var wrap = mk('div', 'ow-compose');
    var head = mk('div', 'ow-compose__steps');
    var stage = mk('div', 'ow-compose__stage');
    var status = mk('p', 'ow-compose__status');
    var foot = mk('div', 'ow-compose__foot');
    wrap.appendChild(head); wrap.appendChild(stage);
    wrap.appendChild(status); wrap.appendChild(foot);
    host.appendChild(wrap);

    function say(m, bad) {
      status.textContent = m || '';
      status.classList.toggle('is-bad', !!bad);
      /* the status line is behind the camera while the camera is up, so a
         problem is said over it instead */
      if (m && bad && curLens && curLens.frame.isConnected && OW.toast) OW.toast(m);
    }

    /* THE STREAM MUST NOT OUTLIVE THE SURFACE, however a person leaves it. A
       camera light still on after someone walked away is the single most
       damaging thing this surface could do. */
    function stop() {
      /* the lens is closing, whichever way it closed — the screen comes back
         (founder/493). One place, because every exit already runs this. */
      try { doc.documentElement.removeAttribute('data-ow-lens'); } catch (_) {}
      stopStream();
      curLens = null;
    }
    /* LEAVING LIGHTBULB ENDS THE MAKING SCREEN TOO — the shell announces every
       navigation (`ow:navigate`), and a screen that took the viewport must
       give it back, or the dock stays hidden on the next page. */
    function leave() {
      keepOnLeaving();
      stop();
      screenMode(false);
      doc.removeEventListener('ow:navigate', leave);
    }
    /* WHAT WAS MADE IS KEPT WHEN THE CAMERA IS LEFT MID-WAY (register row 28, drafts: Instagram's Close offers Save
       draft, TikTok keeps it in Drafts). Here nothing asks (no dialog, S rules): leaving Lightbulb with something made
       and not yet sent keeps it as a draft through the one door that already makes one (`makePrivatePost`: the
       pictures, the words, born a draft, in no feed and on no profile), and the toast says so, with Discard. A
       thing already sent to a friend is that draft already; the receipt (step 5) means it went out. Closing the
       tab itself is not covered: an upload cannot outlive the page. */
    function keepOnLeaving() {
      if (step === 5 || sentPost) return;
      var words = (caption || '').trim() || (title || '').trim();
      if (!picks.length && !(posting && textPost && words)) return;
      makePrivatePost().then(function (id) {
        if (!OW.toast) return;
        if (!id) { OW.toast('What you made could not be kept. Nothing was shared.'); return; }
        OW.toast('Kept in your drafts', { tone: 'ok', action: 'Discard', onAction: function () {
          data.del('/api/oneway/social/posts/' + encodeURIComponent(id)).then(function (r) {
            OW.toast(r && r.ok ? 'Discarded' : 'That draft could not be discarded. It is in your drafts.',
                     { tone: r && r.ok ? 'ok' : 'bad' });
          });
        } });
      });
    }
    try {
      doc.addEventListener('ow:navigate', leave);
      /* a hidden tab releases the camera and a returning one takes it back —
         the screen stays the camera the whole time (founder/545) */
      doc.addEventListener('visibilitychange', function () {
        if (doc.hidden) { if (stream) stopStream(); return; }
        if (curLens && curLens.frame.isConnected && !video && !picks.length
            && curLens.frame.getAttribute('data-state') !== 'off'
            && curLens.frame.getAttribute('data-state') !== 'ask') startStream(curLens);
      });
    } catch (_) {}
    /* WHAT YOU MADE IS ITS OWN SCREEN (founder/493: "after attaching and
       editing, they come to an upload screen, not everything on one
       portion"). From the moment something is attached until the receipt,
       the stage takes the viewport the way the lens does — edit, then post,
       then where it went — and the rest of Lightbulb waits behind it. The
       status line comes with it, so a sentence about the post is never said
       behind the screen. */
    function screenMode(on) {
      try {
        if (on) doc.documentElement.setAttribute('data-ow-make', '1');
        else doc.documentElement.removeAttribute('data-ow-make');
      } catch (_) {}
      if (on) stage.appendChild(status);
      else if (status.parentNode !== wrap) wrap.insertBefore(status, foot);
    }

    /* ── the step rail ─────────────────────────────────────────────────── */
    /* THE RAIL APPEARS WHEN THERE IS SOMETHING TO STEP THROUGH.
       Founder: *"everything should have steps to it"* — and also that Create
       should feel like making something rather than filling a form. Five greyed
       steps shown before a person has touched anything served the first and
       broke the second: taking one photo LOOKED like a five-stage process.

       So step 1 is just the camera, and the rail appears the moment there is
       something to arrange — which is exactly when the steps start being true.
       The steps are not removed; they stop being a warning. */
    /* ══ THERE IS NO WALKTHROUGH ═══════════════════════════════════════════
       ★ FOUNDER, 2026-09-07: *"You may feel like a walk through with steps
         that should feel like a tool that people everyday naturally use."*

       This drew "1. Make · 2. Review · 3. Describe · 4. Where · 5. Send" across
       the top and a Next button underneath, and that rail IS the complaint. A
       numbered path tells a person they are COMPLETING A PROCESS. Nothing
       anybody opens forty times a day does that: a camera is a place you are,
       not a form you finish, and no camera on any phone has ever shown a step
       counter.

       The rail was also honest work — it earned its place when Create meant
       assembling a document, and the earlier rulings about steps were about
       that. A photograph is not that, and the founder has now said so twice.

       SO THERE ARE TWO SURFACES AND NO STAGES: the camera, and what you made.
       Everything the middle steps held — a name, a caption, where it goes — is
       still here, sitting ON the second surface as fields you may ignore,
       because none of them was ever a decision that needed its own screen.

       This function stays and renders nothing. Deleting it would mean chasing
       every caller, and a `head` that is empty is what "no rail" IS. */
    function paintSteps() {
      head.innerHTML = '';
      head.style.display = 'none';
    }
    /* A STEP YOU HAVE NOT EARNED IS SHOWN AND DISABLED, NEVER HIDDEN — the
       shape of the path is itself information, and "Arrange" with nothing to
       arrange is a step that can only disappoint. */
    function canReach(i) {
      if (i === 0) return true;
      return picks.length > 0;
    }
    function go(i) {
      if (i > 0) stop();                /* leaving the lens releases it */
      if (i === 0) { posting = false; sub = ''; textPost = false; }   /* back to the camera is back to the start */
      step = i; say('');
      paintSteps(); paintStage(); paintFoot();
    }

    /* ══ LIGHTBULB OPENS AS THE CAMERA ════════════════════════════════════
       ★ FOUNDER/544: *"Get light bulb feeling like the Snapchat camera. Before
         it becomes like the TikTok post page … At first it should feel like a
         fresh place using the user's camera for fresh ideas. And also
         uploading like we discussed."*
       ★ FOUNDER/545: *"no tap to start thats friction i want none"*
       ★ FOUNDER/546: *"maybe on pc with permissions and allat"*

       THE CAMERA IS THE FIRST SCREEN, AND ON A PHONE IT IS SIMPLY ON. This
       overturns the rule that stood here since 2026-08-08 ("a surface that
       opens with a permission dialog has already failed") and the 2026-09-07
       middle ground that opened straight in only when the browser had already
       said yes. The browser's own one-time question is the only thing left
       between a person and their camera; ONEWAY adds nothing to it.

       A COMPUTER IS THE ONE EXCEPTION HE ALLOWED: until the browser has said
       yes, one press turns the camera on. After that a computer opens straight
       in too.

       IT IS A PLACE, NOT A SHEET OVER A PAGE. The dock stays over the picture
       the way Snapchat's does, so a person leaves the camera the way they
       leave anything else. Upload and Import sit beside the shutter
       (founder/493), and under it the three ways of making: the camera, words
       on their own, and the rest of Lightbulb. Whatever cannot run (no
       camera, a refusal) is said in one line on the same screen, with Upload
       and Import still under the thumb. */
    var mode = opts.mode === 'write' ? 'write' : 'camera';
    var lensShut = false;      /* the person chose More: the rest of Lightbulb */
    /* A PLACE FROM THE FIRST RUN (founder/846): sign-up's "Put a place on Oneway" leaves one to confirm; Lightbulb opens on
       More, where create.js shows it filled in, never on a camera the person did not ask for */
    try { if (global.sessionStorage && global.sessionStorage.getItem('ow_place_prefill')) lensShut = true; } catch (_) {}
    try { if (global.sessionStorage && global.sessionStorage.getItem('ow_place_near')) lensShut = true; } catch (_) {}   /* an area request's tap */
    var textPost = false;      /* words on their own went to the post page */
    var lensGen = 0;           /* a stream that answers after its lens closed is released */
    var curLens = null;

    function isPhone() {
      try { return !!(global.matchMedia && global.matchMedia('(pointer: coarse)').matches); }
      catch (_) { return false; }
    }
    function lensOn() {
      try { doc.documentElement.setAttribute('data-ow-lens', '1'); } catch (_) {}
    }
    /* the stream alone — the screen stays. Flip, Write and a hidden tab use
       this; `stop()` is for leaving the camera altogether. */
    function stopStream() {
      lensGen++;
      try { if (rec && rec.state === 'recording') rec.stop(); } catch (_) {}
      rec = null;
      try { if (stream) stream.getTracks().forEach(function (t) { t.stop(); }); } catch (_) {}
      stream = null;
      if (video) { try { video.pause(); } catch (_) {} if (video.parentNode) video.parentNode.removeChild(video); }
      video = null;
    }

    function paintChoose() {
      stage.innerHTML = '';
      stage.removeAttribute('data-screen');
      if (lensShut) { drawDoor(); return; }
      if (mode === 'write') { paintWrite(); return; }
      openLens();
    }

    /* THE STRIP UNDER THE SHUTTER — what you are making with it */
    function modeStrip(frame) {
      var strip = mk('div', 'ow-compose__modes');
      [['camera', 'Camera'], ['write', 'Write'], ['more', 'More']].forEach(function (m) {
        var b = mk('button', 'ow-compose__mode', m[1]);
        b.type = 'button';
        b.setAttribute('aria-pressed', String(mode === m[0]));
        if (m[0] === 'more') b.setAttribute('aria-label', 'More of Lightbulb: writing, drafts and everything else you can make');
        b.addEventListener('click', function () {
          if (m[0] === mode) return;
          if (m[0] === 'more') {
            lensShut = true; stop(); stage.innerHTML = ''; drawDoor();
            try { global.scrollTo(0, 0); } catch (_) {}
            return;
          }
          stopStream();
          mode = m[0];
          paintChoose();
        });
        strip.appendChild(b);
      });
      frame.appendChild(strip);
    }

    function lensShell() {
      stage.innerHTML = '';
      var frame = mk('div', 'ow-compose__lens');
      frame.setAttribute('data-state', 'starting');
      var mid = mk('div', 'ow-compose__lensmid');
      frame.appendChild(mid);
      var panel = mk('div', 'ow-compose__lenspanel');
      frame.appendChild(panel);

      var top = mk('div', 'ow-compose__lenstop');
      var flip = mk('button', 'ow-compose__round');
      flip.type = 'button';
      flip.setAttribute('aria-label', 'Switch camera');
      flip.title = 'Switch camera';
      flip.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8.5h3l1.8-2.5h6.4L17 8.5h3V19H4z"/><path d="M9 13.4a3.1 3.1 0 0 1 5.4-1.9M15 13.2a3.1 3.1 0 0 1-5.4 1.9"/><path d="M14.6 9.8v1.9h-1.9M9.4 16.6v-1.9h1.9"/></svg>';
      flip.addEventListener('click', function () {
        facing = (facing === 'environment') ? 'user' : 'environment';
        stopStream(); startStream(L);
      });
      top.appendChild(mk('span', ''));
      top.appendChild(flip);
      frame.appendChild(top);

      var bar = mk('div', 'ow-compose__bar');
      /* ── ONE SHUTTER. TAP IS A PHOTO, HOLD IS A VIDEO. (2026-09-07)
         The press length decides, so nobody has to choose what they are
         making before they can see what they are pointing at. Pointer events
         give one path for a finger, a pen and a mouse; `setPointerCapture`
         ends a video on release even if the finger slid off; `contextmenu` is
         refused because a phone reads a long press as "select this". */
      var HOLD_MS = 320;
      var holdTimer = null, holding = false, recording = false;
      var shot = mk('button', 'ow-compose__shutter');
      shot.type = 'button';
      shot.setAttribute('aria-label', 'Tap for a photo, hold for a video');
      function beginHold(e) {
        if (!video) return;
        if (holding) return;
        holding = true;
        try { shot.setPointerCapture(e.pointerId); } catch (_) {}
        holdTimer = global.setTimeout(function () {
          holdTimer = null;
          recording = true;
          shot.classList.add('is-rec');
          frame.setAttribute('data-rec', '1');
          toggleRec(shot, true);
        }, HOLD_MS);
      }
      function endHold() {
        if (!holding) return;
        holding = false;
        if (holdTimer) { global.clearTimeout(holdTimer); holdTimer = null; snap(); return; }
        if (recording) {
          recording = false;
          shot.classList.remove('is-rec');
          frame.removeAttribute('data-rec');
          toggleRec(shot, false);
        }
      }
      shot.addEventListener('pointerdown', beginHold);
      shot.addEventListener('pointerup', endHold);
      shot.addEventListener('pointercancel', endHold);
      shot.addEventListener('contextmenu', function (e) { e.preventDefault(); });
      /* before the camera is on, the shutter is the way to turn it on (546) */
      shot.addEventListener('click', function () {
        if (!video && frame.getAttribute('data-state') === 'ask') startStream(L);
      });
      shot.addEventListener('keydown', function (e) {
        if ((e.key === ' ' || e.key === 'Enter') && video) { e.preventDefault(); snap(); }
      });

      /* Upload and Import beside the shutter (founder/493): a mark and one
         word each, because the row is over a live picture; the title carries
         the rest. */
      var pick = mk('button', 'ow-compose__side');
      pick.type = 'button';
      pick.setAttribute('aria-label', 'Upload photos and videos from this device');
      pick.title = 'Upload photos and videos from this device';
      pick.innerHTML = '<span>' + (OW.glyph ? OW.glyph('share') : '') + '</span><b>Upload</b>';
      pick.addEventListener('click', function () { filePick.click(); });
      var imp = mk('button', 'ow-compose__side');
      imp.type = 'button';
      imp.setAttribute('aria-label', 'Import something you host elsewhere');
      imp.title = 'Import something you host elsewhere';
      imp.innerHTML = '<span>' + (OW.glyph ? OW.glyph('link') : '') + '</span><b>Import</b>';
      imp.addEventListener('click', function () { openImport(panel); });
      bar.appendChild(pick); bar.appendChild(shot); bar.appendChild(imp);
      frame.appendChild(bar);
      modeStrip(frame);
      stage.appendChild(frame);
      lensOn();

      var L = {
        frame: frame,
        panel: panel,
        state: function (s) { frame.setAttribute('data-state', s); shot.disabled = (s === 'off'); },
        /* one line, on the picture, saying why it is dark */
        off: function (words) {
          L.state('off');
          mid.innerHTML = '';
          mid.appendChild(mk('p', 'ow-compose__lensnote', esc(words)));
        },
        /* a computer whose browser has not said yes yet: one press (546) */
        ask: function () {
          L.state('ask');
          mid.innerHTML = '';
          var on = mk('button', 'ow-compose__lenson', 'Turn on camera');
          on.type = 'button';
          on.addEventListener('click', function () { startStream(L); });
          mid.appendChild(on);
        },
        live: function () { L.state('live'); mid.innerHTML = ''; }
      };
      curLens = L;
      return L;
    }

    var CAM_OFF = 'Your browser has the camera off for Oneway. Turn it on from the address bar, or upload instead.';
    function startStream(L) {
      var md = global.navigator && global.navigator.mediaDevices;
      if (!md || !md.getUserMedia) { L.off('No camera on this device. Upload or import instead.'); return; }
      var gen = ++lensGen;
      L.state('starting');
      /* AUDIO IS ASKED FOR WITH THE PICTURE, because the shutter does not know
         yet whether this will be a video; a refusal of the microphone still
         leaves a camera and silent video (2026-09-07). */
      md.getUserMedia({ video: { facingMode: facing }, audio: true })
        .catch(function () {
          hasAudio = false;
          return md.getUserMedia({ video: { facingMode: facing }, audio: false });
        })
        .then(function (s) {
          /* THE PERSON MAY HAVE LEFT WHILE THE BROWSER WAS ASKING — a camera
             light on for a screen nobody is looking at is the worst thing this
             surface could do, so a late stream is released at once. */
          if (gen !== lensGen || !L.frame.isConnected) {
            s.getTracks().forEach(function (t) { t.stop(); });
            return;
          }
          stream = s;
          video = doc.createElement('video');
          video.setAttribute('playsinline', '');
          video.muted = true;
          video.srcObject = s;
          if (facing === 'user') video.setAttribute('data-mirror', '1');
          video.play().catch(function () {});
          L.frame.insertBefore(video, L.frame.firstChild);
          L.live();
        })
        .catch(function (e) {
          if (gen !== lensGen || !L.frame.isConnected) return;
          var n = (e && e.name) || '';
          L.off(n === 'NotAllowedError' || n === 'SecurityError' ? CAM_OFF
            : n === 'NotFoundError' || n === 'OverconstrainedError' ? 'No camera found. Upload or import instead.'
            : 'The camera did not start. Upload or import instead.');
        });
    }

    function openLens() {
      mode = 'camera';
      var L = lensShell();
      var md = global.navigator && global.navigator.mediaDevices;
      if (!md || !md.getUserMedia) { L.off('No camera on this device. Upload or import instead.'); return; }
      if (isPhone()) { startStream(L); return; }          /* 545: no tap */
      var perms = global.navigator.permissions;
      if (!perms || !perms.query) { L.ask(); return; }
      try {
        perms.query({ name: 'camera' }).then(function (st) {
          if (!L.frame.isConnected || picks.length) return;
          if (st && st.state === 'granted') startStream(L);
          else if (st && st.state === 'denied') L.off(CAM_OFF);
          else L.ask();
        }, function () { if (L.frame.isConnected) L.ask(); });
      } catch (e) { L.ask(); }
    }

    /* WORDS ON THEIR OWN — the camera's third way of making. The screen is
       the person's colour instead of a picture, the words are the thing, and
       Next goes to the same post page a photo goes to. One post type
       (2026-09-07): these are the Post's words, with no media inside it. */
    function paintWrite() {
      stage.innerHTML = '';
      var frame = mk('div', 'ow-compose__lens ow-compose__write');
      frame.setAttribute('data-state', 'write');
      var ta = doc.createElement('textarea');
      ta.className = 'ow-compose__words';
      ta.placeholder = 'Say something';
      ta.setAttribute('aria-label', 'What you want to say');
      ta.maxLength = 5000;
      ta.value = caption;
      var bar = mk('div', 'ow-compose__bar');
      var next = mk('button', 'ow-btn ow-compose__next', 'Next');
      next.type = 'button';
      next.disabled = !caption.trim();
      ta.addEventListener('input', function () { caption = ta.value; next.disabled = !caption.trim(); });
      next.addEventListener('click', function () {
        if (!caption.trim()) return;
        textPost = true; stop(); posting = true; paintStage();
        try { global.scrollTo(0, 0); } catch (_) {}
      });
      bar.appendChild(next);
      frame.appendChild(ta);
      frame.appendChild(bar);
      modeStrip(frame);
      stage.appendChild(frame);
      lensOn();
      if (!isPhone()) { try { ta.focus(); } catch (_) {} }
    }

    /* THE CAMERA, AFTER THE PERSON CHOSE MORE: the rest of Lightbulb is under
       it, and this is the way back in. */
    function drawDoor() {
      var lens = mk('button', 'ow-compose__lensdoor');
      lens.type = 'button';
      lens.setAttribute('aria-label', 'Open the camera');
      lens.innerHTML =
        '<span class="ow-compose__ring"></span>' +
        '<span class="ow-compose__lenslbl">Camera</span>';
      lens.addEventListener('click', function () { lensShut = false; openLens(); });
      stage.appendChild(lens);
      var row = mk('div', 'ow-compose__ways');
      way(row, 'Upload', 'photos and videos, as many as you like',
          function () { filePick.click(); });
      way(row, 'Import a link', 'something you host elsewhere',
          function () { openImport(row); });
      stage.appendChild(row);
    }
    function way(host2, label, why, run) {
      var b = mk('button', 'ow-compose__way');
      b.type = 'button';
      b.innerHTML = '<b>' + esc(label) + '</b><span>' + esc(why) + '</span>';
      b.addEventListener('click', run);
      host2.appendChild(b);
      return b;
    }

    /* IMPORT IS THE SAME `/media` CALL. A Gallery holds references, so an
       external URL is the primitive rather than a special case — no fetch, no
       proxy, no second store. Over the camera it opens on the picture, above
       the shutter; its message is said in the box, because the status line
       is behind the camera. */
    function openImport(seat) {
      var had = seat.querySelector('.ow-compose__imp');
      if (had) { had.remove(); return; }
      var box = mk('div', 'ow-compose__imp');
      var fld = mk('div', 'ow-fld');
      var input = doc.createElement('input');
      input.type = 'url';
      input.placeholder = 'https://…';
      input.setAttribute('aria-label', 'Link to import');
      fld.appendChild(input);
      var add = mk('button', 'ow-btn', 'Add it');
      add.type = 'button';
      var note = mk('p', 'ow-compose__impnote', '');
      add.addEventListener('click', function () {
        var u = input.value.trim();
        if (!u) return;
        if (!/^https?:\/\//i.test(u)) { note.textContent = 'That needs to be a http or https link.'; return; }
        picks.push({ src: u, kind: coKind(u), external: true });
        box.remove();
        say('');
        go(1);
      });
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); add.click(); }
        if (e.key === 'Escape') box.remove();
      });
      box.appendChild(fld); box.appendChild(add); box.appendChild(note);
      seat.appendChild(box);
      input.focus();
    }

    function snap() {
      if (!video) return;
      var w = video.videoWidth || 1280, h = video.videoHeight || 720;
      var cv = doc.createElement('canvas');
      cv.width = w; cv.height = h;
      var cx = cv.getContext('2d');
      /* the front camera is shown as a mirror, and the photo is what was seen */
      if (facing === 'user') { cx.translate(w, 0); cx.scale(-1, 1); }
      cx.drawImage(video, 0, 0, w, h);
      /* JPEG — a phone frame as PNG is several megabytes for no gain */
      /* ── WHERE IT CAME FROM IS DECIDED HERE AND NOWHERE ELSE ──────────
         ★ B, 2026-09-07: origin is `captured | created | uploaded | imported`
           and is *"declared by the client, never inferred — only you know
           whether the camera or the picker produced a file."* True: by the
           time bytes reach the server a shutter and a file chooser are
           identical, and the founder's *"people should be able to distinct
           uploading pictures, videos"* is a fact about each ITEM, not about
           the Post — one Post can carry a photograph you took beside one you
           picked, and both are the same type of post. */
      picks.push({ src: cv.toDataURL('image/jpeg', 0.9), kind: 'photo',
                   origin: 'captured' });
      stop();
      go(1);                              /* straight to Arrange, never away */
    }

    /* `want` is EXPLICIT — true starts, false stops — because the shutter now
       drives this from a gesture rather than from alternating taps. A hold
       that ends before the recorder finished starting would otherwise toggle
       it ON at the moment the finger came up, and leave the camera recording
       with nobody holding anything. Omitted, it still behaves as the toggle it
       was, so any other caller is unaffected. */
    function toggleRec(btn, want) {
      if (!global.MediaRecorder) {
        say('This browser cannot record video — you can film with your camera '
            + 'app and upload it instead.', 1);
        return;
      }
      var on = !!(rec && rec.state === 'recording');
      if (want === undefined) want = !on;
      if (want === on) return;
      if (!want) { try { rec.stop(); } catch (_) {} return; }
      chunks = [];
      var mime = '';
      ['video/mp4', 'video/webm;codecs=vp9', 'video/webm'].some(function (m) {
        if (global.MediaRecorder.isTypeSupported
            && global.MediaRecorder.isTypeSupported(m)) { mime = m; return true; }
        return false;
      });
      try { rec = new global.MediaRecorder(stream, mime ? { mimeType: mime } : undefined); }
      catch (_) { say('This browser refused to record.', 1); return; }
      rec.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
      rec.onstop = function () {
        var blob = new global.Blob(chunks, { type: mime || 'video/webm' });
        var fr = new global.FileReader();
        fr.onload = function () {
          var src = String(fr.result || '');
          if (coBytes(src) > CO_MAX_BYTES) {
            say('That clip is too big to send — keep it under about '
                + Math.round(CO_MAX_BYTES / (1024 * 1024)) + 'MB.', 1);
            return;
          }
          picks.push({ src: src, kind: 'video', origin: 'captured' });
          stop();
          go(1);
          /* SAID ONCE, AT THE MOMENT IT MATTERS. A person who declined the
             microphone gets a video with no sound, and finding that out on
             playback — after sending it — is worse than being told here. */
          if (!hasAudio) say('That was recorded without sound: the microphone '
                             + 'is off for Oneway.', 1);
        };
        fr.onerror = function () { say('That recording could not be read.', 1); };
        fr.readAsDataURL(blob);
      };
      rec.start();
      btn.classList.add('is-on');
      say('');
    }

    /* UPLOAD. Multiple, photos AND videos, feeding the same picks list — one
       pipeline, never a second one. */
    var filePick = doc.createElement('input');
    filePick.type = 'file';
    filePick.accept = 'image/*,video/*';
    filePick.multiple = true;
    filePick.style.display = 'none';
    filePick.addEventListener('change', function () {
      var files = Array.prototype.slice.call(filePick.files || []);
      filePick.value = '';                /* so the same file can be picked twice */
      if (!files.length) return;
      /* THE EDITOR OPENS AT THE UPLOAD (founder/831), over the camera, and hands back each piece in its frame;
         Cancel leaves the camera exactly as it was */
      if (typeof OW.editMedia === 'function') {
        OW.editMedia(files, { frame: 'post', videoFrame: 'postVideo', title: 'New post' }).then(function (res) {
          if (!res || !res.length) return;
          res.forEach(function (r, i) {
            var it = coFromEdit(r, files[i]);
            if (coBytes(it.src) > CO_MAX_BYTES) {
              say('"' + (it.name || 'that file') + '" is too big to send \u2014 keep it under about '
                  + Math.round(CO_MAX_BYTES / (1024 * 1024)) + 'MB.', 1);
              return;
            }
            picks.push(it);
          });
          if (picks.length) go(1);
        });
        return;
      }
      say('Reading ' + files.length + (files.length === 1 ? ' file…' : ' files…'));
      var left = files.length;
      files.forEach(function (f) {
        var fr = new global.FileReader();
        fr.onerror = function () { if (!--left) go(1); };
        fr.onload = function () {
          var src = String(fr.result || '');
          var isVid = /^data:video\//i.test(src);
          var done = function (out) {
            if (coBytes(out) > CO_MAX_BYTES) {
              say('"' + (f.name || 'that file') + '" is too big to send — keep it '
                  + 'under about ' + Math.round(CO_MAX_BYTES / (1024 * 1024)) + 'MB.', 1);
            } else {
              picks.push({ src: out, kind: isVid ? 'video' : 'photo',
                           origin: 'uploaded' });
            }
            if (!--left) go(1);
          };
          /* a modern phone photo blows through the cap, so it is re-encoded
             on the same canvas the camera path uses. Video is passed through:
             re-encoding it in a browser is not something to do quietly. */
          if (isVid) done(src); else shrink(src, done);
        };
        fr.readAsDataURL(f);
      });
    });
    wrap.appendChild(filePick);

    /* TRANSPARENCY BECOMES BLACK IF YOU LET IT, AND THAT IS THE BLACK BOX
       ARRIVING BY A THIRD ROUTE. A canvas starts fully transparent and JPEG
       has no alpha channel, so every transparent pixel of a PNG — a logo, a
       screenshot with rounded corners, a sticker, anything cut out — encodes
       as BLACK. Caught on screen: a transparent test PNG rendered as a solid
       black square in the Arrange grid.

       Two answers, in order. A PNG already under the cap is passed through
       UNTOUCHED, which keeps its alpha and costs nothing — re-encoding a file
       that does not need it only ever loses something. Anything that must be
       resized is composited onto WHITE first, so flattening produces the
       colour a person expects rather than the one the format defaults to. */
    /* `shrink` lives at module scope now (see coShrink) so the composer and
       any operator-side intake share ONE implementation — the transparency fix
       must not exist twice. */
    var shrink = coShrink;

    /* ── WHAT YOU MADE, and what you do with it ───────────────────────── */
    function paintArrange() {
      stage.innerHTML = '';
      if (!picks.length) {
        stage.appendChild(mk('p', 'ow-compose__why',
          'Nothing chosen yet. Go back and take, film, upload or import something.'));
        return;
      }
      /* THE THING FIRST, THEN WHAT TO DO WITH IT. The acts were rendered
         ABOVE the photograph — a person looked at two buttons before they
         looked at what they had taken, which is the ordering of a form rather
         than of a camera. Nothing anybody uses every day asks you to decide
         before it shows you.

         AND THE INSTRUCTIONAL LINE IS GONE with one thing. "One thing, ready.
         The first is what people see first." is a sentence teaching a rule
         about ORDER, and there is no order to teach until there are two. */
      if (picks.length > 1) {
        stage.appendChild(mk('p', 'ow-compose__why',
          picks.length + ' things. The first is what people see first.'));
      }
      var grid = mk('div', 'ow-compose__picks');
      grid.setAttribute('data-n', String(picks.length));
      /* the editor (and the look of its Edit mark) arrives before the press that needs it */
      if (OW.need && !(OW.editMedia && OW.editMedia.__owReal)) OW.need('editor').catch(function () {});
      picks.forEach(function (p, i) {
        var cell = mk('div', 'ow-compose__pick');
        if (p.kind === 'video') {
          var v = doc.createElement('video');
          v.src = p.src; v.muted = true; v.setAttribute('playsinline', '');
          v.preload = 'metadata';
          cell.appendChild(v);
          /* framed as it will play: its crop and the part that plays (oneway-popit.js OW.mediaFrame) */
          if ((p.crop || p.trim) && OW.mediaFrame) OW.mediaFrame.apply(v, p, { fit: 'contain' });
          cell.appendChild(mk('span', 'ow-compose__tag', 'Video'));
          /* TRIM — the one edit almost every clip needs. Lightbulb could film
             and upload video and could not cut a second off either end, which
             is the difference between a camera and something you'd post from.
             It is the editor now (founder/831): the frame and the trim together, and nothing re-encoded. */
          var editor = typeof OW.editMedia === 'function';
          var trimBtn = mk('button', 'ow-compose__trim' + (editor ? ' ow-ed-entry' : ''), editor ? CO_EDIT_MARK + '<span>Edit</span>' : 'Trim');
          trimBtn.type = 'button';
          trimBtn.setAttribute('aria-label', (editor ? 'Edit video ' : 'Trim video ') + (i + 1));
          trimBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            if (editor) editPick(p, i); else openTrim(p, i);
          });
          cell.appendChild(trimBtn);
        } else {
          var im = doc.createElement('img');
          im.src = p.src; im.alt = '';
          /* cut to its frame in the editor, so it is shown whole: what is seen here is what is posted */
          if (p.frame) im.style.setProperty('object-fit', 'contain', 'important');
          cell.appendChild(im);
          if (p.external) cell.appendChild(mk('span', 'ow-compose__tag', 'Link'));
          else if (typeof OW.editMedia === 'function') {
            var editBtn = mk('button', 'ow-compose__trim ow-ed-entry', CO_EDIT_MARK + '<span>Edit</span>');
            editBtn.type = 'button';
            editBtn.setAttribute('aria-label', 'Edit photo ' + (i + 1));
            editBtn.addEventListener('click', function (e) { e.stopPropagation(); editPick(p, i); });
            cell.appendChild(editBtn);
          }
        }
        var rm = mk('button', 'ow-compose__rm', '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12"/></svg><span>Remove</span>');
        rm.type = 'button';
        rm.setAttribute('aria-label', 'Remove item ' + (i + 1));
        rm.addEventListener('click', function () { picks.splice(i, 1); go(1); });
        cell.appendChild(rm);
        grid.appendChild(cell);
      });
      stage.appendChild(grid);
      var more = mk('button', 'po-act ow-compose__more', '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg><span>Add more</span>');
      more.setAttribute('aria-label', 'Add more');
      more.type = 'button';
      more.addEventListener('click', function () { go(0); });
      stage.appendChild(more);
    }


    /* EDIT A PIECE AGAIN: the original opens in the editor (a photo from its file, a video with its frame and trim
       where they were left), and what comes back takes its place. Cancel changes nothing. */
    function editPick(p, idx) {
      /* a photo without a file (the camera's) keeps the shot it started from, so it is never a crop of a crop */
      var from = p.file || p.orig || p.src;
      OW.editMedia(from, { frame: 'post', videoFrame: 'postVideo', frameKey: p.frame, title: 'Edit',
                           crop: p.kind === 'video' ? p.crop : null, trim: p.kind === 'video' ? p.trim : null })
        .then(function (r) {
          if (!r) return;
          var it = coFromEdit(r, p.file);
          it.origin = p.origin || 'uploaded';
          if (!it.file && it.kind === 'photo') it.orig = p.orig || p.src;
          picks[idx] = it;
          go(1);
        });
    }

    /* ═══ TRIM — REAL, NOT A REMEMBERED IN/OUT POINT ═══════════════════════
       (founder/831 moved this: the editor keeps the clip whole and the frame and trim travel beside it, honoured by
       every renderer through OW.mediaFrame; this re-recording stays only for a page without the editor.)
       The tempting version stores `in`/`out` on the media row and lets players
       honour it. That is a WRITE NOBODY READS: the feed's cover, the immersive
       player, the gallery viewer and every future reader would each have to
       learn the convention, and until all of them did, a "trimmed" clip would
       play full-length everywhere it mattered. This codebase has a name for
       that defect and has been bitten by it three times.

       So the trim PRODUCES A REAL, SHORTER FILE — captureStream() off a
       <video> into MediaRecorder — and the rest of the platform needs to know
       nothing. It costs the clip's own duration in real time, which is honest
       and is why the button says so rather than pretending to be instant.

       DEGRADES RATHER THAN LIES: a browser without captureStream or
       MediaRecorder is told plainly that it cannot trim here, and the original
       is kept untouched. */
    function openTrim(p, idx) {
      var wrap = mk('div', 'ow-trim');
      var v = doc.createElement('video');
      v.src = p.src; v.setAttribute('playsinline', ''); v.preload = 'metadata';
      v.muted = true; v.className = 'ow-trim__v';
      wrap.appendChild(v);

      var read = mk('p', 'ow-compose__why', 'Reading the clip…');
      wrap.appendChild(read);
      var row = mk('div', 'ow-trim__row');
      var inR = doc.createElement('input'); inR.type = 'range'; inR.min = 0; inR.step = 0.05;
      var outR = doc.createElement('input'); outR.type = 'range'; outR.min = 0; outR.step = 0.05;
      inR.setAttribute('aria-label', 'Start'); outR.setAttribute('aria-label', 'End');
      row.appendChild(inR); row.appendChild(outR);

      var acts = mk('div', 'po-acts');
      acts.style.setProperty('--h', 'var(--ow-h1)');
      acts.style.setProperty('--h2', 'var(--ow-h2)');
      var keep = mk('button', 'ow-btn', 'Trim it');
      keep.type = 'button'; keep.disabled = true;
      var cancel = mk('button', 'po-act', 'Cancel');
      cancel.type = 'button';
      cancel.addEventListener('click', function () { go(1); });
      acts.appendChild(keep); acts.appendChild(cancel);

      var note = mk('p', 'ow-compose__status');

      v.addEventListener('loadedmetadata', function () {
        var dur = v.duration;
        /* A CLIP OF UNKNOWN LENGTH CANNOT BE TRIMMED HONESTLY. Some recordings
           report Infinity until they are fully seeked; saying so beats showing
           a slider that means nothing. */
        if (!isFinite(dur) || dur <= 0) {
          read.textContent = 'This clip does not report its length, so it cannot be trimmed here.';
          return;
        }
        inR.max = outR.max = dur;
        inR.value = 0; outR.value = dur;
        keep.disabled = false;
        function say() {
          var a = Math.min(+inR.value, +outR.value), b = Math.max(+inR.value, +outR.value);
          read.textContent = 'Keeping ' + (b - a).toFixed(1) + 's of ' + dur.toFixed(1) + 's'
                           + ' — from ' + a.toFixed(1) + 's to ' + b.toFixed(1) + 's.';
          v.currentTime = a;
        }
        inR.addEventListener('input', say);
        outR.addEventListener('input', say);
        say();
      });
      v.addEventListener('error', function () {
        read.textContent = 'That clip could not be opened.';
      });

      keep.addEventListener('click', function () {
        var a = Math.min(+inR.value, +outR.value), b = Math.max(+inR.value, +outR.value);
        if (b - a < 0.2) { note.textContent = 'That is too short to keep.'; return; }
        keep.disabled = true;
        trimVideo(v, a, b, note, function (blob) {
          if (!blob) { keep.disabled = false; return; }
          var fr = new global.FileReader();
          fr.onload = function () {
            picks[idx] = { src: String(fr.result || ''), kind: 'video' };
            go(1);
          };
          fr.onerror = function () { note.textContent = 'The trimmed clip could not be read.'; keep.disabled = false; };
          fr.readAsDataURL(blob);
        });
      });

      wrap.appendChild(row); wrap.appendChild(acts); wrap.appendChild(note);
      stage.innerHTML = '';
      stage.appendChild(wrap);
    }

    /* RE-RECORD THE KEPT RANGE. `captureStream` gives the element's own output,
       so this is a straight copy of what plays — no canvas, no per-frame draw,
       and the audio track comes with it. It runs in REAL TIME because that is
       what the media element does; the note says so while it works, because a
       silent ten-second wait reads as a hang. */
    function trimVideo(srcVideo, a, b, note, done) {
      if (!srcVideo.captureStream && !srcVideo.mozCaptureStream) {
        note.textContent = 'This browser cannot trim video — the clip is unchanged.';
        return done(null);
      }
      if (!global.MediaRecorder) {
        note.textContent = 'This browser cannot record — the clip is unchanged.';
        return done(null);
      }
      var stream;
      try {
        stream = srcVideo.captureStream ? srcVideo.captureStream() : srcVideo.mozCaptureStream();
      } catch (_) {
        note.textContent = 'This clip cannot be trimmed here — it is unchanged.';
        return done(null);
      }
      var mime = ['video/mp4', 'video/webm;codecs=vp9', 'video/webm'].filter(function (m) {
        return global.MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(m);
      })[0];
      var rec2;
      try { rec2 = new global.MediaRecorder(stream, mime ? { mimeType: mime } : undefined); }
      catch (_) { note.textContent = 'This browser refused to trim.'; return done(null); }

      var chunks2 = [];
      rec2.ondataavailable = function (e) { if (e.data && e.data.size) chunks2.push(e.data); };
      rec2.onstop = function () {
        srcVideo.muted = true;
        note.textContent = '';
        done(new global.Blob(chunks2, { type: mime || 'video/webm' }));
      };

      var stopAt = function () {
        if (srcVideo.currentTime >= b - 0.03) {
          srcVideo.removeEventListener('timeupdate', stopAt);
          try { srcVideo.pause(); } catch (_) {}
          try { rec2.stop(); } catch (_) {}
        }
      };
      srcVideo.currentTime = a;
      srcVideo.muted = false;          /* the audio has to be flowing to be captured */
      srcVideo.addEventListener('timeupdate', stopAt);
      note.textContent = 'Trimming — this takes about ' + (b - a).toFixed(1) + 's, the length you kept.';
      rec2.start();
      srcVideo.play().catch(function () {
        note.textContent = 'The clip would not play, so it could not be trimmed.';
        try { rec2.stop(); } catch (_) {}
        done(null);
      });
      /* A HARD CEILING, because `timeupdate` stops firing if a tab is
         backgrounded and the recorder would otherwise run forever. */
      setTimeout(function () {
        if (rec2.state === 'recording') { try { srcVideo.pause(); rec2.stop(); } catch (_) {} }
      }, Math.ceil((b - a) * 1000) + 2500);
    }

    /* ══ SEND IT TO SOMEBODY. THE WHOLE POINT OF A CAMERA. ═════════════════
       ★ FOUNDER, 2026-09-07: *"they can seamlessly send things to their friends
         through messages. There's basically no friction or anything like that."*

       IT DID NOT EXIST. Step 4 "Where" offered exactly two destinations —
       your profile, and a place you belong to — and the composer had never
       called `/api/oneway/sharing/to-conversation` even though the Post page
       had used it for weeks. A finished backend with no producer, on the one
       act a camera app is for.

       IT SITS AT REVIEW, not at the end. Snapchat is shutter, person, sent;
       everything after this step — a name, a caption, a destination — is for
       something you are PUBLISHING, and a person sending one photograph to one
       friend should never walk past it.

       ── WHAT "PRIVATE" MEANS HERE, EXACTLY ────────────────────────────────
       The Post is created as a DRAFT. A draft is in no feed and — since the
       fix in the same change as this — on no profile. The share reference is
       what GRANTS SIGHT of it, so it reaches the people it was sent to and
       nobody else. Proven end to end: the recipient's thread resolves it with
       its media while the author's own profile does not list it.

       That also answers the founder's other sentence in one object. It is a
       Post, `contracts.NATIVE`, carrying image AND video items together — not
       a photo-thing and a video-thing, and never a reel. */
    var sentPost = '';          /* the draft, once made — sent again, not remade */

    function sendRow(host2) {
      var wrap = mk('div', 'ow-compose__send');

      /* ── POST IT, FROM HERE, IN ONE TAP ──────────────────────────────────
         ★ FOUNDER, 2026-09-07: *"There's basically no friction or anything
           like that."*

         Posting a photograph cost FOUR presses from this step — Next, Next,
         Next, Share — through a name you do not have to give, a caption you
         may not want and a destination that is already correct. Every one of
         those steps is worth keeping for the thing that needs it: twenty
         photographs from a night, a name somebody will search for later, a
         community to light it to. None of them is worth making a person walk
         through to post one picture.

         So the common case is one press and the steps are still there for the
         uncommon one. `share()` already handles an empty title and no place —
         it posts to the person's own Centre, which is where it was going
         anyway, and the summary at step 5 exists to CONFIRM that rather than
         to decide it.

         IT SITS BESIDE "SEND TO A FRIEND" because those are the two things a
         person does with what they just made, and they are the same size. */
      /* ★ FOUNDER/493 (2026-09-22) OVERRULES THE ONE-TAP POST ABOVE: *"The
         process should be like tiktok … where after attaching and editing,
         they come to an upload screen, not everything on one portion."* So
         the edit screen's act is Next, and posting happens on its own screen
         — the caption, where it goes, the other platforms, and one Post. */
      /* SNAP'S TWO ACTS (founder, 2026-10-16): "Send to" is the quick one and the one hue button; "Post" is quiet and
         opens the TikTok-like post screen with the upload settings. */
      var post = mk('button', 'ow-btn ow-btn--quiet ow-compose__postbtn', 'Post');
      post.type = 'button';
      post.addEventListener('click', function () {
        posting = true; paintStage();
        try { global.scrollTo(0, 0); } catch (_) {}
      });

      var btn = mk('button', 'ow-btn ow-compose__sendbtn', 'Send to');
      btn.type = 'button';
      var panel = mk('div', 'ow-sendto');
      var row = mk('div', 'ow-compose__twoacts');
      row.appendChild(post); row.appendChild(btn);
      wrap.appendChild(row); wrap.appendChild(panel);
      host2.appendChild(wrap);

      btn.addEventListener('click', function () {
        if (panel.firstChild) { panel.innerHTML = ''; return; }
        if (!OW.sendTo) {
          panel.appendChild(mk('p', 'po-acts__wait',
            'Sending is not available just now.'));
          return;
        }
        btn.disabled = true;
        panel.innerHTML = '';
        panel.appendChild(mk('span', 'po-acts__wait', 'Getting it ready…'));
        makePrivatePost().then(function (id) {
          btn.disabled = false;
          if (!id) {
            panel.innerHTML = '';
            if (OW.toast) OW.toast('That could not be prepared to send. Nothing has been shared.');
            return;
          }
          /* THE FULL-SCREEN SEND TO (Snapchat's): a list to choose from and one Send; the photo stays under it */
          panel.classList.add('ow-sendto--pick');
          var head = mk('div', 'ow-sendto__head');
          var x = mk('button', 'ow-sendto__x'); x.type = 'button'; x.setAttribute('aria-label', 'Back to your photo');
          x.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 5-7 7 7 7"/></svg>';
          x.addEventListener('click', function () { panel.innerHTML = ''; panel.classList.remove('ow-sendto--pick'); });
          head.appendChild(x); head.appendChild(mk('h2', 'ow-sendto__h', 'Send to'));
          var body = mk('div', 'ow-sendto__body');
          OW.sendTo(body, {
            subject_type: 'post', subject_id: id, peopleOnly: true, pick: true,
            onSentAll: function (list) {
              if (OW.toast) OW.toast('Sent to ' + list.map(function (d) { return d.label || 'them'; }).join(', ') + '.');
              panel.innerHTML = ''; panel.classList.remove('ow-sendto--pick');
            }
          });
          panel.innerHTML = ''; panel.appendChild(head); panel.appendChild(body);
        });
      });
    }

    /* ONE DRAFT POST CARRYING EVERYTHING PICKED. The uploads go through the
       same `/upload` the publish path uses, so bytes are stored once, the same
       way, whichever button a person pressed. */
    function makePrivatePost() {
      if (sentPost) return Promise.resolve(sentPost);
      var home = (data.meHome && data.meHome()) || '';
      if (!home) {
        return Promise.resolve('');   /* no Place of their own — say so, do not guess */
      }
      var uploaded = [];
      return picks.reduce(function (chain, p) {
        return chain.then(function () {
          /* ORIGIN TRAVELS WITH A SENT THING TOO. It was omitted here and the
             recipient's copy came back with `origin: ""` — measured — so a
             photograph you TOOK arrived indistinguishable from one you picked.
             The founder's distinction is a fact about the item and it must
             survive the send, not only the post. */
          if (p.external) {
            uploaded.push({ url: p.src, kind: p.kind, origin: 'imported' });
            return;
          }
          /* THE SAME DOOR AS `share()`. Two upload paths in one file is how
             the origin came to be set in one of them and not the other — the
             defect fixed an hour ago. One door cannot have that bug. */
          return data.post('/api/oneway/media', coMediaBody(p))
            .then(function (u) {
              if (!u.ok) throw new Error(u.error || 'that file was refused');
              var item = (u.data || {}).media;
              if (!item || !item.url) throw new Error('that file was refused');
              uploaded.push(item);
            });
        });
      }, Promise.resolve()).then(function () {
        return data.post('/api/oneway/social/posts', {
          center_id: home,
          body: caption.trim() || title.trim() || '',
          title: title.trim(),
          media: uploaded,
          /* BORN UNPUBLISHED. Not a euphemism: `contracts.VISIBLE_STATES` is
             (PUBLISHED,), so this is in no feed and on no profile, and the
             share reference is the only thing that shows it to anybody. */
          state: 'draft'
        });
      }).then(function (r) {
        var id = ((r.data || {}).post || {}).id || (r.data || {}).id || '';
        if (!r.ok || !id) throw new Error('it could not be prepared');
        sentPost = id;
        return id;
      }).catch(function () { return ''; });
    }

    /* ── step 3 · DESCRIBE ─────────────────────────────────────────────── */
    /* ── WORDS, IF YOU WANT THEM ─────────────────────────────────────────
       This was a STAGE with a Next button and, before that, a required name.
       It is two optional fields now, sitting under what they describe. Nothing
       waits on them and nothing is disabled by them.

       COLLAPSED BY DEFAULT, because the common case is a photograph with
       nothing to say and a shut field is quieter than an open one — but ONE
       TAP away and labelled with what it is for, never a bare "..." . */
    function paintDescribe() {
      stage.innerHTML = '';
      /* ── A PHOTO DOES NOT NEED A NAME ────────────────────────────────────
         ★ FOUNDER, 2026-09-07: *"There's basically no friction or anything
           like that."*

         Next was DISABLED here until a title was typed, with "A name first."
         under it. That is a form standing between a person and the thing they
         just photographed — and nothing a camera app competes with has ever
         asked for one. Snapchat does not. Instagram does not.

         The field stays, because a name is genuinely useful on the things that
         want one — a set of twenty photographs from a night, a gallery
         somebody will look for again. It is simply no longer a toll.

         `share()` already handles an empty title: the summary reads "Untitled"
         and publish sets the cover from the first item, so a nameless Post is
         a Post with a picture and no heading, not a broken one. */
      stage.appendChild(mk('p', 'ow-compose__why',
        'Both optional. A name helps people find this again later.'));
      var tf = mk('div', 'ow-fld');
      var ti = doc.createElement('input');
      ti.type = 'text';
      ti.placeholder = 'Name it (optional)';
      ti.setAttribute('aria-label', 'Name');
      ti.value = title;
      ti.addEventListener('input', function () { title = ti.value; paintFoot(); });
      tf.appendChild(ti);
      var cf = mk('div', 'ow-fld');
      var ca = doc.createElement('textarea');
      ca.rows = 3;
      ca.placeholder = 'Say something about it';
      ca.setAttribute('aria-label', 'Caption');
      ca.value = caption;
      ca.addEventListener('input', function () { caption = ca.value; });
      cf.appendChild(ca);
      stage.appendChild(tf); stage.appendChild(cf);
      ti.focus();
    }

    /* ── step 4 · WHERE ────────────────────────────────────────────────── */
    /* THE DESTINATION IS STATED, ALWAYS. "Your profile" is not a euphemism: a
       person's Gallery is owned by their Profile Center, and publishing it is
       what puts it on their profile and into the feeds of people who follow
       them — measured, not assumed (a follower's `/api/me/feed/galleries` goes
       from 0 rows to 1 the moment publish is called, and 0 before it).
       A place is ADDITIONAL: it also lights a post to a community they belong
       to, which is the act `light_to` has always existed for. */
    /* WHERE IT GOES is now the Post screen's own row and page (founder/510,
       paintPost / paintPostSub); the inline chip row that stood here is gone. */

    function paintWhere() {
      stage.innerHTML = '';
      stage.appendChild(mk('p', 'ow-compose__why',
        'This goes to your profile, where anyone who follows you will see it. '
        + 'You can also send it to a place you are part of.'));
      var chips = mk('div', 'po-acts');
      chips.style.setProperty('--h', 'var(--ow-h1)');
      chips.style.setProperty('--h2', 'var(--ow-h2)');

      var mine = mk('button', 'po-act po-act--primary', 'Your profile');
      mine.type = 'button';
      mine.disabled = true;               /* always true, never a choice to undo */
      mine.setAttribute('aria-pressed', 'true');
      chips.appendChild(mine);

      places.forEach(function (p) {
        if (!p || !p.id || !p.name) return;
        var b = mk('button', 'po-act', esc(p.name));
        b.type = 'button';
        b.setAttribute('aria-pressed', String(place === p.id));
        b.classList.toggle('po-act--primary', place === p.id);
        b.addEventListener('click', function () {
          place = (place === p.id) ? '' : p.id;
          paintWhere(); paintFoot();
        });
        chips.appendChild(b);
      });
      stage.appendChild(chips);
      if (!places.length) {
        stage.appendChild(mk('p', 'ow-compose__why',
          'You have not joined anywhere yet, so your profile is the only '
          + 'destination. Joining somewhere adds more.'));
      }

      /* ── AND SEND IT TO SOMEBODY ────────────────────────────────────────
         The act a camera is actually for. Multi-select, because nobody sends
         one photo to exactly one person, and pressed state is the whole UI —
         no submenu, no second screen, no modal. It sits in the destination
         step beside the places rather than behind anything, because the
         founder's word was "seamless" and a send that costs a navigation is
         not.

         IT IS ADDITIVE, NOT A REPLACEMENT. What you make still goes to your
         profile; choosing people ALSO puts it in their messages. Whether a
         person can send privately WITHOUT posting is a real product question
         and a bigger one than this change — "Your profile" is deliberately
         `disabled` above with the note "always true, never a choice to undo" —
         so it is raised rather than decided here. */
      stage.appendChild(mk('h3', 'ow-compose__to', 'Send it to'));
      if (friendsOk === false) {
        /* BLIND IS NOT EMPTY. Saying "you follow nobody" when the read failed
           is the more expensive of the two lies: it is a false statement about
           a person's life, and they cannot tell it from the truth. */
        stage.appendChild(mk('p', 'ow-compose__why',
          'Your people could not be loaded just now, so there is nobody to '
          + 'choose here. Nothing else about this is affected.'));
      } else if (friendsOk === null) {
        stage.appendChild(mk('p', 'ow-compose__why', 'Finding your people…'));
      } else if (!friends.length) {
        stage.appendChild(mk('p', 'ow-compose__why',
          'You are not following anyone yet. Follow someone and you can send '
          + 'them what you make.'));
      } else {
        var who = mk('div', 'po-acts');
        who.style.setProperty('--h', 'var(--ow-h1)');
        who.style.setProperty('--h2', 'var(--ow-h2)');
        friends.forEach(function (f) {
          var on = sendTo.indexOf(f.who) >= 0;
          var b = mk('button', 'po-act', esc(f.name));
          b.type = 'button';
          b.setAttribute('aria-pressed', String(on));
          b.classList.toggle('po-act--primary', on);
          b.addEventListener('click', function () {
            var i = sendTo.indexOf(f.who);
            if (i >= 0) sendTo.splice(i, 1); else sendTo.push(f.who);
            paintWhere(); paintFoot();
          });
          who.appendChild(b);
        });
        stage.appendChild(who);
      }
    }

    /* ── THE SEND ────────────────────────────────────────────────────────
       ONE AT A TIME, AND ONE FAILURE NEVER KILLS THE REST. Sending to four
       people is four independent acts; a reduce over a promise chain keeps
       them ordered and keeps each one's outcome, so the person is told exactly
       who got it rather than "it did not send".

       THROUGH THE CANONICAL PAIR, NOT THE OBVIOUS ONE. `POST /api/conversations`
       has the better name and writes a conversation that APPEARS IN NOBODY'S
       MESSAGES LIST: measured 2026-09-07, it writes the participants row and
       not `oneway_person_conversations`, which is what the list reads. It also
       drops `kind:"direct"` to "group", so opening a line to the same person
       twice mints two threads. `/api/oneway/messaging/conversations` writes the
       index, reuses the one thread per pair, and is the domain that owns the
       list — so it is the one a camera sends through.

       HELD IS NOT SENT AND IT IS NOT REFUSED. A first message to somebody who
       does not know you waits for them to accept it. The runtime says so
       (`held:true` with a reason) and this repeats it, because telling a person
       "sent" when it is sitting in a request queue is a lie they will only
       discover from the silence. */
    function sendToPeople(gid, made) {
      if (!sendTo.length) return Promise.resolve([]);
      var nameOf = {};
      friends.forEach(function (f) { nameOf[f.who] = f.name; });
      return sendTo.reduce(function (chain, em) {
        return chain.then(function (acc) {
          var nm = nameOf[em] || em;
          say('Sending to ' + nm + '…');
          return data.post('/api/oneway/messaging/conversations',
                           { with_people: [em] })
            .then(function (r) {
              if (!r.ok) throw new Error(r.error || 'a line could not be opened');
              var d = r.data || {};
              if (d.held) return { to: nm, held: true };
              var cid = (d.conversation || {}).id;
              if (!cid) throw new Error('a line could not be opened');
              return data.post('/api/oneway/messaging/conversations/'
                               + cid + '/messages', {
                body: caption.trim() || title.trim() || 'Sent you something',
                /* ── THE MEDIA ITSELF, NOT A LINK TO IT ──────────────────
                   `attachments` is the field, and the runtime contracts it
                   through the SAME function a Post's media goes through
                   (`service._contracted` -> `_sc.media`). So a thing sent to a
                   person and a thing posted to a feed are one media shape,
                   which is the founder's rule that everything uploaded is one
                   type of post, holding at the message layer too.

                   ★ I FIRST SENT `object_ref` AND IT VANISHED. The send
                   returned 200 with a message id, the body arrived, and the
                   reference was NULL when the recipient read it — FastAPI
                   ignores a field the model does not declare and still answers
                   200, which `tools/contracts.py` warns about in its own
                   output. A camera app would have been sending friends the
                   sentence "look at this" with nothing attached, and the
                   sender would have been told it sent. Only reading it back as
                   the RECIPIENT found it. */
                attachments: made || []
              }).then(function (m) {
                if (!m.ok) throw new Error(m.error || 'it did not send');
                return { to: nm, sent: true };
              });
            })
            .catch(function (e) {
              return { to: nm, failed: (e && e.message) || 'it did not send' };
            })
            .then(function (one) { acc.push(one); return acc; });
        });
      }, Promise.resolve([]));
    }

    /* ── step 5 · SHARE ────────────────────────────────────────────────── */
    function paintShare() {
      stage.innerHTML = '';
      var name = title.trim() || 'Untitled';
      var to = 'your profile';
      places.forEach(function (p) { if (p.id === place) to = 'your profile and ' + p.name; });
      var sum = mk('div', 'ow-compose__sum');
      sum.innerHTML =
        '<p><b>' + esc(name) + '</b></p>'
        + '<p>' + esc(picks.length + (picks.length === 1 ? ' item' : ' items'))
        + ' &middot; going to ' + esc(to) + '</p>'
        + '<p class="ow-compose__why">Nothing has been shared yet. Until you tap '
        + 'Share this is private to you.</p>';
      stage.appendChild(sum);
    }

    /* THE ONE ACT. Four calls that already exist, in the order the runtime
       documents them: upload the bytes · attach the reference · set what the
       person wrote and the visibility they chose · publish. Publishing sets
       the cover from the first item, which is why a shared Gallery always has
       a picture on it and can never be the black box. */
    function share(btn) {
      btn.disabled = true;
      var made = [];        /* what actually got uploaded, in Post media shape */

      /* ══ ONE ACT MAKES ONE OBJECT ══════════════════════════════════════
         ★ FOUNDER, 2026-09-07: *"People should be able to distinct uploading
           pictures, videos, etcetera, but it should all be uploaded under ONE
           TYPE OF POST. There should be no posts on reels, like, on
           Instagram."*

         THIS MADE THREE OBJECTS OUT OF ONE ACT, and each destination got a
         different one:

             your profile   a GALLERY, created private, filled, made public,
                            published — four calls to the object model this
                            repo has already retired
             a place        a POST carrying the caption and NO MEDIA AT ALL,
                            so a community you lit it to received words and no
                            photograph
             a friend       the media COPIED into a message

         One photograph, three shapes, and only the third could be looked at
         where it landed. That is not a stray inconsistency — it is the exact
         thing the founder's sentence forbids, sitting in the primary write
         path of the App, and it is why the same picture had a like count on
         one surface and none on another.

         NOW IT IS ONE CANONICAL POST. `contracts.NATIVE` is "post"; the KIND
         lives on the media items inside it, so an image and a video ride in
         the same object and no reel is possible. The place is `light_to` on
         that same Post rather than a second, emptier one. And because a Post
         is what `oneway/sharing` can reference, the friend gets a pointer to
         the very thing on the profile instead of a frozen duplicate.

         WHY THE GALLERY IS NOT MISSED: `/api/users/{email}` serves canonical
         Posts (measured — a Post created through this door appears on the
         profile with its media), and the Post write maintains the feed index
         itself, which the gallery path never did. Galleries are untouched
         everywhere else; this stops MAKING new ones from the camera.

         THE BYTES GO THROUGH `POST /api/oneway/media`, which returns the
         contracted item itself — so nothing has to invent an object to hold a
         file, and nothing has to assemble one either. */
      say('Getting it ready…');
      /* ── A BAR, NOT A SENTENCE ───────────────────────────────────────────
         ★ FOUNDER/493: *"There is also loading bars for post uploads."*

         This said "Adding 2 of 3…" and nothing else — a line of text that a
         person reads once and then watches not change for however long a video
         takes. The steps are honest and countable (one per file, plus the post
         itself), so the bar measures something real rather than animating to
         look busy: it moves when a file has actually landed.

         IT IS NOT A PERCENTAGE OF BYTES, and it does not pretend to be. Bytes
         would need upload progress events the data layer does not expose; a
         bar that crept to 90% and sat there would be a worse lie than a bar
         that steps. Each step is a file that is genuinely on the server. */
      var steps = picks.length + 1, at = 0;
      var prog = mk('div', 'ow-compose__prog');
      var bar = mk('i', '');
      prog.appendChild(bar);
      prog.setAttribute('role', 'progressbar');
      prog.setAttribute('aria-valuemin', '0');
      prog.setAttribute('aria-valuemax', String(steps));
      function tick(n) {
        at = n;
        prog.setAttribute('aria-valuenow', String(at));
        bar.style.width = Math.round((at / steps) * 100) + '%';
      }
      tick(0);
      if (status && status.parentNode) status.parentNode.insertBefore(prog, status.nextSibling);
      else wrap.appendChild(prog);
      var clearProg = function () { if (prog.parentNode) prog.parentNode.removeChild(prog); };

      var home = (data.meHome && data.meHome()) || '';
      var pid = '';
      return picks.reduce(function (chain, p, i) {
        return chain.then(function () {
          say('Adding ' + (i + 1) + ' of ' + picks.length + '…');
          /* AN IMPORT IS ALREADY A REFERENCE — it needs no upload */
          if (p.external) {
            made.push({ url: p.src, kind: p.kind, origin: 'imported' });
            return;
          }
          /* ── THE SERVER HANDS BACK THE ITEM, AND THE CLIENT STOPS BUILDING
                 ONE ────────────────────────────────────────────────────────
             ★ B, 2026-09-07: `POST /api/oneway/media` returns *"the same
               media_item shape a Post carries and a message attachment now
               carries, origin included — so the client hands it straight to
               POST /api/posts or to a message without reshaping anything."*
               And they proved the property that matters: SENT ITEM == POSTED
               ITEM, byte for byte.

             This was assembling `{url, kind, origin}` by hand from a
             url-and-kind reply. That worked and it made the byte-for-byte
             property a COINCIDENCE — two hands building the same shape, which
             is the arrangement that drifts. Now there is one builder and it is
             the contract itself.

             WHERE IT CAME FROM IS STILL THE CLIENT'S TO SAY, because only this
             code knows whether the shutter or the picker produced the file —
             it is DECLARED on the way in rather than inferred on the way
             out. */
          return data.post('/api/oneway/media', coMediaBody(p))
            .then(function (u) {
              if (!u.ok) throw new Error(u.error || 'that file was refused');
              var item = (u.data || {}).media;
              if (!item || !item.url) throw new Error('that file was refused');
              made.push(item);
              tick(made.length);
            });
        });
      }, Promise.resolve()).then(function () {
        say('Sharing…');
        tick(picks.length);
        /* ══ POSTING MOVES TO THE NEW BACKEND ═════════════════════════════
           ★ FOUNDER/500: *"verify that we are truly moving over to a new
             backend and this is truly becoming a real platform down to the
             backend."*

           MEASURED 2026-09-23 (tools/probe/backend-reality.cjs): the App's
           reads are 80% on `api/oneway/`, and the single most important thing
           a person does on a social platform — POSTING — still went through
           the legacy application's `/api/posts`. The same composer's "Send to a
           friend" already used the canonical `/api/oneway/social/posts`, so one
           screen created one kind of object through two backends.

           THIS WAS A PROMISE A LANE-A SESSION MADE AND DID NOT KEEP. The
           canonical route carries a comment quoting it: *"canonical door
           exists but has no security screen and no idempotency replay; add
           them and I move the write the same hour."*  B added both. The write
           never moved. It moves now.

           THE MAPPING IS EXACT, NOT APPROXIMATE. The legacy door took
           `light_to` (a destination) and fell back to the author's own Center;
           the canonical model says a Post BELONGS TO A PLACE and names it
           `center_id`. So `center_id` is the place the person chose, or their
           own Center when they chose none — which is precisely what the legacy
           door did with `light_to`. The canonical route screens content
           (refusing rather than posting unscreened), replays idempotent
           retries, and honours `audience` — everything the legacy door did. */
        var body = { center_id: place || home, body: caption.trim(),
                     title: title.trim(), media: made };
        if (audience && audience !== 'everyone') body.audience = audience;
        if (!body.center_id) throw new Error('there is nowhere for it to go yet');
        /* ALSO TO THE PLATFORMS CHOSEN — only the ones this Center can send
           to; the server holds back anything else by name (founder/503) */
        var can = reachFor[body.center_id] || [];
        var outward = OW.reach.keys(outTo).filter(function (k) {
          return can.some(function (t) { return t.key === k && t.canSend; });
        });
        if (outward.length) body.destinations = outward;
        return data.post('/api/oneway/social/posts', body);
      }).then(function (r) {
        if (!r || !r.ok) throw new Error((r && r.error) || 'it did not go out');
        pid = ((r.data || {}).post || {}).id || (r.data || {}).id || '';
        if (!pid) throw new Error('it did not go out');
        /* THE PEOPLE LAST, AND DELIBERATELY SO. The thing must exist and be
           published before anybody is handed a link to it; sending first would
           put a reference to a private draft in somebody's messages. And a
           send that fails must never lose what was already made — which is why
           `sendToPeople` resolves with outcomes instead of rejecting. */
        return sendToPeople(pid, made).then(function (sent) {
          data.invalidate('/api/');
          tick(steps);
          clearProg();
          done(pid, r, sent);
        });
      }).catch(function (e) {
        clearProg();
        var why = (e && e.message) || 'try again';
        say('That did not share — ' + why + '.', 1);
        /* the bar says it too, because the composer may be scrolled away from
           this line by the time it fails (founder/493) */
        if (OW.toast) OW.toast('That did not post — ' + why);
        btn.disabled = false;
      });
    }

    /* IT LANDED, AND THIS SAYS WHERE — IT DOES NOT WALK YOU THERE.
       The old code fired `ow:open-gallery` and the App navigated, so finishing
       one thing threw you onto a page you had not asked for. A person who has
       just shared something usually wants to share the next thing. So the
       result is a sentence and a LINK: going is their choice. */
    /* THE RECEIPT IS ALREADY ON SCREEN. `done()` renders it directly, so a
       repaint at this point must LEAVE IT ALONE rather than redraw it — the
       one thing worse than a walkthrough is a screen that erases the sentence
       telling you something worked. */
    function paintDone() { /* nothing: done() owns this surface */ }
    function done(gid, postRes, sent) {
      stop();
      step = 5; paintSteps();
      stage.innerHTML = '';
      foot.innerHTML = '';
      say('');
      /* A POST OF WORDS ALONE HAS NO PICKS. It used to read `Shared "0 things"`
         — so with nothing picked, the receipt names the person's own words. */
      var words = caption.trim().replace(/\s+/g, ' ');
      var name = title.trim() ||
        (picks.length === 0 ? (words.length > 40 ? words.slice(0, 40).replace(/\s+\S*$/, '') + '\u2026' : words) || 'Your post'
         : picks.length === 1 ? 'What you made'
         : picks.length + ' things');
      var where = 'your profile';
      places.forEach(function (p) {
        if (p.id === place) {
          where = postRes && postRes.ok
            ? 'your profile and ' + p.name
            : 'your profile — but it could not also go to ' + p.name;
        }
      });
      var ok = mk('div', 'ow-compose__done');
      ok.appendChild(mk('p', 'ow-note show ow-note--good',
        esc('Shared "' + name + '" to ' + where + '.')));
      /* ── WHERE IT WENT, AND HOW TO OPEN IT ───────────────────────────────
         ★ FOUNDER/493: *"feedback that truly tells user where a post uploaded
           and where to click it."*

         The receipt below says where and offers a link, and it is correct — but
         it lives on the composer, which is the one surface a person leaves the
         moment they are done. The bar says the same thing over whatever they
         went to next, and its action opens the Post itself. Five seconds,
         because a control nobody has time to press is not a control. */
      if (OW.toast && gid) {
        OW.toast('Posted to ' + where + '.', {
          tone: 'ok',
          action: 'See it',
          onAction: function () {
            try {
              doc.dispatchEvent(new CustomEvent('ow:open-post', { detail: { id: gid } }));
            } catch (_) {}
          }
        });
      }

      /* WHO ACTUALLY GOT IT — NAMED, AND SPLIT THREE WAYS.
         "Sent to 3 people" is the sentence that hides a failure. Sending is
         per-person and so is the outcome, so each of the three real endings
         gets its own words: it arrived · it is waiting for them to accept a
         first message from you · it did not go. Anything less makes a person
         believe something reached somebody it did not reach. */
      (sent || []).length && (function () {
        var went = (sent || []).filter(function (x) { return x.sent; })
                     .map(function (x) { return x.to; });
        var held = (sent || []).filter(function (x) { return x.held; })
                     .map(function (x) { return x.to; });
        var bad  = (sent || []).filter(function (x) { return x.failed; })
                     .map(function (x) { return x.to; });
        if (went.length) {
          ok.appendChild(mk('p', 'ow-note show ow-note--good',
            esc('Sent to ' + went.join(', ') + '.')));
        }
        if (held.length) {
          ok.appendChild(mk('p', 'ow-compose__why',
            esc('Waiting for ' + held.join(', ') + ' to accept a first message '
                + 'from you — it is not in their messages yet.')));
        }
        if (bad.length) {
          ok.appendChild(mk('p', 'ow-note show is-bad',
            esc('It did not reach ' + bad.join(', ') + '. What you made is '
                + 'safe — you can send it from the post itself.')));
        }
      }());
      /* and each platform it also went to, each with its own answer */
      OW.reach.track(ok, gid, ((postRes && postRes.data) || {}).syndication || []);
      var acts = mk('div', 'po-acts');
      acts.style.setProperty('--h', 'var(--ow-h1)');
      acts.style.setProperty('--h2', 'var(--ow-h2)');
      /* ── BACK TO THE CAMERA IS THE PRIMARY ACT ──────────────────────────
         ★ FOUNDER, 2026-09-07: *"a tool that people everyday naturally use."*

         The receipt offered "See it" first and "Make another" second, which is
         the ordering of something you did ONCE. What people actually do after
         posting a photograph is take another one — every camera app returns
         you to the viewfinder, and the one that does not is the one you open
         twice a week.

         The confirmation stays, because a person needs to know it went. It is
         the ORDER and the WORD that change: "Camera" rather than "Make
         another", first rather than second. */
      var see = mk('button', 'po-act', 'See it');
      see.type = 'button';
      see.addEventListener('click', function () {
        /* IT IS A POST NOW, so this opens the Post surface. `ow:open-gallery`
           would have been handed a post id and found nothing — a "See it" that
           does nothing is the dead control Rule 12 forbids by name. */
        if (typeof global.openPost === 'function') { global.openPost(gid); return; }
        try {
          doc.dispatchEvent(new global.CustomEvent('ow:open-post',
            { detail: { id: gid } }));
        } catch (_) {}
      });
      var again = mk('button', 'po-act po-act--primary', 'Camera');
      again.type = 'button';
      again.addEventListener('click', function () {
        picks = []; title = ''; caption = ''; place = ''; outTo = {}; audience = 'everyone'; sub = '';
        sentPost = '';        /* a new thing, not the last one sent again */
        go(0);
      });
      acts.appendChild(again); acts.appendChild(see);
      ok.appendChild(acts);
      stage.appendChild(ok);
    }

    /* ── the foot: back / next / share ─────────────────────────────────── */
    /* NO NEXT, NO SHARE-AT-THE-END, NO BACK-AS-A-STAGE. `Post it` and `Send
       to a friend` sit with the thing they act on, where a person is already
       looking. The only thing left down here is the way OUT of what you made —
       and it is a way back to the CAMERA, not to a previous step. */
    function paintFoot() {
      foot.innerHTML = '';
      if (step === 5 || !picks.length) return;
      var again = mk('button', 'po-act', 'Camera');
      again.type = 'button';
      again.setAttribute('aria-label', 'Back to the camera');
      again.addEventListener('click', function () { go(0); });
      foot.appendChild(again);
    }

    /* WHAT IS ON SCREEN IS DECIDED BY WHETHER YOU HAVE MADE ANYTHING, not by
       how far along a path you are. `step` still exists because `done()` and
       the lens both set it and the rail is gone rather than every call site
       rewritten — but nothing READS it to choose a surface any more.

       `step === 5` is the one exception and it is not a stage either: it is
       the receipt after something has actually gone out. */
    function paintStage() {
      if (step === 5) paintDone();
      else if (!picks.length && !(posting && textPost)) { posting = false; paintChoose(); }
      else if (posting) { if (sub) paintPostSub(); else paintPost(); }
      else paintMade();
      screenMode(step === 5 || !!picks.length || (posting && textPost));
    }

    /* ── WHAT YOU MADE ─────────────────────────────────────────────────────
       Everything that used to be Review, Describe and Where, on one surface,
       in the order a person actually cares about it: the thing itself, what to
       do with it, and then — quietly, below — the optional words and the
       optional destination. */
    function screenTop(title, backLabel, onBack) {
      var top = mk('div', 'ow-upload__top');
      var back = mk('button', 'ow-upload__back');
      back.type = 'button';
      back.setAttribute('aria-label', backLabel);
      back.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 5-7 7 7 7"/></svg>';
      back.addEventListener('click', onBack);
      top.appendChild(back);
      top.appendChild(mk('h2', 'ow-upload__h', esc(title)));
      stage.insertBefore(top, stage.firstChild);
    }
    function paintMade() {
      stage.innerHTML = '';
      /* SNAPCHAT'S AFTER-THE-SHOT (founder, 2026-10-16: "make it feel like taking a photo with snap and quick sending";
         then "not good or professional rn"): the photo fills the screen between the bars, its controls sit ON it (back
         at the top left, add and remove as bare marks on the right), and the two acts sit across its foot: Post, quiet,
         to the TikTok-like post screen, and Send to, the one hue button, to the full-screen list. */
      stage.setAttribute('data-screen', 'made');
      paintArrange();          /* the picks, Add more, Remove, trim */
      screenTop('Edit', 'Back to the camera', function () { go(0); });
      sendRow(stage);          /* Post · Send to */
    }

    /* ── THE UPLOAD SCREEN ─────────────────────────────────────────────────
       ★ FOUNDER/493: TikTok's flow — attach, edit, THEN a separate screen
       to post from. Laid out the way TikTok's Post screen is: the words
       beside the cover, then where it goes, then the other platforms, then
       one Post across the bottom. Back returns to editing with nothing lost —
       every value here lives in the composer, not in this screen. */
    function paintPost() {
      stage.innerHTML = '';
      stage.removeAttribute('data-screen');
      screenTop('Post', 'Back to editing', function () { posting = false; paintStage(); });

      var row = mk('div', 'ow-upload__row');
      var cf = mk('div', 'ow-fld ow-upload__cap');
      var ca = doc.createElement('textarea');
      ca.rows = 5;
      ca.placeholder = 'Describe your post';
      ca.setAttribute('aria-label', 'Caption');
      ca.value = caption;
      ca.addEventListener('input', function () { caption = ca.value; });
      cf.appendChild(ca);
      row.appendChild(cf);
      var first = picks[0];
      var cover = mk('div', 'ow-upload__cover');
      if (!first) cover.hidden = true;        /* words on their own have no cover */
      if (first) {
        /* a video framed in the editor has its poster, the first frame of the part that plays, cut to its frame */
        var still = first.kind === 'video' && first.poster;
        var m = doc.createElement(first.kind === 'video' && !still ? 'video' : 'img');
        m.src = still ? first.poster : first.src;
        if (first.kind === 'video' && !still) { m.muted = true; m.playsInline = true; m.preload = 'metadata'; }
        else m.alt = '';
        cover.appendChild(m);
        if (picks.length > 1) cover.appendChild(mk('span', 'ow-upload__n', String(picks.length)));
      }
      row.appendChild(cover);
      stage.appendChild(row);

      /* a headline is the uncommon case: a quiet control, never a box */
      var tf = mk('div', 'ow-fld');
      var ti = doc.createElement('input');
      ti.type = 'text'; ti.maxLength = 200;
      ti.placeholder = 'Headline';
      ti.setAttribute('aria-label', 'Headline');
      ti.value = title;
      ti.addEventListener('input', function () { title = ti.value; });
      tf.appendChild(ti);
      if (!title) {
        tf.hidden = true;
        var addT = mk('button', 'ow-depth__add', 'Add a headline');
        addT.type = 'button';
        addT.addEventListener('click', function () {
          tf.hidden = false; addT.remove();
          try { ti.focus(); } catch (_) {}
        });
        stage.appendChild(addT);
      }
      stage.appendChild(tf);

      /* ── THE ROWS, TIKTOK'S WAY (founder/510) ─────────────────────────────
         *"clean to use and labeled into different areas and it's easy to get
         back and into different sections."* Each decision is one labelled
         row saying its current answer; pressing it opens its own page with a
         back arrow, and the answer comes back here. The same row the Settings
         pages use, so the two read as one product. */
      var sec = mk('section', 'ow-set__sec ow-upload__rows');
      postRow(sec, 'pin', 'Where it goes', whereWords(), 'where');
      postRow(sec, 'lock', 'Who can see it', AUD_WORDS[audience] || 'Everyone', 'who');
      stage.appendChild(sec);

      /* ── ONE POST, THE WHOLE INTERNET ─────────────────────────────────────
         ★ FOUNDER/544: *"like a distributor platform for the entire
           internet"* — and 503: cross-platform posting is *"extremely
           important"*.

         It was a row reading "Other platforms · Off" that opened a page: the
         one thing that makes this more than a camera, one level down and
         worded as absent. It is now TikTok's "Share to" row on the post page
         itself: every platform's own mark, one tap to add it, and a platform
         that is not connected yet says so and offers Connect in place. The
         list is the Center's own (`/api/oneway/distribution`), never a second
         one kept here. */
      var ts = reachOf(place || ((data.meHome && data.meHome()) || ''));
      var reachSlot = mk('div', 'ow-upload__reach');
      stage.appendChild(reachSlot);
      if (place && OW.reach.notRun(reachSlot, placeOf(place))) { /* said why */ }
      else if (ts.length) OW.reach.row(reachSlot, ts, outTo, '', picks.map(function (p) { return p.kind; }));

      /* one Post, across the bottom, where the thumb already is */
      var bar = mk('div', 'ow-upload__bar');
      var go = mk('button', 'ow-btn ow-upload__post', 'Post');
      go.type = 'button';
      go.addEventListener('click', function () { share(go); });
      bar.appendChild(go);
      stage.appendChild(bar);
    }
    var AUD_WORDS = { everyone: 'Everyone', followers: 'Followers', close: 'Close friends' };
    var AUD_SAID = {
      everyone: 'Anyone on Oneway, and anywhere it is shared.',
      followers: 'Only people who follow you.',
      close: 'Only the people in your close friends.'
    };
    function whereWords() {
      var w = 'Your profile';
      places.forEach(function (p) { if (p && p.id === place) w = p.name; });
      return w;
    }
    function reachWords(ts) {
      var on = OW.reach.keys(outTo).map(function (k) {
        var t = ts.filter(function (x) { return x.key === k; })[0];
        return t ? t.label : '';
      }).filter(Boolean);
      return on.length ? on.join(', ') : 'Off';
    }
    function postRow(host2, icon, label, value, page) {
      var el = mk('button', 'ow-set__row');
      el.type = 'button';
      el.setAttribute('data-post-row', page);
      el.innerHTML = '<span class="ow-set__ic">' + setIcon(icon) + '</span>'
        + '<span class="ow-set__lb">' + esc(label) + '</span>'
        + '<span class="ow-set__v">' + esc(value || '') + '</span>'
        + '<span class="ow-set__cv">' + setIcon('chevron') + '</span>';
      el.addEventListener('click', function () { sub = page; paintStage(); try { global.scrollTo(0, 0); } catch (_) {} });
      host2.appendChild(el);
    }
    /* a choice among a few, TikTok's way: the row is the choice and a check
       says which one it is. Pressing one chooses it and goes back. */
    function pickRowOf(host2, label, said, on, face, onPick) {
      var el = mk('button', 'ow-set__row ow-setpick');
      el.type = 'button';
      el.setAttribute('role', 'radio');
      el.setAttribute('aria-checked', String(!!on));
      el.innerHTML = (face ? '' : '<span class="ow-set__ic"></span>')
        + '<span class="ow-setpick__w"><b>' + esc(label) + '</b>' + (said ? '<span>' + esc(said) + '</span>' : '') + '</span>'
        + '<span class="ow-setpick__ok">' + (on ? setIcon('check') : '') + '</span>';
      if (face) el.insertBefore(face, el.firstChild);
      el.addEventListener('click', onPick);
      host2.appendChild(el);
    }
    function paintPostSub() {
      stage.innerHTML = '';
      stage.removeAttribute('data-screen');
      var TITLES = { where: 'Where it goes', who: 'Who can see it', platforms: 'Other platforms' };
      screenTop(TITLES[sub] || 'Post', 'Back to your post', function () { sub = ''; paintStage(); });
      var sec = mk('section', 'ow-set__sec');
      var back = function () { sub = ''; paintStage(); };
      if (sub === 'where') {
        stage.appendChild(mk('p', 'ow-set__lede', 'It goes to your profile. It can go to a place you are part of instead, where its members see it.'));
        /* your profile wears your own face, like the places under it */
        var meFace = mk('span', 'ow-dest__face ow-setpick__face');
        meFace.setAttribute('data-shape', 'round');
        OW.cards.fill(meFace, { kind: 'person' });
        data.get('/api/oneway/people/me').then(function (r) {
          var pc = r && r.ok && r.data && r.data.picture;
          pc = pc && (pc.url || pc);
          if (pc && typeof pc === 'string' && meFace.isConnected) {
            OW.cards.fill(meFace, { kind: 'person', picture: pc });
          }
        });
        pickRowOf(sec, 'Your profile', 'Everyone who follows you sees it.', !place, meFace, function () { place = ''; back(); });
        places.forEach(function (p) {
          if (!p || !p.id || !p.name) return;
          var face = mk('span', 'ow-dest__face ow-setpick__face');
          var pair = (typeof p.hue === 'number' && OW.hue && OW.hue.fromAngle) ? OW.hue.fromAngle(p.hue) : null;
          if (pair) { face.style.setProperty('--h', pair[0]); face.style.setProperty('--h2', pair[1] || pair[0]); }
          if (p.picture && OW.imageUrl) { var im = doc.createElement('img'); im.src = OW.imageUrl(p.picture); im.alt = ''; face.appendChild(im); }
          else face.textContent = String(p.name).trim().slice(0, 2).toUpperCase();
          pickRowOf(sec, p.name, '', place === p.id, face, function () { place = p.id; back(); });
        });
      } else if (sub === 'who') {
        ['everyone', 'followers', 'close'].forEach(function (a) {
          pickRowOf(sec, AUD_WORDS[a], AUD_SAID[a], audience === a, null, function () { audience = a; back(); });
        });
      } else if (sub === 'platforms') {
        stage.appendChild(mk('p', 'ow-set__lede', 'Choose where else it goes. Nothing is sent anywhere you do not choose.'));
        var ts = reachOf(place || ((data.meHome && data.meHome()) || ''));
        OW.reach.list(sec, ts, outTo, picks.map(function (p) { return p.kind; }));
        var done = mk('button', 'ow-btn ow-upload__post', 'Done');
        done.type = 'button';
        done.addEventListener('click', back);
        sec.appendChild(done);
      }
      stage.appendChild(sec);
    }

    /* the places are read ONCE, up front, so step 4 never waits on a request */
    data.get('/api/me/communities').then(function (r) {
      /* a person's own home is "your profile", never a second place beside it */
      var _home = (data.meHome && data.meHome()) || '';
      places = ((r.ok && r.data && r.data.communities) || []).filter(function (p) { return !p || p.id !== _home; });
    }).catch(function () { places = []; });
    reachOf((data.meHome && data.meHome()) || '');

    /* THE PEOPLE, READ ONCE, FOR THE SAME REASON — a person choosing where
       something goes must never wait on a request to find their friends.

       ASKED BY ADDRESS, NEVER BY "me". `/api/oneway/graph/{person}/following`
       answers 200 with `readable:true` and an EMPTY list for an address that
       does not resolve — including the literal string "me", which the rest of
       this codebase uses as an alias everywhere (`/api/me/places`,
       `/api/me/galleries`, `/api/me/lightbulb`). Measured 2026-09-07: asking
       it for "me" and asking it for a person who does not exist give the same
       confident empty answer as a real person with no follows. So a picker
       built on the convenient spelling would tell people they have no friends
       and never admit it had asked a bad question. `data.me()` is the address.

       FAILING TO READ IS NOT HAVING NOBODY, which is why the catch leaves the
       list empty AND `paintWhere` says which of the two happened. */
    var friendsOk = null;      /* null = not answered yet */
    (function () {
      var me = (data.me && data.me()) || '';
      if (!me) { friendsOk = false; return; }
      data.get('/api/oneway/graph/' + encodeURIComponent(me) + '/following')
        .then(function (r) {
          if (!r || !r.ok) { friendsOk = false; return; }
          friendsOk = true;
          /* `who` is the @handle: the list no longer carries anybody's address, and the
             conversation door takes the handle (people/refs.py, 2026-10-02) */
          friends = ((r.data || {}).people || []).filter(function (x) {
            return x && (x.ref || x.email);
          }).map(function (x) {
            return { who: x.ref || x.email, name: x.name || 'Someone' };
          });
        })
        .catch(function () { friendsOk = false; });
    }());

    paintSteps(); paintStage(); paintFoot();
    return { stop: stop };
  }

  /* NO NATIVE PROMPT. This asked for the name with `window.prompt()` — a
     browser-chrome modal in the middle of a surface that is otherwise entirely
     ONEWAY's own material. It breaks the platform's own rule ("no popups, no
     modals — every add-X is an inline composer"), it cannot be styled, cannot
     be themed to the person's hue, and on iOS it is a system sheet that closes
     the keyboard. It is replaced by the same inline composer pattern
     `postToPlace` uses: the field material that already exists, opened in
     place, with Enter to commit and Escape to change your mind. */
  function beginEmptyPost(host, anchor) {
    var seat = anchor || host;
    var open = seat.querySelector('.ow-galnew');
    if (open) { var f = open.querySelector('input'); if (f) f.focus(); return; }

    var wrap = mk('div', 'ow-galnew');
    var fld = mk('div', 'ow-fld');
    var input = doc.createElement('input');
    input.type = 'text';
    input.placeholder = 'What is this a place for?';
    input.setAttribute('aria-label', 'Name this post');
    fld.appendChild(input);
    var go = mk('button', 'ow-btn', 'Make it');
    go.type = 'button'; go.disabled = true;
    var out = mk('div');
    input.addEventListener('input', function () { go.disabled = !input.value.trim(); });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && input.value.trim()) { e.preventDefault(); go.click(); }
      if (e.key === 'Escape') wrap.remove();
    });
    go.addEventListener('click', function () {
      var name = input.value.trim(); if (!name) return;
      go.disabled = true;
      makeEmptyPost(name, out, wrap, go);
    });
    wrap.appendChild(fld); wrap.appendChild(go); wrap.appendChild(out);
    seat.appendChild(wrap);
    input.focus();
  }

  /* AN EMPTY POST IS A POST. This made a Gallery (`POST /api/me/galleries`)
     under the word "post" — the name was retired and the object under it was
     not, so the App's last legacy write lived behind this row. Galleries are
     retired, not migrated (founder, 2026-08-26, kept in api/oneway/manifest.py),
     and the App is to stand entirely on the new backend (founder/641).

     So it is the canonical Post, BORN A DRAFT: in no feed, on no profile,
     visible to its author alone until they share it — which is exactly what the
     row promises ("private until you share it"). The name is its title; the
     photos go in from the Post itself; it waits in Workspace meanwhile. */
  function makeEmptyPost(name, out, wrap, go) {
    function failed(why) {
      /* `.ow-note` is display:none until `.show` — a post that did not save
         must say so, where the person is looking */
      out.innerHTML = '';
      out.appendChild(mk('p', 'ow-note show ow-note--bad',
        esc('That did not save — ' + why + '.')));
      if (go) go.disabled = false;      /* they must be able to try again */
    }
    /* THE PERSON'S OWN PLACE. The shell learns it from `/api/auth/me` at boot;
       a press that beats that answer asks once more rather than refusing a
       person who is signed in. */
    function withHome() {
      var h = (data.meHome && data.meHome()) || '';
      if (h) return Promise.resolve(h);
      return data.get('/api/auth/me', { fresh: true }).then(function (r) {
        var u = (r && r.ok && r.data) || {};
        h = u.home_id || (u.user || {}).home_id || '';
        if (h) data.configure({ home: h });
        return h;
      });
    }
    return withHome().then(function (home) {
      if (!home) { failed('sign in again'); return null; }
      return data.post('/api/oneway/social/posts',
        { center_id: home, title: name, state: 'draft' });
    }).then(function (r) {
      if (r === null) return;
      var po = (r && r.ok && (r.data || {}).post) || {};
      if (!po.id) { failed((r && r.error) || 'try again'); return; }
      data.invalidate('/api/');
      /* IT SAYS WHERE IT WENT; IT DOES NOT WALK YOU THERE.
         Naming something must not throw the person off Create onto a screen
         they had not asked for — the "spawning objects in different pages" the
         founder named. Announcing it is the right move mid-flow; going is their
         choice, so it is a link. */
      if (out) {
        out.innerHTML = '';
        out.appendChild(mk('p', 'ow-note show ow-note--good',
          esc('"' + (po.title || name) + '" is ready, and private until you '
              + 'share it.')));
        var open = mk('button', 'po-act', 'Open it');
        open.type = 'button';
        open.addEventListener('click', function () {
          if (typeof global.openPost === 'function') { global.openPost(po.id); return; }
          try {
            doc.dispatchEvent(new global.CustomEvent('ow:open-post', { detail: { id: po.id } }));
          } catch (_) {}
        });
        out.appendChild(open);
      }
      /* the field and its button have done their work; the note replaces them
         in place, so the row the person started from is where the answer is */
      if (wrap) {
        var fldEl = wrap.querySelector('.ow-fld');
        if (fldEl) fldEl.remove();
      }
      if (go && go.parentNode) go.remove();
      try {
        doc.dispatchEvent(new global.CustomEvent('ow:created',
          { detail: { type: 'post', id: po.id } }));
      } catch (_) {}
    });
  }

  /* ═══ 7c · WHAT THE BRAIN SUGGESTS YOU MAKE ══════════════════════════════
     "The Brain understands. Lightbulb creates." (FOUNDATION.md) — the two are
     named as a pair in canon and the App had no join between them.
     `/api/brain/profile/creation-assist` was dark.

     IT EARNS ITS PLACE BECAUSE EVERY SUGGESTION CARRIES ITS OWN `why`, which is
     the one thing this surface's canon demands and the reason I did NOT wire
     `/api/discovery/*` — seven live routes whose payloads carry no reason at
     all. Measured on a real account rather than assumed:

       new person   → 1 suggestion, why: "Brain hasn't found a clear theme yet —
                      each post you make teaches Brain what you care about"
       after joining
       a community  → a SECOND appears: "Publish your next post to Food &
                      Dining", why: "It's your most active community"

     That is the Brain reasoning from what actually happened, and saying so. The
     reason LEADS in the row, because a suggestion without one is a
     recommendation and this surface deliberately is not that.

     NO NEW CREATION PATH. `kind` is already a Lightbulb create type (post ·
     document · note), so a tap runs the SAME `OW.live.begin()` every other row
     on this surface runs. A second way to start something would be the
     defect the whole platform is organised against. */
  function brainSuggests(host) {
    var wrap = mk('div');
    host.appendChild(wrap);
    return data.get('/api/oneway/people/me/brain/creation-assist').then(function (r) {
      if (!r.ok) return 0;                    /* never costs the create list */
      var d = r.data || {};
      var sugg = (d.suggestions || []).filter(function (x) {
        return x && x.prompt && x.kind;
      });
      /* NOTHING TO SAY IS A VALID ANSWER — no heading, no empty shell. The
         Brain not having noticed anything yet is not a surface to render. */
      if (!sugg.length) return 0;

      wrap.appendChild(mk('h3', 'ow-group', 'What Brain suggests'));
      /* the door writes its theme in markdown bold (`**theme**`) — measured on
         the Lightbulb 2026-09-21: the asterisks were on the screen. The one
         form it uses is drawn as what it means; everything else stays escaped
         (B told: the door should send words, not markup). */
      if (d.statement) {
        wrap.appendChild(mk('p', 'ow-door__why',
          esc(d.statement).replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')));
      }
      var list = mk('div');
      OW.mountList(list, sugg.slice(0, 4).map(function (x, i) {
        return { id: 'bs-' + i,
                 label: x.prompt,
                 /* the REASON, said out loud — this surface's own law */
                 signal: x.why || '',
                 icon: 'spark' };
      }), { open: false });
      list.addEventListener('click', function (e) {
        var row = e.target.closest('.po-glance'); if (!row) return;
        var i = parseInt((row.getAttribute('data-po-id') || '').replace(/^bs-/, ''), 10);
        var pick = sugg[i];
        if (!pick) return;
        /* the same begin() every other row runs — no second creation path */
        OW.live.begin(pick.kind, row);
      });
      wrap.appendChild(list);
      return sugg.length;
    }).catch(function () { return 0; });
  }

  /* ═══ 7b · BEYOND ONEWAY — the accounts a person already has ═════════════
     Founder-prioritised 2026-08-08; founder/503 made it one path. This was a
     SECOND composer — its own box, its own Post button, its own legacy doors
     (`/api/connections/status`, `/api/marketing/publish-targets`,
     `/api/social/publish`) — beside the composer every post is made in. Two
     ways to post outward is the duplication rule broken in the one place the
     founder called "extremely important".

     Posting outward is now "Also post to" on the post itself (OW.reach, on
     B's canonical distribution door). What stays here is what Lightbulb is
     for: saying where what you make can reach, and the one step to reach
     further — Settings > Connected accounts. Rendered after the creation list
     and allowed to fail on its own without costing anyone the list above. */
  function beyondOneway(host) {
    var wrap = mk('div', 'ow-beyond');
    host.appendChild(wrap);
    return OW.reach.targets((data.meHome && data.meHome()) || '').then(function (ts) {
      if (!ts.length) return 0;            /* silent — it must never cost the list */
      var on = ts.filter(function (t) { return t.connected; });
      wrap.appendChild(mk('h3', 'ow-group', 'Beyond Oneway'));
      wrap.appendChild(mk('p', 'ow-door__why', esc(on.length
        ? 'What you post can also go to ' + on.map(function (t) { return t.label; }).join(', ')
          + ' — choose it on the post.'
        : 'Connect the accounts you already have, and what you post here can go to them too.')));
      if (on.length) {
        var marks = mk('div', 'ow-reach__chips');
        on.forEach(function (t) { marks.appendChild(OW.reach.mark(t.key)); });
        wrap.appendChild(marks);
      }
      var go = mk('button', 'po-act', on.length ? 'Connected accounts' : 'Connect an account');
      go.type = 'button';
      go.style.setProperty('--h', 'var(--ow-h1)');
      go.style.setProperty('--h2', 'var(--ow-h2)');
      go.addEventListener('click', function () { global.location.hash = '#settings/connected'; });
      wrap.appendChild(go);
      return on.length;
    }).catch(function () { return 0; });
  }

  /* ═══ 8c · POST TO A PLACE — the basis of the platform ═════════════════
     FOUNDER, 2026-08-09: "users cannot post via only their accounts, they
     have to post to a center. that's the basis of the platform."

     THE CAPABILITY WAS COMPLETE AND NOBODY COULD REACH IT. `POST /api/posts
     {light_to}` — the Lightbulb publish, screened, indexed into
     `feed_by_destination`, wired to the Brain — had ZERO callers across the
     App and the OS. Nothing in the product had ever sent `light_to`. So this
     is not a new capability; it is the door onto one that was already there.

     WHY THE DESTINATIONS COME FROM MEMBERSHIP AND NOT FROM
     `can_publish_through`. Those are two different questions and the runtime
     already settled one of them: `can_publish_through` is "which Centers may
     I publish AS", and it is EMPTY BY THE FOUNDER'S 2026-08-08 RULING —
     the App does not offer creating under a business. Posting TO a place you
     belong to is the opposite act: you speak as YOURSELF, and the place is
     where it lands. Sourcing this from `/api/me/communities` honours both
     rulings and adds no second notion of permission.

     AND THE DESTINATION IS REQUIRED. There is no "just me" option, because
     the ruling is that a person does not post into their own account. If a
     person belongs nowhere the composer says so and opens Discovery, rather
     than quietly letting them post into a room with no one in it. */
  function postToPlace(host) {
    var wrap = mk('div');
    host.appendChild(wrap);
    return Promise.all([
      data.get('/api/me/communities'),
      /* WHO THIS PERSON IS, so their own Center can be named rather than
         labelled with a generic word. Read in parallel — it costs no wall
         clock, and a destination a person cannot see their own name on does
         not read as theirs. */
      /* the canonical person read — it carries the ONE face (436) and the
         cut, which the legacy /api/auth/me never did */
      data.get('/api/oneway/people/me').catch(function () { return { ok: false }; })
    ]).then(function (rs) {
      var r = rs[0], mr = rs[1];
      /* a person's own home is the "you" chip, never a second place beside it */
      var _home = (data.meHome && data.meHome()) || '';
      var places = ((r.ok && r.data && r.data.communities) || []).filter(function (p) { return !p || p.id !== _home; });
      var meRow = (mr.ok && mr.data && (mr.data.person || mr.data)) || {};
      var myName = (meRow.display_name || meRow.name || meRow.full_name || '').trim();
      /* the heading is the SURFACE'S now ("Say something") — this used to add
         its own, and two headings for one composer is how a screen starts
         reading like a stack of unrelated panels */

      /* ═══ TWO POSTABLES, NAMED APART ═══════════════════════════════════
         Founder, 2026-08-16: *"clearly separating the main, like, postables,
         like the mainstream post to a center, and then the personal story
         post. I also want text like posts, like Twitter."*

         ⚠ SUPERSEDED THE SAME DAY — READ THIS BEFORE RESTORING ANYTHING.
         The paragraph above was written for a personal post that no longer
         exists. Later on 2026-08-16 the founder ruled, narrowly and
         unambiguously:

             "people don't have their own posts, everything is posted under a
              community — that's a core correction that i already laid out"

         THE SOURCE OF THE EARLIER QUOTE IS REAL AND IS RECORDED HERE, because
         getting this label right matters more than the feature did. Asked about
         it, the founder answered "I did not tell another Claude that" — and I
         briefly marked this MISATTRIBUTED on the strength of that. That was
         wrong. The session that built the personal post holds the verbatim line
         from its own transcript, said in a longer message about Lightbulb:

             "...clearly separating the main, like, postables, like the
              mainstream post to a center, and then the personal story post."

         Both of his statements are true from where he was sitting. One founder,
         two moments, hours apart. Writing "a session invented a quote" would
         have put a FALSE thing in this file to make a true correction look
         tidier — and a file that claims he never said something he did is worth
         less than no comment at all.

         SUPERSEDED, therefore: said, then narrowed by the same person the same
         day. The later ruling governs and is not re-litigated.

         The quote is left standing rather than deleted, because a comment that
         edits its own history teaches the next reader it was always right — and
         because this is exactly how the misattribution was caught: it was
         written down, so it could be put to the founder and checked. A tidy
         file would have hidden it.

         It is re-marked, not erased. If anyone ever produces a verbatim source
         for it, that belongs in front of the founder, not in a rebuild.

         The old objection was fair and is answered rather than ignored — a
         person who has joined nowhere could not write a sentence. They still
         cannot post, because there is nowhere for a post to live; but they are
         now told that plainly and pointed at joining a place, instead of being
         handed a composer whose button never lights.

         MEASURED, NOT ASSUMED. `POST /api/posts` with `light_to:""` returns
         200, stores `destination:""` against the person's own Profile Center,
         and the post appears in their own `/api/me/feed/posts`. What it does
         NOT do is appear in `/api/me/posts`, which powers the profile page and
         reads a different store (channel messages) — so the copy below says
         "your feed" and does not promise a profile listing it cannot keep. */
      /* ── EVERYTHING IS POSTED UNDER A COMMUNITY ────────────────────────
         (founder, 2026-08-16: "people don't have their own posts, everything
         is posted under a community — that's a core correction I already laid
         out".)

         This surface offered "Your own feed" FIRST and called it "the one that
         always works", sending `light_to:""` — a post belonging to no place.
         The runtime accepts that, so nothing could ever catch it: it was not
         wrong in a way a test can see, it was wrong about what a post IS here.

         A post is an act INSIDE a community. Remove the community and it is not
         a lighter-weight post — it is a different object with no home, no
         audience, and no Center whose Brain can do anything with it. The shape
         was already telling on itself: personal posts land in
         `/api/me/feed/posts` while a profile reads a different store, so they
         appeared on no profile at all. A dead end by construction.

         So there is no personal destination. Someone who belongs nowhere is not
         handed an empty picker and a dead button — they are told the true thing
         about posting here, which is that it happens in a place. */
      /* ── ⚠ THE PARAGRAPH ABOVE READ THE RULING BACKWARDS, AND IT CLOSED THE
            FRONT DOOR. Founder, 2026-08-17: *"none of the posts are working."*
            Walked as an account thirty seconds old: Create → "Post it" → *"Posts
            live in communities. Join one, and this is where you write to it."*
            No picker, no button, and no way to join from that screen. A new
            person could not write one sentence on this platform.

            Read the governing quote as English: *"people dont have their own
            posts — everything is posted under a community — thats a core
            correctaiton that i already laid out."* That is the founder naming
            a DEFECT, and saying he had already called it out once. It was read
            as an instruction to make a community mandatory, which is precisely
            the thing being complained about. The two clauses were treated as
            rule-then-reason when they are symptom-then-symptom.

            The reasoning built on top of it was sound and is kept: a post with
            no home is a row nothing can show, and that dead end was real. What
            was wrong is the arithmetic — a person's OWN Center is a home, every
            account is given one at registration, and it was never counted.
            `light_to:''` no longer means "belongs nowhere"; the runtime resolves
            it to this person's own Center by name, so the post has a place, an
            author and a Brain that can use it.

            MEASURED, NOT ASSUMED, on the shared database: a fresh account with
            zero communities posts, and the row comes back `destination_name:
            "Walk Tester"` and is carried by `/api/me/feed/posts`, `/api/feed`
            AND `/api/me/posts` — the profile read. Three of three. */
      var SELF = '@me';                 /* sentinel: the person's own Center */
      var selfLabel = myName || 'Your own Center';
      /* THE PERSON'S OWN PLACE IS THE DEFAULT, whatever else they belong to.
         This pre-picked the one community when there was exactly one, so a
         brand-new person who had joined a Center a minute earlier wrote her
         first words and read "Posted to Caesars Atlantic City" (measured
         2026-09-14 as Ida, on a fresh gateway). Where a post goes is her
         choice (Lightbulb rulings: nothing is decided for her); her own
         Center is the one destination that is always there, so it is the one
         that is chosen until she chooses. */
      var picked = SELF;

      wrap.appendChild(mk('p', 'ow-door__why',
        places.length ? 'Where does this go?'
                      : 'This goes to your profile. Join a place to post there too.'));
      /* ★ FOUNDER/438 + /442: a ROW of faces, sideways, not a wall of chips
         — the same row the media composer's "Also to" draws. */
      var chips = mk('div', 'ow-compose__dests');

      /* ── TWO DESTINATIONS WITH ONE NAME IS NOT A CHOICE ──────────────────
         MEASURED 2026-09-13 on a real signed-in account: this picker offered
         TWENTY destinations and TWO distinct labels. Nineteen chips all read
         "Feed Continuity Center", and a person deciding where to put what they
         just wrote could not tell them apart. The machine was never confused —
         each chip carries `data-dest` with its own id — but the person is the
         one being asked, and they were choosing blind.

         It is not a fixture artefact. A chain operates "Bally's" in three
         towns; each is a real Center with its own id, and its operator posts
         to one of them specifically. Posting to the wrong branch and not being
         able to tell is a worse failure than any empty state on this screen.

         WHAT IS ACTUALLY AVAILABLE TO TELL THEM APART. `/api/me/communities`
         carries id, name, role, operates, hue, members and joined_at — and no
         location, which would have been the human answer. joined_at does not
         separate them either: these nineteen were joined within minutes of
         each other. So the only always-unique, person-checkable fact is the id
         — and it is the one already in the address bar when you open a Center
         (#/c/047fcbb50531), so a short head of it is something a person can
         actually match against something they have seen.

         SO THE DISAMBIGUATOR IS SHOWN ONLY WHERE IT IS NEEDED. A picker where
         every name is unique shows no ids at all; a name that occurs twice
         carries a quiet tail on both. Nothing is added to a screen that does
         not need it — which is the same rule the location block follows.

         AND EACH CHIP TAKES ITS OWN CENTER'S HUE, which the payload has been
         sending all along and nothing read. Nineteen chips in nineteen colours
         are distinguishable at a glance even before the text is read, and a
         Center's hue is already how this product says which world you are in. */
      var nameCount = {};
      places.forEach(function (p) {
        if (!p || !p.id || !p.name) return;
        var nm = String(p.name).trim();
        nameCount[nm] = (nameCount[nm] || 0) + 1;
      });

      function chip(id, label, hue, picture, shape) {
        var nm = String(label).trim();
        var tail = (nameCount[nm] > 1 && id && id !== SELF)
          ? String(id).slice(0, 4) : '';
        var b = mk('button', 'ow-dest');
        var face = mk('span', 'ow-dest__face');
        if (/^(round|rounded|square)$/.test(String(shape || ''))) face.setAttribute('data-shape', shape);
        /* you, with no picture: the outline (founder/495); a place its first letters (the one face rule, S21) */
        OW.cards.fill(face, { kind: id === SELF ? 'person' : 'center', picture: picture,
                              letters: (id === SELF ? nm.slice(0, 1) : nm.slice(0, 2)).toUpperCase() }, { img: ' loading="lazy"' });
        b.appendChild(face);
        b.appendChild(mk('span', 'ow-dest__n', esc(nm) + (tail ? ' <i class="po-act__tag">' + esc(tail) + '</i>' : '')));
        b.type = 'button';
        /* THE CHIP WEARS THE CENTER IT SENDS TO, not the row's.
           `--ow-h1` is an RGB TRIPLE ("r,g,b"), not an angle and not HSL —
           `OW.hue.fromAngle` is the one bridge from the backend's single
           integer to the pair the canon requires, and writing an angle
           straight into the variable produces `rgb(8 70% 58%)`, which is
           invalid and paints nothing. I wrote exactly that first. */
        if (typeof hue === 'number' && OW.hue && OW.hue.fromAngle) {
          var pair = OW.hue.fromAngle(hue);
          if (pair && pair[0]) {
            b.style.setProperty('--h', pair[0]);
            b.style.setProperty('--h2', pair[1] || pair[0]);
          }
        }
        /* THE CHIP CARRIES ITS OWN DESTINATION. Every later read — the
           pre-select, the confirmation — asks the chip what it means rather
           than matching its visible text, which is a label and may be a
           person's name, a community's, or a translation. */
        b.setAttribute('data-dest', id);
        b.setAttribute('aria-pressed', String(picked === id));
        b.addEventListener('click', function () {
          picked = (picked === id) ? '' : id;
          Array.prototype.forEach.call(chips.children, function (c) {
            var on = c === b && picked;
            c.setAttribute('aria-pressed', String(!!on));
          });
          sync();
        });
        chips.appendChild(b);
        return b;
      }
      /* THE PERSON'S OWN CENTER COMES FIRST — it is the one destination that
         is always there, and on a brand-new account it is the only one. */
      /* the person's own face on their own destination (436) */
      chip(SELF, selfLabel, null, meRow.picture || meRow.image || '', meRow.shape || 'round');
      places.forEach(function (p) {
        if (!p || !p.id || !p.name) return;      /* a place we cannot name */
        chip(p.id, p.name, typeof p.hue === 'number' ? p.hue : null, p.picture || '', p.shape || '');
      });

      /* THE FIELD MATERIAL ALREADY EXISTS — `.ow-fld` carries the dark
         ground, the radius, the placeholder tone and the focus ring that
         takes the person's own hue. A bare <textarea> renders as a WHITE BOX
         in a dark world; I shipped exactly that a moment ago and saw it on
         screen. Reuse beats inventing a second field style. */
      /* A HEADLINE, OPTIONAL. `POST /api/posts` has always taken `title` and
         the App has never sent one, so a person could not give their post a
         name while the Center's own composer could. Same field material as
         the body — `.ow-fld` — never a second one. */
      /* ── DEPTH ON REQUEST, NEVER AN EMPTY BOX ─────────────────────────
         ★ FOUNDER/369: *"how things like extra descriptions and headers
           could be optional for things like posts while not making them feel
           like empty boxes that a user has to either live leave in or leave
           out."*

         THIS WAS THE EMPTY BOX. The headline input sat above the body on
         every open of the composer, empty, saying "A headline, if it needs
         one" — and every person writing a two-line post had to decide what
         to do about a field they had not asked for. Two bad outcomes, both
         the founder's words: fill it with something to make the box go away,
         or leave it and post past a hole.

         THE PATTERN EVERY PLATFORM CONVERGED ON is one field and a quiet way
         to ask for more. The composer opens as the body alone. "Add a
         headline" is a text control under it, not a box; pressing it reveals
         the field, focused, and the control goes. A person who never wants a
         headline never sees an input for one. A person who does is one press
         from it. Nothing is hidden that has a value: once the field exists it
         stays for this composer, and an emptied one is simply not sent.

         The same pattern is the answer for descriptions, venues and the rest
         of an Event's depth (founder/369 names events first) — the field is
         the depth, the control is the invitation, and the box is never there
         until it is wanted. */
      var tfld = mk('div', 'ow-fld');
      tfld.hidden = true;
      var tin = doc.createElement('input');
      tin.type = 'text';
      tin.placeholder = 'Headline';
      tin.setAttribute('aria-label', 'Headline');
      tfld.appendChild(tin);
      var more = mk('div', 'ow-depth');
      var addT = mk('button', 'ow-depth__add', 'Add a headline');
      addT.type = 'button';
      addT.addEventListener('click', function () {
        tfld.hidden = false;
        addT.remove();
        if (!more.children.length) more.remove();
        try { tin.focus(); } catch (e) {}
      });
      more.appendChild(addT);

      var fld = mk('div', 'ow-fld');
      var ta = doc.createElement('textarea');
      ta.rows = 3;
      ta.placeholder = 'Say something';
      ta.setAttribute('aria-label', 'What to post');
      fld.appendChild(ta);
      var send = mk('button', 'ow-btn', 'Post it');
      send.type = 'button'; send.disabled = true;
      var out = mk('div');

      function sync() { send.disabled = !(ta.value.trim() && picked); }
      ta.addEventListener('input', sync);

      /* PRE-SELECT WHAT IS ALREADY DECIDED. A person who belongs nowhere has
         exactly one destination — their own Center — and asking them to tap a
         chip with no alternative is a step with a single possible outcome.
         Done here rather than in the chip helper because `send` does not exist
         yet up there and `sync()` would throw on it.

         THE OLD VERSION MATCHED ON LABEL TEXT and compared against `''` when
         there was more than one place, so every chip got `aria-pressed=false`
         while `picked` held a real id — the button was live and the screen
         showed nothing chosen. Matching the CHIP'S OWN VALUE instead cannot
         drift from what will actually be sent. */
      Array.prototype.forEach.call(chips.children, function (c) {
        var on = !!picked && c.getAttribute('data-dest') === picked;
        c.setAttribute('aria-pressed', String(on));
        c.classList.toggle('po-act--primary', on);
      });
      sync();

      send.addEventListener('click', function () {
        var body = ta.value.trim(); if (!body || !picked) return;
        send.disabled = true;
        out.innerHTML = '';
        /* A DESTINATION IS NOT OPTIONAL — `picked` is a real community id, or
           the sentinel meaning this person's own Center, or the button never
           enabled. `@me` is translated to an empty `light_to` at the wire,
           because the SERVER owns what "my own Center" resolves to: it holds
           the person's Center id and its display name, and a client that
           guessed either would be inventing a destination. */
        /* ── ON THE NEW BACKEND (founder/500) ────────────────────────────
           The second of the App's two posting doors that still wrote through
           legacy `/api/posts`. The canonical route names the destination
           explicitly as `center_id`; "my own Center" is `data.meHome()`, which
           is the SERVER'S value — the `home_id` it handed back at sign-in — so
           the reasoning above still holds: nothing here guesses a destination,
           it repeats the one the server already stated. */
        var ownHome = (data.meHome && data.meHome()) || '';
        var dest = (picked === SELF) ? ownHome : picked;
        if (!dest) {
          out.appendChild(mk('p', 'ow-note show ow-note--bad',
            'There is nowhere for this to go yet — your own Center has not been made.'));
          sync(); return;
        }
        var wbody = { center_id: dest, body: body, title: (tin.value || '').trim() };
        var can = reachFor[reachCenter()] || [];
        var outward = OW.reach.keys(outTo).filter(function (k) {
          return can.some(function (t) { return t.key === k && t.canSend && OW.reach.meets(t, []); });
        });
        if (outward.length) wbody.destinations = outward;
        data.post('/api/oneway/social/posts', wbody)
          .then(function (res) {
            if (!res.ok) {
              /* NAMED, NEVER SWALLOWED — and `.ow-note` is display:none until
                 `.show`, which is how twelve earlier notes wrote to nobody */
              out.appendChild(mk('p', 'ow-note show ow-note--bad',
                esc(res.status === 422
                    ? 'That did not pass the security screen.'
                    : (res.error || 'It did not go out.'))));
              sync(); return;
            }
            /* THE SERVER NAMES THE PLACE IT ACTUALLY LANDED IN. This used to
               search `places` only, so a post to the person's own Center — not
               in that list — fell through to "the place you chose", which tells
               someone nothing about where their words went. */
            var name = ((res.data || {}).post || {}).destination_name || '';
            if (!name) places.forEach(function (p) { if (p.id === picked) name = p.name; });
            if (!name && picked === SELF) name = selfLabel;
            ta.value = ''; tin.value = '';
            out.appendChild(mk('p', 'ow-note show ow-note--good',
              esc('Posted to ' + (name || 'the place you chose') + '.')));
            OW.reach.track(out, ((res.data || {}).post || {}).id || '', (res.data || {}).syndication || []);
            outTo = {}; paintReach();
            /* the feed this just landed in must re-read reality */
            data.invalidate(FEED_READS);
            /* SEEING IT LAND IS THE SATISFYING PART, and a confirmation with
               nowhere to go is a dead end. Home is where a post to a place
               you belong to actually arrives — verified: `/api/me/feed/posts`
               carries it, nested as `{actor, post:{title, body…}}`. The App
               has no route to a single Center, so this goes to the feed and
               says so rather than promising a page that does not exist. */
            if (typeof global.go === 'function') {
              var seeIt = mk('button', 'po-act', 'See it in Home');
              seeIt.type = 'button';
              seeIt.addEventListener('click', function () { global.go('home'); });
              out.appendChild(seeIt);
            }
            sync();
          });
      });

      wrap.appendChild(chips);
      wrap.appendChild(tfld);            /* hidden until asked for */
      wrap.appendChild(fld);
      wrap.appendChild(more);            /* the invitations to add depth */
      /* ALSO TO THE PLATFORMS — the ones the chosen place can send to; a
         place the person does not run answers none, and then there is no row
         (founder/503) */
      var outTo = {}, reachSlot = mk('div'), reachFor = {};
      wrap.appendChild(reachSlot);
      function reachCenter() {
        return picked === SELF ? ((data.meHome && data.meHome()) || '') : (picked || '');
      }
      function paintReach() {
        var cid = reachCenter();
        reachSlot.innerHTML = '';
        var pl = null;
        places.forEach(function (p) { if (p && p.id === cid) pl = p; });
        if (OW.reach.notRun(reachSlot, pl)) return;
        if (reachFor[cid] === undefined) {
          reachFor[cid] = null;
          OW.reach.targets(cid, pl).then(function (ts) { reachFor[cid] = ts || []; paintReach(); });
          return;
        }
        OW.reach.row(reachSlot, reachFor[cid] || [], outTo, '', []);
      }
      paintReach();
      chips.addEventListener('click', function () { global.setTimeout(paintReach, 0); });
      wrap.appendChild(send);
      wrap.appendChild(out);
      return places.length;
    }).catch(function () { return 0; });
  }

  _u.beginEmptyPost = beginEmptyPost;
  _u.beyondOneway = beyondOneway;
  _u.brainSuggests = brainSuggests;
  _u.composer = composer;
  _u.postToPlace = postToPlace;
})(window);
