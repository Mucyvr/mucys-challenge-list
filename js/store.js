/* ===========================================================
   store.js - state, saving, and the list maths.

   Three layers, in order of authority:

   1. data/list.json  the PUBLISHED list. Ships with the site, so every
                      visitor sees it. This is what makes the list public.
   2. localStorage    your working copy. Edits land here first, which is
                      why they survive a refresh but nobody else sees them
                      until you publish.
   3. db              the shared live store, only when the page is opened
                      as a Claude artifact.

   Publishing = Admin -> Publish -> save the file into data/list.json and
   redeploy. Everything else in the app talks to put() / drop() / putCfg()
   and never cares which layer is running.
   =========================================================== */
window.MCL = window.MCL || {};
(function (M) {
  "use strict";

  var LS = "mcl.v3", TK = "mcl.theme", BK = "mcl.backup";
  M.backupKey = BK;

  M.DEF_CFG = {
    title: "Mucy's Challenge List",
    ver: "v1.0",
    blurb: "The challenge list run by Mucy. Beat a challenge, send the clip in the Discord, get on the leaderboard.",
    discord: "",
    studio: "https://mucys-studio.com",
    legacyAfter: 150,
    /* Live saving. Both of these are public by design - the anon key can
       only read the list and post a submission. What actually protects the
       list is the row-level security in supabase.sql: changing it needs a
       signed-in account. Never put the service_role key here.
       Left empty in the open-source copy: fill in your own project's
       values, or paste them in Admin -> Live saving. Empty means the site
       runs on data/list.json alone. */
    supaUrl: "",
    supaKey: ""
  };

  /* What a challenge can be based on. You can type anything you like in
     the admin form - these are just the suggestions in the dropdown. */
  M.BASED = ["Difficulty", "Spamming", "Consistency", "Timings", "Straight fly", "Memory", "Mixed"];

  /* Suggestions for the FPS box. Anything from 10 to 360 works - a 15 FPS
     challenge is fine - and anything above 360 is CBF. */
  M.FPS_HINTS = ["CBF", "360", "240", "180", "165", "144", "120", "60", "30", "15", "10"];

  /* Clean up whatever was typed in an FPS box.
     Returns the tidied value ("240", "15", "CBF"), or null if it is neither
     a sensible frame rate nor CBF - so "Hi" gets rejected. */
  M.normFps = function (v) {
    v = String(v == null ? "" : v).trim();
    if (!v) return "";                            /* blank is allowed - means unknown */
    if (/^cbf$/i.test(v)) return "CBF";
    if (/^[0-9]{1,4}$/.test(v)) {
      var n = parseInt(v, 10);
      return (n >= 10 && n <= 360) ? String(n) : null;
    }
    return null;
  };
  M.FPS_HELP = "a number from 10 to 360, or CBF for anything above that.";

  M.COLLS = ["challenges", "packs", "records", "submissions", "runs", "editors", "clans", "players"];
  M.S = { config: {}, challenges: {}, packs: {}, records: {}, submissions: {}, runs: {}, editors: {}, clans: {}, players: {}, meta: {} };
  M.DB = null;
  M.MODE = "local";
  M.UI = {
    view: "list", sel: { main: null, friends: null }, q: "", based: "",
    tab: { board: "main", roul: "main", packs: "main", submit: "record" },
    admin: false, msg: null, edit: null, run: null, user: null, clan: null, country: null, pos: null
  };

  /* ---------------- small helpers ---------------- */
  M.uid = function () { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); };
  M.esc = function (s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };
  M.hash = function (s) { var x = 5381; for (var i = 0; i < s.length; i++) x = ((x << 5) + x + s.charCodeAt(i)) | 0; return String(x >>> 0); };
  M.safeUrl = function (u) { u = String(u || "").trim(); return /^https?:\/\//i.test(u) ? u : ""; };
  /* People paste "medal.tv/..." or "youtu.be/..." without the https:// - that
     is still obviously a link, so give it the scheme rather than calling it
     missing. Anything that does not look like host/path is left alone. */
  M.fixUrl = function (u) {
    u = String(u || "").trim();
    if (u && !/^[a-z][a-z0-9+.-]*:/i.test(u) && /^(www\.)?[a-z0-9-]+(\.[a-z0-9-]+)+(\/|$)/i.test(u)) u = "https://" + u;
    return u;
  };
  M.cfg = function () { return Object.assign({}, M.DEF_CFG, M.S.config); };
  M.all = function (c) { return Object.keys(M.S[c]).map(function (k) { return M.S[c][k]; }); };

  /* ---------------- persistence ---------------- */
  M.themeKey = TK;
  M.lsRead = function () {
    try {
      var r = localStorage.getItem(LS);
      if (!r) return;
      var o = JSON.parse(r);
      M.COLLS.concat(["config", "meta"]).forEach(function (k) { if (o[k]) M.S[k] = o[k]; });
    } catch (e) { /* private mode, blocked storage - run from memory */ }
  };
  M.lsWrite = function () { try { localStorage.setItem(LS, JSON.stringify(M.S)); } catch (e) {} };

  /* Everything worth keeping, as one plain object. This is exactly what
     goes into data/list.json and what gets saved to the cloud.
     The admin PIN is deliberately left out: it is a local convenience lock,
     so it never travels to visitors, to the published file, or to the
     database. */
  M.snapshot = function (publishedAt) {
    var cfg = M.cfg();
    delete cfg.pin;
    var out = { publishedAt: publishedAt || 0, config: cfg };
    M.COLLS.forEach(function (k) { out[k] = M.S[k]; });
    return out;
  };
  /* Replace everything with a published or cloud snapshot, keeping the PIN
     that belongs to this browser. */
  M.applySnapshot = function (file, baseAt) {
    var pin = (M.S.config && M.S.config.pin) || "";
    if (file.config) M.S.config = Object.assign({}, M.DEF_CFG, file.config);
    if (pin) M.S.config.pin = pin;
    M.COLLS.forEach(function (k) { if (file[k] && typeof file[k] === "object") M.S[k] = file[k]; });
    M.S.meta = Object.assign({}, M.S.meta, { baseAt: baseAt });
    M.lsWrite();
  };

  /* ---------------- who is signed in, and what they may do ----------------
     Two jobs, deliberately separate:

       owner  everything - placements, settings, staff, bans
       mod    the queue and nothing else: accept and reject records and
              Friends List challenges

     A mod can place a level, because that is what accepting a challenge out
     of the queue does. What a mod cannot do is change the settings or change
     who is staff, and that is enforced by the database (supabase.sql), not
     by hiding the buttons.

     With no cloud - a local copy of the folder, or the Claude preview - there
     is nobody to sign in as, so editing is open the way it always was. */
  M.role = function () {
    if (M.DB) return "owner";
    if (!(M.cloud && M.cloud.enabled())) return "owner";
    return M.cloud.role();
  };
  M.canEdit = function () { return M.role() === "owner"; };
  M.canQueue = function () { var r = M.role(); return r === "owner" || r === "mod"; };
  /* Moving a level up and down the list. A mod can do this as well as work
     the queue - placing something out of the queue already decides a position,
     so being unable to fix it afterwards made no sense and left every
     reshuffle with the owner. Changing a level's details, adding one from
     scratch and deleting one stay with the owner. */
  M.canPlace = function () { return M.canQueue(); };
  M.me = function () { return (M.cloud && M.cloud.me && M.cloud.me()) || null; };

  /* ---------------- profiles ----------------
     A player on the list and a Discord account are tied together in one place
     only: the Discord user id an admin puts on the player in Admin -> Players.
     Nothing else links them, so nobody can claim somebody else's name by
     typing it into their own profile. */
  M.discordOf = function (name) {
    var p = M.player(name);
    return p && p.discordId ? String(p.discordId) : "";
  };
  M.playerByDiscord = function (id) {
    id = String(id || "");
    if (!id) return null;
    var hit = null;
    M.all("players").forEach(function (p) { if (String(p.discordId || "") === id) hit = p; });
    return hit;
  };
  /* Profiles nobody has been linked to yet. Somebody signs in, writes their
     page, and until an admin puts their Discord id on a name here it is
     attached to nothing - so the admin needs to be told it is waiting rather
     than having to hear about it from the person. */
  M.unlinkedProfiles = function () {
    if (!M.cloud || !M.cloud.profiles) return [];
    var taken = {};
    M.all("players").forEach(function (pl) { if (pl.discordId) taken[String(pl.discordId)] = 1; });
    return Object.keys(M.cloud.profiles).filter(function (id) { return !taken[id]; })
      .map(function (id) {
        var d = M.cloud.profiles[id] || {};
        return { discordId: id, data: d, label: d.discordName || d.gd || "" };
      })
      .filter(function (row) { return Object.keys(row.data).length > 0; });
  };

  /* What this player chose to show. {} when they have never filled one in. */
  M.profileOf = function (name) {
    var id = M.discordOf(name);
    if (!id || !M.cloud || !M.cloud.profiles) return null;
    return M.cloud.profiles[id] || null;
  };
  M.hasProfile = function (name) {
    var p = M.profileOf(name);
    return !!(p && Object.keys(p).some(function (k) { return String(p[k] || "").trim(); }));
  };
  /* The links a profile can carry. Each one is [key, label, prefix] - the
     prefix is what a bare handle gets turned into, so people can type
     "mucy" rather than the whole address. */
  M.SOCIALS = [
    ["youtube",  "YouTube",   "https://youtube.com/@"],
    ["twitch",   "Twitch",    "https://twitch.tv/"],
    ["twitter",  "X / Twitter", "https://x.com/"],
    ["tiktok",   "TikTok",    "https://tiktok.com/@"],
    ["instagram", "Instagram", "https://instagram.com/"],
    ["site",     "Website",   ""]
  ];
  M.socialUrl = function (key, value) {
    var v = String(value || "").trim();
    if (!v) return "";
    if (/^https?:\/\//i.test(v)) return M.safeUrl(v);
    var row = M.SOCIALS.filter(function (s) { return s[0] === key; })[0];
    if (!row || !row[2]) return M.safeUrl("https://" + v.replace(/^@/, ""));
    return M.safeUrl(row[2] + v.replace(/^@/, ""));
  };

  /* ---------------- clip hosts ----------------
     A submitted clip link has to be somewhere a clip actually lives. This is
     not about trusting the video - it is about not handing anyone a box that
     posts an arbitrary link under somebody else's completion. */
  M.CLIP_HOSTS = ["youtube.com", "youtu.be", "medal.tv", "streamable.com", "twitch.tv",
                  "discord.com", "discordapp.com", "discordapp.net", "drive.google.com", "dropbox.com"];
  M.clipHostOk = function (u) {
    var url = M.safeUrl(u);
    if (!url) return false;
    var host;
    try { host = new URL(url).hostname.toLowerCase().replace(/^www\./, ""); } catch (e) { return false; }
    return M.CLIP_HOSTS.some(function (h) { return host === h || host.endsWith("." + h); });
  };
  M.CLIP_HELP = "Clip links have to be on YouTube, Medal, Streamable, Twitch, Google Drive, Dropbox or Discord.";
  M.hasLocalWork = function () {
    return Object.keys(M.S.challenges).length > 0 || Object.keys(M.S.records).length > 0
      || Object.keys(M.S.packs).length > 0 || Object.keys(M.S.editors).length > 0
      || !!(M.S.meta && M.S.meta.editedAt);   /* settings-only changes count too */
  };
  M.stashBackup = function () {
    try { localStorage.setItem(BK, JSON.stringify(M.snapshot(Date.now()))); } catch (e) {}
  };
  M.readBackup = function () {
    try { var r = localStorage.getItem(BK); return r ? JSON.parse(r) : null; } catch (e) { return null; }
  };

  M.dbfail = function (e) {
    M.UI.msg = {
      t: "err",
      s: (e && e.code === "invalid_argument")
        ? "You have view-only access, so that change was not saved. Ask Mucy for edit access."
        : "Could not save that right now - try again in a moment."
    };
    M.render();
  };

  function touched() {
    M.S.meta = Object.assign({}, M.S.meta, { editedAt: Date.now() });
    M.lsWrite();
    if (M.cloud) M.cloud.schedulePush();   /* live save, when cloud is on */
  }
  /* True when this browser holds edits nobody else can see yet. With cloud
     saving on and signed in, this is only ever true for a moment. */
  M.unpublished = function () {
    var m = M.S.meta || {};
    if (M.DB) return false;
    if (M.cloud && M.cloud.enabled() && M.cloud.signedIn()) return false;
    return !!m.editedAt && m.editedAt > (m.baseAt || 0);
  };

  M.put = function (coll, id, obj) {
    obj = Object.assign({}, obj, { id: id });
    M.S[coll][id] = obj;
    if (M.DB) M.DB.doc(coll + "/" + id).set(obj).catch(M.dbfail); else touched();
    M.render();
  };
  M.drop = function (coll, id) {
    delete M.S[coll][id];
    if (M.DB) M.DB.doc(coll + "/" + id).delete().catch(M.dbfail); else touched();
    M.render();
  };
  M.putCfg = function (patch) {
    M.S.config = Object.assign(M.cfg(), patch);
    if (M.DB) M.DB.doc("site/config").set(M.S.config).catch(M.dbfail); else touched();
    M.render();
  };

  /* ---------------- list maths ---------------- */
  M.legacyAfter = function () { return Math.max(1, parseInt(M.cfg().legacyAfter, 10) || 150); };
  M.listOf = function (l) {
    return M.all("challenges").filter(function (c) { return c.list === l; })
      .sort(function (a, b) { return a.pos - b.pos; });
  };
  M.isLegacy = function (c) { return c.pos > M.legacyAfter(); };
  /* #1 is worth 200 and the curve falls off toward the cutoff.
     Anything in legacy is a flat 5. */
  M.pts = function (pos) {
    if (pos > M.legacyAfter()) return 5;
    return Math.round(200 * Math.exp(-0.0155 * (pos - 1)) * 10) / 10;
  };
  M.chal = function (id) { return M.S.challenges[id]; };
  M.atPos = function (l, p) { var a = M.listOf(l).filter(function (c) { return c.pos === p; }); return a[0] || null; };
  M.renumber = function (l) {
    M.listOf(l).forEach(function (c, i) {
      if (c.pos !== i + 1) {
        c.pos = i + 1; M.S.challenges[c.id] = c;
        if (M.DB) M.DB.doc("challenges/" + c.id).set(c).catch(M.dbfail);
      }
    });
    if (!M.DB) M.lsWrite();
  };
  M.recsFor = function (cid) {
    return M.all("records").filter(function (r) { return r.cid === cid && r.status === "approved"; })
      .sort(function (a, b) { return b.pct - a.pct || a.at - b.at; });
  };
  /* The leaderboard.

     Verifying a level IS a completion - you had to beat it to verify it -
     so every verifier is credited with their level automatically, without
     anyone having to submit a record for it. If they also submitted a
     record for the same level it is only counted once.

     Players are grouped case-insensitively, so "mucy" and "Mucy" are one
     person; the spelling shown is the first one seen. */
  M.board = function (l) {
    var m = {}, counted = {};
    function slot(name) {
      var k = String(name).trim().toLowerCase();
      return m[k] || (m[k] = { player: String(name).trim(), points: 0, done: 0, prog: 0, verified: 0, best: null });
    }
    function complete(name, c) {
      var p = slot(name);
      p.points += M.pts(c.pos); p.done++;
      if (p.best === null || c.pos < p.best) p.best = c.pos;
      counted[String(name).trim().toLowerCase() + "|" + c.id] = 1;
      return p;
    }
    /* verifiers first, so a duplicate record cannot double-count */
    M.listOf(l).forEach(function (c) {
      var v = String(c.verifier || "").trim();
      if (!v) return;
      complete(v, c).verified++;
    });
    M.all("records").filter(function (r) { return r.list === l && r.status === "approved"; }).forEach(function (r) {
      var c = M.chal(r.cid); if (!c) return;
      if (r.pct >= 100) {
        if (counted[String(r.player).trim().toLowerCase() + "|" + c.id]) return;
        complete(r.player, c);
      } else slot(r.player).prog++;
    });
    return Object.keys(m).map(function (k) { m[k].points = Math.round(m[k].points * 10) / 10; m[k].country = M.countryOf(m[k].player); return m[k]; })
      .sort(function (a, b) { return b.points - a.points || b.done - a.done; });
  };
  /* True when this player's completion comes from having verified it. */
  M.verifiedBy = function (c, player) {
    return String(c.verifier || "").trim().toLowerCase() === String(player || "").trim().toLowerCase();
  };
  M.pendingCount = function () {
    return M.all("submissions").filter(function (s) { return s.status === "pending"; }).length
      + M.all("records").filter(function (r) { return r.status === "pending"; }).length;
  };
  M.curList = function () { return M.UI.view === "friends" ? "friends" : "main"; };
  M.selected = function (l) {
    var arr = M.listOf(l); if (!arr.length) return null;
    var s = M.UI.sel[l] && M.chal(M.UI.sel[l]);
    if (s && s.list === l) return s;
    M.UI.sel[l] = arr[0].id; return arr[0];
  };
  /* Every "based on" value actually in use, for the filter dropdown. */
  /* "Timings, Memory" is two tags, not one - split on commas / slashes so the
     filter offers each tag on its own and a level shows up under both. */
  M.basedTags = function (c) {
    return String(c.basedOn || "").split(/[,\/&+]/).map(function (t) { return t.trim(); }).filter(Boolean);
  };
  M.basedValues = function (l) {
    var seen = {}, out = [];
    M.listOf(l).forEach(function (c) {
      M.basedTags(c).forEach(function (b) {
        if (!seen[b.toLowerCase()]) { seen[b.toLowerCase()] = 1; out.push(b); }
      });
    });
    return out.sort();
  };

  /* ---------------- webcam ---------------- */
  /* Some challenges only count if the run was recorded with a webcam on the
     player's hands - a click-spam challenge is trivial to fake otherwise. It
     is a per-level flag, off unless it is switched on, so every level placed
     before this existed simply reads "not required". */
  M.needsCam = function (c) { return !!(c && c.webcam); };
  M.CAM_ICON = '<svg class="ci" viewBox="0 0 24 24" aria-hidden="true">'
    + '<path d="M4 6h9a2 2 0 0 1 2 2v1.3l5-2.8v11l-5-2.8V16a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z"/></svg>';
  M.camChip = function (c) {
    return M.needsCam(c) ? '<span class="chip cam">' + M.CAM_ICON + "webcam required</span>" : "";
  };

  /* ---------------- players, countries, clans ---------------- */
  /* A player is just a name. "mucy" and "Mucy" are the same person, so
     everything is keyed on the lower-cased, trimmed name. */
  M.key = function (name) { return String(name || "").trim().toLowerCase(); };

  /* ISO 3166-1 alpha-2 codes; the names come from the browser (Intl), so
     there is no list of country names to keep up to date. */
  M.COUNTRIES = ("AD AE AF AG AI AL AM AO AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BW BY BZ "
    + "CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR "
    + "GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GT GU GW GY HK HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP "
    + "KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ "
    + "NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW "
    + "SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TG TH TJ TK TL TM TN TO TR TT TV TW TZ "
    + "UA UG US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW").split(" ");
  var dn = null;
  M.countryName = function (code) {
    code = String(code || "").toUpperCase();
    if (!code) return "";
    try { dn = dn || new Intl.DisplayNames(["en"], { type: "region" }); return dn.of(code) || code; } catch (e) { return code; }
  };
  /* "DE" -> the flag emoji. Kept for text-only places (messages, titles);
     Windows cannot draw these, so the site itself uses flagImg() below. */
  M.flag = function (code) {
    code = String(code || "").toUpperCase();
    if (!/^[A-Z]{2}$/.test(code)) return "";
    return String.fromCodePoint(0x1F1E6 + code.charCodeAt(0) - 65, 0x1F1E6 + code.charCodeAt(1) - 65);
  };
  /* "DE" -> <img> of the real flag. The PNGs live in img/flags/ inside the
     site folder, so nothing is fetched from anyone else's server. Somewhere
     the folder does not exist (the Claude preview) the image just hides. */
  M.flagImg = function (code) {
    code = String(code || "").toUpperCase();
    if (!/^[A-Z]{2}$/.test(code)) return "";
    var name = M.countryName(code);
    return '<img class="flag" src="' + (M.base || "") + "/img/flags/" + code.toLowerCase() + '.png" alt="' + M.esc(name)
      + '" title="' + M.esc(name) + '" width="20" height="15" loading="lazy" onerror="this.style.display=\'none\'">';
  };
  /* Whatever someone typed in a country box -> a code, or "" if it is not a
     country. Accepts "DE", "Germany", "germany", "Germany (DE)". */
  M.countryFromInput = function (text) {
    var t = String(text || "").trim();
    if (!t) return "";
    var m = t.match(/\(([A-Za-z]{2})\)\s*$/);
    if (m && M.COUNTRIES.indexOf(m[1].toUpperCase()) >= 0) return m[1].toUpperCase();
    if (/^[A-Za-z]{2}$/.test(t) && M.COUNTRIES.indexOf(t.toUpperCase()) >= 0) return t.toUpperCase();
    var lower = t.toLowerCase();
    for (var i = 0; i < M.COUNTRIES.length; i++) {
      if (M.countryName(M.COUNTRIES[i]).toLowerCase() === lower) return M.COUNTRIES[i];
    }
    for (var j = 0; j < M.COUNTRIES.length; j++) {           /* "united k" -> United Kingdom */
      if (M.countryName(M.COUNTRIES[j]).toLowerCase().indexOf(lower) === 0) return M.COUNTRIES[j];
    }
    return "";
  };
  M.player = function (name) { return M.S.players[M.key(name)] || null; };
  M.countryOf = function (name) {
    var p = M.player(name);
    if (p && p.country) return p.country;
    /* fall back to whatever they put on their most recent record */
    var k = M.key(name), best = null;
    M.all("records").forEach(function (r) { if (M.key(r.player) === k && r.country && (!best || r.at > best.at)) best = r; });
    return best ? best.country : "";
  };
  /* Clans: a full name, a tag of up to 4 letters that goes after your name
     as "Mucy (MCL)", and a list of member names. */
  M.clanOf = function (name) {
    var k = M.key(name);
    return M.all("clans").filter(function (c) { return (c.members || []).some(function (m) { return M.key(m) === k; }); })[0] || null;
  };
  M.clanByTag = function (tag) {
    tag = String(tag || "").toUpperCase();
    return M.all("clans").filter(function (c) { return String(c.tag || "").toUpperCase() === tag; })[0] || null;
  };
  M.normTag = function (t) { return String(t || "").replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 4); };
  /* "Mucy (MCL)" - the name the way it should read everywhere on the site */
  M.shown = function (name) {
    var c = M.clanOf(name);
    return String(name || "").trim() + (c ? " (" + c.tag + ")" : "");
  };
  /* Split "Mucy/MGG" or "Mucy, MGG" into people */
  M.people = function (field) {
    return String(field || "").split(/[\/,&+]| and /i).map(function (x) { return x.trim(); }).filter(Boolean);
  };
  /* Everything a clan page shows: points across both lists, levels made,
     levels verified, levels beaten. */
  M.clanStats = function (clan) {
    var keys = {};
    (clan.members || []).forEach(function (m) { keys[M.key(m)] = m; });
    var points = 0, beaten = 0, created = 0, verified = 0, per = {};
    Object.keys(keys).forEach(function (k) { per[k] = { name: keys[k], points: 0, beaten: 0 }; });
    ["main", "friends"].forEach(function (l) {
      M.board(l).forEach(function (row) {
        var k = M.key(row.player);
        if (!per[k]) return;
        per[k].points += row.points; per[k].beaten += row.done;
        points += row.points; beaten += row.done;
      });
    });
    M.all("challenges").forEach(function (c) {
      if (M.people(c.creator).some(function (n) { return per[M.key(n)]; })) created++;
      if (per[M.key(c.verifier)]) verified++;
    });
    var members = Object.keys(per).map(function (k) { return per[k]; }).sort(function (a, b) { return b.points - a.points; });
    return { points: Math.round(points * 10) / 10, beaten: beaten, created: created, verified: verified, members: members };
  };

  /* ---------------- roulette pools ---------------- */
  /* A roulette runs on the main list, the friends list, or both mixed
     together. "both" is its own board, so a mixed run is never compared
     against a single-list one. */
  M.ROUL_LISTS = [["main", "Main list"], ["friends", "Friends list"], ["both", "Both lists"]];
  M.poolFor = function (l) {
    return l === "both" ? M.listOf("main").concat(M.listOf("friends")) : M.listOf(l);
  };
  M.listLabel = function (l) { return l === "friends" ? "friends list" : l === "both" ? "both lists" : "main list"; };

  /* ---------------- redrawing safely ---------------- */
  /* The cloud sync redraws the page when the list changes. Rebuilding the
     page throws away whatever is half-typed in a form, so anything triggered
     by the sync goes through renderIfIdle(): if a form is being filled in,
     the redraw waits until it is done. */
  M.busyEditing = function () {
    if (M.UI.edit) return true;                       /* an admin form is open */
    var el = document.activeElement;
    if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) && el.closest && el.closest("#app")) return true;
    var forms = document.querySelectorAll("#app form[data-form]");
    for (var i = 0; i < forms.length; i++) {
      var f = forms[i];
      for (var j = 0; j < f.elements.length; j++) {
        var e = f.elements[j];
        if (!e.name || e.type === "hidden" || e.type === "submit") continue;
        if (e.type === "checkbox" || e.type === "radio") { if (e.checked) return true; }
        else if (String(e.value || "").trim() && e.value !== e.defaultValue) return true;
      }
    }
    return false;
  };
  M.renderIfIdle = function () {
    if (M.busyEditing()) { M.pendingRender = true; return false; }
    M.render(); return true;
  };

  /* ---------------- thumbnails ---------------- */
  /* Every level has one file, img/thumbs/<id>.jpg, fetched by mcl-tools/thumbs.js.
     Medal's own thumbnail urls are signed and expire within a day or two and
     Medal sends no CORS header, so the image has to be downloaded and served
     from here - which also means the list loads without touching anyone
     else's server. A level with no file falls back to a coloured tile, so a
     newly added level looks deliberate rather than broken. */
  /* The downloaded file wins over whatever url the Thumbnail box holds.

     A link pasted in there is a source to fetch from, not somewhere to serve
     from: Discord's image urls expire within a day or so (they carry a signed
     ?ex= stamp), Medal's expire too, and a link that dies takes the thumbnail
     with it. thumbs.js downloads from that url once and from then on the site
     serves its own copy, which cannot rot. */
  /* Where a level's picture comes from, in order:

       1. whatever is in the Thumbnail box - an uploaded file or a pasted url.
          Somebody chose it, on purpose, more recently than anything else, so
          it wins. Getting this order wrong made that box do nothing at all:
          every level has a downloaded copy, the copy won, and setting a
          thumbnail looked broken because the picture never changed.
       2. the downloaded copy in img/thumbs, which is what takes over when a
          pasted Discord or Medal url expires - that is the rot this was
          meant to solve, and a fallback solves it without ignoring people.
       3. nothing, and the coloured tile with the level's initials shows. */
  M.localThumb = function (c) {
    var id = String((c && c.id) || "").replace(/[^A-Za-z0-9_-]/g, "");
    return id ? (M.base || "") + "/img/thumbs/" + id + ".jpg" : "";
  };
  M.thumbSrc = function (c) {
    if (!c) return "";
    return M.safeUrl(c.thumb) || M.localThumb(c);
  };

  /* If the chosen picture does not load - an expired link, or a file that was
     never downloaded - try the other one before giving up on it. */
  M.thumbFallbackAttrs = function (c) {
    var primary = M.thumbSrc(c), local = M.localThumb(c);
    if (!local || primary === local) return ' onerror="this.remove()"';
    return ' data-alt="' + M.esc(local) + '"'
      + " onerror=\"if(this.dataset.alt){this.src=this.dataset.alt;this.removeAttribute('data-alt')}else{this.remove()}\"";
  };
  /* A stable colour per level, so the fallback tile is never random. */
  M.thumbHue = function (c) {
    var s = String((c && (c.name || c.id)) || ""), n = 0;
    for (var i = 0; i < s.length; i++) n = (n * 31 + s.charCodeAt(i)) % 360;
    return n;
  };
  M.thumbHtml = function (c, cls) {
    var src = M.thumbSrc(c), hue = M.thumbHue(c);
    var initials = String((c && c.name) || "?").replace(/[^A-Za-z0-9 ]/g, "").split(/\s+/)
      .filter(Boolean).slice(0, 2).map(function (w) { return w[0].toUpperCase(); }).join("") || "?";
    return '<span class="thumb ' + (cls || "") + '" style="--h:' + hue + '"><i>' + M.esc(initials) + "</i>"
      + (src ? '<img src="' + M.esc(src) + '" alt="" loading="lazy"' + M.thumbFallbackAttrs(c) + ">" : "")
      + (M.needsCam(c) ? '<b class="cam" title="Webcam required">' + M.CAM_ICON + "</b>" : "") + "</span>";
  };


  /* Everything a player's own page shows. Points, completions and verified
     come from the same board maths as the leaderboard so the two can never
     disagree; the records table underneath is built the same way, with a
     verification counted as the completion it is. */
  M.playerStats = function (name) {
    var k = M.key(name);
    var out = { name: String(name || "").trim(), points: 0, done: 0, verified: 0, prog: 0,
                best: null, bestName: "", bestList: "", records: [] };
    if (!k) return out;
    ["main", "friends"].forEach(function (l) {
      M.board(l).forEach(function (row) {
        if (M.key(row.player) !== k) return;
        out.points += row.points; out.done += row.done;
        out.verified += row.verified || 0; out.prog += row.prog || 0;
        if (row.best !== null && (out.best === null || row.best < out.best)) {
          var c = M.atPos(l, row.best);
          out.best = row.best; out.bestName = c ? c.name : ""; out.bestList = l;
        }
      });
      /* the levels they verified - a verification is a completion */
      M.listOf(l).forEach(function (c) {
        if (M.key(c.verifier) !== k) return;
        out.records.push({ cid: c.id, name: c.name, pos: c.pos, list: l, pct: 100,
                           points: M.pts(c.pos), video: c.video, verifier: true });
      });
    });
    M.all("records").forEach(function (r) {
      if (M.key(r.player) !== k || r.status !== "approved") return;
      var c = M.chal(r.cid);
      if (!c) return;
      /* already there from the verification - do not list it twice */
      if (r.pct >= 100 && out.records.some(function (x) { return x.cid === c.id; })) return;
      out.records.push({ cid: c.id, name: c.name, pos: c.pos, list: c.list, pct: r.pct,
                         points: M.pts(c.pos), video: r.video, verifier: false });
    });
    out.records.sort(function (a, b) { return b.pct - a.pct || a.pos - b.pos; });
    return out;
  };

  /* ---------------- your own profile ----------------
     Two copies on purpose. The published one is what the world sees and is
     the only thing that reaches the database. The draft is yours, stays in
     this browser, and remembers what you typed into a field you later chose
     to hide - so turning it back on does not mean typing it again. */
  var PDRAFT = "mcl.profile.draft";
  M.myProfile = function () {
    var me = M.me();
    if (!me) return {};
    var pub = (M.cloud && M.cloud.profiles && M.cloud.profiles[me.discordId]) || {};
    var draft = {};
    try { draft = JSON.parse(localStorage.getItem(PDRAFT) || "{}") || {}; } catch (e) {}
    return Object.assign({}, draft, pub);
  };
  M.saveDraft = function (d) {
    try { localStorage.setItem(PDRAFT, JSON.stringify(d || {})); } catch (e) {}
  };
  /* Turn what was typed into the form into the two copies. Empty fields are
     dropped rather than stored as "", so a profile row only ever holds
     things somebody actually put there. */
  /* ---------------- what a field is allowed to contain ----------------
     The same rules the database enforces (see supabase.sql), repeated here.

     Neither layer is redundant. This one catches the everyday version -
     somebody editing a dropdown's options in the browser's Elements panel and
     pressing Save - and gives an honest mistake a sensible result instead of
     a silent one. The database catches the version this cannot: a request
     that never goes near this page at all. A rule that only lives here is
     decoration; a rule that only lives there is invisible until it bites. */
  M.DEVICES = ["PC", "Mobile", "Console"];
  /* trim, cut to length, and collapse anything that is not meant to be a
     line break - an empty result means "the field is not set" */
  M.clean = function (t, max, multiline) {
    t = String(t == null ? "" : t);
    t = multiline ? t.replace(/\r|\t/g, " ").replace(/\n{3,}/g, "\n\n")
                  : t.replace(/[\u0000-\u001f\u007f]+/g, " ");
    return t.trim().slice(0, max).trim();
  };
  M.cleanDevice = function (v) {
    v = M.clean(v, 16);
    return M.DEVICES.indexOf(v) >= 0 ? v : "";
  };
  /* Validate the whole thing, never a truncated piece of it: cutting first
     turns "9999 lol" into "999", which is garbage wearing a valid shape.
     Same range the list uses everywhere - 10 to 360, or CBF above that. */
  M.cleanFps = function (v) {
    v = String(v == null ? "" : v).trim().toUpperCase();
    if (v === "CBF") return "CBF";
    if (!/^[0-9]{2,3}$/.test(v)) return "";
    var n = parseInt(v, 10);
    return (n >= 10 && n <= 360) ? String(n) : "";
  };

  M.buildProfile = function (d) {
    var me = M.me() || {};
    var pub = {};
    var caps = { gd: 24, bio: 300 };
    M.SOCIALS.forEach(function (sx) { caps[sx[0]] = 80; });

    Object.keys(caps).forEach(function (key) {
      var v = M.clean(d[key], caps[key], key === "bio");
      if (v) pub[key] = v;
    });
    /* These two are a dropdown and a pattern in the page, which means they
       are nothing at all once the page is open in a devtools panel. */
    var dev = M.cleanDevice(d.device); if (dev) pub.device = dev;
    var fps = M.cleanFps(d.fps);       if (fps) pub.fps = fps;

    if (d.showDiscord === "yes" && me.name) pub.discordName = M.clean(me.name, 40);
    return { pub: pub, draft: Object.assign({}, d) };
  };
  /* Everyone, grouped by the country on their name.

     This is the thing people actually use a country map for: "who else is
     from here, and how do we stack up". A clickable map is the prettier way
     in; the ranking is the part that answers the question. */
  M.nations = function (which) {
    var lists = which === "both" || !which ? ["main", "friends"] : [which];
    var byCode = {};
    lists.forEach(function (l) {
      M.board(l).forEach(function (row) {
        var cc = M.countryOf(row.player);
        if (!cc) return;
        var n = byCode[cc] || (byCode[cc] = { code: cc, name: M.countryName(cc), points: 0,
                                              done: 0, players: {} });
        n.points += row.points;
        n.done += row.done;
        /* add the two lists together rather than keeping the better one -
           the country total already sums them, and a member showing less
           than they contributed reads as a bug, because it is one */
        var k = M.key(row.player);
        if (!n.players[k]) n.players[k] = { name: row.player, points: 0 };
        n.players[k].points = Math.round((n.players[k].points + row.points) * 10) / 10;
      });
    });
    return Object.keys(byCode).map(function (cc) {
      var n = byCode[cc];
      var people = Object.keys(n.players).map(function (k) { return n.players[k]; })
        .sort(function (a, b) { return b.points - a.points; });
      n.points = Math.round(n.points * 10) / 10;
      n.list = people;
      n.count = people.length;
      return n;
    }).sort(function (a, b) { return b.points - a.points; });
  };

  /* ---------------- position history ---------------- */
  /* Every placement change is written onto the challenge itself, so the
     level page can show where it has been. Any operation that moves things
     around goes through reposition(): it snapshots positions, lets the
     operation change them in memory, then records what moved and why, and
     saves every challenge that changed in one go. */
  M.reposition = function (list, cause, mutate) {
    var before = {};
    M.listOf(list).forEach(function (c) { before[c.id] = c.pos; });
    mutate();
    /* close any gaps, in memory */
    M.listOf(list).forEach(function (c, i) { c.pos = i + 1; });
    var now = Date.now(), causeName = cause && cause.name ? cause.name : "";
    M.listOf(list).forEach(function (c) {
      var was = before[c.id], entry = null;
      if (was == null) {
        entry = { at: now, from: null, to: c.pos, reason: cause && cause.id === c.id && cause.kind === "add" ? "Added to list" : "Added" };
      } else if (was !== c.pos) {
        var reason;
        if (cause && cause.id === c.id) reason = cause.reason || "Moved";
        else if (cause && cause.kind === "add") reason = c.pos > was ? causeName + " was added above" : causeName + " was added below";
        else if (cause && cause.kind === "remove") reason = causeName + " was removed";
        else if (cause && cause.kind === "move") reason = c.pos > was ? causeName + " was moved up past this challenge" : causeName + " was moved down past this challenge";
        else reason = "Moved";
        entry = { at: now, from: was, to: c.pos, reason: reason };
      }
      if (entry) {
        c.history = (c.history || []).concat([entry]).slice(-200);
        M.put("challenges", c.id, c);
      } else if (cause && cause.id === c.id && cause.kind === "edit") {
        M.put("challenges", c.id, c);   /* edited in place, position unchanged */
      }
    });
  };

  /* ---------------- rules ---------------- */
  M.ruleSet = function () {
    return [
      ["No impossible levels",
        "If it cannot be beaten, it does not belong on MCL. Every challenge has to be completed legitimately by its verifier before it can be placed - no theoretical placements, no \"someone will get it eventually\"."],
      ["Verifications go in the Discord - completions just need a clip",
        "A verification has to be posted in the Discord before the level can be placed. Completions are looser: link the clip in your submission, post it in the Discord, or send it to Mucy in DMs - all three count. What is not optional is the clip itself. No clip, no record."],
      ["Medal clips are allowed",
        "Recording with Medal is fine. It does not have to be a full-quality upload - the clip just has to clearly show the completion from start to finish. Paste the Medal link into the submission and it plays right here on the page."],
      ["Verifiers have to be honest about placement",
        "When you verify a level you say what top you actually think it deserves, not the top you want it to be. Inflating your own level is the fastest way to get it removed."],
      ["What you type is part of the list",
        "Level names, Based on, notes, your profile - every one of those boxes ends up on a public page that this community reads. The same standard applies to all of them as to a level: nothing explicit, nothing hateful, nothing you would not want a stranger to read first. Filling a field with rubbish to see what happens gets it deleted; doing it on purpose gets your account blocked from submitting."],
      ["Breaking these takes your records off",
        "A genuine mistake is a conversation - say so and it gets sorted. Doing it on purpose is different: a faked FPS, an abused route, filth typed into a submission, and every record you hold comes off both lists and your account stops being able to submit anything. Mucy decides, and it is not done quietly - it goes in announcements with the reason, so everybody can see what it was for."],
      ["The main list is whitelist only",
        "A level reaches the main list when whoever made it is whitelisted. The whitelist is not something you apply for: you need Mucy added, and Mucy has to trust you - which comes from being around, not from asking for it. Whitelisted people carry the Whitelisted role in the Discord. Everything made by friends who are not on the whitelist goes on Mucy's Friends List, under the same rules, with its own placements and its own leaderboard."]
    ];
  };
  /* What a LEVEL needs to get on the list, and what a RECORD needs to count.
     Separate from the conduct rules above; shown in the right column and on
     the Rules page. */
  M.listReqs = function () {
    return [
      ["Beat it on the listed FPS",
        "Every level says what FPS it needs. That is the FPS you beat it on. A level listed at 60 beaten on 30 gets rejected, no exceptions. If you are not sure, match it exactly. Saying you matched it when you did not is not a mistake, it is a fake record - and one found means every record you hold gets looked at again."],
      ["Above 360 is just CBF",
        "The FPS field is a number from 10 to 360, or CBF. If a level needs anything higher than 360 - 263 with physics bypass, 500, whatever - do not write the number. Write CBF. CBF is what it takes to beat it, so CBF is what goes on the level."],
      ["No auto-decorated levels",
        "Decoration has to be built by a person. Levels put together with auto-build tools, decoration generators or copied block-by-block from a template do not get placed. A plain layout is fine; a fake one is not."],
      ["It has to be a challenge - 30 seconds, 35 at the outside",
        "Short and hard, not long and hard. 30 seconds is the target, 35 is the hard ceiling, and anything longer than 35 seconds is disqualified. A few levels placed before this rule are longer and keep their spots. Past a minute, ask Mucy first - with approval it can still be verified and placed. But if it plays like a full demon rather than a challenge it does not go on MCL at all; send it off for a rate instead."],
      ["Beat it the way it is meant to be beaten",
        "A challenge is the route it was built around. Getting to 100% some other way - clipping a wall, riding a corner the hitbox lets through, taking a path the creator never built - is not a completion of that challenge, whatever the end screen says. Find a route like that and say so: it gets fixed, or the level comes off. Using it quietly and submitting the run anyway is bug abuse, and that is the fastest way off this list."],
      ["One real level ID",
        "The ID you give has to be the uploaded, public version that the verification was done on. A different upload, an unlisted copy or a fixed re-upload means a new verification."],
      ["Dupes need a reason",
        "A level that is an existing challenge with the same gameplay - a re-decorate, a mirror, the same part again - is a dupe and does not get placed unless it genuinely changes what you have to do."],
      ["Keep it clean",
        "No slurs, no hate symbols, no suggestive or explicit content in the level or its name. It will not be added, and it will not be discussed."],
      ["Lip spam is banned",
        "Lip spam does not count on MCL. A challenge beaten with it is not a record, and a level built around it is not a challenge - it is a way of clicking, not a skill the list is measuring. Use your hands. This applies to both lists, and to levels already placed: a lip spam completion comes off the moment it is spotted."]
    ];
  };
  M.ruleExtra = function () {
    return [
      ["Raw footage on request", "For anything in the top 10, Mucy can ask for raw footage. If you cannot provide it, the record comes off the list."],
      ["No hacks, no bug abuse", "Speedhack, noclip, click limiters and physics bugs void the record, and so does any mod that does part of the challenge for you. Practice mode is obviously fine - just not in the clip you send."],
      ["The Friends List runs on the same rules", "Everything above applies to Mucy's Friends List too, except \"The main list is whitelist only\" - that one is what separates the two lists in the first place. Its own placements, its own leaderboard, the same standard."]
    ];
  };
})(window.MCL);
