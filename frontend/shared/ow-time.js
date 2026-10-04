/* ── WHEN SOMETHING HAPPENS, AND WHICH THING TO SHOW FIRST ────────────────
   ★ FOUNDER, 2026-09-04: the temporal ranking should be a shared contract,
     not buried in a widget picker.

   It was buried in one. `tierOf` lived inside countdownFace's closure, so
   "Counting Down" ranked NOW → SOONEST → ENDED → UNTIMED, and "What's
   Happening" — which reads the same events from the same endpoint — did not
   rank at all. It rendered whatever order the server sent. Two Popits on the
   same Home, showing the same events, disagreeing about which one is next.

   A second copy of a rule is not a duplicate, it is a future disagreement. So
   the rule lives here once, and every surface that has an opinion about time
   reads it rather than restating it.

   THE ORDER A PERSON MEANS BY "NEXT"
     0  happening now      — the answer to "what is on" is this
     1  the soonest FUTURE one
     2  ended, and only when there is nothing else to say
     3  no time at all     — last, because an event with a known time is more
                             useful than one without; never dropped, because it
                             is still a real thing happening here
   Within a tier, soonest first.

   A DISAGREEMENT FOUND WHILE LIFTING THIS OUT. The two copies had already
   drifted, exactly as predicted, on an event with an end in the past and no
   start: untilText answered ENDED (it tested the end first, unconditionally)
   while tierOf answered UNTIMED (it returned early unless a valid start
   existed). One rule said "this finished", the other said "we do not know when
   this is". Resolved toward ENDED — a known end IS temporal knowledge, and
   "finished" is more use to a reader than "not set". Now impossible to have
   the argument twice: the words and the ranking are derived from ONE tier. */

(function (global) {
  var OW = global.OW = global.OW || {};

  var TIER = { NOW: 0, UPCOMING: 1, ENDED: 2, UNTIMED: 3 };

  /* ── WHICH EVENTS MAY BE ANNOUNCED AT ALL ──────────────────────────────
     A management list is not a promise. The domain keeps returning an event
     you cancelled because you operate that Center; a Popit that renders it is
     advertising a cancelled concert. A DRAFT is excluded for the same reason:
     it exists but has not been announced, and announcing it is precisely what
     these tiles do. */
  var ON_STATES = { scheduled: 1, live: 1 };
  function isAnnounceable(ev) {
    if (!ev) return false;
    var st = (ev.state || '').toLowerCase();
    /* a legacy row carries no state it chose; the domain stamps it SCHEDULED */
    if (!st) return true;
    return !!ON_STATES[st];
  }

  /* Date.parse returns NaN for junk and 0 is a legitimate instant nobody
     means here, so both are treated as "not a time" — consistently, in one
     place, rather than as four slightly different truthiness tests */
  function ms(v) {
    if (!v) return null;
    var t = Date.parse(v);
    return (!t || isNaN(t)) ? null : t;
  }
  function startOf(ev) { return ms((ev || {}).starts_at); }
  function endOf(ev)   { return ms((ev || {}).ends_at); }

  function tier(ev, now) {
    now = now || Date.now();
    var st = startOf(ev), en = endOf(ev);
    if (en !== null && en <= now) return TIER.ENDED;   /* a known end wins */
    if (st === null) return TIER.UNTIMED;
    if (st <= now) return TIER.NOW;
    return TIER.UPCOMING;
  }

  /* soonest first within a tier; an event with no start sorts after one with */
  function compare(a, b, now) {
    now = now || Date.now();
    var ta = tier(a, now), tb = tier(b, now);
    if (ta !== tb) return ta - tb;
    var sa = startOf(a), sb = startOf(b);
    if (sa === null && sb === null) return 0;
    if (sa === null) return 1;
    if (sb === null) return -1;
    return sa - sb;
  }

  /* a COPY, sorted. Callers pass arrays they did not author — a read cache,
     shared between two widgets — and sorting one in place would reorder the
     other's data underneath it. */
  function rank(rows, now) {
    now = now || Date.now();
    return (rows || []).slice().sort(function (a, b) { return compare(a, b, now); });
  }

  /* ── FOUR TEMPORAL STATES, AND ONLY ONE OF THEM IS A COUNTDOWN ──────────
     ★ FOUNDER RULING, 2026-09-04:
         No start time -> Date/time not set
         Future        -> Starts in X
         Started       -> Happening now
         Ended         -> Ended
       *"No fake countdown."*

     ENDED was the one that used to be missing, because nothing read ends_at at
     all: an event that finished an hour ago rendered through the "started"
     branch as HAPPENING NOW — the most confidently wrong thing a Popit can
     say, because it reads as live information rather than as an absence.

     ends_at is optional in the domain, so an event with a start and no end
     stays "happening now" once it begins. That is what is actually known about
     it, and inventing an end would be the same fabrication as inventing a
     start.

     Returns null for UNTIMED so the caller states the absence in its own
     voice — a Countdown says "Date/time not set", a list may say nothing. */
  /* the words are sentence case (founder/467: no all-capitals anywhere) */
  function until(startsAt, endsAt, now) {
    now = now || Date.now();
    var ev = { starts_at: startsAt, ends_at: endsAt };
    var t = tier(ev, now);
    if (t === TIER.ENDED) return { word: 'Ended', state: 'ended', tier: t };
    if (t === TIER.UNTIMED) return null;
    if (t === TIER.NOW) return { word: 'Happening now', state: 'now', on: true, tier: t };

    var msLeft = startOf(ev) - now;
    var mins = Math.floor(msLeft / 60000);
    /* under a minute it says the event is starting, which is the only honest
       thing left to say — and it costs a frame a second forever to say
       anything more precise than that */
    if (mins < 1) return { word: 'Starting now', state: 'now', on: true, tier: TIER.NOW };
    if (mins < 60) return { word: 'Starts in ' + mins + (mins === 1 ? ' minute' : ' minutes'),
                            state: 'soon', tier: t };
    var hrs = Math.floor(mins / 60);
    if (hrs < 24) return { word: 'Starts in ' + hrs + (hrs === 1 ? ' hour' : ' hours'),
                           state: 'soon', tier: t };
    var days = Math.floor(hrs / 24);
    return { word: 'Starts in ' + days + (days === 1 ? ' day' : ' days'), state: 'soon', tier: t };
  }

  OW.time = {
    TIER: TIER,
    isAnnounceable: isAnnounceable,
    startOf: startOf,
    endOf: endOf,
    tier: tier,
    compare: compare,
    rank: rank,
    until: until
  };
})(typeof window !== 'undefined' ? window : this);
