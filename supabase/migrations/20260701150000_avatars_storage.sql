-- Storage-bucket voor profielfoto's + policies.

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Iedereen mag avatars lezen (publieke bucket).
create policy "Avatars zijn publiek leesbaar"
  on storage.objects for select
  using (bucket_id = 'avatars');

-- Een gebruiker beheert alleen bestanden in zijn eigen map: <uid>/...
create policy "Eigen avatar uploaden"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Eigen avatar bijwerken"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Eigen avatar verwijderen"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
