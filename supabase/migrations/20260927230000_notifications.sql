-- Phase 7 — notifications: in-app inbox, per-type preferences, Expo push foundations.
-- Additive: apply after 20260927220000_community.sql.
--
-- Notifications are only ever written by SECURITY DEFINER triggers below (clients cannot insert).
-- Push delivery is an outbox: rows get push_status = 'pending' when the recipient wants push for that
-- group; a trusted worker (service role, e.g. a Supabase Edge Function on a schedule) claims batches
-- with claim_push_batch() and sends them to the Expo push service. See docs/PHASE7.md.
begin;

-- ---------------------------------------------------------------- kinds and groups
-- kind  = what happened (stored on the row); group = what the member toggles in settings.
create or replace function public.notification_group(p_kind text)
returns text
language sql
immutable
as $$
  select case
    when p_kind in ('meetup_join', 'meetup_cancelled') then 'meetup'
    when p_kind in ('match_start', 'match_goal', 'match_end') then 'match'
    else p_kind
  end;
$$;

-- Defaults when the member has not saved a setting. Keep in sync with lib/notifications.ts (DEFAULT_SETTINGS).
create or replace function public.notification_default(p_group text, p_channel text)
returns boolean
language sql
immutable
as $$
  select case
    when p_channel = 'in_app' then true
    else p_group in ('reply', 'quote', 'mention', 'follow', 'meetup', 'match')
  end;
$$;

-- ---------------------------------------------------------------- tables
create table if not exists public.notification_settings (
  user_id uuid not null references public.profiles (id) on delete cascade,
  grp text not null check (grp in ('reply', 'quote', 'mention', 'like', 'follow', 'category_topic', 'meetup', 'match', 'badge')),
  in_app boolean not null,
  push boolean not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, grp),
  check (in_app or not push)
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in (
    'reply', 'quote', 'mention', 'like', 'follow', 'category_topic',
    'meetup_join', 'meetup_cancelled', 'match_start', 'match_goal', 'match_end', 'badge'
  )),
  actor_id uuid references public.profiles (id) on delete set null,
  -- Grouped kinds (reply, like, meetup_join) collapse into one unread row: latest actor + distinct count.
  actor_ids uuid[] not null default '{}',
  actor_count integer not null default 1 check (actor_count >= 0),
  topic_id uuid references public.topics (id) on delete cascade,
  post_id uuid references public.posts (id) on delete cascade,
  meetup_id uuid references public.meetups (id) on delete cascade,
  match_id uuid references public.matches (id) on delete cascade,
  badge_id text references public.badges (id) on delete cascade,
  -- Display snapshot (topic title, excerpt, badge name, score…) so the inbox needs no extra joins.
  data jsonb not null default '{}'::jsonb check (jsonb_typeof(data) = 'object'),
  dedupe_key text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  push_status text not null default 'skipped' check (push_status in ('pending', 'sent', 'skipped', 'failed'))
);
create unique index if not exists notifications_unread_dedupe_idx on public.notifications (user_id, kind, dedupe_key) where read_at is null;
create index if not exists notifications_dedupe_idx on public.notifications (user_id, kind, dedupe_key);
create index if not exists notifications_inbox_idx on public.notifications (user_id, created_at desc, id desc);
create index if not exists notifications_unread_idx on public.notifications (user_id) where read_at is null;
create index if not exists notifications_push_idx on public.notifications (created_at) where push_status = 'pending';

create table if not exists public.push_tokens (
  token text primary key check (token ~ '^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]{10,}\]$'),
  user_id uuid not null references public.profiles (id) on delete cascade,
  platform text not null check (platform in ('ios', 'android', 'web')),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  disabled_at timestamptz
);
create index if not exists push_tokens_user_idx on public.push_tokens (user_id) where disabled_at is null;

alter table public.notification_settings enable row level security;
alter table public.notifications enable row level security;
alter table public.push_tokens enable row level security;

revoke all on public.notification_settings, public.notifications, public.push_tokens from anon, authenticated;
grant select on public.notification_settings, public.notifications to authenticated;

drop policy if exists "own notification settings" on public.notification_settings;
create policy "own notification settings" on public.notification_settings for select to authenticated using (user_id = auth.uid());
drop policy if exists "own notifications" on public.notifications;
create policy "own notifications" on public.notifications for select to authenticated using (user_id = auth.uid());
-- push_tokens: no client policies; only the RPCs below and the service role touch it.

-- ---------------------------------------------------------------- core writer (internal)
create or replace function public.notification_pref(p_user uuid, p_group text, p_channel text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select case when p_channel = 'push' then s.push else s.in_app end
       from public.notification_settings s where s.user_id = p_user and s.grp = p_group),
    public.notification_default(p_group, p_channel)
  );
$$;

create or replace function public.notify(
  p_user uuid,
  p_kind text,
  p_actor uuid,
  p_dedupe text,
  p_topic uuid default null,
  p_post uuid default null,
  p_meetup uuid default null,
  p_match uuid default null,
  p_badge text default null,
  p_data jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group text := public.notification_group(p_kind);
  v_push text;
begin
  if p_user is null or p_user = p_actor then
    return;
  end if;
  if not exists (select 1 from public.profiles where id = p_user and deleted_at is null) then
    return;
  end if;
  if not public.notification_pref(p_user, v_group, 'in_app') then
    return;
  end if;
  v_push := case when public.notification_pref(p_user, v_group, 'push') then 'pending' else 'skipped' end;

  if p_kind in ('reply', 'like', 'meetup_join') then
    insert into public.notifications as n
      (user_id, kind, actor_id, actor_ids, topic_id, post_id, meetup_id, match_id, badge_id, data, dedupe_key, push_status)
    values
      (p_user, p_kind, p_actor, case when p_actor is null then '{}'::uuid[] else array[p_actor] end,
       p_topic, p_post, p_meetup, p_match, p_badge, p_data, p_dedupe, v_push)
    on conflict (user_id, kind, dedupe_key) where read_at is null do update
      set actor_count = n.actor_count + case when excluded.actor_id = any (n.actor_ids) then 0 else 1 end,
          actor_ids = case when excluded.actor_id = any (n.actor_ids) then n.actor_ids
                           else (array[excluded.actor_id] || n.actor_ids)[1:20] end,
          actor_id = excluded.actor_id,
          data = n.data || excluded.data,
          created_at = now();
    -- post_id and push_status stay from the first event: deep link to the first unread post, one push per group.
  else
    if exists (select 1 from public.notifications where user_id = p_user and kind = p_kind and dedupe_key = p_dedupe) then
      return;
    end if;
    insert into public.notifications
      (user_id, kind, actor_id, actor_ids, topic_id, post_id, meetup_id, match_id, badge_id, data, dedupe_key, push_status)
    values
      (p_user, p_kind, p_actor, case when p_actor is null then '{}'::uuid[] else array[p_actor] end,
       p_topic, p_post, p_meetup, p_match, p_badge, p_data, p_dedupe, v_push)
    on conflict do nothing;
  end if;
end;
$$;

create or replace function public.notification_excerpt(p_body text)
returns text
language sql
immutable
as $$
  select left(btrim(regexp_replace(coalesce(p_body, ''), '\s+', ' ', 'g')), 140);
$$;

-- ---------------------------------------------------------------- forum triggers
-- Replies and quotes. Runs after capture_post_mentions (trigger order is alphabetical), so members who
-- are @mentioned or quoted in this post get that more specific notification instead of a reply
-- (unless they turned that type off, in which case they still get the reply).
create or replace function public.notify_on_post()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_title text;
  v_topic_author uuid;
  v_quoted uuid;
  v_data jsonb;
  r record;
begin
  if new.is_opening_post or new.is_deleted then
    return new;
  end if;
  select title, author_id into v_title, v_topic_author from public.topics where id = new.topic_id;
  v_data := jsonb_build_object('topic_title', v_title, 'excerpt', public.notification_excerpt(new.body));

  if new.quote_post_id is not null then
    select author_id into v_quoted from public.posts where id = new.quote_post_id and not is_deleted;
    perform public.notify(v_quoted, 'quote', new.author_id, new.id::text, new.topic_id, new.id, p_data => v_data);
  end if;

  for r in
    select distinct u.id
      from (select v_topic_author as id
            union select tf.user_id from public.topic_follows tf where tf.topic_id = new.topic_id) u
     where u.id is not null
       and u.id <> new.author_id
       and not coalesce(u.id = v_quoted and public.notification_pref(u.id, 'quote', 'in_app'), false)
       and not (exists (select 1 from public.post_mentions m where m.post_id = new.id and m.user_id = u.id)
                and public.notification_pref(u.id, 'mention', 'in_app'))
  loop
    perform public.notify(r.id, 'reply', new.author_id, 'topic:' || new.topic_id, new.topic_id, new.id, p_data => v_data);
  end loop;
  return new;
end;
$$;

drop trigger if exists notify_post_insert on public.posts;
create trigger notify_post_insert after insert on public.posts
for each row execute function public.notify_on_post();

create or replace function public.notify_on_mention()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  p record;
begin
  select po.author_id, po.topic_id, po.body, po.is_deleted, t.title, q.author_id as quoted_author
    into p
    from public.posts po
    join public.topics t on t.id = po.topic_id
    left join public.posts q on q.id = po.quote_post_id
   where po.id = new.post_id;
  -- A quoted member who is also @mentioned gets only the quote notification (see notify_on_post).
  if p is null or p.is_deleted or p.quoted_author = new.user_id then
    return new;
  end if;
  perform public.notify(new.user_id, 'mention', p.author_id, new.post_id::text, p.topic_id, new.post_id,
    p_data => jsonb_build_object('topic_title', p.title, 'excerpt', public.notification_excerpt(p.body)));
  return new;
end;
$$;

drop trigger if exists notify_mention_insert on public.post_mentions;
create trigger notify_mention_insert after insert on public.post_mentions
for each row execute function public.notify_on_mention();

create or replace function public.notify_on_like()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  p record;
begin
  select po.author_id, po.topic_id, po.body, po.is_deleted, t.title
    into p
    from public.posts po join public.topics t on t.id = po.topic_id
   where po.id = new.post_id;
  if p is null or p.is_deleted then
    return new;
  end if;
  perform public.notify(p.author_id, 'like', new.user_id, 'post:' || new.post_id, p.topic_id, new.post_id,
    p_data => jsonb_build_object('topic_title', p.title, 'excerpt', public.notification_excerpt(p.body)));
  return new;
end;
$$;

drop trigger if exists notify_like_insert on public.post_likes;
create trigger notify_like_insert after insert on public.post_likes
for each row execute function public.notify_on_like();

create or replace function public.notify_on_user_follow()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.notify(new.followee_id, 'follow', new.follower_id, 'user:' || new.follower_id);
  return new;
end;
$$;

drop trigger if exists notify_user_follow_insert on public.user_follows;
create trigger notify_user_follow_insert after insert on public.user_follows
for each row execute function public.notify_on_user_follow();

create or replace function public.notify_on_topic()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  c record;
  r record;
begin
  select name, slug into c from public.categories where id = new.category_id;
  for r in select cf.user_id from public.category_follows cf where cf.category_id = new.category_id loop
    perform public.notify(r.user_id, 'category_topic', new.author_id, new.id::text, new.id,
      p_data => jsonb_build_object('topic_title', new.title, 'category_name', c.name, 'category_slug', c.slug));
  end loop;
  return new;
end;
$$;

drop trigger if exists notify_topic_insert on public.topics;
create trigger notify_topic_insert after insert on public.topics
for each row execute function public.notify_on_topic();

-- ---------------------------------------------------------------- community triggers
create or replace function public.notify_on_meetup_join()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  m record;
begin
  select id, title, starts_at, created_by, cancelled into m from public.meetups where id = new.meetup_id;
  if m is null or m.cancelled then
    return new;
  end if;
  perform public.notify(m.created_by, 'meetup_join', new.user_id, 'meetup:' || m.id, p_meetup => m.id,
    p_data => jsonb_build_object('meetup_title', m.title, 'starts_at', m.starts_at));
  return new;
end;
$$;

drop trigger if exists notify_meetup_join_insert on public.meetup_attendees;
create trigger notify_meetup_join_insert after insert on public.meetup_attendees
for each row execute function public.notify_on_meetup_join();

create or replace function public.notify_on_meetup_cancel()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  if not new.cancelled or old.cancelled or new.starts_at <= now() then
    return new;
  end if;
  for r in select a.user_id from public.meetup_attendees a where a.meetup_id = new.id loop
    perform public.notify(r.user_id, 'meetup_cancelled', new.created_by, new.id::text, p_meetup => new.id,
      p_data => jsonb_build_object('meetup_title', new.title, 'starts_at', new.starts_at, 'city', new.city));
  end loop;
  return new;
end;
$$;

drop trigger if exists notify_meetup_cancel_update on public.meetups;
create trigger notify_meetup_cancel_update after update of cancelled on public.meetups
for each row execute function public.notify_on_meetup_cancel();

create or replace function public.notify_on_badge()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  b record;
begin
  select name, icon into b from public.badges where id = new.badge_id;
  perform public.notify(new.user_id, 'badge', null, new.badge_id, p_badge => new.badge_id,
    p_data => jsonb_build_object('badge_name', b.name, 'badge_icon', b.icon));
  return new;
end;
$$;

drop trigger if exists notify_badge_insert on public.user_badges;
create trigger notify_badge_insert after insert on public.user_badges
for each row execute function public.notify_on_badge();

-- ---------------------------------------------------------------- match triggers (fan-out to every member)
-- One row per active member who keeps the "match" group on. Fine at forum scale (thousands of members);
-- beyond that, move the fan-out into the push worker. See docs/PHASE7.md.
create or replace function public.notify_on_match_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_kind text;
  v_data jsonb;
begin
  if old.status = 'scheduled' and new.status = 'live' then
    v_kind := 'match_start';
  elsif old.status in ('live', 'halftime') and new.status = 'finished' then
    v_kind := 'match_end';
  else
    return new;
  end if;
  v_data := jsonb_build_object(
    'match_title', new.home_team || ' – ' || new.away_team,
    'competition', new.competition,
    'home_score', new.home_score,
    'away_score', new.away_score
  );
  perform public.notify(p.id, v_kind, null, new.id::text, new.topic_id, p_match => new.id, p_data => v_data)
     from public.profiles p where p.deleted_at is null;
  return new;
end;
$$;

drop trigger if exists notify_match_status_update on public.matches;
create trigger notify_match_status_update after update of status on public.matches
for each row execute function public.notify_on_match_status();

create or replace function public.notify_on_match_goal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  m record;
  v_data jsonb;
begin
  if new.type not in ('goal', 'penalty_goal', 'own_goal') then
    return new;
  end if;
  select id, home_team, away_team, status, topic_id into m from public.matches where id = new.match_id;
  if m is null or m.status not in ('live', 'halftime') then
    return new;
  end if;
  v_data := jsonb_build_object(
    'match_title', m.home_team || ' – ' || m.away_team,
    'minute', new.minute,
    'extra_minute', new.extra_minute,
    'event_type', new.type,
    'player', new.player,
    'team', case new.side when 'home' then m.home_team when 'away' then m.away_team end
  );
  perform public.notify(p.id, 'match_goal', null, new.id::text, m.topic_id, p_match => m.id, p_data => v_data)
     from public.profiles p where p.deleted_at is null;
  return new;
end;
$$;

drop trigger if exists notify_match_goal_insert on public.match_events;
create trigger notify_match_goal_insert after insert on public.match_events
for each row execute function public.notify_on_match_goal();

-- ---------------------------------------------------------------- member RPCs
create or replace function public.unread_notification_count()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer from public.notifications where user_id = auth.uid() and read_at is null;
$$;

-- p_ids null = mark everything read. Returns the number of rows changed.
create or replace function public.mark_notifications_read(p_ids uuid[] default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if auth.uid() is null then
    raise exception 'auth_required' using errcode = '28000';
  end if;
  update public.notifications
     set read_at = now()
   where user_id = auth.uid() and read_at is null and (p_ids is null or id = any (p_ids));
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.get_notification_settings()
returns table (grp text, in_app boolean, push boolean)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'auth_required' using errcode = '28000';
  end if;
  return query
    select g.grp,
           public.notification_pref(auth.uid(), g.grp, 'in_app'),
           public.notification_pref(auth.uid(), g.grp, 'push')
      from unnest(array['reply', 'quote', 'mention', 'like', 'follow', 'category_topic', 'meetup', 'match', 'badge'])
           with ordinality as g(grp, ord)
     order by g.ord;
end;
$$;

create or replace function public.set_notification_setting(p_group text, p_in_app boolean, p_push boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'auth_required' using errcode = '28000';
  end if;
  if p_group not in ('reply', 'quote', 'mention', 'like', 'follow', 'category_topic', 'meetup', 'match', 'badge') then
    raise exception 'invalid_group' using errcode = '22023';
  end if;
  insert into public.notification_settings (user_id, grp, in_app, push, updated_at)
  values (auth.uid(), p_group, coalesce(p_in_app, true), coalesce(p_push, false) and coalesce(p_in_app, true), now())
  on conflict (user_id, grp) do update
    set in_app = excluded.in_app, push = excluded.push, updated_at = now();
end;
$$;

-- A device token belongs to whoever registered it last (shared devices, account switches).
create or replace function public.register_push_token(p_token text, p_platform text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'auth_required' using errcode = '28000';
  end if;
  if p_token is null or p_token !~ '^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]{10,}\]$' then
    raise exception 'invalid_token' using errcode = '22023';
  end if;
  if p_platform not in ('ios', 'android', 'web') then
    raise exception 'invalid_platform' using errcode = '22023';
  end if;
  insert into public.push_tokens (token, user_id, platform)
  values (p_token, v_uid, p_platform)
  on conflict (token) do update
    set user_id = v_uid, platform = excluded.platform, last_seen_at = now(), disabled_at = null;
  -- Keep the 10 most recently seen devices per member.
  delete from public.push_tokens
   where user_id = v_uid
     and token not in (select token from public.push_tokens where user_id = v_uid order by last_seen_at desc limit 10);
end;
$$;

create or replace function public.unregister_push_token(p_token text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'auth_required' using errcode = '28000';
  end if;
  delete from public.push_tokens where token = p_token and user_id = auth.uid();
end;
$$;

-- ---------------------------------------------------------------- push worker RPCs (service role only)
-- Claims up to p_limit pending rows (oldest first). Rows already read, older than 1 hour, or whose recipient has no
-- active device, are marked 'skipped'; the rest are marked 'sent' and returned with their tokens.
create or replace function public.claim_push_batch(p_limit integer default 100)
returns table (
  notification_id uuid,
  user_id uuid,
  kind text,
  actor_username text,
  actor_count integer,
  topic_id uuid,
  post_id uuid,
  meetup_id uuid,
  match_id uuid,
  data jsonb,
  tokens text[]
)
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.notifications set push_status = 'skipped'
   where push_status = 'pending' and (created_at < now() - interval '1 hour' or read_at is not null);

  return query
  with picked as (
    select n.id
      from public.notifications n
     where n.push_status = 'pending'
     order by n.created_at
     limit greatest(1, least(coalesce(p_limit, 100), 500))
     for update skip locked
  ),
  with_tokens as (
    select n.id, array_agg(t.token order by t.last_seen_at desc) filter (where t.token is not null) as toks
      from public.notifications n
      join picked on picked.id = n.id
      left join public.push_tokens t on t.user_id = n.user_id and t.disabled_at is null
     group by n.id
  ),
  marked as (
    update public.notifications n
       set push_status = case when w.toks is null then 'skipped' else 'sent' end
      from with_tokens w
     where n.id = w.id
    returning n.*, w.toks
  )
  select m.id, m.user_id, m.kind, a.username, m.actor_count, m.topic_id, m.post_id, m.meetup_id, m.match_id, m.data, m.toks
    from marked m
    left join public.profiles a on a.id = m.actor_id
   where m.toks is not null
   order by m.created_at;
end;
$$;

-- Expo answers DeviceNotRegistered for uninstalled apps: stop sending to those tokens.
create or replace function public.disable_push_tokens(p_tokens text[])
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  update public.push_tokens set disabled_at = now() where token = any (p_tokens) and disabled_at is null;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.mark_push_failed(p_ids uuid[])
returns void
language sql
security definer
set search_path = public
as $$
  update public.notifications set push_status = 'failed' where id = any (p_ids);
$$;

-- Retention: read rows after 90 days, everything after 180 days. Schedule daily (pg_cron / worker).
create or replace function public.prune_notifications()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  delete from public.notifications
   where (read_at is not null and created_at < now() - interval '90 days')
      or created_at < now() - interval '180 days';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------- grants
revoke all on function public.notification_pref(uuid, text, text),
  public.notify(uuid, text, uuid, text, uuid, uuid, uuid, uuid, text, jsonb),
  public.notify_on_post(), public.notify_on_mention(), public.notify_on_like(), public.notify_on_user_follow(),
  public.notify_on_topic(), public.notify_on_meetup_join(), public.notify_on_meetup_cancel(), public.notify_on_badge(),
  public.notify_on_match_status(), public.notify_on_match_goal(),
  public.claim_push_batch(integer), public.disable_push_tokens(text[]), public.mark_push_failed(uuid[]),
  public.prune_notifications()
  from public, anon, authenticated;

revoke all on function public.unread_notification_count(), public.mark_notifications_read(uuid[]),
  public.get_notification_settings(), public.set_notification_setting(text, boolean, boolean),
  public.register_push_token(text, text), public.unregister_push_token(text)
  from public, anon;
grant execute on function public.unread_notification_count(), public.mark_notifications_read(uuid[]),
  public.get_notification_settings(), public.set_notification_setting(text, boolean, boolean),
  public.register_push_token(text, text), public.unregister_push_token(text)
  to authenticated;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.claim_push_batch(integer), public.disable_push_tokens(text[]),
      public.mark_push_failed(uuid[]), public.prune_notifications() to service_role;
  end if;
end;
$$;

-- ---------------------------------------------------------------- realtime (Supabase only)
-- The inbox badge listens to inserts/updates on the member's own rows (RLS applies to realtime).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
     ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end;
$$;

-- ---------------------------------------------------------------- account deletion
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'auth_required' using errcode = '28000';
  end if;
  delete from public.notifications where user_id = v_uid;
  delete from public.notification_settings where user_id = v_uid;
  delete from public.push_tokens where user_id = v_uid;
  delete from public.post_likes where user_id = v_uid;
  delete from public.poll_votes where user_id = v_uid;
  delete from public.post_reports where reporter_id = v_uid;
  delete from public.post_mentions where user_id = v_uid;
  delete from public.match_reactions where user_id = v_uid;
  delete from public.lineups where user_id = v_uid;
  delete from public.user_follows where follower_id = v_uid or followee_id = v_uid;
  delete from public.topic_follows where user_id = v_uid;
  delete from public.category_follows where user_id = v_uid;
  delete from public.user_badges where user_id = v_uid;
  delete from public.meetup_attendees where user_id = v_uid;
  update public.meetups set cancelled = true where created_by = v_uid and starts_at > now();
  update public.profiles
     set username = 'silinmis_' || substr(replace(v_uid::text, '-', ''), 1, 10),
         avatar_url = null,
         bio = null,
         city = null,
         favorite_category_id = null,
         role = 'user',
         deleted_at = now()
   where id = v_uid;
  delete from auth.users where id = v_uid;
end;
$$;

commit;
