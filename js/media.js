/* ===========================================================
   media.js - turns a pasted clip URL into a real player.

   Supported, in this order:
     direct video file (.mp4 / .webm / .mov / .m4v)  -> <video>
     YouTube (watch, youtu.be, shorts, live, embed)  -> YouTube player
     Medal.tv clip                                   -> Medal player
     Streamable                                      -> Streamable player
     Twitch clip                                     -> Twitch player
     anything else                                   -> "Watch the clip" button

   Some hosts (claude.ai, for one) refuse to let other sites load
   inside them. checkFrames() notices that and swaps the dead frame
   for a working link instead of leaving a black box.
   =========================================================== */
(function (M) {
  "use strict";
  var esc = M.esc, safeUrl = M.safeUrl;

  M.media = function (u) {
    u = safeUrl(u); if (!u) return null;
    var m;
    if (/\.(mp4|webm|mov|m4v)(\?|$)/i.test(u)) return { kind: "file", src: u, url: u, name: "the clip" };
    if ((m = u.match(/(?:youtube\.com\/(?:watch\?(?:[^#]*&)?v=|embed\/|shorts\/|live\/|v\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/)))
      return { kind: "frame", src: "https://www.youtube.com/embed/" + m[1], url: u, name: "YouTube" };
    if ((m = u.match(/medal\.tv\/(?:games\/[^\/]+\/)?clips?\/([A-Za-z0-9_-]+)/)))
      return { kind: "frame", src: "https://medal.tv/clip/" + m[1], url: u, name: "Medal" };
    if ((m = u.match(/streamable\.com\/(?:e\/)?([A-Za-z0-9]+)/)))
      return { kind: "frame", src: "https://streamable.com/e/" + m[1], url: u, name: "Streamable" };
    if ((m = u.match(/(?:twitch\.tv\/[^\/]+\/clip\/|clips\.twitch\.tv\/)([A-Za-z0-9_-]+)/)))
      return { kind: "frame", src: "https://clips.twitch.tv/embed?clip=" + m[1] + "&parent=" + location.hostname, url: u, name: "Twitch" };
    return { kind: "link", url: u, name: "the clip" };
  };

  /* The player is not loaded until somebody asks for it. Until then it is
     the level's own thumbnail with a play button over it. That keeps the
     page fast and, with Medal, keeps their cookie-consent panel out of the
     page until the viewer actually wants to watch. */
  M.playerHtml = function (u, canEdit, thumb) {
    var m = M.media(u);
    if (!m) {
      return '<div class="noplayer"><p>No clip linked for this challenge yet.</p>'
        + (canEdit ? '<span class="chip">add one with Edit</span>' : "") + "</div>";
    }
    var open = '<div style="max-width:640px;margin-top:8px"><a href="' + esc(m.url) + '" target="_blank" rel="noopener" style="font-size:12.5px">Open on '
      + esc(m.name) + " &#8599;</a></div>";
    if (m.kind === "link") {
      return '<div class="noplayer"><p>This clip is hosted somewhere that will not embed.</p>'
        + '<a class="btn" href="' + esc(m.url) + '" target="_blank" rel="noopener">Watch the clip</a></div>';
    }
    if (m.kind === "file") {
      return '<div class="player"><video controls preload="none" playsinline' + (thumb ? ' poster="' + esc(thumb) + '"' : "")
        + ' src="' + esc(m.src) + '"></video></div>' + open;
    }
    return '<div class="player poster" data-play="' + esc(m.src) + '" data-url="' + esc(m.url) + '" data-name="' + esc(m.name) + '">'
      + (thumb ? '<img src="' + esc(thumb) + '" alt="" onerror="this.remove()">' : "")
      + '<button class="playbtn" type="button" aria-label="Play the verification on ' + esc(m.name) + '">'
      + '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></button>'
      + '<span class="playon">' + esc(m.name) + "</span></div>" + open;
  };

  /* Swap a poster for the real player. */
  M.startPlayer = function (box) {
    var src = box.getAttribute("data-play");
    if (!src) return;
    box.classList.remove("poster");
    box.removeAttribute("data-play");
    box.setAttribute("data-frame", "1");
    box.innerHTML = '<iframe src="' + esc(src) + '" title="Verification video" allowfullscreen '
      + 'allow="accelerometer; autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" '
      + 'referrerpolicy="strict-origin-when-cross-origin"></iframe>';
    M.checkFrames();
  };

  M.checkFrames = function () {
    var nodes = document.querySelectorAll(".player[data-frame]");
    Array.prototype.forEach.call(nodes, function (box) {
      setTimeout(function () {
        if (!box.isConnected) return;
        var f = box.querySelector("iframe"), blocked = false;
        try {
          /* A frame that really loaded is cross-origin and throws here.
             One that was blocked sits readable on about:blank. */
          if (f && f.contentWindow && f.contentWindow.location.href === "about:blank") blocked = true;
        } catch (e) { blocked = false; }
        if (!blocked) return;
        var u = box.getAttribute("data-url"), n = box.getAttribute("data-name");
        var d = document.createElement("div");
        d.className = "noplayer";
        d.innerHTML = "<p>This page will not let " + esc(n) + " play inside it. The clip itself is fine.</p>"
          + '<a class="btn" href="' + esc(u) + '" target="_blank" rel="noopener">Watch on ' + esc(n) + "</a>"
          + '<span class="chip">embeds work once the site is on your own domain</span>';
        box.replaceWith(d);
      }, 2200);
    });
  };
})(window.MCL);
