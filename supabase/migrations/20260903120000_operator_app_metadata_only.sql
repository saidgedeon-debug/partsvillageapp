-- Operator RLS: trust app_metadata.role only (user_metadata is client-writable).

drop policy if exists "Authenticated read shop_state" on public.shop_state;
drop policy if exists "Authenticated insert shop_state" on public.shop_state;
drop policy if exists "Authenticated update shop_state" on public.shop_state;
drop policy if exists "Authenticated delete shop_state" on public.shop_state;

create policy "Authenticated read shop_state"
  on public.shop_state for select
  to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'operator');

create policy "Authenticated insert shop_state"
  on public.shop_state for insert
  to authenticated
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'operator');

create policy "Authenticated update shop_state"
  on public.shop_state for update
  to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'operator')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'operator');

create policy "Authenticated delete shop_state"
  on public.shop_state for delete
  to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'operator');

drop policy if exists "Authenticated upload part-photos" on storage.objects;
drop policy if exists "Authenticated update part-photos" on storage.objects;
drop policy if exists "Authenticated delete part-photos" on storage.objects;

create policy "Authenticated upload part-photos"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'part-photos'
    and (auth.jwt() -> 'app_metadata' ->> 'role') = 'operator'
  );

create policy "Authenticated update part-photos"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'part-photos'
    and (auth.jwt() -> 'app_metadata' ->> 'role') = 'operator'
  )
  with check (
    bucket_id = 'part-photos'
    and (auth.jwt() -> 'app_metadata' ->> 'role') = 'operator'
  );

create policy "Authenticated delete part-photos"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'part-photos'
    and (auth.jwt() -> 'app_metadata' ->> 'role') = 'operator'
  );
