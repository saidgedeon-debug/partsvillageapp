-- Shared online shop state (no auth). Phone + PC read/write the same rows.
-- WARNING: anon role has full access — anyone with the site URL can read/write.

create table if not exists public.shop_state (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.shop_state enable row level security;

drop policy if exists "Public read shop_state" on public.shop_state;
drop policy if exists "Public insert shop_state" on public.shop_state;
drop policy if exists "Public update shop_state" on public.shop_state;
drop policy if exists "Public delete shop_state" on public.shop_state;

create policy "Public read shop_state" on public.shop_state for select using (true);
create policy "Public insert shop_state" on public.shop_state for insert with check (true);
create policy "Public update shop_state" on public.shop_state for update using (true) with check (true);
create policy "Public delete shop_state" on public.shop_state for delete using (true);

-- Allow anon writes on existing tables (best-effort sync / future use)
do $$
declare
  t text;
begin
  foreach t in array array[
    'clients', 'parts', 'machines', 'orders', 'order_lines',
    'quotations', 'invoices', 'supplier_inquiries'
  ]
  loop
    execute format('drop policy if exists "Public insert %1$s" on public.%1$I', t);
    execute format('drop policy if exists "Public update %1$s" on public.%1$I', t);
    execute format('drop policy if exists "Public delete %1$s" on public.%1$I', t);
    execute format(
      'create policy "Public insert %1$s" on public.%1$I for insert with check (true)',
      t
    );
    execute format(
      'create policy "Public update %1$s" on public.%1$I for update using (true) with check (true)',
      t
    );
    execute format(
      'create policy "Public delete %1$s" on public.%1$I for delete using (true)',
      t
    );
  end loop;
end $$;

-- Seed empty keys so upserts are updates after first write
insert into public.shop_state (key, value) values
  ('inventory', '{}'::jsonb),
  ('parties', '{}'::jsonb),
  ('documents', '[]'::jsonb),
  ('fleet', '{"machines":[],"orders":[]}'::jsonb),
  ('cart', '{"documentKind":null,"lines":[]}'::jsonb),
  ('kits', '[]'::jsonb),
  ('prefs', '{"favoritePartIds":[],"machinePresets":[],"favoriteCategoryGroups":[],"recentCategoryGroups":[]}'::jsonb)
on conflict (key) do nothing;

-- Realtime for live sync across devices
alter publication supabase_realtime add table public.shop_state;
