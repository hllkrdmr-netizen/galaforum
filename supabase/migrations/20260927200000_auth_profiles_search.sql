-- Phase 4 — authentication support, public profiles, account deletion and real search.
-- Additive: apply after 20260927190000_other_sports_category.sql. Existing tables/content are preserved.
begin;

-- ---------------------------------------------------------------- profiles
-- Tombstones: deleting an account keeps the forum history readable ("silinmiş üye") while the
-- auth identity and personal data are removed. The profile row therefore must outlive auth.users.
alter table public.profiles add column if not exists deleted_at timestamptz;
alter table public.profiles drop constraint if exists profiles_id_fkey;

-- Usernames starting with "silinmis_" are reserved for tombstones.
create or replace function public.profiles_guard_username()
returns trigger
language plpgsql
set search_path = public, extensions
as $$
begin
  if new.username like 'silinmis\_%' and new.deleted_at is null then
    raise exception 'reserved_username' using errcode = '22023';
  end if;
  if tg_op = 'UPDATE' and old.deleted_at is not null and new.deleted_at is null then
    raise exception 'profile_deleted' using errcode = '22023';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard_username on public.profiles;
create trigger profiles_guard_username before insert or update of username, deleted_at on public.profiles
for each row execute function public.profiles_guard_username();

-- Sign-up: prefer the username chosen in the app (auth metadata) when it is valid and free.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  wanted text := lower(coalesce(new.raw_user_meta_data ->> 'username', ''));
  base text;
  candidate text;
begin
  if wanted ~ '^[a-z0-9_]{3,24}$'
     and wanted not like 'silinmis\_%'
     and not exists (select 1 from public.profiles where username = wanted) then
    candidate := wanted;
  else
    base := lower(regexp_replace(split_part(coalesce(new.email, 'uye'), '@', 1), '[^a-z0-9_]', '', 'g'));
    if base like 'silinmis%' then base := 'uye_' || base; end if;
    if char_length(base) < 3 then base := 'uye' || base; end if;
    base := left(base, 18);
    candidate := base;
    while exists (select 1 from public.profiles where username = candidate) loop
      candidate := base || '_' || substr(md5(random()::text), 1, 4);
    end loop;
  end if;
  insert into public.profiles (id, username) values (new.id, candidate);
  return new;
end;
$$;

-- Public availability check used by the sign-up form (usernames are public anyway).
create or replace function public.username_available(p_username text)
returns boolean
language sql
stable
security definer
set search_path = public, extensions
as $$
  select lower(coalesce(p_username, '')) ~ '^[a-z0-9_]{3,24}$'
     and lower(p_username) not like 'silinmis\_%'
     and not exists (select 1 from public.profiles where username = lower(p_username));
$$;

-- Public profile summary (no e-mail or private data).
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
    'topicCount', (select count(*) from public.topics t where t.author_id = p.id),
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
        where t.author_id = p.id
        order by t.last_activity_at desc
        limit 10
      ) s), '[]'::jsonb)
  )
  from public.profiles p
  where p.username = lower(p_username) and p.deleted_at is null;
$$;

-- Self-service account deletion (App Store / Play requirement).
-- Removes personal data and the auth identity; posts remain under an anonymous tombstone.
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
  delete from public.post_likes where user_id = v_uid;
  delete from public.poll_votes where user_id = v_uid;
  delete from public.post_reports where reporter_id = v_uid;
  delete from public.post_mentions where user_id = v_uid;
  update public.profiles
     set username = 'silinmis_' || substr(replace(v_uid::text, '-', ''), 1, 10),
         avatar_url = null,
         role = 'user',
         deleted_at = now()
   where id = v_uid;
  delete from auth.users where id = v_uid;
end;
$$;

-- ---------------------------------------------------------------- search
create index if not exists topics_title_fts_idx on public.topics using gin (to_tsvector('turkish', title));
create index if not exists posts_body_fts_idx on public.posts using gin (to_tsvector('turkish', body)) where not is_deleted;
create index if not exists topics_author_idx on public.topics (author_id, last_activity_at desc);
create index if not exists posts_author_idx on public.posts (author_id, created_at desc) where not is_deleted;

-- Ranked topic search: full-text (Turkish stemming) + trigram fallback for partial words.
-- Filters: category slug, author username, activity since; sort: relevance | newest | replies.
create or replace function public.forum_search_topics(
  p_query text,
  p_category text default null,
  p_author text default null,
  p_since timestamptz default null,
  p_sort text default 'relevance',
  p_limit integer default 20
)
returns table (id uuid, score real)
language plpgsql
stable
security invoker
set search_path = public, extensions
as $$
declare
  q text := btrim(coalesce(p_query, ''));
  pat text;
  tsq tsquery;
begin
  if char_length(q) > 100 or (char_length(q) < 2 and p_author is null) then
    raise exception 'invalid_query' using errcode = '22023';
  end if;
  pat := '%' || replace(replace(replace(q, '\', '\\'), '%', '\%'), '_', '\_') || '%';
  if q <> '' then
    tsq := websearch_to_tsquery('turkish', q);
  end if;
  return query
    select t.id,
           (case when q = '' then 0
                 else ts_rank(to_tsvector('turkish', t.title), tsq) * 2 + word_similarity(q, t.title) end)::real
    from public.topics t
    join public.categories c on c.id = t.category_id
    join public.profiles a on a.id = t.author_id
    where (q = '' or to_tsvector('turkish', t.title) @@ tsq or t.title ilike pat)
      and (p_category is null or c.slug = p_category)
      and (p_author is null or a.username = lower(p_author))
      and (p_since is null or t.last_activity_at >= p_since)
    order by
      case when p_sort = 'replies' then t.reply_count end desc nulls last,
      case when p_sort = 'newest' then t.last_activity_at end desc nulls last,
      2 desc,
      t.last_activity_at desc
    limit least(greatest(coalesce(p_limit, 20), 1), 50);
end;
$$;

create or replace function public.forum_search_posts(
  p_query text,
  p_category text default null,
  p_author text default null,
  p_since timestamptz default null,
  p_sort text default 'relevance',
  p_limit integer default 20
)
returns table (id uuid, score real)
language plpgsql
stable
security invoker
set search_path = public, extensions
as $$
declare
  q text := btrim(coalesce(p_query, ''));
  pat text;
  tsq tsquery;
begin
  if char_length(q) > 100 or (char_length(q) < 2 and p_author is null) then
    raise exception 'invalid_query' using errcode = '22023';
  end if;
  pat := '%' || replace(replace(replace(q, '\', '\\'), '%', '\%'), '_', '\_') || '%';
  if q <> '' then
    tsq := websearch_to_tsquery('turkish', q);
  end if;
  return query
    select x.id,
           (case when q = '' then 0
                 else ts_rank(to_tsvector('turkish', x.body), tsq) * 2 + word_similarity(q, x.body) end)::real
    from public.posts x
    join public.topics t on t.id = x.topic_id
    join public.categories c on c.id = t.category_id
    join public.profiles a on a.id = x.author_id
    where not x.is_deleted
      and (q = '' or to_tsvector('turkish', x.body) @@ tsq or x.body ilike pat)
      and (p_category is null or c.slug = p_category)
      and (p_author is null or a.username = lower(p_author))
      and (p_since is null or x.created_at >= p_since)
    order by
      case when p_sort = 'replies' then t.reply_count end desc nulls last,
      case when p_sort = 'newest' then x.created_at end desc nulls last,
      2 desc,
      x.created_at desc
    limit least(greatest(coalesce(p_limit, 20), 1), 50);
end;
$$;

-- ---------------------------------------------------------------- grants
revoke all on function public.username_available(text) from public;
revoke all on function public.forum_profile(text) from public;
revoke all on function public.delete_my_account() from public, anon;
revoke all on function public.forum_search_topics(text, text, text, timestamptz, text, integer) from public;
revoke all on function public.forum_search_posts(text, text, text, timestamptz, text, integer) from public;
revoke all on function public.profiles_guard_username() from public, anon, authenticated;
grant execute on function public.username_available(text) to anon, authenticated;
grant execute on function public.forum_profile(text) to anon, authenticated;
grant execute on function public.delete_my_account() to authenticated;
grant execute on function public.forum_search_topics(text, text, text, timestamptz, text, integer) to anon, authenticated;
grant execute on function public.forum_search_posts(text, text, text, timestamptz, text, integer) to anon, authenticated;

commit;
