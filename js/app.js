/* ===========================================================
   app.js - events, the roulette run, and start-up.
   =========================================================== */
(function (M) {
  "use strict";
  var UI = M.UI, chal = M.chal, listOf = M.listOf, cfg = M.cfg;

  function go(v, pos) {
    UI.view = v;
    UI.pos = pos == null ? null : pos;
    UI.edit = null;
    M.render();
    window.scrollTo(0, 0);
  }

  function inboxRow(id) {
    var rows = (M.cloud && M.cloud.inbox) || [];
    for (var i = 0; i < rows.length; i++) if (rows[i].id === id) return rows[i];
    return null;
  }

  function linkDownload(text) {
    var blob = new Blob([text], { type: "application/json" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "list.json";
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  /* A copy of a submission for Netlify Forms, so it lands in the Netlify
     dashboard as well as in the queue. Only worth doing when the site is
     actually being served by Netlify - the site now lives on Cloudflare
     Pages, where this would be a POST to a path that does not exist on
     every single submission. The hidden forms in index.html stay, so
     moving back is nothing more than a redeploy. */
  function netlifyPost(formName, data) {
    try {
      if (location.protocol !== "http:" && location.protocol !== "https:") return;
      if (!/\.netlify\.app$|^netlify\./.test(location.hostname)) return;
      var body = new URLSearchParams(Object.assign({ "form-name": formName }, data)).toString();
      fetch("/", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: body })
        .catch(function () {});
    } catch (e) {}
  }

  /* ---------------- roulette ---------------- */
  function drawNext() {
    var run = UI.run, pool = M.poolFor(run.list);
    if (run.pool === "legacy") pool = pool.filter(M.isLegacy);
    else if (run.pool !== "all") pool = pool.filter(function (c) { return c.pos <= parseInt(run.pool, 10); });
    if (!pool.length) pool = M.poolFor(run.list);
    var used = {};
    run.steps.forEach(function (s) { used[s.id] = 1; });
    var left = pool.filter(function (c) { return !used[c.id]; });
    if (!left.length) { endRun("You ran out of levels in that pool."); return false; }
    run.cur = left[Math.floor(Math.random() * left.length)].id;
    run.prewatch = false;     /* each new level starts hidden - pre-watching is a choice */
    return true;
  }
  function endRun(why) {
    var run = UI.run; if (!run) return;
    var beaten = run.steps.filter(function (s) { return !s.skip; }).length;
    var best = Math.round((run.best || 0) * 100) / 100;
    UI.run = null;
    if (beaten > 0) {
      M.put("runs", M.uid(), { list: run.list, player: run.player, beaten: beaten, best: best, at: Date.now() });
    }
    UI.msg = {
      t: "ok",
      s: why + " " + beaten + " level" + (beaten === 1 ? "" : "s") + " beaten, best " + best + "%"
        + (beaten > 0 ? " - saved to the board." : ".")
    };
    M.render();
  }

  /* ---------------- typing ---------------- */
  document.addEventListener("input", function (e) {
    var el = e.target;
    if (!el || el.id !== "q") return;
    UI.q = el.value;
    var box = document.querySelector(".side"), top = box ? box.scrollTop : 0;
    M.render();
    var q = document.getElementById("q");
    if (q) { q.focus(); q.setSelectionRange(q.value.length, q.value.length); }
    var b2 = document.querySelector(".side"); if (b2) b2.scrollTop = top;
  });
  document.addEventListener("change", function (e) {
    if (e.target && e.target.id === "basedf") { UI.based = e.target.value; M.render(); }
    if (e.target && e.target.hasAttribute && e.target.hasAttribute("data-thumbup")) uploadThumb(e.target);
  });

  /* Picking a thumbnail off your computer. The form is not re-rendered while
     this happens - that would throw away everything else you had typed - so
     the result is written straight into the two fields it affects. */
  function uploadThumb(input) {
    var file = input.files && input.files[0];
    if (!file) return;
    var id = input.getAttribute("data-thumbup");
    var msg = document.getElementById("thumbmsg");
    var box = document.querySelector('form[data-form="chal"] [name="thumb"]');
    var say = function (t, bad) {
      if (!msg) return;
      msg.textContent = t;
      msg.style.color = bad ? "var(--bad)" : "var(--ink2)";
    };
    if (!id) { say("Save the level first, then come back and add a thumbnail.", true); input.value = ""; return; }
    say("Resizing " + Math.round(file.size / 1024) + "KB...");
    M.shrinkImage(file, 480)
      .then(function (blob) {
        say("Uploading " + Math.round(blob.size / 1024) + "KB...");
        return M.cloud.uploadThumb(id, blob);
      })
      .then(function (url) {
        if (box) box.value = url;
        /* There may be no preview to update: a level with no thumbnail yet
           draws one, it 404s, and it takes itself off the page. Make one. */
        var prev = document.querySelector(".thumbprev");
        if (!prev) {
          var holder = document.querySelector(".thumbpick");
          if (holder) {
            prev = document.createElement("img");
            prev.className = "thumbprev";
            prev.alt = "";
            holder.insertBefore(prev, msg || null);
          }
        }
        if (prev) { prev.removeAttribute("data-alt"); prev.onerror = null; prev.src = url; }
        say("Uploaded. Press Save to keep it.");
      })
      .catch(function (err) { say(err.message || "That did not work.", true); })
      .then(function () { input.value = ""; });
  }
  /* country boxes: show the flag as soon as what you typed is a real country */
  document.addEventListener("input", function (e) {
    var el = e.target;
    if (!el || !el.hasAttribute || !el.hasAttribute("data-countrybox")) return;
    var cc = M.countryFromInput(el.value), img = el.parentNode && el.parentNode.querySelector("img.flag");
    if (!img) return;
    if (cc) { img.src = (M.base || "") + "/img/flags/" + cc.toLowerCase() + ".png"; img.alt = img.title = M.countryName(cc); img.style.display = ""; }
    else img.style.display = "none";
  });

  /* ---------------- clicks ---------------- */
  document.addEventListener("click", function (ev) {
    var t = ev.target.closest ? ev.target.closest(
      "[data-go],[data-tab],[data-sel],[data-based],[data-rec],[data-edit],[data-del],[data-mv],[data-new],[data-cancel]," +
      "[data-newpack],[data-editpack],[data-delpack],[data-delrec],[data-delrun],[data-deled],[data-ok],[data-no]," +
      "[data-acc],[data-rej],[data-import],[data-wipe],[data-roul],[data-download],[data-copy],[data-published]," +
      "[data-restore],[data-inok],[data-inacc],[data-inno],[data-signout],[data-pushnow]," +
      "[data-newclan],[data-editclan],[data-delclan],[data-play],[data-dlogin],[data-user],[data-openlvl]," +
      "[data-block],[data-unblock],[data-delstaff],[data-profwipe],[data-wipeprof],[data-wiperecs]," +
      "[data-pickthumb],[data-country],#adminbtn,#themebtn") : null;
    if (!t) return;
    var g;

    /* nav items are real links now: let ctrl/shift/middle-click open a tab,
       otherwise handle it in-page without a reload */
    if (t.tagName === "A" && (t.hasAttribute("data-go") || t.hasAttribute("data-tab"))) {
      if (ev.ctrlKey || ev.metaKey || ev.shiftKey || ev.altKey || ev.button === 1) return;
      ev.preventDefault();
    }

    if (t.hasAttribute("data-play")) { M.startPlayer(t); return; }
    if (t.id === "themebtn") {
      var next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      try { localStorage.setItem(M.themeKey, next); } catch (e) {}
      M.chrome(); return;
    }
    if (t.id === "adminbtn") { go("admin"); return; }
    if ((g = t.getAttribute("data-tab"))) {
      var p = g.split(":"); UI.tab[p[0]] = p[1]; UI.edit = null;
      if (!t.hasAttribute("data-go")) { M.render(); return; }
    }
    if ((g = t.getAttribute("data-go"))) {
      /* a row or a crumb carries which position it is going to */
      if (g === "list" || g === "friends") {
        var want = t.getAttribute("data-pos");
        go(g, want ? parseInt(want, 10) : null);
        return;
      }
      /* A link that goes somewhere about a particular clan or player carries
         which one alongside data-go, and this branch runs first - so read it
         here. Missing this was why every profile link landed on an empty
         "Player" page: the screen changed, the name never came with it. */
      if (g === "clans") UI.clan = t.getAttribute("data-clan") ? t.getAttribute("data-clan").toUpperCase() : null;
      if (g === "user" && t.getAttribute("data-user")) UI.user = t.getAttribute("data-user");
      go(g); return;
    }
    /* Discord sign-in leaves the page entirely and comes back with a token
       in the url - captureRedirect() picks it up on the way in. */
    if (t.hasAttribute("data-dlogin")) { M.cloud.signInDiscord(); return; }
    if ((g = t.getAttribute("data-user"))) { UI.user = g; go("user"); return; }
    if ((g = t.getAttribute("data-openlvl"))) {
      var oc = chal(g);
      if (oc) { UI.sel[oc.list] = oc.id; UI.view = oc.list === "friends" ? "friends" : "list"; UI.edit = null; M.render(); window.scrollTo(0, 0); }
      return;
    }
    if ((g = t.getAttribute("data-block"))) {
      var bname = t.getAttribute("data-blockname") || "";
      if (!confirm("Block " + (bname || g) + " from submitting anything? Their account is refused by the database until you unblock it.")) return;
      M.cloud.ban(g, bname, "blocked from the queue")
        .then(function () { UI.msg = { t: "ok", s: (bname || g) + " can no longer submit." }; M.render(); })
        .catch(function (e) { UI.msg = { t: "err", s: e.message }; M.render(); });
      return;
    }
    if ((g = t.getAttribute("data-wiperecs"))) {
      var mine = M.all("records").filter(function (r) { return M.key(r.player) === M.key(g); });
      if (!mine.length) { UI.msg = { t: "ok", s: "There are no records under that name." }; M.render(); return; }
      var verifs = M.listOf("main").concat(M.listOf("friends"))
        .filter(function (c) { return M.key(c.verifier) === M.key(g); });
      if (!confirm("Remove all " + mine.length + " record" + (mine.length === 1 ? "" : "s") + " by " + g + "?"
          + (verifs.length ? "\n\nThis does NOT touch the " + verifs.length + " level"
             + (verifs.length === 1 ? "" : "s") + " they are the verifier of - those are credited from the level itself, "
             + "so change the verifier on each level if that has to go too." : "")
          + "\n\nThis cannot be undone.")) return;
      mine.forEach(function (r) { M.drop("records", r.id); });
      UI.msg = { t: "ok", s: "Removed " + mine.length + " record" + (mine.length === 1 ? "" : "s") + " by " + g + "."
        + (verifs.length ? " Their " + verifs.length + " verification" + (verifs.length === 1 ? "" : "s") + " still stand." : "") };
      M.render(); return;
    }
    if ((g = t.getAttribute("data-wipeprof"))) {
      var wn = t.getAttribute("data-wipename") || "that account";
      if (!confirm("Delete everything " + wn + " wrote on their profile? Their records stay on the list - this is only the page they wrote about themselves.")) return;
      M.cloud.dropProfile(g)
        .then(function () { UI.msg = { t: "ok", s: "Profile deleted." }; M.render(); })
        .catch(function (e) { UI.msg = { t: "err", s: e.message }; M.render(); });
      return;
    }
    if ((g = t.getAttribute("data-unblock"))) {
      M.cloud.unban(g).then(function () { UI.msg = { t: "ok", s: "Unblocked." }; M.render(); });
      return;
    }
    if ((g = t.getAttribute("data-delstaff"))) {
      if (!confirm("Remove this person from staff? They keep their profile, they just cannot sign in to the queue any more.")) return;
      M.cloud.dropStaff(g)
        .then(function () { UI.msg = { t: "ok", s: "Removed from staff." }; M.render(); })
        .catch(function (e) { UI.msg = { t: "err", s: e.message }; M.render(); });
      return;
    }
    if (t.hasAttribute("data-profwipe")) {
      if (!confirm("Take your profile down? Everything you published is deleted. The list still shows your records - that is the list's, not your profile's.")) return;
      M.cloud.saveProfile({})
        .then(function () { UI.msg = { t: "ok", s: "Your profile is down." }; M.render(); })
        .catch(function (e) { UI.msg = { t: "err", s: e.message }; M.render(); });
      return;
    }
    if (t.hasAttribute("data-country")) {
      UI.country = t.getAttribute("data-country") || null;
      if (UI.country && UI.tab.board === "nations") UI.tab.board = "main";
      M.render(); window.scrollTo(0, 0); return;
    }
    if (t.hasAttribute("data-newclan")) { UI.edit = { _clan: true, members: [] }; M.render(); return; }
    if ((g = t.getAttribute("data-editclan"))) { UI.edit = Object.assign({ _clan: true }, M.S.clans[g]); M.render(); return; }
    if ((g = t.getAttribute("data-delclan"))) {
      var cl = M.S.clans[g];
      if (cl && confirm("Delete the clan " + cl.name + "? Members keep their records, they just lose the tag.")) { UI.clan = null; M.drop("clans", g); }
      return;
    }
    if ((g = t.getAttribute("data-based"))) { UI.based = UI.based === g ? "" : g; M.render(); return; }
    if ((g = t.getAttribute("data-sel"))) {
      UI.sel[M.curList()] = g; UI.edit = null; M.render();
      var mid = document.querySelector(".mid"); if (mid) mid.scrollIntoView({ block: "start" });
      return;
    }
    if ((g = t.getAttribute("data-rec"))) {
      UI.tab.submit = "record"; UI.view = "submit"; UI.edit = null; M.render();
      var sel = document.querySelector('[name="cid"]'); if (sel) sel.value = g;
      window.scrollTo(0, 0); return;
    }
    if ((g = t.getAttribute("data-edit"))) { UI.edit = Object.assign({}, chal(g)); M.render(); return; }
    if (t.hasAttribute("data-cancel")) { UI.edit = null; M.render(); return; }
    /* A new level gets its id now rather than on save, so the thumbnail
       picker has somewhere to put the file. chal() will not find it yet, so
       saving still counts as adding rather than editing. */
    if ((g = t.getAttribute("data-new"))) { UI.edit = { list: g, id: M.uid() }; M.render(); return; }
    if (t.hasAttribute("data-pickthumb")) {
      var fi = document.getElementById("thumbfile");
      if (fi) fi.click();
      return;
    }
    if ((g = t.getAttribute("data-del"))) {
      var c2 = chal(g);
      if (c2 && confirm("Delete " + c2.name + "?")) {
        var l = c2.list; UI.sel[l] = null;
        M.reposition(l, { id: g, name: c2.name, kind: "remove" }, function () { delete M.S.challenges[g]; });
        M.drop("challenges", g);   /* persists the removal (cloud / local) and re-renders */
      }
      return;
    }
    if ((g = t.getAttribute("data-mv"))) {
      var q2 = g.split(":"), c3 = chal(q2[0]), dir = parseInt(q2[1], 10), arr = listOf(c3.list),
          i = arr.indexOf(c3), j = i + dir;
      if (i < 0 || j < 0 || j >= arr.length) return;
      var a = arr[i], b = arr[j];
      M.reposition(c3.list, { id: a.id, name: a.name, kind: "move", reason: "Moved " + (dir < 0 ? "up" : "down") }, function () {
        var ap = a.pos; a.pos = b.pos; b.pos = ap;
      });
      return;
    }
    if ((g = t.getAttribute("data-newpack"))) { UI.edit = { list: g, _pack: true }; M.render(); return; }
    if ((g = t.getAttribute("data-editpack"))) { UI.edit = Object.assign({ _pack: true }, M.S.packs[g]); M.render(); return; }
    if ((g = t.getAttribute("data-delpack"))) { if (confirm("Delete this pack?")) M.drop("packs", g); return; }
    if ((g = t.getAttribute("data-delrec"))) { if (confirm("Remove this record?")) M.drop("records", g); return; }
    if ((g = t.getAttribute("data-delrun"))) { if (confirm("Remove this run?")) M.drop("runs", g); return; }
    if ((g = t.getAttribute("data-deled"))) { M.drop("editors", g); return; }
    if ((g = t.getAttribute("data-ok"))) {
      var rec0 = M.S.records[g];
      if (rec0 && rec0.country && !M.player(rec0.player)) M.put("players", M.key(rec0.player), { name: String(rec0.player).trim(), country: rec0.country });
      M.put("records", g, Object.assign({}, M.S.records[g], { status: "approved" }));
      UI.msg = { t: "ok", s: "Record accepted." }; M.render(); return;
    }
    if ((g = t.getAttribute("data-no"))) { M.drop("records", g); UI.msg = { t: "ok", s: "Record rejected." }; M.render(); return; }
    if ((g = t.getAttribute("data-acc"))) {
      var s = M.S.submissions[g], box = document.querySelector('[data-pos="' + g + '"]'),
          pos = Math.max(1, parseInt(box && box.value, 10) || 1),
          arr2 = listOf("friends");
      pos = Math.min(pos, arr2.length + 1);
      var nid = M.uid();
      M.reposition("friends", { id: nid, name: s.name, kind: "add" }, function () {
        arr2.forEach(function (x) { if (x.pos >= pos) x.pos++; });
        M.S.challenges[nid] = { id: nid, list: "friends", pos: pos, name: s.name, creator: s.creator, verifier: s.verifier, publisher: s.by,
          basedOn: s.basedOn || "", fps: s.fps || "", levelId: s.levelId || "", version: "2.2", device: "All",
          webcam: !!s.webcam,
          req: 100, top: s.top, video: s.video, note: s.note };
      });
      M.drop("submissions", g);
      UI.msg = { t: "ok", s: s.name + " placed at #" + pos + " on the Friends List." };
      M.render(); return;
    }
    if ((g = t.getAttribute("data-rej"))) { M.drop("submissions", g); UI.msg = { t: "ok", s: "Submission rejected." }; M.render(); return; }
    /* ---- submissions that arrived from the live site ---- */
    if ((g = t.getAttribute("data-inok"))) {
      var row = inboxRow(g); if (!row) return;
      var p = row.payload || {}, ch2 = chal(p.cid);
      if (!ch2) return;
      if (p.country && !M.player(p.player)) M.put("players", M.key(p.player), { name: String(p.player).trim(), country: p.country });
      M.put("records", M.uid(), {
        list: ch2.list, player: p.player, cid: p.cid, pct: Math.max(1, Math.min(100, parseInt(p.pct, 10) || 100)),
        fps: p.fps, device: p.device, country: p.country || "", video: p.video, medal: !!p.medal, discord: !!p.discord,
        status: "approved", at: Date.now()
      });
      M.cloud.clearInbox(g).then(function () { M.render(); });
      UI.msg = { t: "ok", s: "Record accepted." }; M.render(); return;
    }
    if ((g = t.getAttribute("data-inacc"))) {
      var row2 = inboxRow(g); if (!row2) return;
      var s2 = row2.payload || {}, box2 = document.querySelector('[data-pos="' + g + '"]'),
          pos2 = Math.max(1, parseInt(box2 && box2.value, 10) || 1), arr3 = listOf("friends");
      pos2 = Math.min(pos2, arr3.length + 1);
      var nid2 = M.uid();
      M.reposition("friends", { id: nid2, name: s2.name, kind: "add" }, function () {
        arr3.forEach(function (x) { if (x.pos >= pos2) x.pos++; });
        M.S.challenges[nid2] = { id: nid2, list: "friends", pos: pos2, name: s2.name, creator: s2.creator, verifier: s2.verifier, publisher: s2.by,
          basedOn: s2.basedOn || "", fps: s2.fps || "", levelId: s2.levelId || "", version: "2.2", device: "All",
          webcam: !!s2.webcam,
          req: 100, top: s2.top, video: s2.video, note: s2.note };
      });
      M.cloud.clearInbox(g).then(function () { M.render(); });
      UI.msg = { t: "ok", s: s2.name + " placed at #" + pos2 + " on the Friends List." }; M.render(); return;
    }
    if ((g = t.getAttribute("data-inno"))) {
      M.cloud.clearInbox(g).then(function () { UI.msg = { t: "ok", s: "Submission rejected." }; M.render(); });
      return;
    }
    if (t.hasAttribute("data-signout")) { M.cloud.signOut(); UI.msg = { t: "ok", s: "Signed out of the cloud." }; M.render(); return; }
    if (t.hasAttribute("data-pushnow")) {
      M.cloud.push().then(function () { UI.msg = { t: "ok", s: "Saved to the cloud." }; M.render(); })
        .catch(function (e) { UI.msg = { t: "err", s: e.message || "Could not save." }; M.render(); });
      return;
    }
    if ((g = t.getAttribute("data-download"))) {
      var stamp = parseInt(g, 10) || Date.now();
      var text = JSON.stringify(M.snapshot(stamp), null, 1);
      var done = function () {
        M.S.meta = Object.assign({}, M.S.meta, { baseAt: stamp }); M.lsWrite();
        UI.msg = { t: "ok", s: "Saved. Put it in mcl/data/list.json and redeploy - then everyone sees this list." };
        M.render();
      };
      /* In the Claude artifact viewer a plain <a download> is inert, so ask
         the host to hand the file over instead. Everywhere else (Netlify,
         localhost, a file on disk) the link works normally. */
      if (window.claude && typeof window.claude.use === "function") {
        window.claude.use("downloads").then(function (dl) {
          if (dl) dl.save({ filename: "list.json", data: text }).then(done).catch(function () {});
          else { linkDownload(text); done(); }
        }).catch(function () { linkDownload(text); done(); });
      } else { linkDownload(text); done(); }
      return;
    }
    if ((g = t.getAttribute("data-copy"))) {
      var ta = document.getElementById(g);
      if (ta) {
        ta.select();
        if (navigator.clipboard) navigator.clipboard.writeText(ta.value).catch(function () {});
        else try { document.execCommand("copy"); } catch (e) {}
        UI.msg = { t: "ok", s: "Copied. Paste it into mcl/data/list.json and redeploy." };
        M.render();
      }
      return;
    }
    if ((g = t.getAttribute("data-published"))) {
      M.S.meta = Object.assign({}, M.S.meta, { baseAt: parseInt(g, 10) || Date.now() }); M.lsWrite();
      UI.msg = { t: "ok", s: "Marked as published." }; M.render(); return;
    }
    if (t.hasAttribute("data-restore")) {
      var bk = M.readBackup();
      if (!bk) return;
      if (!confirm("Replace what is in this browser with the backup?")) return;
      M.applySnapshot(bk, (M.S.meta && M.S.meta.baseAt) || 0);
      UI.msg = { t: "ok", s: "Backup restored." }; M.render(); return;
    }
    if (t.hasAttribute("data-import")) {
      try {
        var o = JSON.parse(document.getElementById("dump").value);
        ["config"].concat(M.COLLS).forEach(function (k) { if (o[k] && typeof o[k] === "object") M.S[k] = o[k]; });
        if (M.DB) {
          M.DB.doc("site/config").set(cfg()).catch(M.dbfail);
          M.COLLS.forEach(function (cl) {
            Object.keys(M.S[cl]).forEach(function (k) { M.DB.doc(cl + "/" + k).set(M.S[cl][k]).catch(M.dbfail); });
          });
        } else M.lsWrite();
        UI.msg = { t: "ok", s: "Data loaded." };
      } catch (e) {
        UI.msg = { t: "err", s: "That is not valid JSON - paste the whole block, outer braces included." };
      }
      M.render(); return;
    }
    if ((g = t.getAttribute("data-wipe"))) {
      if (!confirm("Erase all challenges, records, packs, editors and runs?")) return;
      M.COLLS.forEach(function (cl) { Object.keys(M.S[cl]).forEach(function (k) { M.drop(cl, k); }); });
      UI.sel = { main: null, friends: null };
      UI.msg = { t: "ok", s: "Everything erased." }; M.render(); return;
    }
    if ((g = t.getAttribute("data-roul"))) {
      var run = UI.run; if (!run) return;
      if (g === "end") { endRun("Run ended."); return; }
      if (g === "prewatch") { run.prewatch = !run.prewatch; M.render(); return; }
      if (g === "skip") {
        var cc = chal(run.cur);
        run.steps.push({ id: run.cur, name: cc ? cc.name : "?", req: run.need, skip: true });
        run.skips--;
        if (drawNext()) M.render();
      }
      return;
    }
  });

  /* ---------------- forms ---------------- */
  document.addEventListener("submit", function (ev) {
    var f = ev.target, kind = f.getAttribute && f.getAttribute("data-form");
    if (!kind) return;
    ev.preventDefault();
    var d = {};
    Array.prototype.forEach.call(f.elements, function (el) {
      if (!el.name) return;
      if (el.type === "checkbox") d[el.name] = el.checked;
      else if (el.multiple) d[el.name] = Array.prototype.filter.call(el.options, function (o) { return o.selected; })
        .map(function (o) { return o.value; });
      else d[el.name] = String(el.value).trim();
    });

    if (kind === "cfg") {
      var patch = {
        title: d.title, ver: d.ver, blurb: d.blurb, discord: d.discord, studio: d.studio,
        legacyAfter: Math.max(1, parseInt(d.legacyAfter, 10) || 150)
      };
      M.putCfg(patch);
      document.title = d.title || "Mucy's Challenge List";
      UI.msg = { t: "ok", s: "Settings saved." }; M.render(); return;
    }
    if (kind === "cloud") {
      M.putCfg({ supaUrl: d.supaUrl, supaKey: d.supaKey });
      UI.msg = {
        t: "ok",
        s: d.supaUrl ? "Cloud settings saved. Sign in below, then publish once so visitors get these settings."
                     : "Cloud saving turned off."
      };
      M.render(); return;
    }
    if (kind === "signin") {
      M.cloud.signIn(d.email, d.password).then(function () {
        UI.msg = { t: "ok", s: "Signed in. Changes now save for everyone automatically." };
        M.cloud.loadInbox();
        return M.cloud.pull().then(function () { M.render(); });
      }).catch(function (e) {
        UI.msg = { t: "err", s: e.message || "Sign-in failed. Check the email and password you made in Supabase." };
        M.render();
      });
      return;
    }
    if (kind === "clan") {
      var tag = M.normTag(d.tag);
      if (!tag) { UI.msg = { t: "err", s: "The tag needs 1 to 4 letters or digits." }; M.render(); return; }
      var clash = M.clanByTag(tag);
      if (clash && clash.id !== d.id) { UI.msg = { t: "err", s: "Another clan already uses the tag " + tag + "." }; M.render(); return; }
      var members = String(d.members || "").split(/\r?\n|,/).map(function (x) { return x.trim(); }).filter(Boolean);
      /* one clan per person - drop them from any other clan first */
      M.all("clans").forEach(function (other) {
        if (other.id === d.id) return;
        var kept = (other.members || []).filter(function (m) { return !members.some(function (n) { return M.key(n) === M.key(m); }); });
        if (kept.length !== (other.members || []).length) M.put("clans", other.id, Object.assign({}, other, { members: kept }));
      });
      var cid = d.id || M.uid();
      M.put("clans", cid, { name: d.name, tag: tag, color: d.color, desc: d.desc, members: members });
      UI.edit = null; UI.clan = tag;
      UI.msg = { t: "ok", s: d.name + " (" + tag + ") saved with " + members.length + " member" + (members.length === 1 ? "" : "s") + "." };
      M.render(); return;
    }
    if (kind === "country") {
      var k = M.key(d.name);
      if (!k) return;
      var cc = M.countryFromInput(d.country);
      if (d.country && !cc) { UI.msg = { t: "err", s: "\"" + d.country + "\" is not a country I know - pick one from the list." }; M.render(); return; }
      M.put("players", k, Object.assign({}, M.S.players[k] || {}, { name: String(d.name).trim(), country: cc }));
      UI.msg = { t: "ok", s: cc ? d.name + " is now " + M.countryName(cc) + "." : "Country cleared for " + d.name + "." };
      M.render(); return;
    }
    if (kind === "linkprofile") {
      if (!d.name) { UI.msg = { t: "err", s: "Pick who that profile belongs to first." }; M.render(); return; }
      var lk = M.key(d.name), was = M.S.players[lk] || { name: String(d.name).trim() };
      M.put("players", lk, Object.assign({}, was, { name: was.name || String(d.name).trim(),
        discordId: String(d.discordId || "").replace(/[^0-9]/g, "") }));
      UI.msg = { t: "ok", s: d.name + " is linked - their profile shows on their name now." };
      M.render(); return;
    }
    if (kind === "discordid") {
      var pk = M.key(d.name), prev = M.S.players[pk] || { name: String(d.name).trim() };
      var did = String(d.discordId || "").replace(/[^0-9]/g, "");
      M.put("players", pk, Object.assign({}, prev, { name: prev.name || String(d.name).trim(), discordId: did }));
      UI.msg = { t: "ok", s: did ? d.name + " is linked to Discord id " + did + "." : "Discord id cleared for " + d.name + "." };
      M.render(); return;
    }
    if (kind === "staff") {
      var sid = String(d.discordId || "").replace(/[^0-9]/g, "");
      if (!sid) { UI.msg = { t: "err", s: "That does not look like a Discord user id." }; M.render(); return; }
      M.cloud.setStaff(sid, d.name, d.role === "owner" ? "owner" : "mod")
        .then(function () { UI.msg = { t: "ok", s: (d.name || sid) + " is now " + (d.role === "owner" ? "an owner" : "a list mod") + "." }; M.render(); })
        .catch(function (e) { UI.msg = { t: "err", s: e.message }; M.render(); });
      return;
    }
    if (kind === "profile") {
      var built = M.buildProfile(d);
      M.saveDraft(built.draft);
      M.cloud.saveProfile(built.pub)
        .then(function () { UI.msg = { t: "ok", s: "Saved. Your page shows what you filled in and nothing else." }; M.render(); })
        .catch(function (e) { UI.msg = { t: "err", s: e.message }; M.render(); });
      return;
    }
    if (kind === "editor") {
      M.put("editors", M.uid(), { name: d.name, role: d.role, order: M.all("editors").length });
      UI.msg = { t: "ok", s: d.name + " added." }; M.render(); return;
    }
    if (kind === "chal") {
      var chFps = M.normFps(d.fps);
      if (chFps === null) { UI.msg = { t: "err", s: "FPS: " + M.FPS_HELP }; M.render(); return; }
      var l = d.list, id = d.id || M.uid(), pos = Math.max(1, parseInt(d.pos, 10) || 1);
      var existing = d.id ? chal(d.id) : null;
      var others = listOf(l).filter(function (x) { return x.id !== id; });
      pos = Math.min(pos, others.length + 1);
      var body = {
        id: id, list: l, pos: pos, name: d.name, creator: d.creator, verifier: d.verifier, publisher: d.publisher,
        basedOn: M.clean(d.basedOn, 24), fps: chFps, version: M.clean(d.version, 8),
        device: M.clean(d.device, 16), levelId: M.clean(d.levelId, 20), thumb: d.thumb,
        webcam: d.webcam === "yes",
        req: parseInt(d.req, 10) || 100, top: d.top ? parseInt(d.top, 10) : null, video: d.video, note: d.note,
        history: existing ? existing.history || [] : []
      };
      var cause = existing ? { id: id, name: d.name, kind: existing.pos === pos ? "edit" : "move", reason: "Moved" }
                           : { id: id, name: d.name, kind: "add" };
      M.reposition(l, cause, function () {
        others.forEach(function (x, i) { x.pos = i + 1 >= pos ? i + 2 : i + 1; });
        M.S.challenges[id] = body;
      });
      UI.sel[l] = id; UI.edit = null;
      UI.msg = { t: "ok", s: d.name + " saved at #" + pos + "." }; M.render(); return;
    }
    if (kind === "pack") {
      M.put("packs", d.id || M.uid(), { list: d.list, name: d.name, color: d.color, desc: d.desc, ids: d.ids || [] });
      UI.edit = null; UI.msg = { t: "ok", s: "Pack saved." }; M.render(); return;
    }
    if (kind === "record") {
      d.video = M.fixUrl(d.video);
      var c4 = chal(d.cid);
      if (!c4) { UI.msg = { t: "err", s: "Pick a challenge first." }; M.render(); return; }
      var pct = Math.max(1, Math.min(100, parseInt(d.pct, 10) || 100));
      var fps = M.normFps(d.fps);
      if (fps === null) { UI.msg = { t: "err", s: "FPS: " + M.FPS_HELP }; M.render(); return; }
      /* The clip is the one thing that is not optional - it just does not
         have to be the Discord any more. A link or a "sent it" tick will do. */
      if (!M.safeUrl(d.video) && !d.discord) {
        UI.msg = { t: "err", s: "Add a clip link, or tick the box to say you sent it in the Discord or DMs." };
        M.render(); return;
      }
      if (d.video && !M.clipHostOk(d.video)) {
        UI.msg = { t: "err", s: M.CLIP_HELP };
        M.render(); return;
      }
      var meRec = M.me() || {};
      var rec = {
        list: c4.list, player: M.clean(d.player, 24), cid: d.cid, cname: c4.name, pct: pct,
        fps: fps, device: M.cleanDevice(d.device), country: M.countryFromInput(d.country),
        video: M.clean(d.video, 300), medal: !!d.medal, discord: !!d.discord,
        status: "pending", at: Date.now(),
        discordId: meRec.discordId || "", discordName: M.clean(meRec.name, 40)
      };
      /* With the cloud on, this goes straight to Mucy's queue on the live
         site. Without it, it waits in this browser and Netlify Forms. */
      if (M.cloud.useInbox()) M.cloud.submit("record", rec).catch(function () { M.put("records", M.uid(), rec); });
      else M.put("records", M.uid(), rec);
      netlifyPost("mcl-record", {
        player: d.player, challenge: "#" + c4.pos + " " + c4.name, percent: pct + "%",
        fps: d.fps || "", device: d.device || "", clip: d.video || "", notes: d.medal ? "medal clip" : ""
      });
      UI.msg = { t: "ok", s: "Sent. " + d.player + " - " + pct + "% on " + c4.name + " is in the queue for Mucy to check." };
      M.render(); return;
    }
    if (kind === "challenge") {
      d.video = M.fixUrl(d.video);
      var subFps = M.normFps(d.fps);
      if (subFps === null) { UI.msg = { t: "err", s: "FPS: " + M.FPS_HELP }; M.render(); return; }
      if (d.video && !M.clipHostOk(d.video)) {
        UI.msg = { t: "err", s: M.CLIP_HELP };
        M.render(); return;
      }
      var meSub = M.me() || {};
      var sub = {
        name: M.clean(d.name, 60), creator: M.clean(d.creator, 40), verifier: M.clean(d.verifier, 40),
        basedOn: M.clean(d.basedOn, 24), video: M.clean(d.video, 300),
        webcam: d.webcam === "yes",
        discordId: meSub.discordId || "", discordName: M.clean(meSub.name, 40),
        levelId: M.clean(d.levelId, 20), fps: subFps,
        top: Math.max(1, Math.min(1000, parseInt(d.top, 10) || 1)),
        by: M.clean(d.by, 24), note: M.clean(d.note, 400, true),
        honest: !!d.honest, possible: !!d.possible, status: "pending", at: Date.now()
      };
      if (M.cloud.useInbox()) M.cloud.submit("challenge", sub).catch(function () { M.put("submissions", M.uid(), sub); });
      else M.put("submissions", M.uid(), sub);
      netlifyPost("mcl-challenge", {
        name: d.name, creator: d.creator, verifier: d.verifier, basedOn: d.basedOn || "", levelId: d.levelId || "",
        fps: d.fps || "", top: d.top || "", video: d.video || "", by: d.by, notes: d.note || "",
        webcam: d.webcam === "yes" ? "yes" : "no"
      });
      UI.msg = { t: "ok", s: d.name + " is in the Friends List queue. Post the verification in the Discord too." };
      M.render(); return;
    }
    if (kind === "start") {
      UI.run = { list: d.list, player: d.player, pool: d.pool, skips: parseInt(d.skips, 10) || 0, steps: [], cur: null, best: 0, need: 1 };
      if (drawNext()) M.render();
      return;
    }
    if (kind === "pct") {
      var run = UI.run; if (!run) return;
      var req = run.need || 1, got = parseFloat(d.pct);
      if (isNaN(got) || got < 0 || got > 100) { UI.msg = { t: "err", s: "Type a percent between 0 and 100." }; M.render(); return; }
      run.best = Math.max(run.best || 0, got);
      var cur = chal(run.cur);
      if (got < req) {
        endRun("Run over - " + got + "% on " + (cur ? cur.name : "that level") + ", needed " + req + "%.");
        return;
      }
      run.steps.push({ id: run.cur, name: cur ? cur.name : "?", req: req, got: got, skip: false });
      /* The next level needs one more than you actually got on this one - so
         41% here means 42% next, not "step 2 needs 2%". */
      run.need = Math.round((got + 1) * 100) / 100;
      if (run.need > 100) { endRun("You cleared 100% and finished the roulette."); return; }
      if (drawNext()) M.render();
      return;
    }
  });

  /* ---------------- start-up ---------------- */
  function boot() {
    try { var th = localStorage.getItem(M.themeKey); if (th) document.documentElement.setAttribute("data-theme", th); } catch (e) {}
    M.lsRead();
    if (!M.S.config || !M.S.config.title) M.S.config = Object.assign({}, M.DEF_CFG);
    document.title = cfg().title || "Mucy's Challenge List";
    M.readUrl();               /* /rules, /friends, #/leaderboard/friends ... */
    M.render();
    loadPublished();
    connectDb();
    startCloud();
  }

  /* Live saving through Supabase, when it has been set up. The list is
     pulled on load, whenever the tab regains focus, and once a minute -
     so a friend's browser picks up your edits without a redeploy. */
  function startCloud() {
    if (!M.cloud.enabled()) return;
    /* Coming back from Discord: the token is in the url fragment. Take it
       before anything reads the url as a route. */
    if (M.cloud.captureRedirect()) {
      M.readUrl();
      M.UI.msg = { t: "ok", s: "Signed in with Discord." };
    }
    /* Who is staff and what everyone chose to show. Both are public reads, so
       they work signed out - that is what makes profiles visible to visitors. */
    M.cloud.loadStaff().then(function () { M.renderIfIdle(); });
    M.cloud.loadProfiles().then(function () { M.renderIfIdle(); });
    if (M.cloud.signedIn()) M.cloud.loadBans().then(function () { M.renderIfIdle(); });
    var sync = function () {
      if (M.DB) return;
      M.cloud.pull().then(function (changed) { if (changed) M.renderIfIdle(); });
      if (M.cloud.signedIn()) M.cloud.loadInbox();
    };
    sync();
    window.addEventListener("focus", sync);
    setInterval(sync, 60000);
  }

  /* The published list that ships with the site. Every visitor gets this;
     it is what makes the list public rather than personal. */
  function loadPublished() {
    if (location.protocol === "file:") return;   /* fetch is blocked on file:// */
    /* With the cloud on, the database is the truth. Loading the shipped file
       as well would race it and could briefly show a stale or empty list. */
    if (M.cloud.enabled()) return;
    fetch("data/list.json", { cache: "no-store" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (file) {
        if (!file || typeof file !== "object") return;
        var pub = file.publishedAt || 0, meta = M.S.meta || {};
        if (!M.hasLocalWork()) {                 /* first visit - just take it */
          M.applySnapshot(file, pub); M.render(); return;
        }
        if (meta.baseAt == null) {               /* existing work from before publishing existed */
          M.S.meta = Object.assign({}, meta, { baseAt: pub }); M.lsWrite(); return;
        }
        if (pub > meta.baseAt) {                 /* a newer list was published */
          if (M.unpublished()) {
            M.stashBackup();
            M.UI.msg = { t: "ok", s: "A newer published list was loaded. Your unpublished changes were kept - Admin -> Data -> Restore local backup." };
          }
          M.applySnapshot(file, pub); M.render();
        }
      })
      .catch(function () { /* no data/list.json yet - run on local only */ });
  }

  function connectDb() {
    /* The shared live store only exists when this page is opened as a
       Claude artifact. On Netlify this whole block is skipped and the
       site runs on the published file plus localStorage. */
    var cl = window.claude;
    if (!cl || typeof cl.use !== "function") return;
    cl.use("db").then(function (db) {
      if (!db) return;
      var local = {}; M.COLLS.forEach(function (k) { local[k] = M.S[k]; });
      var lc = cfg();
      db.doc("site/config").get().then(function (snap) {
        M.DB = db; M.MODE = "db";
        if (!snap.exists) {
          db.doc("site/config").set(lc).catch(function () {});
          M.COLLS.forEach(function (c2) {
            Object.keys(local[c2]).forEach(function (k) { db.doc(c2 + "/" + k).set(local[c2][k]).catch(function () {}); });
          });
        }
        db.doc("site/config").onSnapshot(function (s) { if (s.exists) { M.S.config = s.data(); M.render(); } }, M.dbfail);
        M.COLLS.forEach(function (c2) {
          db.collection(c2).onSnapshot(function (q) {
            var m = {};
            q.docs.forEach(function (dd) { var v = Object.assign({}, dd.data()); v.id = dd.id; m[dd.id] = v; });
            M.S[c2] = m; M.render();
          }, M.dbfail);
        });
      }).catch(function () { M.DB = null; M.MODE = "local"; M.render(); });
    }).catch(function () {});
  }
  /* A form that fails a check is redrawn to show the error - and the redraw
     used to throw away everything typed into it, so one bad field cost the
     whole form. This runs after the submit handler above: the old form is
     detached but still holds what was typed, so copy it into the new one. */
  document.addEventListener("submit", function (ev) {
    var old = ev.target, kind = old.getAttribute && old.getAttribute("data-form");
    /* UI.msg is used up by the redraw, so ask the page: an error box means a check failed */
    if (!kind || document.contains(old) || !document.querySelector("#app .msg.err")) return;
    var now = document.querySelector('#app form[data-form="' + kind + '"]');
    if (!now) return;
    Array.prototype.forEach.call(old.elements, function (el) {
      if (!el.name || el.type === "file" || el.type === "submit" || el.type === "hidden") return;
      var to = now.elements.namedItem(el.name);
      if (!to) return;
      if (!to.tagName) {                 // several fields share the name (radios): match by value
        if (el.type === "radio" && el.checked) Array.prototype.forEach.call(to, function (r) { if (r.value === el.value) r.checked = true; });
        return;
      }
      if (el.type === "checkbox") to.checked = el.checked;
      else if (el.multiple) Array.prototype.forEach.call(to.options, function (o, i) { o.selected = !!(el.options[i] && el.options[i].selected); });
      else {
        to.value = el.value;
        /* the country box draws its flag on input, so tell it */
        if (to.hasAttribute("data-countrybox")) to.dispatchEvent(new Event("input", { bubbles: true }));
      }
    });
  });

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})(window.MCL);
