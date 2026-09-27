-- Phase 3 is additive. Apply after 20260927120000_forum_core.sql.
begin;
alter table public.posts add column quote_post_id uuid references public.posts(id) on delete set null;
create index posts_page_idx on public.posts(topic_id, created_at, id) where not is_deleted;
create table public.post_likes (
  post_id uuid references public.posts(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  primary key(post_id, user_id)
);
create table public.post_mentions (
  post_id uuid references public.posts(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  primary key(post_id, user_id)
);
create table public.post_reports (
  post_id uuid references public.posts(id) on delete cascade,
  reporter_id uuid references public.profiles(id) on delete cascade,
  reason text not null check(char_length(btrim(reason)) between 5 and 1000),
  created_at timestamptz not null default now(),
  primary key(post_id, reporter_id)
);
create table public.polls (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null unique references public.topics(id) on delete cascade,
  question text not null check(char_length(btrim(question)) between 3 and 200)
);
create table public.poll_options (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.polls(id) on delete cascade,
  label text not null check(char_length(btrim(label)) between 1 and 100),
  position integer not null check(position between 1 and 6),
  unique(poll_id, position), unique(poll_id, id)
);
create unique index poll_options_label_idx on public.poll_options(poll_id, lower(btrim(label)));
create table public.poll_votes (
  poll_id uuid references public.polls(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  option_id uuid not null,
  primary key(poll_id, user_id),
  foreign key(poll_id, option_id) references public.poll_options(poll_id, id) on delete cascade
);
alter table public.post_likes enable row level security;
alter table public.post_mentions enable row level security;
alter table public.post_reports enable row level security;
alter table public.polls enable row level security;
alter table public.poll_options enable row level security;
alter table public.poll_votes enable row level security;
-- All writes are through narrow authenticated RPCs. Reports and votes are private.
revoke all on public.post_likes, public.post_mentions, public.post_reports, public.polls, public.poll_options, public.poll_votes from anon, authenticated;
grant select on public.post_likes, public.post_mentions, public.polls, public.poll_options to anon, authenticated;
grant select on public.post_reports, public.poll_votes to authenticated;
create policy "visible post likes" on public.post_likes for select using (exists(select 1 from public.posts p where p.id = post_id and not p.is_deleted));
create policy "visible post mentions" on public.post_mentions for select using (exists(select 1 from public.posts p where p.id = post_id and not p.is_deleted));
create policy "own or staff reports" on public.post_reports for select to authenticated using(reporter_id = auth.uid() or public.is_staff(auth.uid()));
create policy "public polls" on public.polls for select using(true);
create policy "public options" on public.poll_options for select using(true);
create policy "own votes" on public.poll_votes for select to authenticated using(user_id = auth.uid());

-- Replace the permissive direct reply path so clients cannot forge dates or quote links.
drop policy "members reply to open topics" on public.posts;
revoke insert on public.posts from anon, authenticated;

create function public.forum_capture_mentions() returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from public.post_mentions where post_id = new.id;
  if not new.is_deleted then
    insert into public.post_mentions(post_id, user_id)
    select distinct new.id, p.id from regexp_matches(new.body, '(?:^|[^a-zA-Z0-9_@])@([a-zA-Z0-9_]{3,24})(?![a-zA-Z0-9_])', 'g') m
    join public.profiles p on p.username = lower(m[1]) on conflict do nothing;
  end if;
  return new;
end $$;
create trigger capture_post_mentions after insert or update of body, is_deleted on public.posts for each row execute function public.forum_capture_mentions();

create function public.forum_reply(p_topic_id uuid, p_body text, p_quote_id uuid default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_locked boolean;
begin
  if auth.uid() is null then raise exception 'auth_required' using errcode='28000'; end if;
  select is_locked into v_locked from public.topics where id=p_topic_id for update;
  if not found then raise exception 'topic_not_found' using errcode='P0002'; end if;
  if v_locked or p_body is null or char_length(btrim(p_body)) not between 1 and 10000 then raise exception 'invalid_reply' using errcode='22023'; end if;
  if p_quote_id is not null and not exists(select 1 from public.posts where id=p_quote_id and topic_id=p_topic_id and not is_deleted) then raise exception 'invalid_quote' using errcode='22023'; end if;
  insert into public.posts(topic_id, author_id, body, quote_post_id) values(p_topic_id, auth.uid(), btrim(p_body), p_quote_id) returning id into v_id;
  return v_id;
end $$;
create function public.forum_set_like(p_post_id uuid, p_liked boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'auth_required' using errcode='28000'; end if;
  if not exists(select 1 from public.posts where id=p_post_id and not is_deleted) then raise exception 'post_not_found' using errcode='P0002'; end if;
  if p_liked then insert into public.post_likes values(p_post_id, auth.uid()) on conflict do nothing;
  else delete from public.post_likes where post_id=p_post_id and user_id=auth.uid(); end if;
end $$;
create function public.forum_report(p_post_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'auth_required' using errcode='28000'; end if;
  if not exists(select 1 from public.posts where id=p_post_id and not is_deleted) then raise exception 'post_not_found' using errcode='P0002'; end if;
  if p_reason is null or char_length(btrim(p_reason)) not between 5 and 1000 then raise exception 'invalid_reason' using errcode='22023'; end if;
  insert into public.post_reports(post_id, reporter_id, reason) values(p_post_id, auth.uid(), btrim(p_reason))
    on conflict(post_id, reporter_id) do update set reason=excluded.reason;
end $$;
create function public.forum_create_topic(p_category_slug text, p_title text, p_body text, p_poll jsonb default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_topic uuid; v_poll uuid; v_label text; v_pos integer := 0;
begin
  if auth.uid() is null then raise exception 'auth_required' using errcode='28000'; end if;
  if p_poll is not null then
    if jsonb_typeof(p_poll) <> 'object' or jsonb_typeof(p_poll->'options') is distinct from 'array' or jsonb_typeof(p_poll->'question') is distinct from 'string' then raise exception 'invalid_poll' using errcode='22023'; end if;
    if jsonb_array_length(p_poll->'options') not between 2 and 6 or char_length(btrim(p_poll->>'question')) not between 3 and 200 then raise exception 'invalid_poll' using errcode='22023'; end if;
    if exists(select 1 from jsonb_array_elements(p_poll->'options') o where jsonb_typeof(o) <> 'string') then raise exception 'invalid_options' using errcode='22023'; end if;
  end if;
  v_topic := public.create_topic(p_category_slug, p_title, p_body);
  if p_poll is not null then
    insert into public.polls(topic_id, question) values(v_topic, btrim(p_poll->>'question')) returning id into v_poll;
    for v_label in select jsonb_array_elements_text(p_poll->'options') loop
      v_pos := v_pos + 1;
      insert into public.poll_options(poll_id, label, position) values(v_poll, btrim(v_label), v_pos);
    end loop;
  end if;
  return v_topic;
end $$;
create function public.forum_vote(p_poll_id uuid, p_option_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_locked boolean;
begin
  if auth.uid() is null then raise exception 'auth_required' using errcode='28000'; end if;
  select t.is_locked into v_locked from public.topics t join public.polls p on p.topic_id=t.id where p.id=p_poll_id for update of t;
  if not found then raise exception 'poll_not_found' using errcode='P0002'; end if;
  if v_locked or not exists(select 1 from public.poll_options where id=p_option_id and poll_id=p_poll_id) then raise exception 'invalid_vote' using errcode='22023'; end if;
  insert into public.poll_votes(poll_id, user_id, option_id) values(p_poll_id, auth.uid(), p_option_id)
    on conflict(poll_id, user_id) do update set option_id=excluded.option_id;
end $$;
-- Aggregation exposes totals and the caller's selection, never other voters' identities.
create function public.forum_poll(p_topic_id uuid) returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', p.id, 'question', p.question,
    'myOptionId', (select option_id from public.poll_votes where poll_id=p.id and user_id=auth.uid()),
    'totalVotes', (select count(*) from public.poll_votes where poll_id=p.id),
    'options', (select jsonb_agg(jsonb_build_object('id', o.id, 'label', o.label, 'votes', (select count(*) from public.poll_votes v where v.option_id=o.id)) order by o.position) from public.poll_options o where o.poll_id=p.id))
  from public.polls p where p.topic_id=p_topic_id;
$$;
create function public.forum_post_page(p_topic_id uuid, p_offset integer default 0, p_size integer default 20) returns jsonb
language plpgsql stable security invoker set search_path = public as $$
declare result jsonb;
begin
  if p_offset is null or p_offset < 0 or p_size is null or p_size not between 1 and 100 then raise exception 'invalid_page' using errcode='22023'; end if;
  select coalesce(jsonb_agg(row_data order by created_at, id), '[]'::jsonb) into result from (
    select p.created_at, p.id, jsonb_build_object(
      'id', p.id, 'topicId', p.topic_id, 'body', p.body, 'createdAt', p.created_at, 'isOpeningPost', p.is_opening_post,
      'author', jsonb_build_object('id', a.id, 'username', a.username, 'avatarUrl', a.avatar_url, 'role', a.role),
      'likeCount', (select count(*) from public.post_likes l where l.post_id=p.id),
      'likedByMe', exists(select 1 from public.post_likes l where l.post_id=p.id and l.user_id=auth.uid()),
      'quote', (select jsonb_build_object('id', q.id, 'body', q.body, 'username', u.username) from public.posts q join public.profiles u on u.id=q.author_id where q.id=p.quote_post_id and not q.is_deleted),
      'mentions', coalesce((select jsonb_agg(jsonb_build_object('id', u.id, 'username', u.username)) from public.post_mentions m join public.profiles u on u.id=m.user_id where m.post_id=p.id), '[]'::jsonb)
    ) row_data from public.posts p join public.profiles a on a.id=p.author_id
    where p.topic_id=p_topic_id and not p.is_deleted order by p.created_at, p.id offset p_offset limit p_size+1
  ) rows;
  return result;
end $$;
revoke all on function public.forum_capture_mentions() from public, anon, authenticated;
revoke all on function public.forum_reply(uuid,text,uuid), public.forum_set_like(uuid,boolean), public.forum_report(uuid,text), public.forum_create_topic(text,text,text,jsonb), public.forum_vote(uuid,uuid), public.forum_poll(uuid), public.forum_post_page(uuid,integer,integer) from public, anon, authenticated;
grant execute on function public.forum_reply(uuid,text,uuid), public.forum_set_like(uuid,boolean), public.forum_report(uuid,text), public.forum_create_topic(text,text,text,jsonb), public.forum_vote(uuid,uuid) to authenticated;
grant execute on function public.forum_poll(uuid), public.forum_post_page(uuid,integer,integer) to anon, authenticated;
commit;
