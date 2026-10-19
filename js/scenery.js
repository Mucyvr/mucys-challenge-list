/* The backdrop: a field of crystal spikes under a halftone moon, with the
   ground underneath - and a camera that moves with the list.

   Scroll a list and the camera goes down with you. #1 is the view from the
   peaks; the last live level is down at the foot of the spikes, on the floor;
   Legacy is underground, past the surface. Pages without a list just drift
   down a little as you scroll.

   The world is drawn once, as layers of inline svg from a fixed seed, so it
   is the same picture everywhere and costs nothing to download. Each layer
   moves at its own speed (far things slower than near things), which is what
   makes it read as depth, and the mouse nudges them sideways the same way.
   Only CSS transforms change after that, so the browser never redraws the
   shapes while you scroll.

   Colours come from the --sc-* tokens in style.css - that is how the same
   shapes go near-black on the dark theme and pale grey on the light one. */
(function () {
  var host = document.querySelector(".scenery");
  if (!host) return;

  /* ---- the world, in world units ---- */
  var W = 1600, PAD = 100, H = 2900;     // drawn from -PAD to W+PAD so sideways nudges never show an edge
  var G = 1800;                          // the ground line
  var VIEW = 900;                        // how much world the screen shows, top to bottom

  /* where the camera's top edge sits at each stop */
  var CAM_PEAK = 450;                    // #1: up among the tips
  /* the rest depend on how much world fits on this screen, so size() sets them */
  var CAM_FLOOR, CAM_SURFACE, CAM_DEEP;
  function stops(viewH) {
    CAM_FLOOR = G - viewH * 0.74;        // last live level: the floor in the bottom quarter
    CAM_SURFACE = G - viewH * 0.45;      // the Legacy heading: ground across the middle
    CAM_DEEP = G + 90;                   // last legacy level: all underground
  }

  var seed = 7;
  function rnd() {                       // mulberry32: small, seeded, good enough
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
  function between(a, b) { return a + rnd() * (b - a); }
  function f(n) { return Math.round(n * 10) / 10; }
  function clamp(n) { return n < 0 ? 0 : n > 1 ? 1 : n; }

  /* One spike: a thin triangle split into a lit face and a shaded face,
     which is all it takes to read as a crystal. */
  function spike(cx, base, w, h, cls) {
    var lean = between(-0.3, 0.3) * w;
    var ax = cx + lean, ay = base - h;
    var split = cx + between(-0.15, 0.25) * w;
    var l = cx - w / 2, r = cx + w / 2;
    return '<path class="' + cls + 'l" d="M' + f(l) + ' ' + base + 'L' + f(split) + ' ' + base + 'L' + f(ax) + ' ' + f(ay) + 'Z"/>' +
           '<path class="' + cls + 'd" d="M' + f(split) + ' ' + base + 'L' + f(r) + ' ' + base + 'L' + f(ax) + ' ' + f(ay) + 'Z"/>';
  }

  /* taller toward the edges, so the spikes frame the list instead of hiding behind it */
  function edge(x) { return 0.6 + 0.7 * Math.pow(Math.abs(x - W / 2) / (W / 2), 1.3); }

  function field(o) {
    var out = "", x = -PAD - 30;
    while (x < W + PAD + 30) {
      out += spike(x, o.base, between(o.w[0], o.w[1]), between(o.h[0], o.h[1]) * edge(x), o.cls);
      x += between(o.step[0], o.step[1]);
    }
    return out;
  }

  /* a wavy line across the whole width, for the ground and the strata */
  function wave(y, amp, step) {
    var pts = [], x = -PAD;
    while (x <= W + PAD) { pts.push(f(x) + " " + f(y + between(-amp, amp))); x += step; }
    pts.push(f(W + PAD) + " " + f(y));
    return pts;
  }
  function band(y, amp, cls) {
    return '<path class="' + cls + '" d="M' + wave(y, amp, 80).join("L") + "L" + (W + PAD) + " " + H + "L" + (-PAD) + " " + H + 'Z"/>';
  }

  function dots(n, y0, y1, r0, r1) {
    var out = "";
    for (var i = 0; i < n; i++) {
      out += '<circle cx="' + f(between(-PAD, W + PAD)) + '" cy="' + f(between(y0, y1)) + '" r="' + f(between(r0, r1)) + '"/>';
    }
    return out;
  }

  function svg(inner, defs) {
    return '<svg viewBox="' + (-PAD) + " 0 " + (W + PAD * 2) + " " + H + '" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">' +
      (defs ? "<defs>" + defs + "</defs>" : "") + inner + "</svg>";
  }

  /* ---- sky: the moon ---- */
  var MX = W / 2, MY = 700, MR = 420;
  var sky = svg(
    '<circle class="sc-moon" cx="' + MX + '" cy="' + MY + '" r="' + (MR - 24) + '"/>' +
    '<rect x="' + (-PAD) + '" y="0" width="' + (W + PAD * 2) + '" height="' + (MY + MR + 10) + '" fill="url(#sc-dots)" mask="url(#sc-moonmask)"/>',
    '<pattern id="sc-dots" width="9" height="9" patternUnits="userSpaceOnUse"><circle cx="4.5" cy="4.5" r="1.7" class="sc-dot"/></pattern>' +
    '<radialGradient id="sc-ring"><stop offset=".45" stop-color="#fff" stop-opacity=".12"/><stop offset=".78" stop-color="#fff" stop-opacity=".5"/>' +
      '<stop offset=".93" stop-color="#fff" stop-opacity="1"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>' +
    '<mask id="sc-moonmask"><circle cx="' + MX + '" cy="' + MY + '" r="' + MR + '" fill="url(#sc-ring)"/></mask>');

  /* ---- spikes: far is soft, mid is the sharp one ---- */
  var far = svg('<g filter="url(#sc-soft)" opacity=".8">' +
      field({ base: G + 40, w: [60, 130], h: [550, 1100], step: [30, 62], cls: "sf" }) + "</g>",
    '<filter id="sc-soft" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="1.6"/></filter>');
  var mid = svg(field({ base: G + 40, w: [80, 170], h: [500, 1250], step: [60, 115], cls: "sm" }) +
    /* a little haze where the spikes meet the ground, so they sink into it */
    '<rect x="' + (-PAD) + '" y="' + (G - 260) + '" width="' + (W + PAD * 2) + '" height="300" fill="url(#sc-haze)"/>',
    '<linearGradient id="sc-haze" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="sc-haze0"/><stop offset="1" class="sc-haze1"/></linearGradient>');

  /* ---- the ground and what is under it: Legacy ----
     Strata darkening toward black the deeper you go, rocks, and crystals
     buried at angles - the same spikes, gone underground. */
  var under = band(G, 8, "sg0") + band(G + 110, 22, "sg1") + band(G + 300, 30, "sg2") +
              band(G + 540, 34, "sg3") + band(G + 800, 30, "sg4");
  var rocks = "";
  for (var i = 0; i < 46; i++) {
    var rx = between(-PAD, W + PAD), ry = between(G + 60, H - 60), rs = between(10, 42), sides = 5 + Math.floor(rnd() * 3), pts = [];
    for (var k = 0; k < sides; k++) {
      var a = k / sides * Math.PI * 2 + between(-0.3, 0.3), rr = rs * between(0.6, 1);
      pts.push(f(rx + Math.cos(a) * rr * 1.4) + " " + f(ry + Math.sin(a) * rr));
    }
    rocks += '<path class="sr" d="M' + pts.join("L") + 'Z"/>';
  }
  var buried = "";
  for (var j = 0; j < 11; j++) {
    var bx = between(0, W), by = between(G + 220, H - 140), bs = between(0.35, 0.8), spin = between(-70, 70), cl = "";
    for (var c = 0; c < 4; c++) {
      cl += '<g transform="rotate(' + f(between(-40, 40)) + ')">' + spike(between(-14, 14), 0, between(26, 52), between(90, 210), "sb") + "</g>";
    }
    buried += '<g transform="translate(' + f(bx) + " " + f(by) + ") rotate(" + f(spin) + ") scale(" + f(bs) + ')">' + cl + "</g>";
  }
  var ground = svg(under + rocks + buried +
    '<path class="sgr" d="M' + wave(G, 0, 80).join("L") + '"/>');
  /* the surface line is redrawn flat on purpose: band() above already gave sg0 its own bumps */

  /* ---- foreground: big blurred spikes, out of focus ---- */
  var nearS = "";
  [[-20, 170, 520], [210, 130, 330], [470, 150, 260], [1120, 140, 280], [1370, 160, 360], [1640, 170, 540]]
    .forEach(function (s) { nearS += spike(s[0], G + 320, s[1], s[2] + 320, "sn"); });
  var near = svg('<g filter="url(#sc-blur)">' + nearS + "</g>",
    '<filter id="sc-blur" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="10"/></filter>');

  /* ---- dust: specks in the sky, motes underground ---- */
  var dustA = svg('<g class="sc-dust">' + dots(45, 20, G - 200, 0.8, 2.2) + "</g>");
  var dustB = svg('<g class="sc-dust">' + dots(35, 20, G - 200, 0.8, 1.8) + "</g>");
  var motes = svg('<g class="sc-mote">' + dots(60, G + 60, H - 20, 0.8, 2) + "</g>");

  /* Layers, back to front. `speed` is how fast each one follows the camera:
     under 1 is further away than the ground, over 1 is in front of it. */
  var LAYERS = [
    { html: sky,   speed: 0.35, cls: "l-sky" },
    { html: dustA, speed: 0.45, cls: "l-dust a" },
    { html: far,   speed: 0.72, cls: "l-far" },
    { html: dustB, speed: 0.8,  cls: "l-dust b" },
    { html: mid,   speed: 0.9,  cls: "l-mid" },
    { html: ground, speed: 1,   cls: "l-ground" },
    { html: motes, speed: 1,    cls: "l-motes" },
    { html: near,  speed: 1.1,  cls: "l-near" }
  ];
  host.innerHTML = LAYERS.map(function (l, n) {
    return '<div class="ly ' + l.cls + '" style="--n:' + n + '"><div class="in">' + l.html + "</div></div>";
  }).join("") + '<div class="sc-fx"><div class="sc-star"></div></div>';
  var els = host.querySelectorAll(".ly");
  var star = host.querySelector(".sc-fx");   // the wrapper: the star itself is busy with its own animation

  /* ---- the camera ---- */
  var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var scale = 1, left = 0;
  var cam = CAM_PEAK, camTo = CAM_PEAK, mx = 0, mxTo = 0;
  var anchors = null;                    // document positions of the list's stops, measured after each render

  function size() {
    var vw = host.clientWidth, vh = host.clientHeight;
    scale = Math.max(vw / W, vh / VIEW);
    left = (vw - (W + PAD * 2) * scale) / 2;
    stops(vh / scale);
    for (var i = 0; i < els.length; i++) {
      els[i].style.width = (W + PAD * 2) * scale + "px";
      els[i].style.height = H * scale + "px";
      els[i].style.left = left + "px";
    }
  }

  function measure() {
    var rows = document.querySelectorAll("#app a.row");
    if (!rows.length) { anchors = null; return; }
    var live = [], leg = [];
    for (var i = 0; i < rows.length; i++) (rows[i].classList.contains("legacy") ? leg : live).push(rows[i]);
    var sy = window.scrollY;
    function top(el) { return el.getBoundingClientRect().top + sy; }
    function bottom(el) { return el.getBoundingClientRect().bottom + sy; }
    var heading = leg.length && leg[0].parentElement && leg[0].parentElement.previousElementSibling;
    anchors = {
      first: top(live[0] || leg[0]),
      floor: live.length ? bottom(live[live.length - 1]) : top(leg[0]),
      surface: leg.length ? top(heading || leg[0]) : null,
      deep: leg.length ? bottom(leg[leg.length - 1]) : null
    };
  }

  function seg(p, a, b) { return b > a ? clamp((p - a) / (b - a)) : (p >= b ? 1 : 0); }

  function aim() {
    var sy = window.scrollY, vh = window.innerHeight;
    var maxScroll = Math.max(0, document.documentElement.scrollHeight - vh);
    if (!anchors) {                      // not a list: a gentle way down
      camTo = CAM_PEAK + (CAM_FLOOR - CAM_PEAK) * 0.45 * (maxScroll ? sy / maxScroll : 0);
      return;
    }
    /* the point being "looked at" is the middle of the screen; the stops are
       pulled up to where that point can actually reach on a short page */
    var p = sy + vh * 0.5, reach = maxScroll + vh * 0.5;
    var A = anchors, floor = Math.min(A.floor, reach);
    if (A.surface == null) {
      camTo = CAM_PEAK + (CAM_FLOOR - CAM_PEAK) * seg(p, A.first, floor);
      return;
    }
    var deep = Math.min(A.deep, reach), surface = Math.min(A.surface, deep);
    floor = Math.min(floor, surface);
    if (p < floor) camTo = CAM_PEAK + (CAM_FLOOR - CAM_PEAK) * seg(p, A.first, floor);
    else if (p < surface) camTo = CAM_FLOOR + (CAM_SURFACE - CAM_FLOOR) * seg(p, floor, surface);
    else camTo = CAM_SURFACE + (CAM_DEEP - CAM_SURFACE) * seg(p, surface, deep);
  }

  var raf = 0;
  function frame() {
    raf = 0;
    var k = reduce ? 1 : 0.09;
    cam += (camTo - cam) * k;
    mx += (mxTo - mx) * (reduce ? 1 : 0.06);
    if (Math.abs(camTo - cam) < 0.05) cam = camTo;
    if (Math.abs(mxTo - mx) < 0.05) mx = mxTo;
    for (var i = 0; i < els.length; i++) {
      var s = LAYERS[i].speed;
      els[i].style.transform = "translate3d(" + (mx * s).toFixed(2) + "px," + (-cam * s * scale).toFixed(2) + "px,0)";
    }
    /* the foreground spikes stand on the surface - fade them as the camera passes it */
    els[LAYERS.length - 1].style.opacity = String(1 - clamp((cam - CAM_FLOOR) / ((CAM_SURFACE - CAM_FLOOR) * 0.55)));
    /* shooting stars only make sense with sky on screen */
    star.style.opacity = String(1 - clamp((cam - CAM_PEAK) / 400));
    host.style.setProperty("--depth", clamp((cam - CAM_SURFACE) / (CAM_DEEP - CAM_SURFACE)).toFixed(3));
    if (cam !== camTo || mx !== mxTo) raf = requestAnimationFrame(frame);
  }
  function kick() { if (!raf) raf = requestAnimationFrame(frame); }

  /* re-measure whenever the page is redrawn - a new view, a filter, a sync */
  var pending = 0;
  function remeasure() {
    if (pending) return;
    pending = requestAnimationFrame(function () { pending = 0; measure(); aim(); kick(); });
  }
  var app = document.getElementById("app");
  if (app && window.MutationObserver) new MutationObserver(remeasure).observe(app, { childList: true, subtree: true });

  window.addEventListener("scroll", function () { aim(); kick(); }, { passive: true });
  window.addEventListener("resize", function () { size(); remeasure(); });
  if (!reduce) {
    window.addEventListener("pointermove", function (e) {
      if (e.pointerType && e.pointerType !== "mouse") return;
      mxTo = (0.5 - e.clientX / window.innerWidth) * 36;
      kick();
    }, { passive: true });
  }

  size();
  measure(); aim(); cam = camTo;         // start where the page already is - no swoop on a refresh
  frame();
  requestAnimationFrame(function () { host.classList.add("on"); });
})();
