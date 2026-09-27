-- Phase 6 behaviour checks. Expected errors: role update denied, self_follow, invalid_kind, anon set_follow/topic_follows denied, invalid_date, half coordinates, meetup_full, organizer_cannot_leave, not_allowed cancel, direct meetup insert denied.
\set ON_ERROR_STOP 1
\pset footer off
insert into auth.users (id, email, raw_user_meta_data) values
 ('bbbbbbbb-0000-0000-0000-000000000001','a@x.com','{"username":"ayse_gs"}'),
 ('bbbbbbbb-0000-0000-0000-000000000002','b@x.com','{"username":"burak_gs"}'),
 ('bbbbbbbb-0000-0000-0000-000000000003','c@x.com','{"username":"cem_gs"}');
select p.username, array_agg(ub.badge_id order by ub.badge_id) as badges from public.profiles p join public.user_badges ub on ub.user_id=p.id group by p.username order by 1;

set role authenticated;
select set_config('request.jwt.claim.sub','bbbbbbbb-0000-0000-0000-000000000001',false);
-- profile fields
update public.profiles set bio='Ultra değil ama tribünde yerim belli.', city='İstanbul', favorite_category_id=(select id from public.categories where slug='mac-taktik') where id='bbbbbbbb-0000-0000-0000-000000000001';
\set ON_ERROR_STOP 0
update public.profiles set role='admin' where id='bbbbbbbb-0000-0000-0000-000000000001';
select public.set_follow('user','ayse_gs',true);
select public.set_follow('nope','x',true);
\set ON_ERROR_STOP 1
select public.set_follow('user','burak_gs',true), public.set_follow('user','burak_gs',true) as idempotent;
select public.set_follow('category','transfer',true);
select public.forum_create_topic('mac-taktik','Taktik konusu deneme','İçerik içerik içerik') as t \gset
select public.set_follow('topic', :'t', true);
select public.my_follows();
-- 25 posts in mac-taktik -> taktikci
do $$ begin for i in 1..24 loop perform public.forum_reply((select id from public.topics limit 1), 'Taktik yanıtı ' || i); end loop; end $$;
reset role; set role anon; select set_config('request.jwt.claim.sub','',false);
select public.community_profile('Ayse_GS') - 'userId' as ayse;
select username, post_count from public.active_members(30, 5);
\set ON_ERROR_STOP 0
select public.set_follow('user','burak_gs',true);
select * from public.topic_follows;
\set ON_ERROR_STOP 1

-- meetups
reset role; set role authenticated; select set_config('request.jwt.claim.sub','bbbbbbbb-0000-0000-0000-000000000002',false);
\set ON_ERROR_STOP 0
select public.create_meetup('Geçmiş buluşma','x', now() - interval '1 day','İstanbul','Bar');
select public.create_meetup('Koordinat yarım','x', now() + interval '2 days','İstanbul','Bar','',41.0,null);
\set ON_ERROR_STOP 1
select public.create_meetup('Derbi öncesi Kadıköy buluşması','Maçtan önce birlikte yürüyelim.', now() + interval '2 days','İstanbul','Rıhtım','Kadıköy iskele',40.991,29.023,2) as m \gset
select set_config('request.jwt.claim.sub','bbbbbbbb-0000-0000-0000-000000000003',false);
select public.set_meetup_attendance(:'m', true) as count_after_cem;
select set_config('request.jwt.claim.sub','bbbbbbbb-0000-0000-0000-000000000001',false);
\set ON_ERROR_STOP 0
select public.set_meetup_attendance(:'m', true);
\set ON_ERROR_STOP 1
select set_config('request.jwt.claim.sub','bbbbbbbb-0000-0000-0000-000000000002',false);
\set ON_ERROR_STOP 0
select public.set_meetup_attendance(:'m', false);
\set ON_ERROR_STOP 1
select set_config('request.jwt.claim.sub','bbbbbbbb-0000-0000-0000-000000000001',false);
\set ON_ERROR_STOP 0
select public.cancel_meetup(:'m');
insert into public.meetups (title, starts_at, city, place_name) values ('Doğrudan ekleme', now()+interval '1 day','x','y');
\set ON_ERROR_STOP 1
select set_config('request.jwt.claim.sub','bbbbbbbb-0000-0000-0000-000000000002',false);
select public.cancel_meetup(:'m');
select cancelled from public.meetups where id=:'m';

-- deletion cleans community data
select set_config('request.jwt.claim.sub','bbbbbbbb-0000-0000-0000-000000000001',false);
select public.delete_my_account();
reset role;
select (select count(*) from public.user_follows) as follows_left, (select count(*) from public.topic_follows) as topic_follows_left,
       (select count(*) from public.user_badges where user_id='bbbbbbbb-0000-0000-0000-000000000001') as ayse_badges_left,
       (select bio is null and city is null from public.profiles where id='bbbbbbbb-0000-0000-0000-000000000001') as profile_cleared;
