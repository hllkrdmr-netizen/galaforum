-- Phase 8 — moderation: report queue, post/topic actions, member sanctions, roles, audit log, member blocks.
-- Additive: apply after 20260927230000_notifications.sql.
--
-- Every staff action goes through a SECURITY DEFINER RPC that checks the caller's role and writes one
-- moderation_log row. Direct UPDATE on topics/posts is revoked, so nothing bypasses the audit trail.
begin;

-- ---------------------------------------------------------------- columns
alter table public.posts add column if not exists removed_at timestamptz;
alter table public.posts add column if not exists removed_by uuid references public.profiles (id) on delete set null;
alter table public.posts add column if not exists removed_reason text check (char_length(removed_reason) <= 500);

alter table public.topics add column if not exists hidden_at timestamptz;
alter table public.topics add column if not exists hidden_by uuid references public.profiles (id) on delete set null;
alter table public.topics add column if not exists hidden_reason text check (char_length(hidden_reason) <= 500);

alter table public.post_reports add column if not exists status text not null default 'open'
  check (status in ('open', 'resolved', 'dismissed'));
alter table public.post_reports add column if not exists handled_by uuid references public.profiles (id) on delete set null;
alter table public.post_reports add column if not exists handled_at timestamptz;
alter table public.post_reports add column if not exists note text check (char_length(note) <= 500);
create index if not exists post_reports_open_idx on public.post_reports (post_id) where status = 'open';

-- ---------------------------------------------------------------- visibility
-- Hidden topics disappear for everyone (lists, counters, search, direct links); staff reach them through
-- the moderation RPCs. Posts of hidden topics are hidden with them.
drop policy if exists "topics are public" on public.topics;
create policy "topics are public" on public.topics for select using (hidden_at is null);

drop policy if exists "visible posts are public" on public.posts;
create policy "visible posts are public" on public.posts for select using (
  (is_deleted = false and exists (select 1 from public.topics t where t.id = topic_id and t.hidden_at is null))
  or public.is_staff(auth.uid())
);

-- Staff edits go through audited RPCs only.
drop policy if exists "staff manage topics" on public.topics;
drop policy if exists "staff moderate posts" on public.posts;
revoke update on public.topics, public.posts from anon, authenticated;

-- ---------------------------------------------------------------- audit log
create table if not exists public.moderation_log (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null check (action in (
    'post_remove', 'post_restore', 'topic_pin', 'topic_unpin', 'topic_lock', 'topic_unlock', 'topic_move',
    'topic_hide', 'topic_unhide', 'report_dismiss', 'user_mute', 'user_ban', 'sanction_revoke', 'role_change'
  )),
  target_type text not null check (target_type in ('post', 'topic', 'user')),
  target_id text not null,
  target_label text not null default '',
  reason text not null default '' check (char_length(reason) <= 500),
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists moderation_log_created_idx on public.moderation_log (id desc);
create index if not exists moderation_log_target_idx on public.moderation_log (target_type, target_id);

alter table public.moderation_log enable row level security;
revoke all on public.moderation_log from anon, authenticated;
grant select on public.moderation_log to authenticated;
drop policy if exists "staff read moderation log" on public.moderation_log;
create policy "staff read moderation log" on public.moderation_log for select to authenticated using (public.is_staff(auth.uid()));

-- ---------------------------------------------------------------- sanctions
create table if not exists public.user_sanctions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('mute', 'ban')),
  reason text not null check (char_length(btrim(reason)) between 3 and 500),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_by uuid references public.profiles (id) on delete set null,
  revoke_reason text check (char_length(revoke_reason) <= 500),
  check (ends_at is null or ends_at > starts_at)
);
create index if not exists user_sanctions_active_idx on public.user_sanctions (user_id) where revoked_at is null;

alter table public.user_sanctions enable row level security;
revoke all on public.user_sanctions from anon, authenticated;
-- Read through RPCs (my_restriction for members, mod_member for staff).

-- ---------------------------------------------------------------- member blocks
create table if not exists public.user_blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index if not exists user_blocks_blocked_idx on public.user_blocks (blocked_id);

alter table public.user_blocks enable row level security;
revoke all on public.user_blocks from anon, authenticated;
grant select on public.user_blocks to authenticated;
drop policy if exists "own blocks" on public.user_blocks;
create policy "own blocks" on public.user_blocks for select to authenticated using (blocker_id = auth.uid());

-- ---------------------------------------------------------------- helpers (internal)
create or replace function public.is_admin(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles p where p.id = uid and p.role = 'admin' and p.deleted_at is null);
$$;

create or replace function public.require_staff()
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'auth_required' using errcode = '28000';
  end if;
  if not public.is_staff(auth.uid()) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  return auth.uid();
end;
$$;

create or replace function public.log_moderation(
  p_action text, p_type text, p_id text, p_label text, p_reason text, p_meta jsonb default '{}'::jsonb
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.moderation_log (actor_id, action, target_type, target_id, target_label, reason, meta)
  values (auth.uid(), p_action, p_type, p_id, left(coalesce(p_label, ''), 200), left(btrim(coalesce(p_reason, '')), 500), coalesce(p_meta, '{}'::jsonb));
$$;

create or replace function public.clean_reason(p_reason text, p_required boolean)
returns text
language plpgsql
immutable
as $$
declare
  v text := btrim(coalesce(p_reason, ''));
begin
  if char_length(v) > 500 or (p_required and char_length(v) < 3) then
    raise exception 'invalid_reason' using errcode = '22023';
  end if;
  return v;
end;
$$;

-- Strongest active sanction: 'ban' > 'mute' > null.
create or replace function public.sanction_level(p_user uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when bool_or(kind = 'ban') then 'ban'
    when bool_or(kind = 'mute') then 'mute'
  end
  from public.user_sanctions
  where user_id = p_user and revoked_at is null and starts_at <= now() and (ends_at is null or ends_at > now());
$$;

-- BEFORE INSERT guard. TG_ARGV[0] = column holding the member id, TG_ARGV[1] = 'mute' (blocked while muted
-- or banned: writing content) or 'ban' (blocked only while banned: likes, votes, follows, reports…).
create or replace function public.enforce_sanction()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := (to_jsonb(new) ->> tg_argv[0])::uuid;
  v_level text;
begin
  if v_user is null then
    return new;
  end if;
  v_level := public.sanction_level(v_user);
  if v_level = 'ban' then
    raise exception 'banned' using errcode = '42501';
  elsif v_level = 'mute' and tg_argv[1] = 'mute' then
    raise exception 'muted' using errcode = '42501';
  end if;
  return new;
end;
$$;

do $$
declare
  r record;
begin
  for r in
    select * from (values
      ('posts', 'author_id', 'mute'),
      ('topics', 'author_id', 'mute'),
      ('meetups', 'created_by', 'mute'),
      ('post_likes', 'user_id', 'ban'),
      ('post_reports', 'reporter_id', 'ban'),
      ('poll_votes', 'user_id', 'ban'),
      ('match_reactions', 'user_id', 'ban'),
      ('lineups', 'user_id', 'ban'),
      ('meetup_attendees', 'user_id', 'ban'),
      ('user_follows', 'follower_id', 'ban'),
      ('topic_follows', 'user_id', 'ban'),
      ('category_follows', 'user_id', 'ban')
    ) as t (tbl, col, lvl)
  loop
    execute format('drop trigger if exists aa_enforce_sanction on public.%I', r.tbl);
    execute format(
      'create trigger aa_enforce_sanction before insert on public.%I for each row execute function public.enforce_sanction(%L, %L)',
      r.tbl, r.col, r.lvl
    );
  end loop;
end;
$$;

-- forum_reply is SECURITY DEFINER and only knows about locks; a hidden topic must not take replies either.
create or replace function public.posts_block_hidden_topic()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not new.is_opening_post
     and exists (select 1 from public.topics t where t.id = new.topic_id and t.hidden_at is not null)
     and not public.is_staff(new.author_id) then
    raise exception 'topic_not_found' using errcode = 'P0002';
  end if;
  return new;
end;
$$;

drop trigger if exists ab_block_hidden_topic on public.posts;
create trigger ab_block_hidden_topic before insert on public.posts
for each row execute function public.posts_block_hidden_topic();

-- Re-reporting a handled post re-opens it for review.
create or replace function public.post_reports_reopen()
returns trigger
language plpgsql
as $$
begin
  if new.reason is distinct from old.reason and old.status <> 'open' then
    new.status := 'open';
    new.handled_by := null;
    new.handled_at := null;
    new.note := null;
    new.created_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists post_reports_reopen on public.post_reports;
create trigger post_reports_reopen before update on public.post_reports
for each row execute function public.post_reports_reopen();

-- ---------------------------------------------------------------- notifications: moderation kind, blocks
alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in (
  'reply', 'quote', 'mention', 'like', 'follow', 'category_topic',
  'meetup_join', 'meetup_cancelled', 'match_start', 'match_goal', 'match_end', 'badge', 'moderation'
));

-- 'moderation' is its own group; it is not in notification_settings, so members always receive it.
create or replace function public.notification_default(p_group text, p_channel text)
returns boolean
language sql
immutable
as $$
  select case
    when p_channel = 'in_app' then true
    else p_group in ('reply', 'quote', 'mention', 'follow', 'meetup', 'match', 'moderation')
  end;
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
  -- Nothing from members the recipient blocked (moderation notices come from staff and are never blocked).
  if p_actor is not null and p_kind <> 'moderation'
     and exists (select 1 from public.user_blocks b where b.blocker_id = p_user and b.blocked_id = p_actor) then
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

-- Moderation notices are sent without an actor (members see "GalaForum ekibi", not the moderator's name).
create or replace function public.notify_moderation(p_user uuid, p_data jsonb, p_topic uuid default null, p_post uuid default null)
returns void
language sql
security definer
set search_path = public
as $$
  select public.notify(p_user, 'moderation', null, (p_data ->> 'action') || ':' || gen_random_uuid()::text,
                       p_topic, p_post, p_data => p_data);
$$;

-- ---------------------------------------------------------------- report queue
-- One row per reported post, newest report first.
create or replace function public.mod_report_queue(p_status text default 'open', p_limit integer default 50)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v jsonb;
begin
  perform public.require_staff();
  if p_status not in ('open', 'closed') then
    raise exception 'invalid_status' using errcode = '22023';
  end if;
  select coalesce(jsonb_agg(c order by (c ->> 'lastReportedAt') desc), '[]'::jsonb) into v
  from (
    select jsonb_build_object(
      'postId', p.id,
      'topicId', t.id,
      'topicTitle', t.title,
      'topicHidden', t.hidden_at is not null,
      'body', left(p.body, 1000),
      'isOpeningPost', p.is_opening_post,
      'postRemoved', p.is_deleted,
      'postCreatedAt', p.created_at,
      'author', jsonb_build_object('id', a.id, 'username', a.username, 'avatarUrl', a.avatar_url, 'role', a.role),
      'authorSanction', public.sanction_level(a.id),
      'status', case when bool_or(r.status = 'open') then 'open'
                     when bool_or(r.status = 'resolved') then 'resolved' else 'dismissed' end,
      'reportCount', count(*),
      'firstReportedAt', min(r.created_at),
      'lastReportedAt', max(r.created_at),
      'reports', jsonb_agg(jsonb_build_object('reporter', u.username, 'reason', r.reason, 'createdAt', r.created_at, 'status', r.status)
                           order by r.created_at desc)
    ) c
    from public.post_reports r
    join public.posts p on p.id = r.post_id
    join public.topics t on t.id = p.topic_id
    join public.profiles a on a.id = p.author_id
    left join public.profiles u on u.id = r.reporter_id
    group by p.id, t.id, a.id
    having (p_status = 'open' and bool_or(r.status = 'open'))
        or (p_status = 'closed' and not bool_or(r.status = 'open'))
    order by max(r.created_at) desc
    limit least(greatest(coalesce(p_limit, 50), 1), 200)
  ) q;
  return v;
end;
$$;

create or replace function public.mod_open_report_count()
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.require_staff();
  return (select count(distinct post_id)::integer from public.post_reports where status = 'open');
end;
$$;

create or replace function public.mod_dismiss_reports(p_post_id uuid, p_note text default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_note text := public.clean_reason(p_note, false);
  v_count integer;
  v_title text;
begin
  perform public.require_staff();
  update public.post_reports
     set status = 'dismissed', handled_by = auth.uid(), handled_at = now(), note = nullif(v_note, '')
   where post_id = p_post_id and status = 'open';
  get diagnostics v_count = row_count;
  if v_count = 0 then
    raise exception 'nothing_to_do' using errcode = '22023';
  end if;
  select t.title into v_title from public.posts p join public.topics t on t.id = p.topic_id where p.id = p_post_id;
  perform public.log_moderation('report_dismiss', 'post', p_post_id::text, v_title, v_note, jsonb_build_object('reports', v_count));
  return v_count;
end;
$$;

-- ---------------------------------------------------------------- posts
create or replace function public.mod_remove_post(p_post_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reason text := public.clean_reason(p_reason, true);
  p record;
begin
  perform public.require_staff();
  select po.id, po.topic_id, po.author_id, po.is_opening_post, po.is_deleted, t.title
    into p
    from public.posts po join public.topics t on t.id = po.topic_id
   where po.id = p_post_id
   for update of po;
  if p.id is null then
    raise exception 'post_not_found' using errcode = 'P0002';
  end if;
  if p.is_opening_post then
    raise exception 'use_topic_hide' using errcode = '22023';
  end if;
  if p.is_deleted then
    raise exception 'nothing_to_do' using errcode = '22023';
  end if;
  update public.posts
     set is_deleted = true, removed_at = now(), removed_by = auth.uid(), removed_reason = v_reason
   where id = p_post_id;
  update public.topics set reply_count = greatest(0, reply_count - 1) where id = p.topic_id;
  update public.post_reports
     set status = 'resolved', handled_by = auth.uid(), handled_at = now(), note = v_reason
   where post_id = p_post_id and status = 'open';
  perform public.log_moderation('post_remove', 'post', p_post_id::text, p.title, v_reason,
    jsonb_build_object('topicId', p.topic_id, 'authorId', p.author_id));
  perform public.notify_moderation(p.author_id,
    jsonb_build_object('action', 'post_removed', 'topic_title', p.title, 'reason', v_reason), p.topic_id, null);
end;
$$;

create or replace function public.mod_restore_post(p_post_id uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reason text := public.clean_reason(p_reason, false);
  p record;
begin
  perform public.require_staff();
  select po.id, po.topic_id, po.is_deleted, po.removed_at, t.title
    into p
    from public.posts po join public.topics t on t.id = po.topic_id
   where po.id = p_post_id
   for update of po;
  if p.id is null then
    raise exception 'post_not_found' using errcode = 'P0002';
  end if;
  if not p.is_deleted or p.removed_at is null then
    raise exception 'nothing_to_do' using errcode = '22023';
  end if;
  update public.posts set is_deleted = false, removed_at = null, removed_by = null, removed_reason = null where id = p_post_id;
  update public.topics set reply_count = reply_count + 1 where id = p.topic_id;
  perform public.log_moderation('post_restore', 'post', p_post_id::text, p.title, v_reason, jsonb_build_object('topicId', p.topic_id));
end;
$$;

-- ---------------------------------------------------------------- topics
-- p_flag: 'pinned' | 'locked' | 'hidden'. Hiding requires a reason and notifies the author.
create or replace function public.mod_set_topic_flag(p_topic_id uuid, p_flag text, p_on boolean, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reason text := public.clean_reason(p_reason, p_flag = 'hidden' and p_on);
  t record;
  v_action text;
begin
  perform public.require_staff();
  if p_flag not in ('pinned', 'locked', 'hidden') or p_on is null then
    raise exception 'invalid_flag' using errcode = '22023';
  end if;
  select id, title, author_id, is_pinned, is_locked, hidden_at into t from public.topics where id = p_topic_id for update;
  if t.id is null then
    raise exception 'topic_not_found' using errcode = 'P0002';
  end if;
  if (p_flag = 'pinned' and t.is_pinned = p_on) or (p_flag = 'locked' and t.is_locked = p_on)
     or (p_flag = 'hidden' and (t.hidden_at is not null) = p_on) then
    raise exception 'nothing_to_do' using errcode = '22023';
  end if;

  if p_flag = 'pinned' then
    update public.topics set is_pinned = p_on where id = p_topic_id;
    v_action := case when p_on then 'topic_pin' else 'topic_unpin' end;
  elsif p_flag = 'locked' then
    update public.topics set is_locked = p_on where id = p_topic_id;
    v_action := case when p_on then 'topic_lock' else 'topic_unlock' end;
  else
    update public.topics
       set hidden_at = case when p_on then now() end,
           hidden_by = case when p_on then auth.uid() end,
           hidden_reason = case when p_on then v_reason end
     where id = p_topic_id;
    v_action := case when p_on then 'topic_hide' else 'topic_unhide' end;
    if p_on then
      -- Reports on any post of a hidden topic are settled by the hide.
      update public.post_reports r
         set status = 'resolved', handled_by = auth.uid(), handled_at = now(), note = v_reason
        from public.posts p
       where p.id = r.post_id and p.topic_id = p_topic_id and r.status = 'open';
      perform public.notify_moderation(t.author_id,
        jsonb_build_object('action', 'topic_hidden', 'topic_title', t.title, 'reason', v_reason));
    end if;
  end if;
  perform public.log_moderation(v_action, 'topic', p_topic_id::text, t.title, v_reason);
end;
$$;

create or replace function public.mod_move_topic(p_topic_id uuid, p_category_slug text, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reason text := public.clean_reason(p_reason, false);
  t record;
  v_cat uuid;
  v_from text;
begin
  perform public.require_staff();
  select id into v_cat from public.categories where slug = p_category_slug;
  if v_cat is null then
    raise exception 'category_not_found' using errcode = 'P0002';
  end if;
  select tp.id, tp.title, tp.category_id, c.slug into t
    from public.topics tp join public.categories c on c.id = tp.category_id
   where tp.id = p_topic_id
   for update of tp;
  if t.id is null then
    raise exception 'topic_not_found' using errcode = 'P0002';
  end if;
  if t.category_id = v_cat then
    raise exception 'nothing_to_do' using errcode = '22023';
  end if;
  v_from := t.slug;
  update public.topics set category_id = v_cat where id = p_topic_id;
  perform public.log_moderation('topic_move', 'topic', p_topic_id::text, t.title, v_reason,
    jsonb_build_object('from', v_from, 'to', p_category_slug));
end;
$$;

create or replace function public.mod_hidden_topics(p_limit integer default 50)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.require_staff();
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', t.id, 'title', t.title, 'hiddenAt', t.hidden_at, 'reason', t.hidden_reason,
      'author', a.username, 'hiddenBy', h.username, 'category', c.name) order by t.hidden_at desc)
    from (select * from public.topics where hidden_at is not null order by hidden_at desc
          limit least(greatest(coalesce(p_limit, 50), 1), 200)) t
    join public.profiles a on a.id = t.author_id
    join public.categories c on c.id = t.category_id
    left join public.profiles h on h.id = t.hidden_by
  ), '[]'::jsonb);
end;
$$;

-- ---------------------------------------------------------------- members
create or replace function public.mod_member(p_username text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  p record;
begin
  perform public.require_staff();
  select * into p from public.profiles where username = lower(btrim(p_username)) and deleted_at is null;
  if p.id is null then
    return null;
  end if;
  return jsonb_build_object(
    'author', jsonb_build_object('id', p.id, 'username', p.username, 'avatarUrl', p.avatar_url, 'role', p.role),
    'joinedAt', p.created_at,
    'postCount', (select count(*) from public.posts x where x.author_id = p.id and not x.is_deleted),
    'removedPostCount', (select count(*) from public.posts x where x.author_id = p.id and x.removed_at is not null),
    'openReportCount', (select count(distinct r.post_id) from public.post_reports r join public.posts x on x.id = r.post_id
                         where x.author_id = p.id and r.status = 'open'),
    'activeSanction', (select jsonb_build_object('id', s.id, 'kind', s.kind, 'reason', s.reason, 'endsAt', s.ends_at, 'createdAt', s.created_at)
                         from public.user_sanctions s
                        where s.user_id = p.id and s.revoked_at is null and s.starts_at <= now() and (s.ends_at is null or s.ends_at > now())
                        order by (s.kind = 'ban') desc, s.ends_at desc nulls first limit 1),
    'sanctions', coalesce((select jsonb_agg(jsonb_build_object(
                             'id', s.id, 'kind', s.kind, 'reason', s.reason, 'createdAt', s.created_at, 'endsAt', s.ends_at,
                             'revokedAt', s.revoked_at, 'by', b.username) order by s.created_at desc)
                           from (select * from public.user_sanctions where user_id = p.id order by created_at desc limit 20) s
                           left join public.profiles b on b.id = s.created_by), '[]'::jsonb)
  );
end;
$$;

-- p_hours null = until revoked. Staff cannot be sanctioned (an admin changes their role first).
create or replace function public.mod_sanction(p_username text, p_kind text, p_hours integer, p_reason text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reason text := public.clean_reason(p_reason, true);
  v_user record;
  v_id uuid;
  v_ends timestamptz;
begin
  perform public.require_staff();
  if p_kind not in ('mute', 'ban') then
    raise exception 'invalid_kind' using errcode = '22023';
  end if;
  if p_hours is not null and p_hours not between 1 and 8760 then
    raise exception 'invalid_duration' using errcode = '22023';
  end if;
  select id, username, role into v_user from public.profiles where username = lower(btrim(p_username)) and deleted_at is null;
  if v_user.id is null then
    raise exception 'user_not_found' using errcode = 'P0002';
  end if;
  if v_user.id = auth.uid() or v_user.role in ('moderator', 'admin') then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  v_ends := case when p_hours is null then null else now() + make_interval(hours => p_hours) end;
  insert into public.user_sanctions (user_id, kind, reason, ends_at, created_by)
  values (v_user.id, p_kind, v_reason, v_ends, auth.uid())
  returning id into v_id;
  perform public.log_moderation(case when p_kind = 'ban' then 'user_ban' else 'user_mute' end, 'user', v_user.id::text,
    v_user.username, v_reason, jsonb_build_object('hours', p_hours, 'endsAt', v_ends, 'sanctionId', v_id));
  perform public.notify_moderation(v_user.id,
    jsonb_build_object('action', case when p_kind = 'ban' then 'banned' else 'muted' end, 'reason', v_reason, 'ends_at', v_ends));
  return v_id;
end;
$$;

create or replace function public.mod_revoke_sanction(p_sanction_id uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reason text := public.clean_reason(p_reason, false);
  s record;
begin
  perform public.require_staff();
  select us.id, us.user_id, us.kind, us.revoked_at, p.username into s
    from public.user_sanctions us join public.profiles p on p.id = us.user_id
   where us.id = p_sanction_id
   for update of us;
  if s.id is null then
    raise exception 'sanction_not_found' using errcode = 'P0002';
  end if;
  if s.revoked_at is not null then
    raise exception 'nothing_to_do' using errcode = '22023';
  end if;
  update public.user_sanctions set revoked_at = now(), revoked_by = auth.uid(), revoke_reason = nullif(v_reason, '') where id = p_sanction_id;
  perform public.log_moderation('sanction_revoke', 'user', s.user_id::text, s.username, v_reason,
    jsonb_build_object('sanctionId', s.id, 'kind', s.kind));
  perform public.notify_moderation(s.user_id, jsonb_build_object('action', 'sanction_revoked', 'kind', s.kind));
end;
$$;

-- Admins only. An admin cannot change their own role (avoids locking the forum out of its last admin).
create or replace function public.mod_set_role(p_username text, p_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user record;
begin
  if auth.uid() is null then
    raise exception 'auth_required' using errcode = '28000';
  end if;
  if not public.is_admin(auth.uid()) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if p_role not in ('user', 'verified', 'moderator', 'admin') then
    raise exception 'invalid_role' using errcode = '22023';
  end if;
  select id, username, role into v_user from public.profiles where username = lower(btrim(p_username)) and deleted_at is null for update;
  if v_user.id is null then
    raise exception 'user_not_found' using errcode = 'P0002';
  end if;
  if v_user.id = auth.uid() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if v_user.role = p_role then
    raise exception 'nothing_to_do' using errcode = '22023';
  end if;
  update public.profiles set role = p_role where id = v_user.id;
  perform public.log_moderation('role_change', 'user', v_user.id::text, v_user.username, '',
    jsonb_build_object('from', v_user.role, 'to', p_role));
  perform public.notify_moderation(v_user.id, jsonb_build_object('action', 'role_changed', 'role', p_role));
end;
$$;

create or replace function public.mod_log(p_before bigint default null, p_limit integer default 50)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.require_staff();
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', l.id, 'action', l.action, 'targetType', l.target_type, 'targetId', l.target_id, 'targetLabel', l.target_label,
      'reason', l.reason, 'meta', l.meta, 'createdAt', l.created_at,
      'actor', case when a.id is null then null else jsonb_build_object('id', a.id, 'username', a.username, 'role', a.role) end
    ) order by l.id desc)
    from (select * from public.moderation_log where p_before is null or id < p_before order by id desc
          limit least(greatest(coalesce(p_limit, 50), 1), 200)) l
    left join public.profiles a on a.id = l.actor_id
  ), '[]'::jsonb);
end;
$$;

-- ---------------------------------------------------------------- member-facing
-- The caller's own active restriction (null when none), so the app can explain why posting fails.
create or replace function public.my_restriction()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object('kind', s.kind, 'reason', s.reason, 'endsAt', s.ends_at)
    from public.user_sanctions s
   where s.user_id = auth.uid() and s.revoked_at is null and s.starts_at <= now() and (s.ends_at is null or s.ends_at > now())
   order by (s.kind = 'ban') desc, s.ends_at desc nulls first
   limit 1;
$$;

-- Blocking hides the member's posts for the blocker (in the app), stops notifications from them and
-- removes follows in both directions.
create or replace function public.set_block(p_username text, p_on boolean)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target uuid;
begin
  if auth.uid() is null then
    raise exception 'auth_required' using errcode = '28000';
  end if;
  select id into v_target from public.profiles where username = lower(btrim(p_username)) and deleted_at is null;
  if v_target is null then
    raise exception 'user_not_found' using errcode = 'P0002';
  end if;
  if v_target = auth.uid() then
    raise exception 'self_block' using errcode = '22023';
  end if;
  if p_on then
    insert into public.user_blocks (blocker_id, blocked_id) values (auth.uid(), v_target) on conflict do nothing;
    delete from public.user_follows
     where (follower_id = auth.uid() and followee_id = v_target) or (follower_id = v_target and followee_id = auth.uid());
  else
    delete from public.user_blocks where blocker_id = auth.uid() and blocked_id = v_target;
  end if;
  return p_on;
end;
$$;

create or replace function public.my_blocks()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'username', p.username, 'avatarUrl', p.avatar_url, 'role', p.role)
                            order by b.created_at desc), '[]'::jsonb)
    from public.user_blocks b join public.profiles p on p.id = b.blocked_id
   where b.blocker_id = auth.uid();
$$;

-- ---------------------------------------------------------------- hidden topics out of profile/follow lists
create or replace function public.forum_profile(p_username text)
returns jsonb
language sql
stable
security definer
set search_path = public, extensions
as $$
  select jsonb_build_object(
    'author', jsonb_build_object('id', p.id, 'username', p.username, 'avatarUrl', p.avatar_url, 'role', p.role),
    'joinedAt', p.created_at,
    'topicCount', (select count(*) from public.topics t where t.author_id = p.id and t.hidden_at is null),
    'postCount', (select count(*) from public.posts x where x.author_id = p.id and not x.is_deleted),
    'likesReceived', (select count(*) from public.post_likes l join public.posts x on x.id = l.post_id
                      where x.author_id = p.id and not x.is_deleted),
    'recentTopics', coalesce((
      select jsonb_agg(r order by (r ->> 'lastActivityAt') desc)
      from (
        select jsonb_build_object(
          'id', t.id, 'title', t.title, 'replyCount', t.reply_count, 'lastActivityAt', t.last_activity_at,
          'category', jsonb_build_object('slug', c.slug, 'name', c.name)) r
        from public.topics t join public.categories c on c.id = t.category_id
        where t.author_id = p.id and t.hidden_at is null
        order by t.last_activity_at desc
        limit 10
      ) s), '[]'::jsonb)
  )
  from public.profiles p
  where p.username = lower(p_username) and p.deleted_at is null;
$$;

create or replace function public.my_follows()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'users', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'username', p.username, 'avatarUrl', p.avatar_url) order by p.username)
                       from public.user_follows f join public.profiles p on p.id = f.followee_id
                       where f.follower_id = auth.uid() and p.deleted_at is null), '[]'::jsonb),
    'topics', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'title', t.title) order by t.last_activity_at desc)
                        from public.topic_follows f join public.topics t on t.id = f.topic_id
                        where f.user_id = auth.uid() and t.hidden_at is null), '[]'::jsonb),
    'categories', coalesce((select jsonb_agg(c.slug order by c.sort_order)
                            from public.category_follows f join public.categories c on c.id = f.category_id
                            where f.user_id = auth.uid()), '[]'::jsonb)
  );
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
  delete from public.user_blocks where blocker_id = v_uid or blocked_id = v_uid;
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
  -- Sanctions and the moderation log are kept (tied to the anonymous tombstone) for accountability.
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

-- ---------------------------------------------------------------- grants
revoke all on function public.is_admin(uuid), public.require_staff(), public.log_moderation(text, text, text, text, text, jsonb),
  public.sanction_level(uuid), public.enforce_sanction(), public.post_reports_reopen(), public.posts_block_hidden_topic(),
  public.notify_moderation(uuid, jsonb, uuid, uuid)
  from public, anon, authenticated;

revoke all on function public.mod_report_queue(text, integer), public.mod_open_report_count(), public.mod_dismiss_reports(uuid, text),
  public.mod_remove_post(uuid, text), public.mod_restore_post(uuid, text), public.mod_set_topic_flag(uuid, text, boolean, text),
  public.mod_move_topic(uuid, text, text), public.mod_hidden_topics(integer), public.mod_member(text),
  public.mod_sanction(text, text, integer, text), public.mod_revoke_sanction(uuid, text), public.mod_set_role(text, text),
  public.mod_log(bigint, integer), public.my_restriction(), public.set_block(text, boolean), public.my_blocks()
  from public, anon;
grant execute on function public.mod_report_queue(text, integer), public.mod_open_report_count(), public.mod_dismiss_reports(uuid, text),
  public.mod_remove_post(uuid, text), public.mod_restore_post(uuid, text), public.mod_set_topic_flag(uuid, text, boolean, text),
  public.mod_move_topic(uuid, text, text), public.mod_hidden_topics(integer), public.mod_member(text),
  public.mod_sanction(text, text, integer, text), public.mod_revoke_sanction(uuid, text), public.mod_set_role(text, text),
  public.mod_log(bigint, integer), public.my_restriction(), public.set_block(text, boolean), public.my_blocks()
  to authenticated;

commit;
