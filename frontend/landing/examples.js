/* THE LANDING'S EXAMPLE PROFILES AND CENTERS (the founder, 2026-10-17: "condense the profile and center cards to be the same
   size, completely redo them with correct design and info and give multiple examples. i want to build highly populated
   centers and profiles in the next few days and push them to the landing pages but we are gonna publish the placeholders
   for now its alright if nothings clickable"). Placeholders until his own Centers and profiles replace them: invented
   people and places in the beta's city, drawn by the one card renderer (OW.cards) as the App draws a real card, each
   marked `example` so nothing on it opens, and the section says they are examples. No real person, account or business. */
(function (global) {
  'use strict';
  var OW = global.OW = global.OW || {};
  var P = function (o) { o.kind = 'person'; o.example = true; o.private = false; o.id = o.handle; o.ref = o.handle; o.app = ''; o.href = ''; o.unreadable = []; return o; };
  var C = function (o) { o.kind = 'center'; o.example = true; o.demo = false; o.id = o.ref.replace(/^\$/, ''); o.app = ''; o.href = ''; o.unreadable = []; o.links = o.links || []; return o; };
  OW.landingExamples = {
    people: [
      P({ handle: '@maya.cole', title: 'Maya Cole', hue: 330, layout: 'beside', picture: null,
          line: 'Photographer in Brooklyn. Street portraits, rooftops and the light at golden hour.', place: 'Brooklyn, NY', website: '',
          links: [{ url: 'https://www.instagram.com/' }, { url: 'https://www.tiktok.com/' }, { url: 'https://www.youtube.com/' }],
          banner: null, counts: null }),
      P({ handle: '@jordanreyes', title: 'Jordan Reyes', hue: 24, layout: 'beside', picture: null,
          line: 'Chef. A Brooklyn pop-up every Friday this winter.', place: 'Williamsburg, Brooklyn', website: '',
          links: [{ url: 'https://www.instagram.com/' }, { url: 'https://www.facebook.com/' }, { url: 'https://x.com/' }],
          banner: null, counts: null }),
      P({ handle: '@priya.shah', title: 'Priya Shah', hue: 262, layout: 'beside', picture: null,
          line: 'Runs a book club in Astoria. Thursdays at 7, new members always welcome.', place: 'Queens, NY', website: '',
          links: [{ url: 'https://www.instagram.com/' }, { url: 'https://www.linkedin.com/' }],
          banner: null, counts: null }),
      P({ handle: '@marcus.lee', title: 'Marcus Lee', hue: 190, layout: 'beside', picture: null,
          line: 'DJ and producer. Sets around the city most weekends.', place: 'Manhattan, NY', website: '',
          links: [{ url: 'https://www.tiktok.com/' }, { url: 'https://www.youtube.com/' }, { url: 'https://www.instagram.com/' }, { url: 'https://discord.com/' }],
          banner: null, counts: null })
    ],
    centers: [
      C({ ref: '$rockawaysurf', links: [{ url: 'https://www.instagram.com/' }, { url: 'https://www.facebook.com/' }, { url: 'https://www.youtube.com/' }], title: 'Rockaway Surf Club', hue: 200, layout: 'beside', picture: null, cover: '', banner: null,
          category: 'club', category_label: 'Surf club', categories: ['Surf club', 'Lessons'], line: 'Rockaway Beach, NY',
          blurb: 'Lessons at dawn, boards to rent and a bonfire most Fridays all summer.', website: '',
          details: [{ label: 'Hours', value: 'Daily from 6am' }, { label: 'Lessons', value: 'From $45' }, { label: 'Rentals', value: 'Boards, wetsuits' }], counts: { followers: 2480, posts: 142, events: 18 } }),
      C({ ref: '$sunrisebakery', links: [{ url: 'https://www.instagram.com/' }, { url: 'https://www.facebook.com/' }], title: 'Sunrise Bakery', hue: 38, layout: 'beside', picture: null, cover: '', banner: null,
          category: 'bakery', category_label: 'Bakery', categories: ['Bakery', 'Coffee'], line: 'Astoria, NY',
          blurb: 'Bread from 6am, coffee all day and a long table for whoever comes in.', website: '',
          details: [{ label: 'Hours', value: '6am to 6pm' }, { label: 'Serves', value: 'Bread, pastry, coffee' }], counts: { followers: 1310, posts: 87, events: 6 } }),
      C({ ref: '$baystreetstudio', links: [{ url: 'https://www.instagram.com/' }, { url: 'https://www.tiktok.com/' }, { url: 'https://www.youtube.com/' }], title: 'Bay Street Studio', hue: 285, layout: 'beside', picture: null, cover: '', banner: null,
          category: 'studio', category_label: 'Dance studio', categories: ['Dance studio', 'Classes'], line: 'Long Island City, NY',
          blurb: 'Classes for every level, six days a week, and a showcase every season.', website: '',
          details: [{ label: 'Classes', value: '6 days a week' }, { label: 'Styles', value: 'Ballet, hip hop, jazz' }, { label: 'Ages', value: '4 and up' }, { label: 'First class', value: 'Free' }], counts: { followers: 870, posts: 64, events: 12 } }),
      C({ ref: '$harborlights', links: [{ url: 'https://www.instagram.com/' }, { url: 'https://www.facebook.com/' }, { url: 'https://x.com/' }], title: 'Harbor Lights Market', hue: 150, layout: 'beside', picture: null, cover: '', banner: null,
          category: 'market', category_label: 'Farmers market', categories: ['Farmers market', 'Local food'], line: 'Red Hook, Brooklyn',
          blurb: 'Local farms by the water, with music and food trucks every week.', website: '',
          details: [{ label: 'Open', value: 'Sat, 8am to 1pm' }, { label: 'Season', value: 'May to November' }, { label: 'Vendors', value: '40 local farms' }, { label: 'Parking', value: 'Free, on site' }, { label: 'Pets', value: 'Welcome' }, { label: 'Pays', value: 'Cards, cash, SNAP' }], counts: { followers: 1960, posts: 110, events: 27 } })
    ]
  };
  /* THE CORNER'S OWN PIECES (his brief of 2026-11-09, items 4 and 5: "use realistic product interfaces"), drawn by home.js 7.
     Nothing here is composed in the page: the event is the one event card's markup as the server makes it
     (api/oneway/cards/event_card.py html(facts(...)) for an example event of the example Bay Street Studio), and the code is
     the platform's own QR drawer (api/oneway/systems/asset/codes.py svg(matrix(...))) for https://oneway.center (the
     dispatcher's call, 2026-11-09: a code that opens our front door, never an example's address that goes nowhere).
     api/oneway/platform/test_home_script.py makes both again and fails on a difference. The hotel is an example Center like
     the others: invented, in the beta's city, opening nothing. */
  OW.landingExamples.corner = {
    hotel: C({ ref: '$kestrelhouse', links: [{ url: 'https://www.instagram.com/' }, { url: 'https://www.facebook.com/' }], title: 'Kestrel House', hue: 214, layout: 'beside', picture: null, cover: '', banner: null,
      category: 'hotel', category_label: 'Hotel', categories: ['Hotel', 'Rooftop bar'], line: 'Brooklyn Heights, NY',
      blurb: 'Sixty-four rooms over the harbor, a rooftop bar and breakfast until noon.', website: '',
      details: [{ label: 'Check-in', value: 'From 3pm' }, { label: 'Rooms', value: '64, harbor views' }, { label: 'Booking', value: 'On its own website' }], counts: { followers: 3120, posts: 96, events: 9 } }),
    event: { html: "<article class=\"ow-ecard ow-ecard--text\" data-ow-event=\"\" data-state=\"\"><div class=\"ow-ecard__body\"><div class=\"ow-ecard__date\" aria-hidden=\"true\"><span>DEC</span><b>12</b></div><div class=\"ow-ecard__words\"><h3 class=\"ow-ecard__t\">Winter Showcase</h3><p class=\"ow-ecard__when\"><time datetime=\"2026-12-12T19:00:00-05:00\">Sat, Dec 12 \u00b7 7:00 PM</time></p><p class=\"ow-ecard__where\">Bay Street Studio, Long Island City</p><p class=\"ow-ecard__tags\"><span class=\"ow-ecard__price\">Free</span></p></div><a class=\"ow-ecard__act\" href=\"#rsvp\" data-act=\"rsvp\">RSVP</a></div></article>" },
    qr: "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 33 33\" shape-rendering=\"crispEdges\" role=\"img\" aria-label=\"QR code\"><rect width=\"33\" height=\"33\" fill=\"#fff\"/><path fill=\"#000\" d=\"M4 4h7v1h-7zM13 4h2v1h-2zM16 4h2v1h-2zM20 4h1v1h-1zM22 4h7v1h-7zM4 5h1v1h-1zM10 5h1v1h-1zM17 5h4v1h-4zM22 5h1v1h-1zM28 5h1v1h-1zM4 6h1v1h-1zM6 6h3v1h-3zM10 6h1v1h-1zM12 6h5v1h-5zM19 6h2v1h-2zM22 6h1v1h-1zM24 6h3v1h-3zM28 6h1v1h-1zM4 7h1v1h-1zM6 7h3v1h-3zM10 7h1v1h-1zM12 7h4v1h-4zM17 7h3v1h-3zM22 7h1v1h-1zM24 7h3v1h-3zM28 7h1v1h-1zM4 8h1v1h-1zM6 8h3v1h-3zM10 8h1v1h-1zM12 8h3v1h-3zM16 8h1v1h-1zM18 8h1v1h-1zM20 8h1v1h-1zM22 8h1v1h-1zM24 8h3v1h-3zM28 8h1v1h-1zM4 9h1v1h-1zM10 9h1v1h-1zM12 9h2v1h-2zM15 9h1v1h-1zM18 9h3v1h-3zM22 9h1v1h-1zM28 9h1v1h-1zM4 10h7v1h-7zM12 10h1v1h-1zM14 10h1v1h-1zM16 10h1v1h-1zM18 10h1v1h-1zM20 10h1v1h-1zM22 10h7v1h-7zM12 11h3v1h-3zM16 11h1v1h-1zM4 12h1v1h-1zM6 12h5v1h-5zM13 12h2v1h-2zM16 12h4v1h-4zM22 12h5v1h-5zM5 13h5v1h-5zM11 13h1v1h-1zM14 13h3v1h-3zM20 13h1v1h-1zM23 13h1v1h-1zM27 13h1v1h-1zM4 14h2v1h-2zM10 14h3v1h-3zM15 14h2v1h-2zM18 14h2v1h-2zM21 14h1v1h-1zM23 14h3v1h-3zM27 14h2v1h-2zM5 15h1v1h-1zM8 15h2v1h-2zM11 15h2v1h-2zM18 15h1v1h-1zM20 15h1v1h-1zM23 15h2v1h-2zM28 15h1v1h-1zM4 16h3v1h-3zM10 16h1v1h-1zM12 16h2v1h-2zM16 16h3v1h-3zM21 16h2v1h-2zM24 16h1v1h-1zM26 16h3v1h-3zM4 17h4v1h-4zM9 17h1v1h-1zM12 17h3v1h-3zM18 17h1v1h-1zM23 17h1v1h-1zM25 17h1v1h-1zM27 17h1v1h-1zM4 18h1v1h-1zM6 18h1v1h-1zM9 18h3v1h-3zM13 18h5v1h-5zM19 18h7v1h-7zM27 18h2v1h-2zM4 19h1v1h-1zM7 19h2v1h-2zM12 19h1v1h-1zM15 19h1v1h-1zM19 19h1v1h-1zM21 19h4v1h-4zM28 19h1v1h-1zM4 20h1v1h-1zM8 20h1v1h-1zM10 20h2v1h-2zM15 20h1v1h-1zM20 20h5v1h-5zM26 20h1v1h-1zM12 21h3v1h-3zM16 21h2v1h-2zM20 21h1v1h-1zM24 21h2v1h-2zM4 22h7v1h-7zM17 22h2v1h-2zM20 22h1v1h-1zM22 22h1v1h-1zM24 22h1v1h-1zM26 22h3v1h-3zM4 23h1v1h-1zM10 23h1v1h-1zM12 23h2v1h-2zM16 23h2v1h-2zM20 23h1v1h-1zM24 23h2v1h-2zM27 23h2v1h-2zM4 24h1v1h-1zM6 24h3v1h-3zM10 24h1v1h-1zM12 24h2v1h-2zM16 24h1v1h-1zM18 24h7v1h-7zM26 24h3v1h-3zM4 25h1v1h-1zM6 25h3v1h-3zM10 25h1v1h-1zM12 25h3v1h-3zM21 25h2v1h-2zM24 25h5v1h-5zM4 26h1v1h-1zM6 26h3v1h-3zM10 26h1v1h-1zM12 26h1v1h-1zM14 26h3v1h-3zM19 26h1v1h-1zM21 26h1v1h-1zM25 26h2v1h-2zM28 26h1v1h-1zM4 27h1v1h-1zM10 27h1v1h-1zM14 27h2v1h-2zM18 27h8v1h-8zM28 27h1v1h-1zM4 28h7v1h-7zM12 28h1v1h-1zM15 28h1v1h-1zM21 28h1v1h-1zM23 28h6v1h-6z\"/></svg>"
  };
})(window);
