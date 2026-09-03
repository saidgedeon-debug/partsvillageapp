-- Public bucket for compressed part gallery photos (URLs stored on inventory parts).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'part-photos',
  'part-photos',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Authenticated operators can upload/update/delete; anyone can read public objects.
drop policy if exists "Authenticated upload part-photos" on storage.objects;
drop policy if exists "Authenticated update part-photos" on storage.objects;
drop policy if exists "Authenticated delete part-photos" on storage.objects;
drop policy if exists "Public read part-photos" on storage.objects;

create policy "Authenticated upload part-photos"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'part-photos');

create policy "Authenticated update part-photos"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'part-photos')
  with check (bucket_id = 'part-photos');

create policy "Authenticated delete part-photos"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'part-photos');

create policy "Public read part-photos"
  on storage.objects for select
  to public
  using (bucket_id = 'part-photos');
