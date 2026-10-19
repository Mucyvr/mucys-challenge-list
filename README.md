# MCL — Mucy's Challenge List

The source of https://mucys-challenge-list.pages.dev, published so anyone can
read exactly what the site does - how points are worked out, what the queue
accepts, and what the database lets each kind of account change.

**Nothing private is in here.** The live site's database address and key are
left blank (`supaUrl` / `supaKey` in `js/store.js` and `data/list.json`), the
owner's Discord id in `supabase.sql` is a placeholder, and there is no bot
token, webhook or service key anywhere in this repo. Run it as-is and it works
off `data/list.json` alone; plug in your own free Supabase project (see *Live
saving* below) to get logins and live saving.

Where to look if you want to check something:

| Question | File |
| --- | --- |
| How are points calculated? | `js/store.js` (`M.pts`) |
| Who is allowed to change the list? | `supabase.sql` (row-level security, `mcl_guard_state`) |
| What does a submission have to pass? | `supabase.sql` (`mcl_inbox` policies) and `js/app.js` |
| Is any clip loaded before staff click it? | `js/media.js` - no, it is click-to-play |

---

Static site. No build step, no dependencies, no server needed.

```
mcl/
├── index.html          the page
├── css/style.css       all styling (light + dark)
├── js/store.js         state, saving, points, legacy cutoff
├── js/media.js         turns a clip URL into a real player
├── js/views.js         every screen
├── js/app.js           clicks, forms, roulette, start-up
├── netlify.toml        Netlify config (publish = ".")
├── build.js            optional: inline everything into one file
└── dist/               output of build.js
```

## Section URLs

**Asset paths must stay absolute** (`/js/store.js`, not `js/store.js`). A
relative path resolves against the current directory, so on a two-segment url
like `/clans/MCL` the browser asked for `/clans/js/store.js`, got a 404, and
served a blank page. Single-segment urls happened to work, which is why it hid
for a while.

Every section has its own address, so you can link straight to it:

| URL | Section |
| --- | --- |
| `/` or `/list` | the main list |
| `/friends` | Mucy's Friends List |
| `/leaderboard` · `/leaderboard/friends` | leaderboards |
| `/roulette` · `/roulette/friends` | roulettes |
| `/packs` · `/packs/friends` | packs |
| `/rules` | rules and list requirements |
| `/u/<name>` | a player's profile |
| `/me` | your own profile |
| `/submit` · `/submit/challenge` | submit a record / post a challenge |
| `/admin` | admin |

`netlify.toml` sends every unknown path to `index.html`, which is what makes a
refresh on `/rules` work. If you ever host somewhere without that rule, the
same routes still work after a `#` (`/#/rules`).

## If a change doesn't show up after deploying

The browser is holding an old copy. `netlify.toml` tells browsers not to
cache, and the `?v=N` on the script tags in `index.html` forces the issue —
**bump that number** (`?v=3`, `?v=4`…) on every script and the stylesheet
whenever you change the JS or CSS and someone reports seeing the old site.
A hard refresh (Ctrl+Shift+R) also does it for one person.

## Keep secrets out of this folder

This whole folder gets published, so **anything you put in here is public** at
`your-site.netlify.app/<the file>`. The Discord bot token and the list backups
live in `Q:\mcl-tools\` instead, one level up, precisely so a deploy can never
expose them. Do not move them back in.

## Deploying to Netlify

Drag the whole `mcl` folder onto https://app.netlify.com/drop — that's it.
For a repo deploy: connect the repo, leave the build command empty, set the
publish directory to `.` (or just let `netlify.toml` do it).

## Live saving (do this once, then never publish again)

Connect a free Supabase database and the whole publish dance goes away: you
edit, everyone sees it immediately, and submissions land in your queue on the
live site.

1. Make a free project at <https://supabase.com> — no card.
2. **SQL Editor → New query** → paste all of `supabase.sql` → **Run**.
3. **Authentication → Users → Add user** → your email + a password,
   with "Auto Confirm User" on. This account is how you sign in to edit.
4. **Project Settings → API** → copy the **Project URL** and the **anon public**
   key.
5. On the site: **Admin → Live saving** → paste both → Save → sign in with the
   account from step 3.
6. Publish **once** (below) so visitors' browsers know where the database is.

After that the footer reads *live · saving automatically* and every edit is
saved for everyone about a second after you make it. Other people's browsers
pick it up when they open the page, when they come back to the tab, and once a
minute while it's open.

**Is the anon key safe to ship?** Yes — it's designed to be public, and the
policies in `supabase.sql` are what actually enforce things: anyone may read the
list and post a submission, only a signed-in account may change the list or read
the inbox. Your password never leaves the sign-in box; the site keeps only the
session token, in your browser.

## Where the data lives — without the cloud

There are two layers, and mixing them up is the one thing that will confuse you.

| Layer | Who sees it |
| --- | --- |
| `data/list.json` — the **published** list | **everyone** who opens the site |
| localStorage — your **working copy** | only you, only in that browser |

Edits you make on the site land in your browser first. That is why they survive
a refresh but nobody else can see them. The footer shows an **unpublished
changes** chip whenever that is the case.

### Publishing (do this every time you want the world to see a change)

1. **Admin → Publish → Download data/list.json**
2. Put the downloaded file in `mcl/data/list.json`, replacing the old one.
3. Redeploy — drag the `mcl` folder onto Netlify again, or push to your repo.

That's it. Every visitor now loads your list.

If a newer `data/list.json` is published while you had unpublished edits in a
browser, the site takes the published one and keeps your edits as a backup —
**Admin → Data → Restore local backup**.

**Submissions on the live site** are POSTed to Netlify Forms (`mcl-record` and
`mcl-challenge`, declared as hidden forms in `index.html`). Enable Forms in
your Netlify site settings and every record/challenge submission shows up in
your dashboard and can email you. The submission also stays in the on-site
queue in that visitor's browser so they see the confirmation.

If you later want everyone to see the same live list without you re-publishing,
that needs a small backend (Netlify Functions + a database like Supabase). The
data model is already shaped for it: `challenges`, `records`, `packs`,
`submissions`, `runs`, `editors`.

## Running it

**Admin** → sign in with your Supabase account. That sign-in is the gate: it is
what decides whether a change can actually be saved, so there is no separate
PIN. Visitors who click Admin just see the sign-in box; they can still browse,
use the roulette and submit records.

From admin you can:

* add / edit / delete challenges on either list (owner only)
* **move** challenges up and down (owner **and** list mods)
* accept or reject the queue (owner **and** list mods)
* set a player's **Discord id**, which is what puts their profile on their name
* add and remove staff, and block an account from submitting
* set **Based on** (Difficulty, Spamming, Consistency, or anything you type)
* approve or reject queued records and Friends List challenges
* build packs, manage list editors, set the Discord invite and the
  "Powered by" link, change the legacy cutoff
* back up and restore everything as JSON

## How the list works

* **Main list** — a level lands here when whoever made it is **whitelisted**:
  a friend Mucy knows and trusts enough to put their levels on it. Not applied
  for, and marked by the Whitelisted role in the Discord. It used to be
  "Mucy has to be part of the level", which kept the list to one person's
  output rather than to a standard.
* **Friends List** — everything else made by friends. Its own placements,
  leaderboard, roulette and packs. The whole site turns red-pink on it.
* **Legacy** — anything past #150 moves there automatically. Legacy records
  still count and are worth a flat 5 points.
* **Points** — #1 is worth 200, curving down toward the cutoff. Only full
  completions score; progress records are listed but worth nothing.

## Clans, countries, position history

* **Clans** (`/clans`) - a full name, a tag of up to 4 letters, a colour and a
  member list. The tag goes after every member's name, `Mucy (MCL)`, and links
  to the clan page. Points are the members' points across both lists; created /
  verified / beaten are counted from the list. One clan per person.
  Admin: the **Add clan** button on the Clans page.
* **Countries** - a real flag image before a player's name (`img/flags/`, 243
  small PNGs shipped with the site - emoji flags do not render on Windows). Set
  in **Admin -> Players** by typing the country name, or the player types one
  when submitting a record (it sticks when the record is accepted).
* **Position history** - every add, move and removal is logged on the level
  itself and shown as a table at the bottom of its page, newest first. Levels
  placed before this existed start with an empty history.

## Roulette

Three of them: **main list**, **friends list**, and **both lists** mixed
together (`/roulette/both`). Each keeps its own board, so a mixed run is never
compared against a single-list one. On a mixed run the "top 25/50/100" pools
mean the top N *of each list*, since positions are per-list.

The first level needs 1%. After that the requirement is **one more than you
actually got on the last level** - 41% means the next one needs 42%. Not "step
2 needs 2%", which is what it used to do and was wrong. Skipping leaves the
requirement where it is. Reaching 100% ends the run as a win.

The requirement lives on the run itself (`run.need`), so it cannot drift out of
step with the level count.

## Thumbnails

Every level shows a thumbnail, pointercrate-style: in the list rows and blurred
behind the title on its own page.

They are **files in `img/thumbs/<level id>.jpg`**, fetched by
`Q:\mcl-tools	humbs.js`. It has to work that way — Medal's own thumbnail urls
are signed and expire within a day or two, and Medal sends no CORS header, so
the browser cannot fetch them. Downloading once also means the list loads
without touching anyone else's server.

```bash
node thumbs.js            # grab any that are missing (run after adding levels)
node thumbs.js --dry-run  # show what it would fetch
node thumbs.js --force    # re-fetch everything
```

Medal images are requested at `&width=480` — the default is 1920x1080, which
was 2.4MB across the list instead of 685KB. YouTube links use `mqdefault.jpg`.

A level with no file falls back to a coloured tile with its initials, so a
newly added level looks deliberate rather than broken. The admin form also has
a **Thumbnail** box if you want to point one at a specific image.

## Logo and link previews

`img/mcl-source.webp` is the logo as Mucy exported it - it has dark padding
around the rounded square, so it is **not** used directly. Cropped versions
live beside it:

| File | Used for |
| --- | --- |
| `mcl-32.png` | favicon, and the mark in the top bar |
| `mcl-180.png` | apple-touch-icon (phone home screens) |
| `mcl-og.jpg` | the 1200x630 card Discord/Twitter show when the link is posted |

The og:image url in `index.html` is **absolute** - link previews are fetched by
someone else's server, so a relative path would not resolve.

To remake them after a logo change: drop the new file in as
`img/mcl-source.webp`, then crop and re-export at those sizes (the corners are
rounded at 22.5% of the width, and the og card fits the title to the space
left over so it cannot overflow).

## Signing in with Discord

Nobody needs a password from you and nobody shares an account. Supabase runs
the OAuth, the site only catches the token it hands back.

### Turning it on (once)

1. **Discord Developer Portal** -> your MCL application -> **OAuth2** ->
   **Redirects** -> add exactly:
   `https://<your-project>.supabase.co/auth/v1/callback`
   Copy the **Client ID** and **Client Secret** off that page.
2. **Supabase** -> **Authentication -> Providers -> Discord** -> enable, paste
   the client id and secret, save.
3. **Supabase** -> **Authentication -> URL Configuration** -> Site URL is
   `https://mucys-challenge-list.pages.dev`, and add the same url under
   **Redirect URLs**.
4. **SQL Editor** -> paste all of `supabase.sql` -> **Run**. Re-running it is
   safe; it never touches the list itself.

Until step 4 has run there is no staff table, so nothing changes for anyone.

### Who can do what

| | Owner | List mod | Everyone else |
| --- | --- | --- | --- |
| Add, edit, delete levels | yes | no | no |
| Move levels up and down | yes | yes | no |
| Accept / reject the queue | yes | yes | no |
| Settings, staff, blocking | yes | no | no |
| Submit a record | yes | yes | yes |
| Their own profile page | yes | yes | yes |

Staff is a table keyed on **Discord user id** - the one name nobody else can
take. Add and remove people in **Admin -> Staff**. Two deliberate safety
valves, in the database and mirrored in the page:

* the **email login** you already had counts as the owner, so enabling all of
  this cannot lock you out
* an **empty staff table** means anyone signed in is the owner, so a fresh
  database cannot lock you out either

A list mod's limits are enforced by the database, not by hiding buttons:
`mcl_guard_state()` refuses an update that changes `config` or `editors`
unless it came from the owner. A mod can still place a level, because that is
what accepting a queued challenge does.

### Profiles

`/u/<name>` is a player's page: their points, completions and records on the
left of the sum, and on the right whatever they chose to write about
themselves. Names on the leaderboard and under a level link to it.

The two halves never mix. The list owns the stats; the person owns the rest.
`/me` is where they write it - GD username, a line about themselves, what they
play on, and links (a handle is enough, `mucy` becomes the full address).

**Hiding something removes it.** A field left empty is never uploaded, so the
database does not have it - it is not merely undrawn. What you typed stays in
your own browser so turning a field back on does not mean typing it again.

A profile is tied to a name on the list by exactly one thing: the **Discord
id** an owner sets in **Admin -> Players**. Nothing else links them, so typing
"Mucy" into your own profile claims nothing.

## Stopping people submitting rubbish

The hole was that anyone could file a completion under anybody's name with any
link attached, and the first person to see that link was whoever opened the
queue. Four things close it, and three of them are the database's job rather
than the page's:

1. **A submission needs a Discord login.** The insert policy on `mcl_inbox`
   only accepts `authenticated`.
2. **It has to say who sent it, truthfully.** The policy compares
   `payload.discordId` against the Discord id in the login token, so the name
   on a submission is the account that actually sent it.
3. **Blocked accounts are refused by the database.** **Block sender** on any
   queue item, or **Admin -> Staff -> Blocked from submitting**. The check is
   in the policy, so blocking somebody actually stops them.
4. **Clip links have to be on a host that serves clips** - YouTube, Medal,
   Streamable, Twitch, Google Drive, Dropbox or Discord. Checked in the page
   (`M.clipHostOk`), which is a speed bump rather than a wall, but it stops
   the obvious version.

A pending clip is never embedded anywhere - the queue shows a plain link, so
nothing from a stranger renders in your browser until you decide to click it.

## Webcam required

Each level carries a **Webcam required: yes/no** flag - a click-spam challenge
is trivial to fake without one. It is off unless you switch it on, so every
level placed before this existed reads "not required".

Set it in **Admin -> edit a level -> Webcam required**. Someone posting a
Friends List challenge picks it on the submit form too, and it comes across
when you accept the submission.

Where it shows: an amber **webcam required** chip next to "Based on" on the
level page, a `Webcam` entry in that page's stats, a small camera badge on the
level's thumbnail in the list, a line in the roulette's facts row, and " -
webcam required" after the level's name in the record submit dropdown.

It is a label, not a rule the site enforces - nothing rejects a clip
automatically, it just means you know to look for hands before accepting.

## Clip links

Paste any of these into a challenge or a record and it becomes a player:

| Link | Result |
| --- | --- |
| `youtube.com/watch?v=…`, `youtu.be/…`, `/shorts/…` | YouTube player |
| `medal.tv/games/…/clips/<id>/…` | Medal player |
| `streamable.com/…` | Streamable player |
| `clips.twitch.tv/…` | Twitch player |
| a direct `.mp4` / `.webm` / `.mov` (a Discord CDN file) | native video player |
| anything else | "Watch the clip" button |

The player is **click-to-play**: the level's thumbnail with a play button, and
nothing is loaded from the video host until somebody clicks. Faster, and it
keeps Medal's cookie-consent panel out of the page for people who are only
reading the list.

There is always an "Open on …" link under the player. If a host refuses to be
embedded, the page notices and swaps in a working link instead of a black box.

## A form being filled in is never redrawn

The cloud sync redraws the page when the list changes - on every tab switch,
and once a minute. That used to wipe whatever was half-typed into the admin
form. Three things caused it and all three are fixed:

* the inbox check redrew the page on **every** check, changed or not
* `push()` did not record what it wrote, so the next pull saw its *own* newer
  timestamp, decided the list had changed underneath it, and redrew
* nothing checked whether a form was open

Anything the sync triggers now goes through `M.renderIfIdle()`, which defers
the redraw while `M.busyEditing()` is true (an admin form open, a field
focused, or any form field holding something the user typed). The deferred
redraw happens as soon as the form is saved or cancelled.

If you touch the sync code, keep using `renderIfIdle` rather than `render` or
the bug comes straight back.

## Single-file build

```bash
node build.js
```

Writes `dist/mcl-single.html` — the entire site in one file you can open with a
double-click or drop anywhere.
