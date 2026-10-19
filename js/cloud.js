/* ===========================================================
   cloud.js - live shared saving through Supabase.

   Two tables (see supabase.sql):
     mcl_state  one row holding the whole list as JSON.
                Anyone may read it. Only you, signed in, may change it.
     mcl_inbox  submissions from anyone. Anyone may drop one in;
                only you can read them back and delete them.

   Nothing secret ships to visitors: the anon key is a public key, and
   the only thing it can do on its own is read the list and post a
   submission. Your password never leaves the sign-in box - the site
   keeps the session token it gets back, in your browser only.
   =========================================================== */
(function (M) {
  "use strict";

  var AUTH_KEY = "mcl.auth";
  var C = M.cloud = {};
  var session = null;      /* {access_token, refresh_token, exp} */
  var pushTimer = null;
  var pulling = false;

  try { session = JSON.parse(localStorage.getItem(AUTH_KEY) || "null"); } catch (e) { session = null; }

  function conf() {
    var c = M.cfg();
    var url = String(c.supaUrl || "").trim().replace(/\/+$/, "");
    var key = String(c.supaKey || "").trim();
    return (/^https?:\/\/.+/.test(url) && key) ? { url: url, key: key } : null;
  }
  C.enabled = function () { return !!conf(); };
  C.signedIn = function () { return !!(session && session.access_token); };
  C.status = function () {
    if (M.DB) return "artifact";
    if (!conf()) return "off";
    return C.signedIn() ? "live-admin" : "live";
  };

  function headers(cfg, json) {
    var h = { apikey: cfg.key, Authorization: "Bearer " + ((session && session.access_token) || cfg.key) };
    if (json) { h["Content-Type"] = "application/json"; h.Prefer = "return=minimal"; }
    return h;
  }
  function saveSession(s) {
    session = s ? { access_token: s.access_token, refresh_token: s.refresh_token, exp: Date.now() + (s.expires_in || 3600) * 1000 } : null;
    try {
      if (session) localStorage.setItem(AUTH_KEY, JSON.stringify(session));
      else localStorage.removeItem(AUTH_KEY);
    } catch (e) {}
  }

  /* ---------------- auth ---------------- */
  C.signIn = function (email, password) {
    var cfg = conf();
    if (!cfg) return Promise.reject(new Error("Cloud is not set up yet."));
    return fetch(cfg.url + "/auth/v1/token?grant_type=password", {
      method: "POST",
      headers: { apikey: cfg.key, "Content-Type": "application/json" },
      body: JSON.stringify({ email: email, password: password })
    }).then(function (r) {
      return r.json().then(function (j) {
        if (!r.ok || !j.access_token) throw new Error(j.error_description || j.msg || j.message || "Sign-in failed.");
        saveSession(j);
        return j;
      });
    });
  };
  C.signOut = function () { saveSession(null); };
  function refresh() {
    var cfg = conf();
    if (!cfg || !session || !session.refresh_token) return Promise.reject(new Error("no session"));
    return fetch(cfg.url + "/auth/v1/token?grant_type=refresh_token", {
      method: "POST",
      headers: { apikey: cfg.key, "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: session.refresh_token })
    }).then(function (r) {
      return r.json().then(function (j) {
        if (!r.ok || !j.access_token) {
          /* the session is dead - drop it and put the sign-in back on screen
             rather than leaving edit buttons that would fail */
          saveSession(null);
          C.error = "signed out - sign in again";
          M.render();
          throw new Error("session expired");
        }
        saveSession(j); C.error = null; return j;
      });
    });
  }
  function withAuth(run) {
    if (session && session.exp && session.exp < Date.now() + 30000) {
      return refresh().then(run, function (e) { return Promise.reject(e); });
    }
    return run().catch(function (e) {
      if (String(e && e.message).indexOf("401") >= 0 && session) return refresh().then(run);
      throw e;
    });
  }

  /* ---------------- the list ---------------- */
  C.pull = function () {
    var cfg = conf();
    if (!cfg || pulling) return Promise.resolve(false);
    pulling = true;
    return fetch(cfg.url + "/rest/v1/mcl_state?id=eq.1&select=data,updated_at", { headers: headers(cfg), cache: "no-store" })
      .then(function (r) { if (!r.ok) throw new Error("read " + r.status); return r.json(); })
      .then(function (rows) {
        pulling = false;
        var row = rows && rows[0];
        if (!row || !row.data || !row.data.config) return false;
        var at = Date.parse(row.updated_at || 0) || 0;
        if (at && at === C.lastSeen) return false;      /* nothing new */
        C.lastSeen = at;
        M.applySnapshot(row.data, (M.S.meta && M.S.meta.baseAt) || 0);
        M.S.meta = Object.assign({}, M.S.meta, { cloudAt: at, editedAt: 0 });
        M.lsWrite();
        return true;
      })
      .catch(function () { pulling = false; return false; });
  };

  C.push = function () {
    var cfg = conf();
    if (!cfg) return Promise.reject(new Error("Cloud is not set up yet."));
    if (!C.signedIn()) return Promise.reject(new Error("Sign in first."));
    var stamp = new Date().toISOString();
    var body = JSON.stringify({ data: M.snapshot(Date.now()), updated_at: stamp });
    return withAuth(function () {
      return fetch(cfg.url + "/rest/v1/mcl_state?id=eq.1", { method: "PATCH", headers: headers(cfg, true), body: body })
        .then(function (r) {
          if (!r.ok) throw new Error("write " + r.status);
          /* Remember what we just wrote. Without this the next pull sees our
             own newer timestamp, decides the list changed underneath us and
             redraws the page - wiping any form that was open. */
          C.lastSeen = Date.parse(stamp) || C.lastSeen;
          return true;
        });
    });
  };

  /* Edits are batched - one write a second at most, not one per keystroke. */
  C.schedulePush = function () {
    if (M.DB || !conf() || !C.signedIn()) return;
    clearTimeout(pushTimer);
    C.pending = true;
    pushTimer = setTimeout(function () {
      C.push().then(function () {
        C.pending = false; C.error = null;
        M.S.meta = Object.assign({}, M.S.meta, { editedAt: 0 }); M.lsWrite();
        M.render();
      }).catch(function (e) {
        C.pending = false; C.error = e.message || "could not save";
        M.render();
      });
    }, 900);
  };

  /* ---------------- submissions ---------------- */
  C.submit = function (kind, payload) {
    var cfg = conf();
    if (!cfg) return Promise.reject(new Error("off"));
    return fetch(cfg.url + "/rest/v1/mcl_inbox", {
      method: "POST", headers: headers(cfg, true), body: JSON.stringify({ kind: kind, payload: payload })
    }).then(function (r) { if (!r.ok) throw new Error("submit " + r.status); return true; });
  };
  /* True when a submission should go to the live queue rather than straight
     onto the list. Everyone lands in the queue except the owner - including
     list mods, who can approve things but should not be able to put their own
     record on the list without it ever being looked at.

     This used to key off being signed out, which stopped being the same
     question the moment submitting started to require a Discord login. */
  C.useInbox = function () {
    if (M.DB || !C.enabled()) return false;
    return C.role() !== "owner";
  };

  C.inbox = [];
  var inboxSig = null;
  C.loadInbox = function () {
    var cfg = conf();
    if (!cfg || !C.signedIn()) return Promise.resolve([]);
    return withAuth(function () {
      return fetch(cfg.url + "/rest/v1/mcl_inbox?select=*&order=created_at.asc", { headers: headers(cfg), cache: "no-store" })
        .then(function (r) { if (!r.ok) throw new Error("inbox " + r.status); return r.json(); });
    }).then(function (rows) {
      rows = rows || [];
      var sig = rows.map(function (r) { return r.id; }).join(",");
      if (sig !== inboxSig) { inboxSig = sig; C.inbox = rows; M.renderIfIdle(); }
      return C.inbox;
    }).catch(function () { return []; });
  };

  /* ===========================================================
     Signing in with Discord, staff roles, profiles and bans.

     All of this leans on the same session as the email sign-in above, so a
     Discord login and the original email login are the same thing as far as
     the rest of the site is concerned - only who you are differs.

     The database is the real gate (see supabase.sql). Everything here only
     decides which buttons to draw; nothing here decides what is allowed.
     =========================================================== */

  /* --- reading the login token --- */
  function decode(tok) {
    try {
      var p = String(tok).split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
      while (p.length % 4) p += "=";
      return JSON.parse(decodeURIComponent(atob(p).split("").map(function (ch) {
        return "%" + ("00" + ch.charCodeAt(0).toString(16)).slice(-2);
      }).join("")));
    } catch (e) { return null; }
  }
  /* Who is signed in: the Discord id, name and avatar the token carries.
     discordId is empty for the old email login, which has no Discord side. */
  C.me = function () {
    if (!C.signedIn()) return null;
    var j = decode(session.access_token);
    if (!j) return null;
    var m = j.user_metadata || {};
    var id = m.provider_id || m.sub || "";
    var custom = m.custom_claims || {};
    return {
      uid: j.sub || "",
      email: j.email || "",
      discordId: id ? String(id) : "",
      name: custom.global_name || m.user_name || m.name || m.full_name || m.preferred_username || "",
      avatar: m.avatar_url || "",
      provider: (j.app_metadata && j.app_metadata.provider) || "email"
    };
  };

  /* --- signing in with Discord --- */
  /* Supabase runs the whole OAuth dance; we only send the person there and
     catch the token it puts in the url fragment when it sends them back. */
  C.signInDiscord = function () {
    var cfg = conf();
    if (!cfg) return;
    var back = location.origin + (M.base || "") + "/";
    location.href = cfg.url + "/auth/v1/authorize?provider=discord&redirect_to=" + encodeURIComponent(back);
  };
  /* Called once on boot. True if we just came back from Discord. */
  C.captureRedirect = function () {
    var h = location.hash || "";
    if (h.indexOf("access_token=") < 0) {
      if (h.indexOf("error_description=") >= 0) {
        var msg = (h.match(/error_description=([^&]*)/) || [, ""])[1];
        C.error = decodeURIComponent(msg).split("+").join(" ");
        history.replaceState(null, "", location.pathname + location.search);
      }
      return false;
    }
    var q = {};
    h.replace(/^#/, "").split("&").forEach(function (pair) {
      var i = pair.indexOf("=");
      if (i > 0) q[pair.slice(0, i)] = decodeURIComponent(pair.slice(i + 1));
    });
    if (!q.access_token) return false;
    saveSession({
      access_token: q.access_token, refresh_token: q.refresh_token,
      expires_in: parseInt(q.expires_in, 10) || 3600
    });
    /* get the token out of the address bar - it should not sit in history */
    history.replaceState(null, "", location.pathname + location.search);
    return true;
  };

  /* --- staff --- */
  C.staff = [];
  var staffLoaded = false;
  C.loadStaff = function () {
    var cfg = conf();
    if (!cfg) return Promise.resolve([]);
    return fetch(cfg.url + "/rest/v1/mcl_staff?select=discord_id,name,role", { headers: headers(cfg), cache: "no-store" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (rows) {
        if (rows) { C.staff = rows; staffLoaded = true; }
        return C.staff;
      })
      .catch(function () { return C.staff; });
  };
  /* "owner" | "mod" | "user" | null when signed out. Mirrors mcl_role() in
     the database, including its two safety valves: an empty staff table means
     whoever is signed in is the owner, and the email login - which has no
     Discord id to match on - counts as the owner too. */
  C.role = function () {
    if (!C.signedIn()) return null;
    var me = C.me();
    /* the email login has no Discord side to match on, and is yours */
    if (!me || !me.discordId) return "owner";
    /* the staff table could not be read - assume nothing rather than
       handing the list to whoever happens to be signed in */
    if (!staffLoaded) return "user";
    /* nobody listed: matches mcl_role() in the database, which treats an
       empty staff table as "whoever is signed in is the owner" so you
       cannot lock yourself out before you have added yourself */
    if (!C.staff.length) return "owner";
    var row = C.staff.filter(function (x) { return String(x.discord_id) === me.discordId; })[0];
    return row ? row.role : "user";
  };
  C.setStaff = function (discordId, name, role) {
    var cfg = conf();
    if (!cfg) return Promise.reject(new Error("Cloud is off."));
    return withAuth(function () {
      return fetch(cfg.url + "/rest/v1/mcl_staff", {
        method: "POST",
        headers: Object.assign(headers(cfg, true), { Prefer: "resolution=merge-duplicates,return=minimal" }),
        body: JSON.stringify({ discord_id: String(discordId), name: name || "", role: role })
      }).then(function (r) {
        if (!r.ok) throw new Error(r.status === 401 || r.status === 403
          ? "Only the owner can change who is staff." : "could not save (" + r.status + ")");
        return C.loadStaff();
      });
    });
  };
  C.dropStaff = function (discordId) {
    var cfg = conf();
    if (!cfg) return Promise.reject(new Error("Cloud is off."));
    return withAuth(function () {
      return fetch(cfg.url + "/rest/v1/mcl_staff?discord_id=eq." + encodeURIComponent(discordId),
        { method: "DELETE", headers: headers(cfg, true) })
        .then(function (r) {
          if (!r.ok) throw new Error("could not remove (" + r.status + ")");
          return C.loadStaff();
        });
    });
  };

  /* --- profiles --- */
  /* Only what somebody chose to show is in here. Hidden fields are never
     uploaded, so "hidden" means the server does not have it rather than the
     page politely not drawing it. */
  C.profiles = {};
  C.loadProfiles = function () {
    var cfg = conf();
    if (!cfg) return Promise.resolve({});
    return fetch(cfg.url + "/rest/v1/mcl_profiles?select=discord_id,data", { headers: headers(cfg), cache: "no-store" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (rows) {
        if (!rows) return C.profiles;
        var out = {};
        rows.forEach(function (r) { out[String(r.discord_id)] = r.data || {}; });
        C.profiles = out;
        return out;
      })
      .catch(function () { return C.profiles; });
  };
  C.saveProfile = function (data) {
    var cfg = conf(), me = C.me();
    if (!cfg) return Promise.reject(new Error("Cloud is off."));
    if (!me || !me.discordId) return Promise.reject(new Error("Sign in with Discord first."));
    return withAuth(function () {
      return fetch(cfg.url + "/rest/v1/mcl_profiles", {
        method: "POST",
        headers: Object.assign(headers(cfg, true), { Prefer: "resolution=merge-duplicates,return=minimal" }),
        body: JSON.stringify({
          discord_id: me.discordId, user_id: me.uid, data: data,
          updated_at: new Date().toISOString()
        })
      }).then(function (r) {
        if (!r.ok) throw new Error("could not save your profile (" + r.status + ")");
        C.profiles[me.discordId] = data;
        return true;
      });
    });
  };

  /* Take a profile down. Yours, or anybody's if you are the owner - the
     policy in supabase.sql decides which, not this. Blocking an account stops
     it submitting; this removes what it already wrote. */
  C.dropProfile = function (discordId) {
    var cfg = conf();
    if (!cfg) return Promise.reject(new Error("Cloud is off."));
    return withAuth(function () {
      return fetch(cfg.url + "/rest/v1/mcl_profiles?discord_id=eq." + encodeURIComponent(discordId),
        { method: "DELETE", headers: headers(cfg, true) })
        .then(function (r) {
          if (!r.ok) throw new Error(r.status === 403 || r.status === 401
            ? "Only the owner can take down somebody else's profile." : "could not remove it (" + r.status + ")");
          delete C.profiles[String(discordId)];
          return true;
        });
    });
  };

  /* --- thumbnail files --- */
  /* The bucket is public to read and staff-only to write (supabase.sql).
     The url it returns never expires, which is the entire reason this exists:
     a Discord or Medal link is a loan, this is a copy. */
  C.thumbBase = function () {
    var cfg = conf();
    return cfg ? cfg.url + "/storage/v1/object/public/thumbs/" : "";
  };
  C.uploadThumb = function (name, blob) {
    var cfg = conf();
    if (!cfg) return Promise.reject(new Error("Cloud is off."));
    if (!C.signedIn()) return Promise.reject(new Error("Sign in first."));
    var file = String(name).replace(/[^A-Za-z0-9_-]/g, "") + ".jpg";
    return withAuth(function () {
      return fetch(cfg.url + "/storage/v1/object/thumbs/" + file, {
        method: "POST",
        /* No apikey header on purpose. The storage service can take the role
           from apikey instead of Authorization, and the anon key says "anon" -
           which lands as "new row violates row-level security policy", the
           identical message you get for a policy that genuinely said no. The
           REST API prefers Authorization, which is why every other call
           worked and only uploads did not. */
        headers: {
          Authorization: "Bearer " + ((session && session.access_token) || cfg.key),
          "Content-Type": "image/jpeg",
          "x-upsert": "true"
        },
        body: blob
      }).then(function (r) {
        if (r.ok) return r;
        /* Say what the server said. Guessing at the meaning of a status code
           sent people to re-run SQL that had already worked - the real
           message ("Bucket not found", "violates row-level security policy")
           says which of the two halves of the setup is missing. */
        return r.text().then(function (body) {
          var said = "";
          try { said = (JSON.parse(body) || {}).message || ""; } catch (e) { said = String(body || "").slice(0, 120); }
          if (/bucket not found/i.test(said)) throw new Error("There is no thumbs bucket yet - Storage -> New bucket, called thumbs, public.");
          if (/row-level security|violates|not authorized|permission/i.test(said) || r.status === 403 || r.status === 401) {
            throw new Error("The bucket is there but will not let you write to it: " + said);
          }
          throw new Error("Upload failed (" + r.status + ") " + said);
        });
      }).then(function (r) {
        /* the stamp is only there to beat the browser's cache when an image is
           replaced under the same name - the file itself is overwritten */
        return C.thumbBase() + file + "?v=" + Date.now();
      });
    });
  };

  /* --- blocked accounts --- */
  C.bans = [];
  C.loadBans = function () {
    var cfg = conf();
    if (!cfg || !C.signedIn()) return Promise.resolve([]);
    return withAuth(function () {
      return fetch(cfg.url + "/rest/v1/mcl_bans?select=*&order=at.desc", { headers: headers(cfg), cache: "no-store" })
        .then(function (r) { return r.ok ? r.json() : []; });
    }).then(function (rows) { C.bans = rows || []; return C.bans; }).catch(function () { return []; });
  };
  C.ban = function (discordId, name, reason) {
    var cfg = conf();
    if (!cfg) return Promise.reject(new Error("Cloud is off."));
    return withAuth(function () {
      return fetch(cfg.url + "/rest/v1/mcl_bans", {
        method: "POST",
        headers: Object.assign(headers(cfg, true), { Prefer: "resolution=merge-duplicates,return=minimal" }),
        body: JSON.stringify({ discord_id: String(discordId), name: name || "", reason: reason || "" })
      }).then(function (r) {
        if (!r.ok) throw new Error(r.status === 403 ? "Only the owner can block an account." : "could not block (" + r.status + ")");
        return C.loadBans();
      });
    });
  };
  C.unban = function (discordId) {
    var cfg = conf();
    if (!cfg) return Promise.reject(new Error("Cloud is off."));
    return withAuth(function () {
      return fetch(cfg.url + "/rest/v1/mcl_bans?discord_id=eq." + encodeURIComponent(discordId),
        { method: "DELETE", headers: headers(cfg, true) })
        .then(function () { return C.loadBans(); });
    });
  };

  C.clearInbox = function (id) {
    var cfg = conf();
    if (!cfg || !C.signedIn()) return Promise.resolve();
    return withAuth(function () {
      return fetch(cfg.url + "/rest/v1/mcl_inbox?id=eq." + encodeURIComponent(id), { method: "DELETE", headers: headers(cfg, true) })
        .then(function () { C.inbox = C.inbox.filter(function (x) { return x.id !== id; }); return true; });
    }).catch(function () {});
  };
})(window.MCL);
