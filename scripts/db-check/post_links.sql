-- Post deep links and removed-post placeholders. Expected errors: none.
\set ON_ERROR_STOP 1
\pset footer off
insert into auth.users (id, email, raw_user_meta_data) values
 ('abababab-0000-0000-0000-00000000000b','m@x.com','{"username":"link_mod"}'),
 ('abababab-0000-0000-0000-000000000001','u@x.com','{"username":"link_uye"}');
update public.profiles set role = 'moderator' where username = 'link_mod';

set role authenticated;
select set_config('request.jwt.claim.sub','abababab-0000-0000-0000-000000000001',false);
select public.forum_create_topic('serbest','Bağlantı deneme konusu','Açılış mesajı.') as t \gset
select public.forum_reply(:'t', 'Birinci yanıt') as p1 \gset
select public.forum_reply(:'t', 'İkinci yanıt, kaldırılacak') as p2 \gset
select public.forum_reply(:'t', 'Üçüncü yanıt') as p3 \gset

\echo '== positions (0 = opening post)'
select public.forum_post_position(:'t', :'p1') as p1, public.forum_post_position(:'t', :'p3') as p3,
       public.forum_post_position(:'t', gen_random_uuid()) as unknown;

select set_config('request.jwt.claim.sub','abababab-0000-0000-0000-00000000000b',false);
select public.mod_remove_post(:'p2', 'Kişisel saldırı');

\echo '== removed post stays as a placeholder with no content; numbering unchanged'
reset role; set role anon; select set_config('request.jwt.claim.sub','',false);
select e ->> 'body' as body, coalesce(e ->> 'removed', 'false') as removed, e -> 'author' ->> 'username' as author
  from jsonb_array_elements(public.forum_post_page(:'t', 0, 20)) e;
select public.forum_post_position(:'t', :'p3') as p3_still_3, public.forum_post_position(:'t', :'p2') as removed_pos;
select count(*) as removed_row_via_table from public.posts where id = :'p2';

\echo '== hidden topics give nothing to members, everything to staff'
reset role; set role authenticated;
select set_config('request.jwt.claim.sub','abababab-0000-0000-0000-00000000000b',false);
select public.mod_set_topic_flag(:'t', 'hidden', true, 'Deneme');
select jsonb_array_length(public.forum_post_page(:'t', 0, 20)) as staff_rows;
select set_config('request.jwt.claim.sub','abababab-0000-0000-0000-000000000001',false);
select jsonb_array_length(public.forum_post_page(:'t', 0, 20)) as member_rows, public.forum_post_position(:'t', :'p1') as member_pos;
