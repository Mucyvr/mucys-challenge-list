/* ===========================================================
   views.js - every screen, rendered as HTML strings.
   Nothing in here touches storage directly; it reads M.S and
   writes through the helpers in store.js.
   =========================================================== */
(function (M) {
  "use strict";
  var esc = M.esc, safeUrl = M.safeUrl, all = M.all, listOf = M.listOf, chal = M.chal,
      isLegacy = M.isLegacy, pts = M.pts, cfg = M.cfg, UI = M.UI;

  /* ---------------- chrome (top bar + footer) ---------------- */
  function accentFor(v) { return v === "friends" ? ["#E11D62", "#C2004B"] : ["#7A2FF2", "#5C15D6"]; }
  var DISCORD_SVG = '<svg class="ci" viewBox="0 0 24 24" aria-hidden="true"><path d="M20.3 4.5A18 18 0 0 0 15.9 3l-.3.5a13 13 0 0 1 3.9 1.9 12.6 12.6 0 0 0-11 0A13 13 0 0 1 12.4 3.5L12.1 3a18 18 0 0 0-4.4 1.5C4.9 8.6 4.1 12.6 4.5 16.6a18 18 0 0 0 5.4 2.7l.7-1.2a11.6 11.6 0 0 1-1.8-.9l.4-.3a12.9 12.9 0 0 0 11 0l.4.3a11.6 11.6 0 0 1-1.8.9l.7 1.2a18 18 0 0 0 5.4-2.7c.5-4.7-.8-8.6-2.6-12.1ZM9.7 14.3c-1 0-1.9-1-1.9-2.2S8.6 9.9 9.7 9.9s1.9 1 1.9 2.2-.8 2.2-1.9 2.2Zm4.6 0c-1 0-1.9-1-1.9-2.2s.8-2.2 1.9-2.2 1.9 1 1.9 2.2-.8 2.2-1.9 2.2Z"/></svg>';

  M.chrome = function () {
    var c = cfg(), a = accentFor(UI.view), root = document.documentElement,
        dark = root.getAttribute("data-theme") === "dark";
    root.style.setProperty("--accent", a[0]);
    root.style.setProperty("--accent-2", dark ? a[0] : a[1]);

    /* No "Home" item: the MCL logo is the way home, which is what every site
       does and what people try first anyway. */
    var navs = [["list", "Main List"], ["friends", "Friends List"],
                ["board", "Leaderboard"], ["clans", "Clans"], ["packs", "Packs"],
                ["roulette", "Roulette"], ["rules", "Rules"]];
    var h = navs.map(function (v) {
      return '<a data-go="' + v[0] + '" href="' + M.hrefFor(v[0]) + '" aria-current="' + (UI.view === v[0]) + '">' + v[1] + "</a>";
    }).join("");
    h += '<a data-go="admin" href="' + M.hrefFor("admin") + '" aria-current="' + (UI.view === "admin") + '">Admin'
      + (M.canEdit() && M.pendingCount() ? " (" + M.pendingCount() + ")" : "") + "</a>";
    document.getElementById("nav").innerHTML = h;

    var brand = document.getElementById("brand");
    if (brand) {
      brand.href = M.hrefFor("home");
      brand.setAttribute("aria-current", String(UI.view === "home"));
    }
    document.getElementById("logo").textContent =
      (c.title || "MCL").split(/\s+/).map(function (w) { return w[0]; }).join("").slice(0, 4).toUpperCase() || "MCL";
    document.getElementById("ver").textContent = c.ver || "";

    var meBtn = document.getElementById("mebtn");
    if (meBtn) {
      var cloudOn = M.cloud && M.cloud.enabled(), me = M.me();
      meBtn.hidden = !cloudOn;
      meBtn.href = M.hrefFor("me");
      meBtn.innerHTML = me
        ? (me.avatar ? '<img class="av" src="' + esc(me.avatar) + '" alt="">' : "")
          + "<span>" + esc(me.name || "Me") + "</span>"
        : DISCORD_SVG + "<span>Sign in</span>";
      meBtn.setAttribute("aria-current", String(UI.view === "me"));
    }

    var d = safeUrl(c.discord), jb = document.getElementById("joinbtn");
    if (d) { jb.hidden = false; jb.href = d; } else { jb.hidden = true; }

    var pb = document.getElementById("poweredby"), u = safeUrl(c.studio);
    pb.href = u || "#";
    document.getElementById("adminbtn").textContent = "Admin";
    document.getElementById("foot-left").innerHTML = esc(c.title) + " &middot; " + listOf("main").length
      + " on the main list &middot; " + listOf("friends").length + " on the Friends List &middot; "
      + '<span class="mono">' + statusWord() + "</span>"
      + (M.unpublished() ? ' <button class="chip pend" data-go="admin" title="Only you can see these">unpublished changes</button>' : "")
      + (M.cloud && M.cloud.error ? ' <span class="chip pend">cloud: ' + esc(M.cloud.error) + "</span>" : "");

    document.getElementById("themebtn").innerHTML = dark
      ? '<svg viewBox="0 0 24 24"><path d="M12 5a1 1 0 0 1-1-1V2a1 1 0 1 1 2 0v2a1 1 0 0 1-1 1Zm0 14a1 1 0 0 1 1 1v2a1 1 0 1 1-2 0v-2a1 1 0 0 1 1-1Zm10-7a1 1 0 0 1-1 1h-2a1 1 0 1 1 0-2h2a1 1 0 0 1 1 1ZM5 12a1 1 0 0 1-1 1H2a1 1 0 1 1 0-2h2a1 1 0 0 1 1 1Zm12.7 5.3 1.4 1.4a1 1 0 0 1-1.4 1.4l-1.4-1.4a1 1 0 0 1 1.4-1.4ZM6.3 4.9 7.7 6.3A1 1 0 0 1 6.3 7.7L4.9 6.3a1 1 0 0 1 1.4-1.4Zm11.4 1.4-1.4 1.4a1 1 0 0 1-1.4-1.4l1.4-1.4a1 1 0 1 1 1.4 1.4ZM6.3 19.1l-1.4-1.4a1 1 0 0 1 1.4-1.4l1.4 1.4a1 1 0 0 1-1.4 1.4ZM12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8Z"/></svg>'
      : '<svg viewBox="0 0 24 24"><path d="M21 13.2A9 9 0 1 1 10.8 3a7 7 0 0 0 10.2 10.2Z"/></svg>';
  };

  function statusWord() {
    var s = M.cloud ? M.cloud.status() : "off";
    if (s === "artifact") return "live";
    if (s === "live-admin") return "live &middot; saving automatically";
    if (s === "live") return "live";
    return "published list";
  }

  /* The main list's key is "main" but its route is "list" - they are not the
     same word, and using one where the other belongs sent every main-list
     link to a view that does not exist. Everything that turns a list into a
     link goes through here now. */
  function viewOf(l) { return l === "friends" ? "friends" : "list"; }

  /* "🇩🇪 Mucy (MCL)" - how a player reads anywhere on the site */
  function who(name, opts) {
    opts = opts || {};
    var f = M.flagImg(M.countryOf(name)), c = M.clanOf(name);
    return (f ? f + " " : "")
      + esc(String(name || "").trim())
      + (c ? ' <a class="tag" href="' + M.hrefFor("clans", c.tag) + '" data-go="clans" data-clan="' + esc(c.tag) + '" title="' + esc(c.name) + '">(' + esc(c.tag) + ")</a>" : "");
  }
  M.who = who;

  function msgHtml() {
    if (!UI.msg) return "";
    var m = UI.msg; UI.msg = null;
    return '<div class="msg ' + (m.t === "err" ? "err" : "") + '">' + esc(m.s) + "</div>";
  }

  /* ---------------- home ----------------
     The front door. Until now "/" was the main list, which meant somebody
     arriving cold landed in the middle of one of two lists with no idea the
     other existed, and nothing telling them what any of it was. */
  function vHome() {
    var c = cfg(), main = listOf("main"), friends = listOf("friends");
    var recs = all("records").filter(function (r) { return r.status === "approved"; });
    var players = {};
    recs.forEach(function (r) { players[M.key(r.player)] = 1; });
    listOf("main").concat(listOf("friends")).forEach(function (x) {
      if (x.verifier) players[M.key(x.verifier)] = 1;
    });

    var h = '<section class="hero">'
      + '<img class="hlogo" src="' + (M.base || "") + '/img/mcl-180.png" alt="" width="84" height="84">'
      + '<h1>' + esc(c.title || "Mucy's Challenge List") + "</h1>"
      + '<p class="tag">The official challenge list run by Mucy. Two lists, one standard: '
      + "short, hard, and verified before it is placed.</p>"
      + '<div class="acts">'
      + '<a class="btn" data-go="list" href="' + M.hrefFor("list") + '">Open the main list</a>'
      + '<a class="btn ghost" data-go="rules" href="' + M.hrefFor("rules") + '">Read the rules</a>'
      + (safeUrl(c.discord) ? '<a class="btn ghost" href="' + esc(safeUrl(c.discord)) + '" target="_blank" rel="noopener">Join the Discord</a>' : "")
      + "</div></section>";

    /* the two lists, as the two things they are */
    h += '<div class="homelists">'
      + [["main", "Main list", "Levels made by whitelisted people - friends Mucy knows and trusts enough to put their levels here.", main],
         ["friends", "Mucy's Friends List", "Everything else made by friends. Its own placements, leaderboard, roulette and packs.", friends]]
        .map(function (x) {
          var top3 = x[3].slice(0, 3);
          return '<a class="hlist ' + x[0] + '" data-go="' + viewOf(x[0]) + '" href="' + M.hrefFor(viewOf(x[0])) + '">'
            + '<div class="hl-top">' + top3.map(function (lv) { return M.thumbHtml(lv, "sm"); }).join("")
            + (top3.length ? "" : '<span class="hl-empty">nothing placed yet</span>') + "</div>"
            + '<h2>' + x[1] + "</h2>"
            + '<span class="count">' + x[3].length + " level" + (x[3].length === 1 ? "" : "s") + "</span>"
            + "<p>" + x[2] + "</p>"
            + (top3[0] ? '<span class="peek">#1 is <b>' + esc(top3[0].name) + "</b></span>" : "")
            + "</a>";
        }).join("")
      + "</div>";

    h += '<div class="homestats">'
      + [[main.length + friends.length, "levels"],
         [Object.keys(players).length, "players"],
         [recs.length, "records"],
         [all("clans").length, "clans"]]
        .map(function (s) { return "<div><b>" + s[0] + "</b><span>" + s[1] + "</span></div>"; }).join("")
      + "</div>";

    /* what moved lately, straight out of the placement history */
    var recent = [];
    listOf("main").concat(listOf("friends")).forEach(function (lv) {
      (lv.history || []).forEach(function (hh) {
        if (hh && hh.at) recent.push({ at: hh.at, lv: lv, h: hh });
      });
    });
    recent.sort(function (a, b) { return b.at - a.at; });
    var seen = {}, rows = [];
    recent.forEach(function (x) {
      if (rows.length >= 6 || seen[x.lv.id]) return;
      seen[x.lv.id] = 1;
      rows.push(x);
    });
    if (rows.length) {
      h += '<h2 class="sec">Latest changes</h2><div class="homerecent">'
        + rows.map(function (x) {
            var added = x.h.from === null || x.h.from === undefined;
            return '<a class="hr" data-go="' + viewOf(x.lv.list) + '" data-pos="' + x.lv.pos + '" href="'
              + M.hrefFor(viewOf(x.lv.list), x.lv.pos) + '">' + M.thumbHtml(x.lv, "sm")
              + '<span class="t"><b>' + esc(x.lv.name) + "</b><small>"
              + (added ? "placed at #" + x.h.to : "moved #" + x.h.from + " &rarr; #" + x.h.to)
              + " &middot; " + M.listLabel(x.lv.list) + "</small></span></a>";
          }).join("")
        + "</div>";
    }

    h += '<h2 class="sec">How it works</h2><div class="homehow">'
      + [["Beat a challenge", "Pick one off either list. Every level says what FPS it needs, and that is the FPS it has to be beaten on."],
         ["Send the clip", "Submit a record here with a link, or post it in the Discord. No clip, no record."],
         ["Get on the board", "Accepted records score points - #1 is worth 200, and the curve falls off from there."]]
        .map(function (s, i) {
          return '<div class="how"><span class="num">' + (i + 1) + "</span><b>" + s[0] + "</b><p>" + s[1] + "</p></div>";
        }).join("")
      + "</div>"
      + '<div class="acts" style="margin-top:16px">'
      + '<a class="btn" data-go="submit" href="' + M.hrefFor("submit") + '">Submit a record</a>'
      + '<a class="btn ghost" data-go="board" href="' + M.hrefFor("board") + '">Leaderboard</a>'
      + '<a class="btn ghost" data-go="roulette" href="' + M.hrefFor("roulette") + '">Roulette</a>'
      + "</div>";
    return h;
  }

  /* ---------------- the list itself, down the middle ----------------
     Pointercrate-shaped: the list is the page, and a level is its own page
     at /list/3. The old shape put the list in a cramped left rail and a
     level permanently in the middle, so neither got the room it needed. */
  function filtersHtml(l) {
    var vals = M.basedValues(l);
    return '<div class="filters"><input id="q" type="search" placeholder="Search levels or creators..." value="'
      + esc(UI.q) + '" autocomplete="off">'
      + '<select id="basedf"><option value="">All types</option>'
      + vals.map(function (v) {
          return '<option value="' + esc(v) + '"' + (UI.based === v ? " selected" : "") + ">Based on: " + esc(v) + "</option>";
        }).join("")
      + "</select></div>";
  }

  function rowHtml(c) {
    var rs = M.recsFor(c.id).filter(function (r) { return r.pct >= 100; }).length
      + (String(c.verifier || "").trim() ? 1 : 0);
    return '<a class="row' + (isLegacy(c) ? " legacy" : "") + '" data-go="' + viewOf(c.list)
      + '" data-pos="' + c.pos + '" href="' + M.hrefFor(viewOf(c.list), c.pos) + '">'
      + '<span class="n">#' + c.pos + "</span>"
      + M.thumbHtml(c)
      + '<span class="t"><b>' + esc(c.name) + "</b>"
      + "<small>" + (c.creator ? "by " + esc(c.creator) : "unknown creator")
      + (c.verifier ? " &middot; verified by " + esc(c.verifier) : "") + "</small>"
      + (c.basedOn || c.webcam ? '<span class="tags">'
          + (c.basedOn ? '<span class="chip">' + esc(c.basedOn) + "</span>" : "")
          + M.camChip(c) + "</span>" : "")
      + "</span>"
      + '<span class="meta"><b>' + pts(c.pos) + "</b><small>points</small></span>"
      + '<span class="meta hideS"><b>' + esc(c.fps || "-") + "</b><small>fps</small></span>"
      + '<span class="meta hideS"><b>' + rs + "</b><small>victor" + (rs === 1 ? "" : "s") + "</small></span>"
      + "</a>";
  }

  function listIndex(l) {
    var q = UI.q.toLowerCase(), bf = UI.based.toLowerCase(),
        arr = listOf(l).filter(function (c) {
          if (bf && M.basedTags(c).map(function (t) { return t.toLowerCase(); }).indexOf(bf) < 0) return false;
          if (!q) return true;
          return c.name.toLowerCase().indexOf(q) >= 0 || String(c.creator || "").toLowerCase().indexOf(q) >= 0;
        });
    var live = arr.filter(function (c) { return !isLegacy(c); }), leg = arr.filter(isLegacy);

    var h = msgHtml() + listSwitch(l);
    h += l === "friends"
      ? '<div class="note" style="border-color:var(--accent)"><span><b>Mucy&rsquo;s Friends List.</b> Challenges made by Mucy&rsquo;s friends, with its own placements, leaderboard, roulette and packs.</span>'
        + '<button class="btn sm" data-go="submit" data-tab="submit:challenge">Post a challenge</button></div>'
      : '<div class="note"><span><b>Main list.</b> Levels made by whitelisted people &mdash; friends Mucy knows and trusts enough to put their levels here. The whitelist is not applied for: you need Mucy added, and the trust comes from being around.</span></div>';

    if (M.canEdit()) {
      h += '<div class="adm"><span class="lb">Admin</span>'
        + '<button class="btn sm" data-new="' + l + '">Add challenge</button></div>';
    }
    if (UI.edit && !UI.edit._pack && UI.edit.list === l) h += M.formChallenge(UI.edit);

    h += filtersHtml(l);
    h += live.length
      ? '<div class="rows">' + live.map(rowHtml).join("") + "</div>"
      : '<div class="empty">' + (q || bf ? "Nothing matched." : "Nothing placed here yet.") + "</div>";
    if (leg.length) {
      h += '<h2 class="sec">Legacy &mdash; past #' + M.legacyAfter() + "</h2>"
        + '<p class="sub">Still count, worth a flat 5 points.</p>'
        + '<div class="rows">' + leg.map(rowHtml).join("") + "</div>";
    }
    return h;
  }

  /* ---------------- right column ---------------- */
  function rightHtml() {
    var c = cfg(), eds = all("editors").sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
    var crown = '<svg viewBox="0 0 24 24"><path d="M3 6l4 4 5-6 5 6 4-4v11H3z"/></svg>';
    var staff = '<svg viewBox="0 0 24 24"><path d="M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm7 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM1 20a8 8 0 0 1 16 0Zm16.5-7A5.5 5.5 0 0 1 23 20h-4.2a9.8 9.8 0 0 0-2.6-6.7 5.4 5.4 0 0 1 1.3-.3Z"/></svg>';
    var code = '<svg viewBox="0 0 24 24"><path d="M8.7 17.3 3.4 12l5.3-5.3 1.4 1.4L6.2 12l3.9 3.9zm6.6 0-1.4-1.4 3.9-3.9-3.9-3.9 1.4-1.4L20.6 12z"/></svg>';
    var h = '<p class="blurb">' + esc(c.blurb || "") + "</p><h3>List Editors</h3>";
    h += eds.length
      ? eds.map(function (e) {
          return '<div class="editor">' + (e.role === "owner" ? crown : e.role === "dev" ? code : staff)
            + "<span>" + esc(e.name) + '</span><span class="r">' + esc(e.role || "") + "</span></div>";
        }).join("")
      : "<p>No editors listed yet. Add them in Admin.</p>";
    h += "<h3>List Requirements</h3>";
    M.listReqs().forEach(function (r) { h += "<p><b>" + esc(r[0]) + ".</b> " + esc(r[1]) + "</p>"; });
    h += '<div class="acts" style="margin-top:6px"><button class="btn ghost sm" data-go="rules">All rules</button>'
      + '<button class="btn ghost sm" data-go="submit">Submit</button></div>';
    return h;
  }

  /* ---------------- centre column ---------------- */
  /* The two lists, as a switch you cannot miss, with how many are on each.
     This exists because somebody who had beaten every level on the main list
     did not know the Friends List was there - it was a word in the nav bar
     and nothing else, and a nav bar is wallpaper once you know a site. */
  function listSwitch(l) {
    return '<div class="lswitch">'
      + [["main", "Main list", "Whitelisted creators"],
         ["friends", "Friends List", "Everything else by friends"]].map(function (x) {
          var n = listOf(x[0]).length;
          return '<a class="ls' + (l === x[0] ? " on" : "") + '" data-go="' + viewOf(x[0]) + '" href="'
            + M.hrefFor(viewOf(x[0])) + '"><b>' + x[1] + '</b><span class="n">' + n + " level"
            + (n === 1 ? "" : "s") + '</span><small>' + x[2] + "</small></a>";
        }).join("")
      + "</div>";
  }

  function levelPage(l) {
    var c = M.atPos(l, UI.pos) || M.selected(l);
    var h = msgHtml();
    if (!c) {
      return h + '<div class="empty">There is no level at that position.</div>'
        + '<div class="acts"><a class="btn" data-go="' + viewOf(l) + '" href="' + M.hrefFor(viewOf(l)) + '">Back to the list</a></div>';
    }
    var arr = listOf(l), i = arr.indexOf(c), prev = arr[i - 1], next = arr[i + 1];
    h += '<div class="crumbs">'
      + '<a data-go="' + viewOf(l) + '" href="' + M.hrefFor(viewOf(l)) + '">&larr; ' + esc(M.listLabel(l)) + "</a>"
      + '<span class="nav">'
      + (prev ? '<a data-go="' + viewOf(l) + '" data-pos="' + prev.pos + '" href="' + M.hrefFor(viewOf(l), prev.pos) + '">&larr; #' + prev.pos + "</a>" : "")
      + (next ? '<a data-go="' + viewOf(l) + '" data-pos="' + next.pos + '" href="' + M.hrefFor(viewOf(l), next.pos) + '">#' + next.pos + " &rarr;</a>" : "")
      + "</span></div>";
    if (M.canPlace()) {
      var full = M.canEdit();
      h += '<div class="adm"><span class="lb">' + (full ? "Admin" : "List mod") + "</span>"
        + (full ? '<button class="btn sm" data-new="' + l + '">Add challenge</button>' : "")
        + (c ? (full ? '<button class="btn ghost sm" data-edit="' + c.id + '">Edit ' + esc(c.name) + "</button>" : "")
             + '<button class="btn ghost sm" data-mv="' + c.id + ':-1">Move up</button>'
             + '<button class="btn ghost sm" data-mv="' + c.id + ':1">Move down</button>'
             + (full ? '<button class="btn ghost sm" data-del="' + c.id + '">Delete</button>' : "") : "")
        + (full ? "" : '<span style="font-size:12px;color:var(--ink2)">You can move levels and work the queue.</span>')
        + "</div>";
    }
    if (UI.edit && !UI.edit._pack && UI.edit.list === l) h += M.formChallenge(UI.edit);

    var rs = M.recsFor(c.id);
    h += '<div class="lvlhead" style="--h:' + M.thumbHue(c) + '">'
      + (M.thumbSrc(c) ? '<img class="bg" src="' + esc(M.thumbSrc(c)) + '" alt=""' + M.thumbFallbackAttrs(c) + ">" : "")
      + '<div class="lvlhead-in"><span class="rankbig">#' + c.pos + '</span>'
      + '<h1 class="title">' + esc(c.name) + "</h1>"
      + '<span class="ptsbig">' + pts(c.pos) + " points</span></div></div>";
    h += '<div class="tagrow">'
      + (c.basedOn ? '<button class="based" data-based="' + esc(c.basedOn) + '">Based on: ' + esc(c.basedOn) + "</button>" : "")
      + M.camChip(c)
      + (isLegacy(c) ? '<span class="chip">legacy</span>' : "") + "</div>";
    h += '<dl class="credits"><dt>Creators</dt><dd>' + esc(c.creator || "unknown") + "</dd>"
      + "<dt>Verifier</dt><dd>" + esc(c.verifier || "unknown") + "</dd>"
      + "<dt>Publisher</dt><dd>" + esc(c.publisher || c.creator || "unknown") + "</dd></dl>";
    h += M.playerHtml(c.video, M.canEdit(), M.thumbSrc(c));
    h += '<div class="stats">'
      + "<div><span>Points when completed</span><b>" + pts(c.pos) + "</b></div>"
      + "<div><span>ID</span><b>" + esc(c.levelId || "-") + "</b></div>"
      + "<div><span>FPS</span><b>" + esc(c.fps || "-") + "</b></div>"
      + "<div><span>Version</span><b>" + esc(c.version || "-") + "</b></div>"
      + "<div><span>Device</span><b>" + esc(c.device || "All") + "</b></div>"
      + "<div><span>Webcam</span><b>" + (M.needsCam(c) ? "required" : "not required") + "</b></div>"
      + "<div><span>Verifier calls it</span><b>" + (c.top ? "top " + esc(c.top) : "-") + "</b></div></div>";
    if (c.note) h += '<p style="max-width:66ch;color:var(--ink2);margin-top:14px">' + esc(c.note) + "</p>";

    h += '<h2 class="sec">Records</h2><p class="qual"><b>' + (c.req || 100) + "%</b> to qualify."
      + (safeUrl(cfg().discord)
          ? ' Clips go in the <a href="' + esc(safeUrl(cfg().discord)) + '" target="_blank" rel="noopener">Discord</a>.'
          : " Clips go in the Discord.") + "</p>";
    h += '<div class="acts" style="margin-bottom:14px"><button class="btn" data-rec="' + c.id + '">Submit a record</button></div>';
    var vrow = String(c.verifier || "").trim()
      ? '<div class="rec"><span class="p">100%</span><span class="who">' + profileLinkHtml(c.verifier, who(c.verifier))
        + ' <span class="chip">verifier</span></span><span class="lk">'
        + (M.media(c.video) ? '<a href="' + esc(safeUrl(c.video)) + '" target="_blank" rel="noopener">clip &#8599;</a>'
                            : '<span style="color:var(--ink2)">in Discord</span>')
        + '</span><span class="fps">' + esc(c.fps || "") + "</span></div>"
      : "";
    h += '<div class="recs">' + vrow + (rs.length ? rs.map(function (r) {
        return '<div class="rec"><span class="p">' + r.pct + '%</span><span class="who">' + profileLinkHtml(r.player, who(r.player))
          + (r.medal ? ' <span class="chip">medal</span>' : "") + '</span><span class="lk">'
          + (M.media(r.video) ? '<a href="' + esc(safeUrl(r.video)) + '" target="_blank" rel="noopener">clip &#8599;</a>'
                              : '<span style="color:var(--ink2)">in Discord</span>')
          + '</span><span class="fps">' + esc(r.fps || "")
          + (M.canEdit() ? ' <button class="btn ghost sm" data-delrec="' + r.id + '">x</button>' : "") + "</span></div>";
      }).join("") : (vrow ? "" : '<div class="empty">No records yet. Be the first.</div>')) + "</div>";

    /* ---- position history ---- */
    var hist = (c.history || []).slice().reverse();
    h += '<details class="hist"' + (hist.length ? " open" : "") + '><summary><h2 class="sec" style="margin:0;display:inline">Position History</h2></summary>';
    if (!hist.length) {
      h += '<p class="qual" style="margin-top:10px">No moves recorded for this level yet. Tracking started when this feature went live; everything from now on is logged.</p>';
    } else {
      h += '<div class="scroll"><table class="histt"><thead><tr><th>Date</th><th>Change</th><th>New position</th><th>Reason</th></tr></thead><tbody>';
      hist.forEach(function (e) {
        var d = new Date(e.at).toISOString().slice(0, 10);
        var delta = e.from == null ? 0 : e.from - e.to;      /* positive = moved up the list */
        var cls = e.from == null ? "add" : delta > 0 ? "up" : delta < 0 ? "down" : "same";
        var ch = e.from == null ? "-" : delta > 0 ? "&uarr; " + delta : delta < 0 ? "&darr; " + (-delta) : "-";
        h += '<tr class="' + cls + '"><td class="mono">' + d + '</td><td class="mono">' + ch + '</td><td class="mono">#' + e.to + "</td><td>" + esc(e.reason) + "</td></tr>";
      });
      h += "</tbody></table></div>";
    }
    h += "</details>";
    return h;
  }

  /* ---------------- leaderboard ---------------- */
  function vBoard() {
    var l = UI.tab.board;
    var h = '<h1 class="pg">Leaderboard</h1><p class="sub">Points come from full completions only, and verifying a level counts as one - you had to beat it to verify it. Progress still shows on the challenge, it just does not score. #1 is worth 200 points and the curve falls off toward the legacy cutoff.</p>'
      + '<div class="tabs"><button data-tab="board:main" aria-selected="' + (l === "main") + '">Main list</button>'
      + '<button data-tab="board:friends" aria-selected="' + (l === "friends") + '">Friends list</button>'
      + '<button data-tab="board:nations" aria-selected="' + (l === "nations") + '">Nations</button></div>' + msgHtml();
    if (l === "nations") return h + nationsHtml();

    var rows = M.board(l), top = rows.length && rows[0].points ? rows[0].points : 1;
    /* Clicking a country on the Nations tab filters this one. */
    if (UI.country) {
      rows = rows.filter(function (r) { return M.countryOf(r.player) === UI.country; });
      h += '<div class="note"><span>' + M.flagImg(UI.country) + " Showing <b>"
        + esc(M.countryName(UI.country)) + "</b> only.</span>"
        + '<button class="btn sm" data-country="">Show everyone</button></div>';
    }
    if (!rows.length) {
      return h + '<div class="empty">'
        + (UI.country ? "Nobody from there has a record on this list." : "No approved records on this list yet.")
        + "</div>";
    }
    h += '<div class="scroll panel"><table><thead><tr><th class="num">#</th><th>Player</th><th class="num">Points</th><th>Share</th><th class="num">Completions</th><th class="num">Verified</th><th>Hardest</th><th class="num">Progress</th></tr></thead><tbody>';
    rows.forEach(function (r, i) {
      var hc = r.best ? M.atPos(l, r.best) : null;
      h += '<tr><td class="num" style="color:var(--ink2)">' + (i + 1) + '</td><td style="font-weight:700">' + profileLinkHtml(r.player, who(r.player)) + "</td>"
        + '<td class="num" style="font-weight:600">' + r.points + "</td>"
        + '<td style="min-width:90px"><span class="bar"><i style="width:' + Math.max(3, Math.round(r.points / top * 100)) + '%"></i></span></td>'
        + '<td class="num">' + r.done + '</td><td class="num">' + (r.verified || "-") + "</td>"
        + "<td>" + (hc ? "#" + r.best + " " + esc(hc.name) : "-") + "</td>"
        + '<td class="num">' + r.prog + "</td></tr>";
    });
    return h + "</tbody></table></div>";
  }

  /* ---------------- profiles ----------------
     A player page. Everything on it comes from two places that never mix:
     the list itself (points, records, clan, country - facts the site owns)
     and the person's own profile (socials, GD name, a line about them -
     things only they can write, and only about themselves). */
  function profileLinkHtml(name, inner) {
    return '<a class="plink" data-go="user" data-user="' + esc(name) + '" href="'
      + M.hrefFor("user", name) + '">' + inner + "</a>";
  }
  M.profileLink = profileLinkHtml;

  function vUser() {
    var name = UI.user || "";
    var stats = M.playerStats ? M.playerStats(name) : null;
    var prof = M.profileOf(name) || {};
    var did = M.discordOf(name);
    var me = M.me();
    var mine = !!(me && me.discordId && did && me.discordId === did);

    var h = '<h1 class="pg">' + who(name) + "</h1>";
    if (!name) return '<h1 class="pg">Player</h1><div class="empty">No player named.</div>';

    var known = M.player(name) || stats && stats.records.length;
    if (!known) {
      return h + '<div class="empty">Nobody by that name is on the list.</div>'
        + '<div class="acts"><button class="btn ghost" data-go="board">Back to the leaderboard</button></div>';
    }

    /* "No profile written yet" used to show whenever there was no bio, even
       with a whole About section filled in underneath it. */
    if (prof.bio) h += '<p class="sub">' + esc(prof.bio) + "</p>";
    else if (!M.hasProfile(name)) h += '<p class="sub">No profile written yet.</p>';
    if (mine) h += '<div class="acts" style="margin-bottom:14px"><button class="btn" data-go="me">Edit my profile</button></div>';
    /* Say why a page looks empty, to the one person who can do something
       about it. A missing Discord id is invisible otherwise: the profile
       exists, it is just attached to nobody. */
    if (!did && M.canEdit()) {
      h += '<div class="note"><span>No <b>Discord id</b> is set for this player, so nothing they write about themselves can show here. '
        + "Admin &rarr; Players &rarr; Discord id.</span>"
        + '<button class="btn sm" data-go="admin">Open admin</button></div>';
    }

    /* --- what the list knows --- */
    h += '<div class="stats">'
      + "<div><span>Points</span><b>" + (stats ? stats.points : 0) + "</b></div>"
      + "<div><span>Completions</span><b>" + (stats ? stats.done : 0) + "</b></div>"
      + "<div><span>Verified</span><b>" + (stats ? stats.verified : 0) + "</b></div>"
      + "<div><span>Hardest</span><b>" + (stats && stats.bestName ? "#" + stats.best + " " + esc(stats.bestName) : "-") + "</b></div>"
      + (M.clanOf(name) ? "<div><span>Clan</span><b>" + esc(M.clanOf(name).name) + "</b></div>" : "")
      + "</div>";

    /* --- what they chose to tell people --- */
    var rows = [];
    if (prof.gd) rows.push(["Geometry Dash", esc(prof.gd)]);
    if (prof.discordName) rows.push(["Discord", esc(prof.discordName)]);
    if (prof.device) rows.push(["Plays on", esc(prof.device)]);
    if (prof.fps) rows.push(["Usual FPS", esc(prof.fps)]);
    var links = M.SOCIALS.map(function (sroot) {
      var url = M.socialUrl(sroot[0], prof[sroot[0]]);
      return url ? '<a class="btn ghost sm" href="' + esc(url) + '" target="_blank" rel="noopener">' + sroot[1] + " &#8599;</a>" : "";
    }).filter(Boolean).join("");

    if (rows.length || links) {
      h += '<h2 class="sec" style="font-size:20px">About</h2><div class="panel pad stack" style="max-width:720px">';
      if (rows.length) {
        h += '<dl class="credits">' + rows.map(function (r) {
          return "<dt>" + r[0] + "</dt><dd>" + r[1] + "</dd>";
        }).join("") + "</dl>";
      }
      if (links) h += '<div class="acts">' + links + "</div>";
      h += "</div>";
    } else if (!prof.bio) {
      h += '<p style="color:var(--ink2);font-size:13px;max-width:60ch">'
        + esc(String(name).trim()) + " has not filled anything in. If this is you, sign in with Discord "
        + "and it is your page to write.</p>";
    }

    /* --- records --- */
    var recs = stats ? stats.records : [];
    if (recs.length) {
      h += '<h2 class="sec" style="font-size:20px">Records</h2><div class="scroll panel"><table><thead><tr>'
        + '<th class="num">#</th><th>Challenge</th><th>List</th><th class="num">%</th><th class="num">Points</th><th>Clip</th>'
        + "</tr></thead><tbody>";
      recs.forEach(function (r) {
        h += '<tr><td class="num" style="color:var(--ink2)">' + r.pos + "</td>"
          + '<td style="font-weight:600"><button class="linkish" data-openlvl="' + esc(r.cid) + '">' + esc(r.name) + "</button></td>"
          + "<td>" + esc(M.listLabel(r.list)) + "</td>"
          + '<td class="num">' + r.pct + "%</td>"
          + '<td class="num">' + (r.pct >= 100 ? r.points : 0) + "</td>"
          + "<td>" + (safeUrl(r.video) ? '<a href="' + esc(safeUrl(r.video)) + '" target="_blank" rel="noopener">clip &#8599;</a>'
                                        : '<span style="color:var(--ink2)">-</span>') + "</td></tr>";
      });
      h += "</tbody></table></div>";
    }
    return h;
  }

  /* The person's own page. Everything is optional and everything can be
     taken back off: a field left empty is never uploaded, so hiding
     something removes it from the database rather than just from the page. */
  function vMe() {
    var cl = M.cloud, on = cl && cl.enabled();
    var h = '<h1 class="pg">My profile</h1>';
    if (!on) {
      return h + '<div class="empty">Profiles need the live database, which this copy of the site is not connected to.</div>';
    }
    var me = M.me();
    if (!me || !me.discordId) {
      h += '<p class="sub">Sign in with Discord and you get a page on this site: your Geometry Dash name, your links, and whatever you want people to know. Nothing is filled in for you and nothing is shown unless you put it there.</p>'
        + msgHtml()
        + '<div class="panel pad stack" style="max-width:560px">'
        + '<button class="btn discordbtn" data-dlogin="1">' + DISCORD_SVG + " Sign in with Discord</button>"
        + '<p style="font-size:12.5px;color:var(--ink2)">Signing in tells this site your Discord name, id and avatar - the same things anyone in the server can already see. It cannot post as you, read your messages or see anything else in your account.</p>'
        + "</div>";
      if (me && !me.discordId) {
        h += '<p style="font-size:12.5px;color:var(--ink2);margin-top:10px">You are signed in with an email account, which has no Discord side to it. Sign out in Admin first if you want to use Discord instead.</p>';
      }
      return h;
    }

    var p = M.myProfile();
    /* the toggle follows the draft when there is one, and otherwise whether
       a Discord name is actually published right now */
    var showD = p.showDiscord ? p.showDiscord === "yes" : !!p.discordName;
    var linked = M.playerByDiscord(me.discordId);
    h += '<p class="sub">Signed in as <b>' + esc(me.name || me.discordId) + "</b>. "
      + (linked ? "Your page on the list is " + profileLinkHtml(linked.name, esc(linked.name)) + "."
                : "Nobody on the list is linked to this Discord account yet - ask Mucy to set your Discord id in Admin and this profile appears on your name.")
      + "</p>" + msgHtml();

    h += '<form class="panel pad stack" data-form="profile" style="max-width:720px">'
      + '<div class="fr"><label>Geometry Dash username<input name="gd" maxlength="24" value="' + esc(p.gd || "") + '"></label>'
      + '<label>Show my Discord name<select name="showDiscord"><option value="yes"' + (showD ? " selected" : "") + ">Yes</option>"
      + '<option value="no"' + (showD ? "" : " selected") + ">No</option></select></label></div>"
      + '<label>About you - one or two lines<textarea name="bio" rows="3" maxlength="300">' + esc(p.bio || "") + "</textarea></label>"
      + '<div class="fr"><label>Plays on<select name="device"><option value=""></option>'
      + ["PC", "Mobile", "Console"].map(function (d) {
          return '<option' + (p.device === d ? " selected" : "") + ">" + d + "</option>";
        }).join("")
      + '</select></label>'
      + '<label>Usual FPS<input name="fps" list="fpslist" maxlength="3" placeholder="240, CBF..." value="' + esc(p.fps || "") + '"></label></div>'
      + '<h3 style="font-size:16px;margin:4px 0 0">Links</h3>'
      + '<p style="font-size:12.5px;color:var(--ink2);margin:0">A handle is enough - "mucy" becomes the full address. Leave one empty to take it off your page.</p>'
      + '<div class="fr">' + M.SOCIALS.map(function (s) {
          return "<label>" + s[1] + '<input name="' + s[0] + '" maxlength="80" value="' + esc(p[s[0]] || "") + '"></label>';
        }).join("") + "</div>"
      + '<div class="acts"><button class="btn" type="submit">Save my profile</button>'
      + '<button class="btn ghost" type="button" data-profwipe="1">Take my profile down</button>'
      + '<button class="btn ghost" type="button" data-signout="1">Sign out</button></div>'
      + "</form>" + basedList();
    return h;
  }

  /* Every country with somebody on the list, biggest first. Each one opens
     to show who is in it; clicking a name goes to their page, and "Only this
     country" filters the leaderboards. */
  function nationsHtml() {
    var ns = M.nations("both");
    if (!ns.length) {
      return '<div class="empty">Nobody has a country set yet. Admin &rarr; Players, or people can pick one when they submit a record.</div>';
    }
    var top = ns[0].points || 1;
    return '<p class="sub" style="margin-top:-6px">Points from both lists added together. '
      + ns.length + ' countries so far.</p><div class="nations">'
      + ns.map(function (n, i) {
          return '<details class="nation"><summary>'
            + '<span class="rank">' + (i + 1) + "</span>"
            + M.flagImg(n.code)
            + '<span class="nm">' + esc(n.name) + "</span>"
            + '<span class="who2">' + n.count + (n.count === 1 ? " player" : " players") + "</span>"
            + '<span class="pts">' + n.points + "</span>"
            + '<span class="bar"><i style="width:' + Math.max(3, Math.round(n.points / top * 100)) + '%"></i></span>'
            + "</summary><div class=\"inner\">"
            + n.list.map(function (p2) {
                return '<div class="nrow">' + profileLinkHtml(p2.name, esc(p2.name))
                  + '<span class="pts">' + p2.points + "</span></div>";
              }).join("")
            + '<div class="acts"><button class="btn ghost sm" data-country="' + esc(n.code) + '">'
            + "Only this country on the leaderboard</button></div>"
            + "</div></details>";
        }).join("")
      + "</div>";
  }

  /* ---------------- packs ---------------- */
  function vPacks() {
    var l = UI.tab.packs, ps = all("packs").filter(function (p) { return p.list === l; });
    var h = '<h1 class="pg">Packs</h1><p class="sub">Groups of challenges that belong together - a difficulty step, a type of challenge, a creator. Clear every challenge in a pack to clear the pack.</p>'
      + '<div class="tabs"><button data-tab="packs:main" aria-selected="' + (l === "main") + '">Main list</button>'
      + '<button data-tab="packs:friends" aria-selected="' + (l === "friends") + '">Friends list</button></div>' + msgHtml();
    if (M.canEdit()) h += '<div class="adm"><span class="lb">Admin</span><button class="btn sm" data-newpack="' + l + '">Add pack</button></div>';
    if (UI.edit && UI.edit._pack && UI.edit.list === l) h += M.formPack(UI.edit);
    if (!ps.length) return h + '<div class="empty">No packs on this list yet.</div>';
    return h + '<div class="packs">' + ps.map(function (p) {
      var cs = (p.ids || []).map(chal).filter(Boolean).sort(function (a, b) { return a.pos - b.pos; });
      return '<div class="pack" style="--pc:' + esc(p.color || "var(--accent)") + '"><div class="ph"><h4>' + esc(p.name) + "</h4><p>" + esc(p.desc || "") + "</p>"
        + (M.canEdit() ? '<div class="acts" style="margin-top:8px"><button class="btn ghost sm" data-editpack="' + p.id + '">Edit</button>'
                    + '<button class="btn ghost sm" data-delpack="' + p.id + '">Delete</button></div>' : "")
        + "</div>" + (cs.length ? "<ol>" + cs.map(function (c) {
            return "<li>" + esc(c.name) + ' <span class="mono" style="color:var(--ink2);font-size:11px">#' + c.pos + "</span></li>";
          }).join("") + "</ol>" : '<ol><li style="color:var(--ink2)">empty</li></ol>') + "</div>";
    }).join("") + "</div>";
  }

  /* ---------------- clans ---------------- */
  function vClans() {
    var clans = all("clans").map(function (c) { return { c: c, st: M.clanStats(c) }; })
      .sort(function (a, b) { return b.st.points - a.st.points; });
    var open = UI.clan ? M.clanByTag(UI.clan) : null;
    var h = '<h1 class="pg">Clans</h1><p class="sub">Teams. A clan has a full name and a tag of up to four letters that sits after every member&rsquo;s name, like <b>Mucy (MCL)</b>. Points are the members&rsquo; points added up across both lists.</p>' + msgHtml();
    if (M.canEdit()) h += '<div class="adm"><span class="lb">Admin</span><button class="btn sm" data-newclan="1">Add clan</button>'
      + (open ? '<button class="btn ghost sm" data-editclan="' + open.id + '">Edit ' + esc(open.name) + '</button><button class="btn ghost sm" data-delclan="' + open.id + '">Delete</button>' : "") + "</div>";
    if (UI.edit && UI.edit._clan) h += formClan(UI.edit);
    if (!clans.length) return h + '<div class="empty">No clans yet.' + (M.canEdit() ? " Use <b>Add clan</b>." : "") + "</div>";

    if (open) {
      var st = M.clanStats(open);
      h += '<div class="clanhead" style="--pc:' + esc(open.color || "var(--accent)") + '"><div>'
        + '<div class="tagbig">' + esc(open.tag) + '</div><h2 class="sec" style="margin:4px 0 2px">' + esc(open.name) + "</h2>"
        + (open.desc ? '<p class="sub" style="margin:0">' + esc(open.desc) + "</p>" : "")
        + '</div><a class="btn ghost sm" href="' + M.hrefFor("clans") + '" data-go="clans">All clans</a></div>';
      h += '<div class="stats"><div><span>Points</span><b>' + st.points + '</b></div><div><span>Beaten</span><b>' + st.beaten + '</b></div>'
        + '<div><span>Created</span><b>' + st.created + '</b></div><div><span>Verified</span><b>' + st.verified + '</b></div>'
        + '<div><span>Members</span><b>' + st.members.length + "</b></div></div>";
      h += '<div class="scroll panel" style="margin-top:14px"><table><thead><tr><th class="num">#</th><th>Member</th><th class="num">Points</th><th class="num">Beaten</th></tr></thead><tbody>';
      st.members.forEach(function (m, i) {
        h += '<tr><td class="num" style="color:var(--ink2)">' + (i + 1) + '</td><td style="font-weight:700">' + who(m.name) + '</td><td class="num">' + (Math.round(m.points * 10) / 10) + '</td><td class="num">' + m.beaten + "</td></tr>";
      });
      return h + "</tbody></table></div>";
    }

    h += '<div class="scroll panel"><table><thead><tr><th class="num">#</th><th>Clan</th><th>Tag</th><th class="num">Points</th><th class="num">Beaten</th><th class="num">Created</th><th class="num">Verified</th><th class="num">Members</th></tr></thead><tbody>';
    clans.forEach(function (x, i) {
      h += '<tr><td class="num" style="color:var(--ink2)">' + (i + 1) + '</td>'
        + '<td style="font-weight:700"><a href="' + M.hrefFor("clans", x.c.tag) + '" data-go="clans" data-clan="' + esc(x.c.tag) + '">' + esc(x.c.name) + "</a></td>"
        + '<td><span class="tagpill" style="--pc:' + esc(x.c.color || "var(--accent)") + '">' + esc(x.c.tag) + "</span></td>"
        + '<td class="num" style="font-weight:600">' + x.st.points + '</td><td class="num">' + x.st.beaten + '</td><td class="num">' + x.st.created + '</td><td class="num">' + x.st.verified + '</td><td class="num">' + x.st.members.length + "</td></tr>";
    });
    return h + "</tbody></table></div>";
  }
  function formClan(e) {
    var cols = ["var(--accent)", "#E11D62", "#E0451F", "#1E8FE0", "#14996B", "#B7791F", "#8A8F9E"],
        nm = ["List accent", "Pink", "Red", "Blue", "Green", "Gold", "Grey"];
    return '<form class="panel pad stack" data-form="clan" style="margin-bottom:20px"><input type="hidden" name="id" value="' + esc(e.id || "") + '">'
      + '<h3 style="font-size:18px">' + (e.id ? "Edit clan" : "Add clan") + "</h3>"
      + '<div class="fr"><label>Full name<input name="name" required maxlength="40" value="' + esc(e.name || "") + '"></label>'
      + '<label>Tag - up to 4 letters, goes after names<input name="tag" required maxlength="4" pattern="[A-Za-z0-9]{1,4}" title="1 to 4 letters or digits" value="' + esc(e.tag || "") + '" style="text-transform:uppercase;font-family:var(--mono)"></label>'
      + '<label>Colour<select name="color">' + cols.map(function (c, i) { return '<option value="' + c + '"' + ((e.color || "") === c ? " selected" : "") + ">" + nm[i] + "</option>"; }).join("") + "</select></label></div>"
      + '<label>Description<input name="desc" maxlength="140" value="' + esc(e.desc || "") + '"></label>'
      + '<label>Members - one name per line, exactly as they appear on records<textarea name="members" rows="5">' + esc((e.members || []).join("\n")) + "</textarea></label>"
      + '<div class="acts"><button class="btn" type="submit">Save clan</button><button class="btn ghost" type="button" data-cancel="1">Cancel</button></div></form>';
  }

  /* ---------------- rules ---------------- */
  function vRules() {
    var d = safeUrl(cfg().discord);
    var h = '<h1 class="pg">Rules</h1><p class="sub">Short list, and all of it is enforced. If something here is unclear, ask in the Discord before you submit rather than after.</p>';
    h += '<div class="rulegrid">' + M.ruleSet().map(function (r, i) {
      return '<div class="rule"><div class="n">0' + (i + 1) + "</div><div><h4>" + esc(r[0]) + "</h4><p>" + esc(r[1]) + "</p></div></div>";
    }).join("") + "</div>";
    h += '<h2 class="sec" style="font-size:20px;margin-top:34px">List Requirements</h2>'
      + '<p class="sub">What a level needs to be placed, and what a record needs to count. Mucy decides the edge cases; these are the ones that are not edge cases.</p>';
    h += '<div class="rulegrid">' + M.listReqs().map(function (r, i) {
      return '<div class="rule req"><div class="n">R' + (i + 1) + "</div><div><h4>" + esc(r[0]) + "</h4><p>" + esc(r[1]) + "</p></div></div>";
    }).join("") + "</div>";
    h += '<h2 class="sec" style="font-size:20px;margin-top:34px">Also worth knowing</h2>';
    h += '<div class="rulegrid">' + M.ruleExtra().map(function (r) {
      return '<div class="rule"><div class="n">&middot;</div><div><h4>' + esc(r[0]) + "</h4><p>" + esc(r[1]) + "</p></div></div>";
    }).join("") + "</div>";
    h += '<div class="acts" style="margin-top:22px">'
      + (d ? '<a class="btn" href="' + esc(d) + '" target="_blank" rel="noopener">Open the Discord</a>' : '<span class="chip">no discord link set yet</span>')
      + '<button class="btn ghost" data-go="submit">Submit a record</button></div>';
    return h;
  }

  /* ---------------- roulette ---------------- */
  function vRoulette() {
    var l = UI.tab.roul, run = UI.run, pool = M.poolFor(l);
    var h = '<h1 class="pg">Roulette</h1><p class="sub">The roulette draws challenges from a list at random. The first level needs 1%, and after that you need <b>one more than you actually got last time</b> - 41% on a level means 42% on the next one. Type in the percent you reached: hit the requirement and you carry on, come up short and the run ends there. Skipping does not move the requirement, and skips are limited.</p>'
      + '<div class="tabs">' + M.ROUL_LISTS.map(function (x) {
          return '<button data-tab="roul:' + x[0] + '" aria-selected="' + (l === x[0]) + '">' + x[1] + "</button>";
        }).join("") + "</div>" + msgHtml();
    if (!pool.length) return h + '<div class="empty">Nothing to draw from yet.</div>';

    if (!run || run.list !== l) {
      h += '<form class="panel pad stack" data-form="start" style="max-width:760px"><input type="hidden" name="list" value="' + l + '">'
        + '<div class="fr"><label>Your name<input name="player" required maxlength="24" placeholder="e.g. Mucy"></label>'
        + '<label>Draw from<select name="pool"><option value="all">' + (l === "both" ? "Both lists" : "Whole list") + " (" + pool.length + ')</option>'
        + ["25", "50", "100"].map(function (n) {
            return '<option value="' + n + '">Top ' + n + (l === "both" ? " of each list" : "") + "</option>";
          }).join("")
        + '<option value="legacy">Legacy only</option></select></label>'
        + '<label>Skips allowed<select name="skips"><option>2</option><option>0</option><option>1</option><option>3</option><option>5</option></select></label></div>'
        + '<div><button class="btn" type="submit">Start run</button></div></form>';
    } else {
      var c = chal(run.cur), req = run.need || 1;
      h += '<div class="draw"><span class="step">Step ' + (run.steps.length + 1) + " &middot; " + esc(run.player)
        + " &middot; " + M.listLabel(l) + "</span>"
        + '<div style="display:flex;flex-wrap:wrap;gap:20px;align-items:flex-end;justify-content:space-between">'
        + '<div><div class="lvlname">' + esc(c ? c.name : "?") + "</div>"
        + '<div style="color:var(--ink2);font-size:13px">' + (c ? (l === "both" ? esc(M.listLabel(c.list)) + " " : "") + "#" + c.pos + " &middot; by " + esc(c.creator) + " &middot; verified by " + esc(c.verifier || "?") : "") + "</div></div>"
        + '<div style="text-align:right"><div class="req">' + req + '%</div><div class="step">required</div></div></div>'
        + (c ? '<div class="facts">'
            + "<span>ID <b>" + esc(c.levelId || "-") + "</b></span>"
            + "<span>FPS <b>" + esc(c.fps || "-") + "</b></span>"
            + "<span>Based on <b>" + esc(c.basedOn || "-") + "</b></span>"
            + (c.device ? "<span>Device <b>" + esc(c.device) + "</b></span>" : "")
            + (M.needsCam(c) ? "<span>Webcam <b>required</b></span>" : "")
            + "</div>" : "")
        + (run.prewatch && c ? '<div>' + M.playerHtml(c.video, false, M.thumbSrc(c)) + "</div>" : "")
        + '<form class="pctbar" data-form="pct"><input name="pct" type="number" min="0" max="100" step="0.01" '
        + 'placeholder="At least ' + req + '%" aria-label="Percent you reached" required autofocus>'
        + '<button class="btn" type="submit">Submit</button></form>'
        + '<div class="acts"><button class="btn ghost" data-roul="skip"' + (run.skips <= 0 ? " disabled" : "") + ">Skip (" + run.skips + " left)</button>"
        + (safeUrl(c && c.video) ? '<button class="btn ghost" data-roul="prewatch">' + (run.prewatch ? "Hide video" : "Pre-watch") + "</button>" : "")
        + '<button class="btn ghost" data-roul="end">End run</button></div>'
        + (run.steps.length ? '<div class="steps">' + run.steps.map(function (s, i) {
              return '<span class="pill ' + (s.skip ? "skip" : "done") + '">' + (i + 1) + ". " + esc(s.name)
                + (s.skip ? " / skipped" : " / " + s.got + "%") + "</span>";
            }).join("") + "</div>" : "")
        + "</div>";
    }
    var runs = all("runs").filter(function (r) { return r.list === l; })
      .sort(function (a, b) { return b.beaten - a.beaten || b.best - a.best; }).slice(0, 25);
    h += '<h2 class="sec" style="font-size:20px">Roulette board</h2>';
    h += runs.length
      ? '<div class="scroll panel"><table><thead><tr><th class="num">#</th><th>Player</th><th class="num">Levels beaten</th><th class="num">Highest %</th><th>Date</th>'
        + (M.canEdit() ? "<th></th>" : "") + "</tr></thead><tbody>"
        + runs.map(function (r, i) {
            return '<tr><td class="num" style="color:var(--ink2)">' + (i + 1) + '</td><td style="font-weight:700">' + who(r.player)
              + '</td><td class="num">' + r.beaten + '</td><td class="num">' + r.best + '%</td>'
              + '<td class="mono" style="font-size:12px;color:var(--ink2)">' + new Date(r.at).toISOString().slice(0, 10) + "</td>"
              + (M.canEdit() ? '<td style="text-align:right"><button class="btn ghost sm" data-delrun="' + r.id + '">remove</button></td>' : "") + "</tr>";
          }).join("") + "</tbody></table></div>"
      : '<div class="empty">No finished runs on this list yet.</div>';
    return h;
  }

  /* ---------------- submit ---------------- */
  function vSubmit() {
    var t = UI.tab.submit, d = safeUrl(cfg().discord);
    var h = '<h1 class="pg">Submit</h1><p class="sub">Everything here goes into a queue and shows up on the site once Mucy accepts it. Send the clip in the Discord as well - that part is not optional.</p>'
      + '<div class="tabs"><button data-tab="submit:record" aria-selected="' + (t === "record") + '">A record</button>'
      + '<button data-tab="submit:challenge" aria-selected="' + (t === "challenge") + '">A challenge (Friends List)</button></div>' + msgHtml();
    if (d) h += '<div class="note"><span>' + (t === "record"
        ? "<b>A completion just needs a clip.</b> Link it below, or send it in the Discord or to Mucy in DMs - all three count."
        : "<b>Verifications go in the Discord.</b> A level cannot be placed until its verification has been posted there.")
      + '</span><a class="btn sm" href="' + esc(d) + '" target="_blank" rel="noopener">Open Discord</a></div>';

    /* A submission has to come from a signed-in Discord account. This is the
       thing that stops a stranger from posting whatever clip they like under
       somebody else's completion: it is not anonymous any more, and an
       account that abuses it can be blocked outright. */
    if (M.cloud && M.cloud.enabled() && !M.DB && !M.cloud.signedIn()) {
      return h + '<div class="panel pad stack" style="max-width:600px">'
        + '<h3 style="font-size:18px;margin:0">Sign in with Discord first</h3>'
        + '<p style="font-size:13.5px;color:var(--ink2);margin:0">Submitting used to be open to anyone, which meant anyone could file a completion under somebody else\'s name with any link they felt like attaching. Now a submission carries the account that sent it, so it can be checked - and blocked if it needs to be.</p>'
        + '<button class="btn discordbtn" data-dlogin="1">' + DISCORD_SVG + " Sign in with Discord</button>"
        + '<p style="font-size:12.5px;color:var(--ink2);margin:0">It tells the site your Discord name, id and avatar - the same things anyone in the server already sees. Nothing is posted as you.</p>'
        + "</div>";
    }

    if (t === "record") {
      var opts = [["Main list", listOf("main")], ["Friends list", listOf("friends")]].map(function (g) {
        return g[1].length ? '<optgroup label="' + g[0] + '">' + g[1].map(function (c) {
          return '<option value="' + c.id + '">#' + c.pos + " " + esc(c.name) + (isLegacy(c) ? " (legacy)" : "")
            + (M.needsCam(c) ? " - webcam required" : "") + "</option>";
        }).join("") + "</optgroup>" : "";
      }).join("");
      if (!opts) return h + '<div class="empty">There are no challenges to submit a record for yet.</div>';
      h += '<form class="panel pad stack" data-form="record" style="max-width:720px">'
        + '<div class="fr"><label>Your name<input name="player" required maxlength="24"></label>'
        + '<label>Challenge<select name="cid" required>' + opts + "</select></label></div>"
        + '<div class="fr"><label>Percent reached<input name="pct" type="number" min="1" max="100" value="100" required></label>'
        + '<label>FPS<input name="fps" list="fpslist" maxlength="3" value="240" placeholder="240, 15, CBF..." pattern="[Cc][Bb][Ff]|[0-9]{2,3}" title="10 to 360, or CBF for anything higher"></label>'
        + '<label>Device<select name="device"><option>PC</option><option>Mobile</option><option>Console</option></select></label></div>'
        + '<label>Country (shows as a flag next to your name)' + countrySelect("country", "") + "</label>" + countryList()
        + "<label>Clip link - YouTube, Medal, Streamable or a direct Discord .mp4"
        + '<input name="video" type="text" inputmode="url" autocomplete="off" placeholder="https://medal.tv/games/geometry-dash/clips/..."></label>'
        + '<label class="check"><input type="checkbox" name="discord"> I sent this clip in the Discord, or to Mucy in DMs.</label>'
        + '<label class="check"><input type="checkbox" name="medal"> This is a Medal clip.</label>'
        + '<p style="font-size:12.5px;color:var(--ink2)">Give a link above <b>or</b> tick the box - one of the two, so Mucy can actually watch it. '
        + 'Levels marked <b>webcam required</b> only count if your hands are in the clip.</p>'
        + '<div><button class="btn" type="submit">Submit record</button></div></form>' + basedList();
    } else {
      h += '<form class="panel pad stack" data-form="challenge" style="max-width:720px">'
        + '<div class="fr"><label>Level name<input name="name" required maxlength="60"></label>'
        + '<label>Creator<input name="creator" required maxlength="40"></label>'
        + '<label>Verifier<input name="verifier" required maxlength="40"></label></div>'
        + '<div class="fr"><label>Based on<input name="basedOn" list="basedlist" placeholder="Difficulty, Spamming, Consistency..." maxlength="24"></label>'
        + '<label>Level ID<input name="levelId" maxlength="20"></label>'
        + '<label>FPS<input name="fps" list="fpslist" maxlength="3" value="240" placeholder="240, 15, CBF..." pattern="[Cc][Bb][Ff]|[0-9]{2,3}" title="10 to 360, or CBF for anything higher"></label></div>'
        + '<div class="fr"><label>Where do you honestly think it goes? (top)<input name="top" type="number" min="1" max="' + M.legacyAfter() + '" required></label>'
        + '<label>Verification video<input name="video" type="text" inputmode="url" autocomplete="off" placeholder="https://youtu.be/..."></label>'
        + '<label>Your name<input name="by" required maxlength="24"></label>'
        + '<label>Webcam required' + camSelect(false) + "</label></div>"
        + "<label>Notes - what makes it hard?<textarea name=\"note\" rows=\"3\" maxlength=\"400\"></textarea></label>"
        + '<label class="check"><input type="checkbox" name="possible" required> This level has been beaten in a legitimate attempt. It is not impossible.</label>'
        + '<label class="check"><input type="checkbox" name="honest" required> The placement above is my honest opinion, not the one I would like.</label>'
        + '<div><button class="btn" type="submit">Post to the Friends List queue</button></div></form>' + basedList();
    }
    return h;
  }
  /* A country box you can type in: start typing "ger" and Germany is right
     there. Stores the code; shows the flag next to it once it recognises one. */
  function countrySelect(name, value) {
    var v = value ? M.countryName(value) + " (" + value + ")" : "";
    return '<span class="cbox">' + (value ? M.flagImg(value) : '<img class="flag" style="display:none" alt="">')
      + '<input name="' + name + '" list="countrylist" data-countrybox="1" placeholder="type a country..." autocomplete="off" value="' + esc(v) + '"></span>';
  }
  function countryList() {
    return '<datalist id="countrylist">' + M.COUNTRIES.map(function (c) {
      return '<option value="' + esc(M.countryName(c)) + " (" + c + ')">';
    }).join("") + "</datalist>";
  }
  /* Yes/No for the webcam flag. "No" first, because most levels do not need
     one - the default should be the common answer. */
  function camSelect(on) {
    return '<select name="webcam">'
      + '<option value="no"' + (on ? "" : " selected") + ">No</option>"
      + '<option value="yes"' + (on ? " selected" : "") + ">Yes</option></select>";
  }
  function basedList() {
    return '<datalist id="basedlist">' + M.BASED.map(function (b) { return '<option value="' + esc(b) + '">'; }).join("")
      + '</datalist><datalist id="fpslist">'
      + M.FPS_HINTS.map(function (f) { return '<option value="' + esc(f) + '">'; }).join("") + "</datalist>";
  }

  /* ---------------- admin forms ---------------- */
  M.formChallenge = function (e) {
    return '<form class="panel pad stack" data-form="chal" style="margin-bottom:20px"><input type="hidden" name="id" value="' + esc(e.id || "") + '">'
      + '<input type="hidden" name="list" value="' + esc(e.list) + '">'
      + '<h3 style="font-size:18px">' + (e.id ? "Edit " + esc(e.name) : "Add challenge") + "</h3>"
      + '<div class="fr"><label>Name<input name="name" required maxlength="60" value="' + esc(e.name || "") + '"></label>'
      + '<label>Position<input name="pos" type="number" min="1" required value="' + (e.pos || listOf(e.list).length + 1) + '"></label>'
      + '<label>Based on<input name="basedOn" list="basedlist" placeholder="Difficulty, Spamming..." maxlength="24" value="' + esc(e.basedOn || "") + '"></label></div>'
      + '<div class="fr"><label>Creator<input name="creator" maxlength="40" value="' + esc(e.creator || "") + '"></label>'
      + '<label>Verifier<input name="verifier" maxlength="40" value="' + esc(e.verifier || "") + '"></label>'
      + '<label>Publisher<input name="publisher" maxlength="40" value="' + esc(e.publisher || "") + '"></label></div>'
      + '<div class="fr"><label>Level ID<input name="levelId" maxlength="20" value="' + esc(e.levelId || "") + '"></label>'
      + '<label>FPS<input name="fps" list="fpslist" maxlength="3" pattern="[Cc][Bb][Ff]|[0-9]{2,3}" title="10 to 360, or CBF for anything higher" value="' + esc(e.fps || "") + '"></label>'
      + '<label>Version<input name="version" maxlength="8" value="' + esc(e.version || "2.2") + '"></label>'
      + '<label>Device<input name="device" maxlength="16" value="' + esc(e.device || "All") + '"></label></div>'
      + '<div class="fr"><label>Minimum %<input name="req" type="number" min="1" max="100" value="' + (e.req || 100) + '"></label>'
      + '<label>Verifier says top<input name="top" type="number" min="1" value="' + esc(e.top || "") + '"></label>'
      + '<label>Webcam required' + camSelect(M.needsCam(e)) + "</label></div>"
      + "<label>Video link (YouTube, Medal, Streamable, Twitch clip or a direct .mp4)"
      + '<input name="video" type="url" value="' + esc(e.video || "") + '"></label>'
      + '<label>Thumbnail'
      + '<span class="thumbpick">'
      + '<input type="file" accept="image/*" id="thumbfile" data-thumbup="' + esc(e.id || "") + '" hidden>'
      + '<button class="btn ghost sm" type="button" data-pickthumb="1">Upload an image</button>'
      + (M.thumbSrc(e) ? '<img class="thumbprev" src="' + esc(M.thumbSrc(e)) + '" alt=""'
            + M.thumbFallbackAttrs(e) + ">" : "")
      + '<span class="hint" id="thumbmsg">Pick a file and it is resized and uploaded. Leave it alone and thumbs.js takes one from the video.</span>'
      + "</span></label>"
      + "<label>...or paste a link to copy from - a Discord or Medal url works, but only as a source: those expire, so run thumbs.js afterwards"
      + '<input name="thumb" type="url" placeholder="https://... only if you want a specific image" value="' + esc(e.thumb || "") + '"></label>'
      + '<label>Note<textarea name="note" rows="2" maxlength="400">' + esc(e.note || "") + "</textarea></label>"
      + '<div class="acts"><button class="btn" type="submit">Save</button>'
      + '<button class="btn ghost" type="button" data-cancel="1">Cancel</button></div></form>' + basedList();
  };
  M.formPack = function (e) {
    var cs = listOf(e.list), ids = e.ids || [],
        cols = ["var(--accent)", "#E0451F", "#1E8FE0", "#14996B", "#B7791F", "#8A8F9E"],
        nm = ["List accent", "Red", "Blue", "Green", "Gold", "Grey"];
    return '<form class="panel pad stack" data-form="pack" style="margin-bottom:20px"><input type="hidden" name="id" value="' + esc(e.id || "") + '">'
      + '<input type="hidden" name="list" value="' + esc(e.list) + '">'
      + '<h3 style="font-size:18px">' + (e.id ? "Edit pack" : "Add pack") + "</h3>"
      + '<div class="fr"><label>Name<input name="name" required maxlength="40" value="' + esc(e.name || "") + '"></label>'
      + '<label>Colour<select name="color">' + cols.map(function (c, i) {
          return '<option value="' + c + '"' + ((e.color || "") === c ? " selected" : "") + ">" + nm[i] + "</option>";
        }).join("") + "</select></label></div>"
      + '<label>Description<input name="desc" maxlength="120" value="' + esc(e.desc || "") + '"></label>'
      + '<label>Challenges (ctrl-click for more than one)<select name="ids" multiple size="' + Math.min(10, Math.max(4, cs.length)) + '" style="height:auto">'
      + cs.map(function (c) {
          return '<option value="' + c.id + '"' + (ids.indexOf(c.id) >= 0 ? " selected" : "") + ">#" + c.pos + " " + esc(c.name) + "</option>";
        }).join("") + "</select></label>"
      + '<div class="acts"><button class="btn" type="submit">Save pack</button>'
      + '<button class="btn ghost" type="button" data-cancel="1">Cancel</button></div></form>';
  };

  /* ---------------- admin ---------------- */
  function vAdmin() {
    var c = cfg(),
        subs = all("submissions").filter(function (s) { return s.status === "pending"; }),
        pr = all("records").filter(function (r) { return r.status === "pending"; }),
        eds = all("editors").sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
    if (!M.canQueue()) return vSignIn();
    /* A list mod gets the queue and nothing else. This hides the rest; the
       database is what actually refuses a mod's settings change. */
    var modOnly = !M.canEdit(), meNow = M.me();
    var h = '<h1 class="pg">Admin</h1><p class="sub">'
      + (modOnly ? "Signed in as a <b>list mod</b>" + (meNow && meNow.name ? " (" + esc(meNow.name) + ")" : "")
                 + ". You can accept and reject anything in the queue, and move levels up and down from the list pages. "
                 + "Adding, editing and deleting levels, and anything to do with settings or staff, are the owner's."
         : M.MODE === "db" ? "Changes go live for everyone who can open this page."
         : M.cloud.signedIn() ? "Signed in. Everything you change here saves for everyone straight away."
         : "Changes are saved in this browser. Use the Data box at the bottom to move them anywhere else.")
      + "</p>" + msgHtml();

    var inbox = ((M.cloud && M.cloud.inbox) || []).filter(function (r) {
      return r && (r.kind === "record" || r.kind === "challenge") && r.payload;
    });
    h += '<h2 class="sec" style="font-size:20px">Queue</h2>';
    if (!subs.length && !pr.length && !inbox.length) h += '<div class="empty">Nothing waiting.</div>';
    h += '<div class="grid2">';
    /* Submissions that came in from the live site. */
    inbox.forEach(function (row) {
      var p = row.payload || {};
      if (row.kind === "record") {
        var ch = chal(p.cid);
        h += '<div class="qitem"><span class="chip pend">record &middot; from the site</span><div><b>' + esc(p.player) + "</b> - "
          + esc(p.pct) + "% on " + esc(ch ? ch.name : p.cname || "(unknown level)") + "</div>"
          + '<div style="font-size:12.5px;color:var(--ink2)">' + (p.fps ? esc(p.fps) + " fps &middot; " : "")
          + (p.device ? esc(p.device) + " &middot; " : "") + (p.medal ? "medal clip &middot; " : "")
          + (p.discord ? "clip is in Discord" : "NO Discord clip")
          + (safeUrl(p.video) ? ' &middot; <a href="' + esc(safeUrl(p.video)) + '" target="_blank" rel="noopener">watch</a>' : "")
          + "</div>" + senderHtml(p)
          + '<div class="acts">'
          + (ch ? '<button class="btn sm" data-inok="' + esc(row.id) + '">Accept</button>' : '<span class="chip">level not on the list</span>')
          + '<button class="btn ghost sm" data-inno="' + esc(row.id) + '">Reject</button>'
          + blockBtn(p) + "</div></div>";
      } else {
        h += '<div class="qitem"><span class="chip pend">friends challenge &middot; from the site</span><div><b>' + esc(p.name)
          + "</b> - by " + esc(p.creator) + ", verified by " + esc(p.verifier) + "</div>"
          + '<div style="font-size:12.5px;color:var(--ink2)">posted by ' + esc(p.by) + " &middot; says top " + esc(p.top)
          + (p.basedOn ? " &middot; based on " + esc(p.basedOn) : "")
          + (p.webcam ? " &middot; webcam required" : "")
          + (safeUrl(p.video) ? ' &middot; <a href="' + esc(safeUrl(p.video)) + '" target="_blank" rel="noopener">video</a>' : "") + "</div>"
          + senderHtml(p)
          + (p.note ? '<p style="font-size:13px;color:var(--ink2)">' + esc(p.note) + "</p>" : "")
          + '<div class="acts"><label style="flex:none;text-transform:none;letter-spacing:0;font-size:12px">Place at'
          + '<input type="number" min="1" value="' + esc(p.top || 1) + '" data-pos="' + esc(row.id) + '" style="width:76px"></label>'
          + '<button class="btn sm" data-inacc="' + esc(row.id) + '">Accept</button>'
          + '<button class="btn ghost sm" data-inno="' + esc(row.id) + '">Reject</button>'
          + blockBtn(p) + "</div></div>";
      }
    });
    pr.forEach(function (r) {
      var ch = chal(r.cid);
      h += '<div class="qitem"><span class="chip pend">record</span><div><b>' + (r.country ? M.flagImg(r.country) + " " : "") + esc(r.player) + "</b> - " + r.pct + "% on "
        + esc(ch ? ch.name : "(deleted)") + "</div>"
        + '<div style="font-size:12.5px;color:var(--ink2)">' + (r.fps ? esc(r.fps) + " fps &middot; " : "")
        + (r.device ? esc(r.device) + " &middot; " : "") + (r.medal ? "medal clip &middot; " : "")
        + (r.discord ? "clip is in Discord" : "NO Discord clip")
        + (safeUrl(r.video) ? ' &middot; <a href="' + esc(safeUrl(r.video)) + '" target="_blank" rel="noopener">watch</a>' : "") + "</div>"
        + '<div class="acts"><button class="btn sm" data-ok="' + r.id + '">Accept</button>'
        + '<button class="btn ghost sm" data-no="' + r.id + '">Reject</button></div></div>';
    });
    subs.forEach(function (s) {
      h += '<div class="qitem"><span class="chip pend">friends challenge</span><div><b>' + esc(s.name) + "</b> - by "
        + esc(s.creator) + ", verified by " + esc(s.verifier) + "</div>"
        + '<div style="font-size:12.5px;color:var(--ink2)">posted by ' + esc(s.by) + " &middot; says top " + esc(s.top)
        + (s.basedOn ? " &middot; based on " + esc(s.basedOn) : "")
        + (s.webcam ? " &middot; webcam required" : "")
        + (safeUrl(s.video) ? ' &middot; <a href="' + esc(safeUrl(s.video)) + '" target="_blank" rel="noopener">video</a>' : "") + "</div>"
        + (s.note ? '<p style="font-size:13px;color:var(--ink2)">' + esc(s.note) + "</p>" : "")
        + '<div class="acts"><label style="flex:none;text-transform:none;letter-spacing:0;font-size:12px">Place at'
        + '<input type="number" min="1" value="' + esc(s.top || 1) + '" data-pos="' + s.id + '" style="width:76px"></label>'
        + '<button class="btn sm" data-acc="' + s.id + '">Accept</button>'
        + '<button class="btn ghost sm" data-rej="' + s.id + '">Reject</button></div></div>';
    });
    h += "</div>";

    if (modOnly) {
      return h + '<p style="color:var(--ink2);font-size:13px;max-width:60ch;margin-top:18px">'
        + "That is everything a list mod can do here. If something needs moving, removing or a settings change, it has to go through Mucy.</p>";
    }

    /* ---- players: countries ---- */
    var names = {};
    all("records").forEach(function (r) { names[M.key(r.player)] = r.player; });
    all("challenges").forEach(function (c2) { names[M.key(c2.verifier)] = c2.verifier; M.people(c2.creator).forEach(function (n) { names[M.key(n)] = n; }); });
    all("players").forEach(function (p) { names[M.key(p.name)] = p.name; });
    delete names[""];
    var plist = Object.keys(names).sort().map(function (k) {
      return { key: k, name: names[k], country: M.countryOf(names[k]), clan: M.clanOf(names[k]),
               discordId: M.discordOf(names[k]),
               records: all("records").filter(function (r) { return M.key(r.player) === k; }).length };
    });
    /* ---- profiles waiting for a name ---- */
    var waiting = M.unlinkedProfiles ? M.unlinkedProfiles() : [];
    if (waiting.length) {
      h += '<h2 class="sec" style="font-size:20px">Profiles waiting to be linked</h2>'
        + '<div class="panel pad stack" style="max-width:720px">'
        + '<p style="font-size:13px;color:var(--ink2)">' + waiting.length
        + (waiting.length === 1 ? " person has" : " people have")
        + " signed in and written a profile that is not attached to anybody on the list yet. Pick who they are and it shows up on their name.</p>";
      h += waiting.map(function (w) {
        return '<form class="fr" data-form="linkprofile" style="align-items:end">'
          + '<input type="hidden" name="discordId" value="' + esc(w.discordId) + '">'
          + '<label>Who is this?<select name="name"><option value="">- pick a player -</option>'
          + plist.map(function (pp) {
              /* a name that already has somebody attached is not an option */
              return pp.discordId ? "" : '<option value="' + esc(pp.name) + '">' + esc(pp.name) + "</option>";
            }).join("")
          + "</select></label>"
          + "<label>Their profile says<div style=\"font-size:13px;padding:9px 0\">"
          + (w.data.gd ? "<b>" + esc(w.data.gd) + "</b> in game" : "<i>no GD name</i>")
          + (w.label ? " &middot; " + esc(w.label) + " on Discord" : "")
          + '<br><span class="mono" style="font-size:11px;color:var(--ink2)">' + esc(w.discordId) + "</span></div></label>"
          + '<label>&nbsp;<button class="btn" type="submit">Link</button></label></form>'
          + '<div class="acts" style="margin:-6px 0 10px"><button class="btn ghost sm" data-wipeprof="' + esc(w.discordId)
          + '" data-wipename="' + esc(w.label || w.discordId) + '">Not a real person / delete this profile</button></div>';
      }).join("");
      h += "</div>";
    }

    h += '<h2 class="sec" style="font-size:20px">Players</h2><div class="panel pad stack" style="max-width:720px">'
      + '<p style="font-size:13px;color:var(--ink2)">Everyone who appears on the list. Set a country and it shows as a flag next to their name everywhere. Clans are managed on the Clans page.</p>'
      + '<p style="font-size:13px;color:var(--ink2)">The <b>Discord id</b> is what connects a name here to a real person: set it and everything they put on their own profile page shows up under that name. Turn on Developer Mode in Discord, right-click them, <b>Copy User ID</b>. Nobody can claim a name by typing it - only this field links the two.</p>'
      + '<div class="scroll"><table><thead><tr><th>Player</th><th>Country</th><th>Discord id</th><th>Clan</th><th>Records</th></tr></thead><tbody>'
      + plist.map(function (p) {
          var prof = M.profileOf(p.name);
          return '<tr><td style="font-weight:600">' + who(p.name)
            + (prof ? ' <span class="chip">profile</span>'
                + '<button class="btn ghost sm" style="margin-left:6px" data-wipeprof="' + esc(p.discordId)
                + '" data-wipename="' + esc(p.name) + '" title="Delete what they wrote about themselves">wipe</button>' : "")
            + "</td>"
            + '<td><form data-form="country" style="display:flex;gap:6px;align-items:center"><input type="hidden" name="name" value="' + esc(p.name) + '">'
            + countrySelect("country", p.country) + '<button class="btn sm" type="submit">Set</button></form></td>'
            + '<td><form data-form="discordid" style="display:flex;gap:6px;align-items:center"><input type="hidden" name="name" value="' + esc(p.name) + '">'
            + '<input name="discordId" inputmode="numeric" pattern="[0-9]*" maxlength="20" placeholder="123456789012345678" style="width:190px" value="' + esc(p.discordId || "") + '">'
            + '<button class="btn sm" type="submit">Set</button></form></td>'
            + "<td>" + (p.clan ? esc(p.clan.name) + " (" + esc(p.clan.tag) + ")" : '<span style="color:var(--ink2)">-</span>') + "</td>"
            + '<td>' + (p.records ? '<button class="btn ghost sm" data-wiperecs="' + esc(p.name)
                + '" title="Take every record by this player off both lists">remove ' + p.records + " rec"
                + (p.records === 1 ? "" : "s") + "</button>" : '<span style="color:var(--ink2)">-</span>') + "</td></tr>";
        }).join("")
      + "</tbody></table></div>" + countryList() + "</div>";

    h += '<h2 class="sec" style="font-size:20px">List editors</h2><div class="panel pad stack" style="max-width:720px">'
      + (eds.length ? "<div>" + eds.map(function (e) {
          return '<div class="editor" style="border-bottom:1px solid var(--line)"><span>' + esc(e.name) + '</span>'
            + '<span class="r">' + esc(e.role) + '</span><button class="btn ghost sm" data-deled="' + e.id + '">remove</button></div>';
        }).join("") + "</div>" : '<p style="color:var(--ink2);font-size:13px">Nobody listed yet.</p>')
      + '<form class="stack" data-form="editor"><div class="fr"><label>Name<input name="name" required maxlength="30"></label>'
      + '<label>Role<select name="role"><option value="owner">owner</option><option value="mod">mod</option>'
      + '<option value="helper">helper</option><option value="dev">dev</option></select></label>'
      + '<label>&nbsp;<button class="btn" type="submit">Add editor</button></label></div></form></div>';

    h += staffPanel();

    h += '<h2 class="sec" style="font-size:20px">Settings</h2><form class="panel pad stack" data-form="cfg" style="max-width:720px">'
      + '<div class="fr"><label>List name<input name="title" value="' + esc(c.title) + '"></label>'
      + '<label>Version label<input name="ver" value="' + esc(c.ver || "") + '"></label></div>'
      + '<label>Blurb (top of the right column)<textarea name="blurb" rows="2" maxlength="220">' + esc(c.blurb || "") + "</textarea></label>"
      + '<div class="fr"><label>Discord invite<input name="discord" type="url" placeholder="https://discord.gg/..." value="' + esc(c.discord) + '"></label>'
      + '<label>Your site (Powered by)<input name="studio" type="url" value="' + esc(c.studio) + '"></label></div>'
      + '<label style="max-width:250px">Legacy after position<input name="legacyAfter" type="number" min="1" value="' + M.legacyAfter() + '"></label>'
      + '<div><button class="btn" type="submit">Save settings</button></div></form>';

    /* ---- cloud saving ---- */
    var cl = M.cloud, st = cl ? cl.status() : "off";
    h += '<h2 class="sec" style="font-size:20px">Live saving</h2><div class="panel pad stack" style="max-width:720px">';
    if (st === "artifact") {
      h += '<p style="font-size:13px;color:var(--ink2)">This page is running on the Claude shared store, so everything you change is already live for everyone who can open it. The cloud settings below only matter on your own site.</p>';
    }
    if (st === "off") {
      h += '<p style="font-size:13px;color:var(--ink2)">Right now your edits only live in this browser and you have to publish a file to share them. '
        + "Connect a free Supabase database and that stops: you edit, everyone sees it straight away, and submissions from the site land in the queue above.</p>"
        + '<ol style="font-size:13px;color:var(--ink2);margin:0;padding-left:20px;display:grid;gap:5px">'
        + '<li>Make a free project at <a href="https://supabase.com" target="_blank" rel="noopener">supabase.com</a> (no card needed).</li>'
        + "<li>Open <b>SQL Editor</b>, paste in the contents of <b>supabase.sql</b> from your site folder, press Run.</li>"
        + "<li>Go to <b>Authentication &rarr; Users &rarr; Add user</b> and make yourself an account (email + password, auto-confirm on).</li>"
        + "<li>Go to <b>Project Settings &rarr; API</b> and copy the <b>Project URL</b> and the <b>anon public</b> key into the boxes below.</li></ol>";
    }
    h += '<form class="stack" data-form="cloud"><div class="fr">'
      + '<label>Supabase project URL<input name="supaUrl" type="url" placeholder="https://xxxx.supabase.co" value="' + esc(c.supaUrl || "") + '"></label>'
      + '<label>Anon public key<input name="supaKey" placeholder="eyJhbGciOi..." value="' + esc(c.supaKey || "") + '"></label></div>'
      + '<div><button class="btn" type="submit">Save cloud settings</button></div></form>';
    if (st !== "off" && st !== "artifact") {
      h += cl.signedIn()
        ? '<div class="acts"><span class="chip" style="color:var(--good);border-color:var(--good)">signed in &middot; changes save automatically</span>'
          + '<button class="btn ghost sm" data-signout="1">Sign out</button>'
          + '<button class="btn ghost sm" data-pushnow="1">Force save now</button></div>'
        : '<form class="stack" data-form="signin"><p style="font-size:13px;color:var(--ink2)">Sign in with the Supabase account you made to edit the live list. Visitors never need this.</p>'
          + '<div class="fr"><label>Email<input name="email" type="email" required autocomplete="username"></label>'
          + '<label>Password<input name="password" type="password" required autocomplete="current-password"></label>'
          + '<label>&nbsp;<button class="btn" type="submit">Sign in</button></label></div></form>';
      h += '<p style="font-size:12.5px;color:var(--ink2)">Remember to <b>publish once</b> after connecting, so visitors&rsquo; browsers know where the database is.</p>';
    }
    h += "</div>";

    /* ---- publish ---- */
    var stamp = Date.now(), pub = JSON.stringify(M.snapshot(stamp), null, 1),
        baseAt = (M.S.meta && M.S.meta.baseAt) || 0,
        unsaved = M.MODE !== "db";
    h += '<h2 class="sec" style="font-size:20px">Publish</h2><div class="panel pad stack" style="max-width:720px">'
      + '<p style="font-size:13px;color:var(--ink2)">Your edits live in <b>this browser</b> until you publish them. '
      + "Publishing means saving the file below as <b>data/list.json</b> in the site folder and redeploying &mdash; then everyone who opens the site sees this list.</p>"
      + '<ol style="font-size:13px;color:var(--ink2);margin:0;padding-left:20px;display:grid;gap:4px">'
      + "<li>Press <b>Download data/list.json</b> (or copy the box).</li>"
      + "<li>Put the file in <b>mcl/data/list.json</b>, replacing the old one.</li>"
      + "<li>Drag the <b>mcl</b> folder onto Netlify again, or push it if you deploy from a repo.</li></ol>"
      + '<p style="font-size:12.5px;color:var(--ink2)">' + (baseAt
          ? "Last published from this browser: <b>" + new Date(baseAt).toLocaleString() + "</b>."
          : "<b>Nothing published from this browser yet.</b> Everything you have added so far is only visible to you.")
      + (unsaved ? "" : " This page is running on the shared live store, so changes are already visible to everyone who can open it.") + "</p>"
      + '<textarea id="pubjson" rows="7" class="mono" style="font-size:11px">' + esc(pub) + "</textarea>"
      + '<div class="acts"><button class="btn" data-download="' + stamp + '">Download data/list.json</button>'
      + '<button class="btn ghost" data-copy="pubjson">Copy to clipboard</button>'
      + '<button class="btn ghost" data-published="' + stamp + '">Mark as published</button></div></div>';

    /* ---- data ---- */
    var bk = M.readBackup();
    h += '<h2 class="sec" style="font-size:20px">Data</h2><div class="panel pad stack" style="max-width:720px">'
      + '<p style="font-size:13px;color:var(--ink2)">Paste a backup or an exported list here and load it. This replaces everything currently in this browser.</p>'
      + '<textarea id="dump" rows="4" class="mono" style="font-size:11px" placeholder="paste a backup here"></textarea>'
      + '<div class="acts"><button class="btn" data-import="1">Load pasted data</button>'
      + (bk ? '<button class="btn ghost" data-restore="1">Restore local backup (' + new Date(bk.publishedAt || 0).toLocaleString() + ")</button>" : "")
      + '<button class="btn ghost" data-wipe="all">Erase everything</button></div></div>';
    return h;
  }
  /* The gate: on your own site, editing means being signed in to the
     database, because that is what decides whether a change can be saved. */
  /* Who sent a submission, straight out of the login it was posted with -
     not something they typed, so it cannot be faked. */
  function senderHtml(p) {
    if (!p || !p.discordId) return "";
    return '<div style="font-size:12px;color:var(--ink2)">sent by ' + esc(p.discordName || "a Discord account")
      + ' <span class="mono">' + esc(p.discordId) + "</span></div>";
  }
  function blockBtn(p) {
    if (!p || !p.discordId || !M.canEdit()) return "";
    return '<button class="btn ghost sm" data-block="' + esc(p.discordId) + '" data-blockname="'
      + esc(p.discordName || "") + '" title="Stop this account from submitting anything">Block sender</button>';
  }

  /* Who may sign in and run the list. Owner is everything; a list mod gets
     the queue. Keyed on Discord id because that is the one name nobody else
     can take. */
  function staffPanel() {
    var cl = M.cloud;
    if (!cl || !cl.enabled()) return "";
    var rows = cl.staff || [], bans = cl.bans || [];
    var h = '<h2 class="sec" style="font-size:20px">Staff</h2><div class="panel pad stack" style="max-width:720px">'
      + '<p style="font-size:13px;color:var(--ink2)">Signing in is done with Discord, so nobody needs a password from you and nobody shares an account. '
      + "<b>Owner</b> can do everything. <b>List mod</b> works the queue and moves levels up and down - settings and staff are refused by the database, not just hidden on the page.</p>";
    h += rows.length
      ? '<div class="scroll"><table><thead><tr><th>Name</th><th>Discord id</th><th>Role</th><th></th></tr></thead><tbody>'
        + rows.map(function (r) {
            return "<tr><td style=\"font-weight:600\">" + esc(r.name || "-") + '</td><td class="mono">' + esc(r.discord_id) + "</td>"
              + "<td>" + esc(r.role) + "</td>"
              + '<td><button class="btn ghost sm" data-delstaff="' + esc(r.discord_id) + '">remove</button></td></tr>';
          }).join("")
        + "</tbody></table></div>"
      : '<p style="color:var(--ink2);font-size:13px">Nobody listed yet, which means anyone signed in counts as the owner. Add yourself.</p>';
    h += '<form class="stack" data-form="staff"><div class="fr">'
      + '<label>Name<input name="name" maxlength="30" placeholder="their name"></label>'
      + '<label>Discord id<input name="discordId" required inputmode="numeric" pattern="[0-9]{5,20}" placeholder="Discord user id"></label>'
      + '<label>Role<select name="role"><option value="mod">list mod</option><option value="owner">owner</option></select></label>'
      + '<label>&nbsp;<button class="btn" type="submit">Add</button></label></div></form>';

    h += '<h3 style="font-size:16px;margin-top:6px">Blocked from submitting</h3>';
    h += bans.length
      ? '<div class="scroll"><table><thead><tr><th>Name</th><th>Discord id</th><th>Reason</th><th></th></tr></thead><tbody>'
        + bans.map(function (b) {
            return "<tr><td>" + esc(b.name || "-") + '</td><td class="mono">' + esc(b.discord_id) + "</td>"
              + "<td>" + esc(b.reason || "") + "</td>"
              + '<td><button class="btn ghost sm" data-unblock="' + esc(b.discord_id) + '">unblock</button></td></tr>';
          }).join("")
        + "</tbody></table></div>"
      : '<p style="color:var(--ink2);font-size:13px">Nobody is blocked. Use <b>Block sender</b> on anything in the queue.</p>';
    return h + "</div>";
  }

  function vSignIn() {
    var cl = M.cloud, on = cl && cl.enabled();
    return '<h1 class="pg">Admin</h1>'
      + '<p class="sub">Staff sign in here. Everything you change then saves for everyone, straight away. Visitors never need this - they can still browse, use the roulette and submit records.</p>'
      + msgHtml()
      + (on ? '<div class="panel pad stack" style="max-width:420px;margin-bottom:14px">'
              + '<button class="btn discordbtn" data-dlogin="1">' + DISCORD_SVG + " Sign in with Discord</button>"
              + '<p style="font-size:12.5px;color:var(--ink2)">This is how staff sign in. If you are not staff it still works - you get your own profile page out of it, and the Admin page stays shut.</p>'
              + "</div>" : "")
      + '<details style="max-width:420px"><summary style="cursor:pointer;color:var(--ink2);font-size:13px">Sign in with an email account instead</summary>'
      + '<form class="panel pad stack" data-form="signin" style="max-width:420px;margin-top:10px">'
      + '<label>Email<input name="email" type="email" required autocomplete="username"></label>'
      + '<label>Password<input name="password" type="password" required autocomplete="current-password"></label>'
      + '<div><button class="btn" type="submit">Sign in</button></div></form>'
      + '<p style="font-size:12.5px;color:var(--ink2);margin-top:12px;max-width:56ch">The email and password made in Supabase under Authentication &rarr; Users. Still works, still counts as the owner.</p></details>';
  }

  /* ---------------- render ---------------- */
  M.render = function () {
    M.pendingRender = false;
    M.chrome();
    var v = UI.view, app = document.getElementById("app");
    if (v === "list" || v === "friends") {
      /* Two columns now, not three: the list is the page. A position in the
         url (/list/3) means a single level instead of the index. */
      var l = M.curList();
      app.innerHTML = '<div class="cols2"><section class="mid">'
        + (UI.pos ? levelPage(l) : listIndex(l))
        + '</section><aside class="right">' + rightHtml() + "</aside></div>";
    } else {
      var h = v === "home" ? vHome()
        : v === "board" ? vBoard() : v === "packs" ? vPacks() : v === "rules" ? vRules()
        : v === "roulette" ? vRoulette() : v === "submit" ? vSubmit()
        : v === "clans" ? vClans() : v === "admin" ? vAdmin()
        : v === "user" ? vUser() : v === "me" ? vMe() : vHome();
      app.innerHTML = '<div class="one ' + v + '">' + h + "</div>";
    }
    M.checkFrames();
    if (M.syncUrl) M.syncUrl();
  };
})(window.MCL);
