-- Add the requested category directly after Basketball without changing category IDs.
begin;
update public.categories set sort_order = case slug
  when 'altyapi-akademi' then 10
  when 'taraftar-tribun' then 11
  when 'serbest' then 12 end
where slug in ('altyapi-akademi', 'taraftar-tribun', 'serbest');
insert into public.categories(slug, name, description, icon, sort_order)
values ('diger-branslar', 'Diğer Branşlar', 'Voleybol, yüzme, atletizm ve diğer branşlardan haberler ve tartışmalar.', 'fitness-outline', 9)
on conflict(slug) do update set name=excluded.name, description=excluded.description, icon=excluded.icon, sort_order=excluded.sort_order;
commit;
