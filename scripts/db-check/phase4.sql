-- Phase 4 behaviour checks. Expected errors: invalid_query, permission denied (delete_my_account as anon, deleted_at update), reserved_username (x2).
\set ON_ERROR_STOP 1
\pset footer off
insert into auth.users (id, email, raw_user_meta_data) values
 ('11111111-1111-1111-1111-111111111111','ali@example.com','{"username":"Aslan_Ali"}'),
 ('22222222-2222-2222-2222-222222222222','veli@example.com','{"username":"aslan_ali"}'),
 ('33333333-3333-3333-3333-333333333333','x@example.com','{"username":"silinmis_hack"}');
select id, username from public.profiles order by username;
set role anon;
select public.username_available('aslan_ali') as taken_false, public.username_available('yeni_uye') as free_true, public.username_available('silinmis_abc') as reserved_false, public.username_available('A!') as invalid_false;
reset role;

-- content by ali
set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false);
select public.forum_create_topic('mac-taktik','Derbide çift pivot tercihi','Orta sahada iki ön libero ile oynamak savunmayı güçlendirir.') as t1 \gset
select public.forum_reply(:'t1','Pivotlar önde pres yaparsa kanatlar açılır.') as p2 \gset
select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',false);
select public.forum_create_topic('transfer','Kış transferi için stoper önerileri','Sol ayaklı bir stoper şart diye düşünüyorum.') as t2 \gset
select public.forum_set_like(:'p2', true);
reset role;

-- search as anon
set role anon;
select set_config('request.jwt.claim.sub','',false);
select 'fts stem' as case, count(*) from public.forum_search_topics('pivotlar');
select 'partial' as case, count(*) from public.forum_search_topics('stop');
select 'category filter' as case, count(*) from public.forum_search_topics('pivot', 'transfer');
select 'author only' as case, count(*) from public.forum_search_topics('', null, 'aslan_ali');
select 'posts body' as case, count(*) from public.forum_search_posts('kanatlar');
select 'posts since future' as case, count(*) from public.forum_search_posts('kanatlar', null, null, now() + interval '1 day');
\set ON_ERROR_STOP 0
select public.forum_search_topics('a');
select public.delete_my_account();
\set ON_ERROR_STOP 1
select public.forum_profile('Aslan_Ali') ->> 'topicCount' as ali_topics, public.forum_profile('aslan_ali') ->> 'postCount' as ali_posts, public.forum_profile('aslan_ali') ->> 'likesReceived' as ali_likes;
reset role;

-- username rules on update
set role authenticated;
select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',false);
\set ON_ERROR_STOP 0
update public.profiles set username='silinmis_fake' where id='22222222-2222-2222-2222-222222222222';
update public.profiles set deleted_at=now() where id='22222222-2222-2222-2222-222222222222';
\set ON_ERROR_STOP 1
update public.profiles set username='veli_gs' where id='22222222-2222-2222-2222-222222222222';
select username from public.profiles where id='22222222-2222-2222-2222-222222222222';

-- ali deletes account
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false);
select public.delete_my_account();
reset role;
select count(*) as auth_rows_for_ali from auth.users where id='11111111-1111-1111-1111-111111111111';
select username, deleted_at is not null as tombstone from public.profiles where id='11111111-1111-1111-1111-111111111111';
select count(*) as ali_posts_remaining from public.posts where author_id='11111111-1111-1111-1111-111111111111';
select count(*) as likes_by_veli_still from public.post_likes;
select public.forum_profile('aslan_ali') is null as profile_hidden;
set role anon;
select jsonb_array_length(public.forum_post_page(:'t1')) as page_rows_visible;
select public.username_available('aslan_ali') as name_reusable;
reset role;
-- tombstone cannot be resurrected
\set ON_ERROR_STOP 0
update public.profiles set deleted_at=null where id='11111111-1111-1111-1111-111111111111';
\set ON_ERROR_STOP 1
