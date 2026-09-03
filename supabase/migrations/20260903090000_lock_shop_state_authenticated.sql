-- Lock shop_state to authenticated operators (anon no longer has open R/W).
-- Portal uses service-role server functions, not anon table access.
-- Apply after OPERATOR_PIN unlock creates the operator Auth user.

drop policy if exists "Public read shop_state" on public.shop_state;
drop policy if exists "Public insert shop_state" on public.shop_state;
drop policy if exists "Public update shop_state" on public.shop_state;
drop policy if exists "Public delete shop_state" on public.shop_state;

create policy "Authenticated read shop_state"
  on public.shop_state for select
  to authenticated
  using (true);

create policy "Authenticated insert shop_state"
  on public.shop_state for insert
  to authenticated
  with check (true);

create policy "Authenticated update shop_state"
  on public.shop_state for update
  to authenticated
  using (true)
  with check (true);

create policy "Authenticated delete shop_state"
  on public.shop_state for delete
  to authenticated
  using (true);
