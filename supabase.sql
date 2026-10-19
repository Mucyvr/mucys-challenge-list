-- ===========================================================
-- MCL - run this once in Supabase:
--   your project -> SQL Editor -> New query -> paste -> Run
-- ===========================================================

-- the whole list, in one row
create table if not exists mcl_state (
  id         int primary key,
  data       jsonb not null,
  updated_at timestamptz default now()
);
insert into mcl_state (id, data) values (1, '{}'::jsonb) on conflict (id) do nothing;

-- submissions from anyone (records + Friends List challenges)
create table if not exists mcl_inbox (
  id         uuid primary key default gen_random_uuid(),
  kind       text not null,
  payload    jsonb not null,
  created_at timestamptz default now()
);

alter table mcl_state enable row level security;
alter table mcl_inbox enable row level security;

-- everyone can READ the list
drop policy if exists "read list" on mcl_state;
create policy "read list" on mcl_state
  for select to anon, authenticated using (true);

-- only a signed-in account (you) can CHANGE it
drop policy if exists "owner updates list" on mcl_state;
create policy "owner updates list" on mcl_state
  for update to authenticated using (true) with check (true);

-- anyone can POST a submission...
drop policy if exists "anyone submits" on mcl_inbox;
create policy "anyone submits" on mcl_inbox
  for insert to anon, authenticated with check (true);

-- ...but only you can read them back or clear them
drop policy if exists "owner reads inbox" on mcl_inbox;
create policy "owner reads inbox" on mcl_inbox
  for select to authenticated using (true);

drop policy if exists "owner clears inbox" on mcl_inbox;
create policy "owner clears inbox" on mcl_inbox
  for delete to authenticated using (true);


-- ===========================================================
-- ACCOUNTS, STAFF AND PROFILES  (added in v1.1)
-- Re-running this whole file is safe: it never touches your list data.
-- ===========================================================

-- Who is allowed to do what, keyed on Discord user id.
-- Roles:  owner = everything.  mod = the queue only (no settings, no staff).
create table if not exists mcl_staff (
  discord_id text primary key,
  user_id    uuid,
  name       text,
  role       text not null check (role in ('owner', 'mod')),
  added_at   timestamptz default now()
);

-- People blocked from submitting. Checked by the database, not the page, so
-- blocking somebody actually stops them rather than just hiding the button.
create table if not exists mcl_bans (
  discord_id text primary key,
  name       text,
  reason     text,
  at         timestamptz default now()
);

-- What a person chose to show on their profile. Only what they made public is
-- ever stored here - anything they hide never leaves their browser.
create table if not exists mcl_profiles (
  discord_id text primary key,
  user_id    uuid not null,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);

alter table mcl_staff    enable row level security;
alter table mcl_bans     enable row level security;
alter table mcl_profiles enable row level security;

-- The Discord id of whoever is making the request, out of their login token.
create or replace function mcl_discord_id() returns text
language sql stable as $$
  select coalesce(
    nullif(auth.jwt() -> 'user_metadata' ->> 'provider_id', ''),
    nullif(auth.jwt() -> 'user_metadata' ->> 'sub', '')
  );
$$;

-- 'owner', 'mod', or null. Two safety valves:
--   * an account listed by user_id counts even with no Discord id, so the
--     original email login keeps working
--   * if nobody is listed at all, any signed-in account is the owner, so an
--     empty staff table can never lock you out of your own list
create or replace function mcl_role() returns text
language sql stable security definer set search_path = public as $$
  select case
    when auth.uid() is null then null
    when not exists (select 1 from mcl_staff) then 'owner'
    else (
      select s.role from mcl_staff s
      where
        -- the account id on the row (the email login, and whatever was linked)
        s.user_id = auth.uid()
        -- the Discord id out of the login token
        or s.discord_id = mcl_discord_id()
        -- ...and the same thing looked up from the account itself, which needs
        -- nothing from the token but the user id. The storage service does not
        -- always pass user_metadata through, so a check that leans only on the
        -- token works for the REST API and silently fails for file uploads.
        or s.discord_id = (select u.raw_user_meta_data ->> 'provider_id'
                             from auth.users u where u.id = auth.uid())
      order by case s.role when 'owner' then 0 else 1 end
      limit 1)
  end;
$$;

-- ---------- the list ----------
-- Owners and mods may save it. What a mod may change is limited by the
-- trigger below, not by this policy - RLS cannot compare the old row with the
-- new one, and a trigger can.
drop policy if exists "owner updates list" on mcl_state;
drop policy if exists "staff update list" on mcl_state;
create policy "staff update list" on mcl_state
  for update to authenticated
  using (mcl_role() in ('owner', 'mod'))
  with check (mcl_role() in ('owner', 'mod'));

create or replace function mcl_guard_state() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if mcl_role() = 'owner' then return new; end if;
  if new.data -> 'config' is distinct from old.data -> 'config' then
    raise exception 'Only the owner can change the settings.';
  end if;
  if new.data -> 'editors' is distinct from old.data -> 'editors' then
    raise exception 'Only the owner can change the list editors.';
  end if;
  return new;
end;
$$;
drop trigger if exists mcl_guard_state_trg on mcl_state;
create trigger mcl_guard_state_trg before update on mcl_state
  for each row execute function mcl_guard_state();

-- ---------- submissions ----------
-- A submission now has to come from a signed-in Discord account, it has to say
-- who sent it and say so truthfully, and banned accounts are refused. This is
-- the part that stops a stranger from posting whatever clip they like under
-- somebody else's completion.
drop policy if exists "anyone submits" on mcl_inbox;
drop policy if exists "signed in submits" on mcl_inbox;
create policy "signed in submits" on mcl_inbox
  for insert to authenticated
  with check (
    mcl_discord_id() is not null
    and payload ->> 'discordId' = mcl_discord_id()
    and not exists (select 1 from mcl_bans b where b.discord_id = mcl_discord_id())
  );

drop policy if exists "owner reads inbox" on mcl_inbox;
drop policy if exists "staff read inbox" on mcl_inbox;
create policy "staff read inbox" on mcl_inbox
  for select to authenticated using (mcl_role() in ('owner', 'mod'));

drop policy if exists "owner clears inbox" on mcl_inbox;
drop policy if exists "staff clear inbox" on mcl_inbox;
create policy "staff clear inbox" on mcl_inbox
  for delete to authenticated using (mcl_role() in ('owner', 'mod'));

-- ---------- staff ----------
drop policy if exists "anyone reads staff" on mcl_staff;
create policy "anyone reads staff" on mcl_staff
  for select to anon, authenticated using (true);

drop policy if exists "owner writes staff" on mcl_staff;
create policy "owner writes staff" on mcl_staff
  for all to authenticated using (mcl_role() = 'owner') with check (mcl_role() = 'owner');

-- ---------- bans ----------
drop policy if exists "staff read bans" on mcl_bans;
create policy "staff read bans" on mcl_bans
  for select to authenticated using (mcl_role() in ('owner', 'mod'));

drop policy if exists "owner writes bans" on mcl_bans;
create policy "owner writes bans" on mcl_bans
  for all to authenticated using (mcl_role() = 'owner') with check (mcl_role() = 'owner');

-- ---------- profiles ----------
drop policy if exists "anyone reads profiles" on mcl_profiles;
create policy "anyone reads profiles" on mcl_profiles
  for select to anon, authenticated using (true);

-- You may only write your own, and only under your own Discord id.
drop policy if exists "own profile insert" on mcl_profiles;
create policy "own profile insert" on mcl_profiles
  for insert to authenticated
  with check (user_id = auth.uid() and discord_id = mcl_discord_id());

drop policy if exists "own profile update" on mcl_profiles;
create policy "own profile update" on mcl_profiles
  for update to authenticated
  using (user_id = auth.uid() and discord_id = mcl_discord_id())
  with check (user_id = auth.uid() and discord_id = mcl_discord_id());

drop policy if exists "own profile delete" on mcl_profiles;
create policy "own profile delete" on mcl_profiles
  for delete to authenticated using (user_id = auth.uid());

-- ---------- make yourself the owner ----------
-- Run this once with your own Discord id. Until a row exists here, any
-- signed-in account counts as the owner (see mcl_role above).
-- The owner row is linked to the oldest account in the project as well as to
-- the Discord id, so the email login you already use keeps working whether or
-- not you ever sign in with Discord.
insert into mcl_staff (discord_id, user_id, name, role)
values ('YOUR_DISCORD_ID',
        (select id from auth.users order by created_at asc limit 1),
        'Mucy', 'owner')
on conflict (discord_id) do update
  set role = 'owner', name = excluded.name,
      user_id = coalesce(mcl_staff.user_id, excluded.user_id);

-- Add list mods here, or from Admin -> Staff on the site, which is easier.
-- Nothing is seeded except the owner: somebody removed from staff must not
-- come back the next time this file is run.

-- Check it worked - this should list you as the owner:
--   select discord_id, name, role, user_id from mcl_staff;


-- ===========================================================
-- WHAT THE SERVER WILL ACCEPT  (added in v1.2)
--
-- A form field in a web page is a suggestion. maxlength, a dropdown with
-- three options, a pattern - all of it lives in the browser, and anybody can
-- open the console and send whatever they like instead. That is how a profile
-- ended up with a wall of arrows in "Plays on", which is a dropdown, and how a
-- paragraph ended up in "Based on", which is a 24-character box.
--
-- So the rules are written here instead. Everything below runs inside the
-- database, after the request arrives and before anything is stored, and it
-- cannot be skipped by anyone no matter what they send.
--
-- The approach is a whitelist: a field that is not named here is thrown away,
-- not merely trimmed. Adding a field to the page means adding it here too.
-- ===========================================================

-- trim, cut to length, and turn "" into null so empty fields are simply absent
create or replace function mcl_cap(t text, n int) returns text
language sql immutable as $$
  select nullif(btrim(left(coalesce(t, ''), n)), '');
$$;

-- the same, for anything that has to stay on one line: control characters and
-- line breaks collapse to spaces first
create or replace function mcl_line(t text, n int) returns text
language sql immutable as $$
  select mcl_cap(regexp_replace(coalesce(t, ''), '[[:cntrl:]]+', ' ', 'g'), n);
$$;

-- Casts that cannot blow up. A hand-written request can put anything in any
-- field, and "pct": "abc" must mean "that value is not usable" rather than a
-- raw database error landing in front of whoever was submitting.
create or replace function mcl_bool(t text) returns boolean
language sql immutable as $$
  select lower(coalesce(t, '')) in ('true', 't', '1', 'yes', 'on');
$$;

create or replace function mcl_num(t text, lo numeric, hi numeric, dflt numeric) returns numeric
language sql immutable as $$
  select case when coalesce(t, '') ~ '^-?[0-9]+(\.[0-9]+)?$'
              then least(hi, greatest(lo, t::numeric))
              else dflt end;
$$;

-- a clip has to be on a host that serves clips
create or replace function mcl_clip_ok(u text) returns boolean
language sql immutable as $$
  select coalesce(u, '') = '' or u ~* '^https?://([a-z0-9-]+\.)*(youtube\.com|youtu\.be|medal\.tv|streamable\.com|twitch\.tv|discord\.com|discordapp\.com|drive\.google\.com|dropbox\.com)/';
$$;

-- ---------- profiles ----------
create or replace function mcl_guard_profile() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  d jsonb := coalesce(new.data, '{}'::jsonb);
  out_d jsonb := '{}'::jsonb;
  k text;
  v text;
begin
  v := mcl_line(d ->> 'gd', 24);
  if v is not null then out_d := out_d || jsonb_build_object('gd', v); end if;

  -- the one field allowed to have line breaks, and only a couple of lines of it
  v := mcl_cap(regexp_replace(coalesce(d ->> 'bio', ''), '[\r\t]|\n{3,}', ' ', 'g'), 300);
  if v is not null then out_d := out_d || jsonb_build_object('bio', v); end if;

  -- a dropdown with three options is three options here as well
  v := d ->> 'device';
  if v in ('PC', 'Mobile', 'Console') then out_d := out_d || jsonb_build_object('device', v); end if;

  -- the whole value, never a truncated piece of it, and inside the real range
  v := upper(btrim(coalesce(d ->> 'fps', '')));
  if v = 'CBF' or (v ~ '^[0-9]{2,3}$' and v::int between 10 and 360) then
    out_d := out_d || jsonb_build_object('fps', v);
  end if;

  v := mcl_line(d ->> 'discordName', 40);
  if v is not null then out_d := out_d || jsonb_build_object('discordName', v); end if;

  foreach k in array array['youtube', 'twitch', 'twitter', 'tiktok', 'instagram', 'site'] loop
    v := mcl_line(d ->> k, 80);
    if v is not null then out_d := out_d || jsonb_build_object(k, v); end if;
  end loop;

  new.data := out_d;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists mcl_guard_profile_trg on mcl_profiles;
create trigger mcl_guard_profile_trg before insert or update on mcl_profiles
  for each row execute function mcl_guard_profile();

-- An owner can delete somebody else's profile. Blocking an account stops it
-- submitting; this is for taking down what it already wrote.
drop policy if exists "own profile delete" on mcl_profiles;
create policy "own profile delete" on mcl_profiles
  for delete to authenticated
  using (user_id = auth.uid() or mcl_role() = 'owner');

-- ---------- submissions ----------
create or replace function mcl_guard_inbox() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  p jsonb := coalesce(new.payload, '{}'::jsonb);
  o jsonb := '{}'::jsonb;
  v text;
  n numeric;
begin
  if new.kind not in ('record', 'challenge') then
    raise exception 'Unknown kind of submission.';
  end if;

  -- one person cannot bury the queue
  if (select count(*) from mcl_inbox i where i.payload ->> 'discordId' = p ->> 'discordId') >= 10 then
    raise exception 'You already have 10 submissions waiting. Wait for those to be looked at first.';
  end if;

  if not mcl_clip_ok(p ->> 'video') then
    raise exception 'Clip links have to be on YouTube, Medal, Streamable, Twitch, Google Drive, Dropbox or Discord.';
  end if;

  -- who sent it, which the insert policy has already checked is really them
  o := jsonb_build_object('discordId', p ->> 'discordId');
  v := mcl_line(p ->> 'discordName', 40);
  if v is not null then o := o || jsonb_build_object('discordName', v); end if;
  v := mcl_line(p ->> 'video', 300);
  if v is not null then o := o || jsonb_build_object('video', v); end if;
  o := o || jsonb_build_object('at', extract(epoch from now()) * 1000);

  if new.kind = 'record' then
    v := mcl_line(p ->> 'player', 24);
    if v is not null then o := o || jsonb_build_object('player', v); end if;
    v := mcl_line(p ->> 'cid', 40);
    if v is not null then o := o || jsonb_build_object('cid', v); end if;
    v := mcl_line(p ->> 'cname', 60);
    if v is not null then o := o || jsonb_build_object('cname', v); end if;
    v := mcl_line(p ->> 'list', 10);
    if v in ('main', 'friends') then o := o || jsonb_build_object('list', v); end if;

    n := mcl_num(p ->> 'pct', 1, 100, 100);
    o := o || jsonb_build_object('pct', n);

    v := upper(btrim(coalesce(p ->> 'fps', '')));
    if v = 'CBF' or (v ~ '^[0-9]{2,3}$' and v::int between 10 and 360) then
      o := o || jsonb_build_object('fps', v);
    end if;
    v := p ->> 'device';
    if v in ('PC', 'Mobile', 'Console') then o := o || jsonb_build_object('device', v); end if;
    v := upper(coalesce(p ->> 'country', ''));
    if v ~ '^[A-Z]{2}$' then o := o || jsonb_build_object('country', v); end if;

    o := o || jsonb_build_object('medal', mcl_bool(p ->> 'medal'),
                                 'discord', mcl_bool(p ->> 'discord'));
  else
    v := mcl_line(p ->> 'name', 60);
    if v is not null then o := o || jsonb_build_object('name', v); end if;
    v := mcl_line(p ->> 'creator', 40);
    if v is not null then o := o || jsonb_build_object('creator', v); end if;
    v := mcl_line(p ->> 'verifier', 40);
    if v is not null then o := o || jsonb_build_object('verifier', v); end if;
    -- the field a paragraph was posted into
    v := mcl_line(p ->> 'basedOn', 24);
    if v is not null then o := o || jsonb_build_object('basedOn', v); end if;
    v := mcl_line(p ->> 'levelId', 20);
    if v is not null then o := o || jsonb_build_object('levelId', v); end if;
    v := mcl_line(p ->> 'by', 24);
    if v is not null then o := o || jsonb_build_object('by', v); end if;
    v := mcl_cap(regexp_replace(coalesce(p ->> 'note', ''), '[\r\t]|\n{3,}', ' ', 'g'), 400);
    if v is not null then o := o || jsonb_build_object('note', v); end if;

    v := upper(btrim(coalesce(p ->> 'fps', '')));
    if v = 'CBF' or (v ~ '^[0-9]{2,3}$' and v::int between 10 and 360) then
      o := o || jsonb_build_object('fps', v);
    end if;

    n := mcl_num(p ->> 'top', 1, 1000, 1);
    o := o || jsonb_build_object('top', n);

    o := o || jsonb_build_object('webcam', mcl_bool(p ->> 'webcam'),
                                 'honest', mcl_bool(p ->> 'honest'),
                                 'possible', mcl_bool(p ->> 'possible'));
  end if;

  new.payload := o;
  return new;
end;
$$;

drop trigger if exists mcl_guard_inbox_trg on mcl_inbox;
create trigger mcl_guard_inbox_trg before insert on mcl_inbox
  for each row execute function mcl_guard_inbox();


-- ===========================================================
-- THUMBNAIL UPLOADS  (added in v1.3)
-- A place to put an image file, so a thumbnail is something you pick off your
-- computer rather than a link you paste and hope stays alive.
-- ===========================================================

-- Public to read, because that is the whole point of a thumbnail.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('thumbs', 'thumbs', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Only staff can put anything in it. The 2MB ceiling above is a backstop:
-- the page shrinks every image to about 20KB before it is ever sent.
--
-- These check mcl_staff directly on auth.uid() rather than going through
-- mcl_role(). The storage service does not give a policy everything the REST
-- API does - mcl_role() returns 'owner' over REST and nothing at all here -
-- and a user id is the one thing it always has. Which is why user_id on
-- mcl_staff has to be filled in; the backfill below does that.
--
-- Wrapped in a DO block that swallows its own errors: storage.objects belongs
-- to supabase_storage_admin and the SQL editor is not always allowed to put
-- policies on it. Without this, that single failure aborts the whole file.
do $$
begin
  execute 'drop policy if exists "staff upload thumbs" on storage.objects';
  execute 'create policy "staff upload thumbs" on storage.objects
             for insert to authenticated
             with check (bucket_id = ''thumbs'' and exists (
               select 1 from public.mcl_staff s
                where s.user_id = auth.uid() and s.role in (''owner'', ''mod'')))';

  execute 'drop policy if exists "staff replace thumbs" on storage.objects';
  execute 'create policy "staff replace thumbs" on storage.objects
             for update to authenticated
             using (bucket_id = ''thumbs'' and exists (
               select 1 from public.mcl_staff s
                where s.user_id = auth.uid() and s.role in (''owner'', ''mod'')))
             with check (bucket_id = ''thumbs'' and exists (
               select 1 from public.mcl_staff s
                where s.user_id = auth.uid() and s.role in (''owner'', ''mod'')))';

  execute 'drop policy if exists "staff delete thumbs" on storage.objects';
  execute 'create policy "staff delete thumbs" on storage.objects
             for delete to authenticated
             using (bucket_id = ''thumbs'' and exists (
               select 1 from public.mcl_staff s
                where s.user_id = auth.uid() and s.role in (''owner'', ''mod'')))';

  raise notice 'Storage policies created.';
exception when others then
  raise notice 'Could NOT create the storage policies here (%). Add them by hand: Storage -> Policies -> thumbs.', sqlerrm;
end $$;

-- Point every staff row at the account that person actually signs in with.
-- Run this again whenever somebody new is made staff and has signed in once -
-- until their user_id is filled in, they cannot upload a file.
update mcl_staff s
   set user_id = u.id
  from auth.users u
 where u.raw_user_meta_data ->> 'provider_id' = s.discord_id
   and s.user_id is distinct from u.id;

-- Did it work? Three policies, and no staff row with a null user_id:
--   select policyname from pg_policies
--    where schemaname = 'storage' and tablename = 'objects' and policyname like '%thumbs%';
--   select name, role, user_id from mcl_staff;
