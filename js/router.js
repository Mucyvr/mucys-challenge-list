/* ===========================================================
   router.js - proper URLs for each section.

     /            the main list
     /list        the main list
     /friends     Mucy's Friends List
     /leaderboard /leaderboard/friends
     /roulette    /roulette/friends
     /packs       /packs/friends
     /rules
     /submit      /submit/challenge
     /admin

   On your own domain these are real paths (netlify.toml sends every
   unknown path to index.html so a refresh on /rules still works).
   Where a path cannot be used - the Claude preview, or a file opened
   straight from disk - the same routes live after a "#", e.g. #/rules.
   Old links to the bare site keep working either way.
   =========================================================== */
(function (M) {
  "use strict";

  /* view id  <->  url segment */
  var SEG = { home: "", list: "list", friends: "friends", board: "leaderboard", roulette: "roulette",
              packs: "packs", rules: "rules", submit: "submit", admin: "admin", clans: "clans",
              user: "u", me: "me" };
  var VIEW = {};
  Object.keys(SEG).forEach(function (v) { if (SEG[v]) VIEW[SEG[v]] = v; });
  /* which UI.tab key each view's second segment controls */
  var TAB = { board: "board", roulette: "roul", packs: "packs", submit: "submit" };

  /* Real paths only where the server will hand every path back to
     index.html. Everywhere else, hash routes. */
  function usePath() {
    if (location.protocol !== "http:" && location.protocol !== "https:") return false;
    if (/(^|\.)claude\.ai$/.test(location.hostname)) return false;
    if (document.documentElement.getAttribute("data-routing") === "hash") return false;
    return true;
  }
  var base = (function () {
    /* the folder index.html lives in, so the site also works from a subfolder */
    var p = location.pathname.replace(/index\.html$/, "");
    var known = Object.keys(VIEW).join("|");
    var m = p.match(new RegExp("^(.*?)/(" + known + ")(/[^/]*)?/?$", "i"));
    return (m ? m[1] : p.replace(/\/$/, "")) || "";
  })();

  M.base = base;

  M.hrefFor = function (view, tab) {
    if (view === "home") return usePath() ? (base + "/") : "#/";
    var seg = SEG[view] || "list";
    if (view === "clans") tab = tab ? String(tab).toUpperCase() : "";   /* /clans/MCL */
    if (view === "user") tab = tab ? encodeURIComponent(tab) : "";      /* /u/Mucy */
    /* a position on a list is part of the address: /list/3 */
    if (view === "list" || view === "friends") tab = tab ? String(parseInt(tab, 10) || "") : "";
    var path = "/" + seg + (tab && tab !== "main" && tab !== "record" ? "/" + tab : "");
    return usePath() ? (base + path) : "#" + path;
  };

  /* read the current url into UI.view / UI.tab */
  M.readUrl = function () {
    var UI = M.UI, raw;
    if (usePath()) {
      raw = location.pathname.slice(base.length);
    } else {
      raw = location.hash.replace(/^#/, "");
    }
    var parts = raw.replace(/^\/+|\/+$/g, "").toLowerCase().split("/");
    var view = parts[0] ? (VIEW[parts[0]] || "home") : "home";
    UI.view = view;
    /* /list/3 selects a level; /list on its own is the list itself */
    UI.pos = null;
    if (view === "list" || view === "friends") {
      var n = parseInt(parts[1], 10);
      if (n > 0) UI.pos = n;
    }
    if (view === "clans") UI.clan = parts[1] ? parts[1].toUpperCase() : null;
    /* the player name is not lower-cased away - a profile url keeps the
       capitals the person actually uses */
    if (view === "user") {
      var rawParts = raw.replace(/^\/+|\/+$/g, "").split("/");
      UI.user = rawParts[1] ? decodeURIComponent(rawParts[1]) : null;
    }
    var t = TAB[view];
    if (t) {
      var allowed = view === "submit" ? ["record", "challenge"]
        : view === "roulette" ? ["main", "friends", "both"]
        : view === "board" ? ["main", "friends", "nations"] : ["main", "friends"];
      /* no second segment means the default tab - otherwise the back button
         would land on /submit and get bounced straight to /submit/challenge */
      UI.tab[t] = allowed.indexOf(parts[1]) >= 0 ? parts[1] : allowed[0];
    }
    return view;
  };

  /* keep the address bar in step with the screen */
  function current() {
    if (!usePath()) return location.hash || "#/";
    var p = location.pathname.slice(base.length).replace(/index\.html$/, "");
    return base + (p === "" || p === "/" ? "/" : p.replace(/\/$/, ""));
  }
  M.syncUrl = function () {
    var UI = M.UI, t = TAB[UI.view];
    var want = M.hrefFor(UI.view, UI.view === "clans" ? UI.clan
                                : UI.view === "user" ? UI.user
                                : (UI.view === "list" || UI.view === "friends") ? UI.pos
                                : (t ? UI.tab[t] : null));
    if (current() === want) return;
    try { history.pushState(null, "", want); } catch (e) { /* host forbids it; page still works */ }
  };

  /* back / forward */
  window.addEventListener("popstate", function () {
    M.readUrl();
    M.UI.edit = null;
    M.render();
    window.scrollTo(0, 0);
  });
  window.addEventListener("hashchange", function () {
    if (usePath()) return;
    M.readUrl();
    M.UI.edit = null;
    M.render();
  });
})(window.MCL);
