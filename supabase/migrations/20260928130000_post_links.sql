-- Deep links to a post and "removed by a moderator" placeholders.
-- Additive: apply after 20260928120000_match_admin.sql.
--
-- forum_post_page now returns posts removed by moderators as placeholders ({"removed": true}, no body,
-- author, likes, quote or mentions) so the thread keeps its numbering and replies that quoted them still
-- make sense. It becomes SECURITY DEFINER to see those rows (RLS hides them) and therefore re-applies the
-- visibility rules itself: hidden topics only for staff, other deleted posts never.
begin;

create or replace function public.forum_post_page(p_topic_id uuid, p_offset integer default 0, p_size integer default 20)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if p_offset is null or p_offset < 0 or p_size is null or p_size not between 1 and 100 then
    raise exception 'invalid_page' using errcode = '22023';
  end if;
  if not exists (select 1 from public.topics t where t.id = p_topic_id and (t.hidden_at is null or public.is_staff(auth.uid()))) then
    return '[]'::jsonb;
  end if;
  select coalesce(jsonb_agg(row_data order by created_at, id), '[]'::jsonb) into result from (
    select p.created_at, p.id,
      case when p.is_deleted then
        jsonb_build_object(
          'id', p.id, 'topicId', p.topic_id, 'body', '', 'createdAt', p.created_at, 'isOpeningPost', p.is_opening_post,
          'removed', true,
          'author', jsonb_build_object('id', null, 'username', '', 'avatarUrl', null, 'role', 'user'),
          'likeCount', 0, 'likedByMe', false, 'quote', null, 'mentions', '[]'::jsonb)
      else
        jsonb_build_object(
          'id', p.id, 'topicId', p.topic_id, 'body', p.body, 'createdAt', p.created_at, 'isOpeningPost', p.is_opening_post,
          'author', jsonb_build_object('id', a.id, 'username', a.username, 'avatarUrl', a.avatar_url, 'role', a.role),
          'likeCount', (select count(*) from public.post_likes l where l.post_id = p.id),
          'likedByMe', exists (select 1 from public.post_likes l where l.post_id = p.id and l.user_id = auth.uid()),
          'quote', (select jsonb_build_object('id', q.id, 'body', q.body, 'username', u.username)
                      from public.posts q join public.profiles u on u.id = q.author_id
                     where q.id = p.quote_post_id and not q.is_deleted),
          'mentions', coalesce((select jsonb_agg(jsonb_build_object('id', u.id, 'username', u.username))
                                  from public.post_mentions m join public.profiles u on u.id = m.user_id
                                 where m.post_id = p.id), '[]'::jsonb))
      end as row_data
    from public.posts p
    join public.profiles a on a.id = p.author_id
    where p.topic_id = p_topic_id and (not p.is_deleted or p.removed_at is not null)
    order by p.created_at, p.id
    offset p_offset limit p_size + 1
  ) rows;
  return result;
end;
$$;

-- 0-based position of a post in its thread (same order and rows as forum_post_page); null when the post
-- or its topic is not visible to the caller.
create or replace function public.forum_post_position(p_topic_id uuid, p_post_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select (
    select count(*)::integer
      from public.posts x
     where x.topic_id = p.topic_id
       and (not x.is_deleted or x.removed_at is not null)
       and (x.created_at, x.id) < (p.created_at, p.id)
  )
  from public.posts p
  join public.topics t on t.id = p.topic_id
  where p.id = p_post_id
    and p.topic_id = p_topic_id
    and (not p.is_deleted or p.removed_at is not null)
    and (t.hidden_at is null or public.is_staff(auth.uid()));
$$;

revoke all on function public.forum_post_page(uuid, integer, integer), public.forum_post_position(uuid, uuid) from public;
grant execute on function public.forum_post_page(uuid, integer, integer), public.forum_post_position(uuid, uuid) to anon, authenticated;

commit;
