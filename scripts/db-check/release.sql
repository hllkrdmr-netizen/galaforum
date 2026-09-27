-- Release gate for the database schema. Run after applying every migration (locally with the shim, or
-- against a staging Supabase project in the SQL editor). Raises an exception on the first failed check;
-- prints "release checks passed" otherwise.
\set ON_ERROR_STOP 1
do $$
declare
  r record;
  -- Tables that clients may write directly (under RLS). Everything else is written through RPCs/triggers.
  allowed_write_policies text[] := array[
    'lineups:members delete own lineups',
    'lineups:members save own lineups',
    'match_events:staff manage match events',
    'matches:staff manage matches',
    'profiles:users update own profile',
    'squad_players:staff manage squad'
  ];
  -- SECURITY DEFINER functions anonymous visitors may call (read-only public data).
  anon_definer text[] := array[
    'active_members', 'community_profile', 'forum_poll', 'forum_profile', 'increment_topic_view',
    'is_staff', 'match_reaction_counts', 'username_available',
    -- trigger functions: not callable outside a trigger
    'handle_new_user', 'on_post_inserted'
  ];
begin
  -- 1. RLS on every table in public.
  for r in
    select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
  loop
    raise exception 'RLS disabled on public.%', r.relname;
  end loop;

  -- 2. Only the expected write policies exist.
  for r in
    select tablename || ':' || policyname as k from pg_policies where schemaname = 'public' and cmd <> 'SELECT'
  loop
    if not r.k = any (allowed_write_policies) then
      raise exception 'Unexpected write policy %', r.k;
    end if;
  end loop;

  -- 3. Every SECURITY DEFINER function pins search_path.
  for r in
    select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.prosecdef
       and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')
  loop
    raise exception 'SECURITY DEFINER function %() has no fixed search_path', r.proname;
  end loop;

  -- 4. Anonymous visitors can run only the public read functions.
  for r in
    select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.prosecdef and has_function_privilege('anon', p.oid, 'execute')
  loop
    if not r.proname = any (anon_definer) then
      raise exception 'anon can execute SECURITY DEFINER function %()', r.proname;
    end if;
  end loop;

  -- 5. Internal helpers are not callable by members.
  foreach r.proname in array array['notify', 'log_moderation', 'enforce_sanction', 'claim_push_batch', 'prune_notifications', 'award_badges'] loop
    if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                where n.nspname = 'public' and p.proname = r.proname and has_function_privilege('authenticated', p.oid, 'execute')) then
      raise exception 'authenticated can execute internal function %()', r.proname;
    end if;
  end loop;

  -- 6. Members cannot update topics/posts directly, nor a profile's role.
  if has_table_privilege('authenticated', 'public.topics', 'update') or has_table_privilege('authenticated', 'public.posts', 'update') then
    raise exception 'authenticated has UPDATE on topics/posts';
  end if;
  if has_column_privilege('authenticated', 'public.profiles', 'role', 'update') then
    raise exception 'authenticated can update profiles.role';
  end if;

  -- 7. Seeded reference data.
  if (select count(*) from public.categories) < 12 then
    raise exception 'expected 12 categories, found %', (select count(*) from public.categories);
  end if;
  if (select count(*) from public.badges) < 9 then
    raise exception 'badges not seeded';
  end if;

  raise notice 'release checks passed';
end;
$$;
