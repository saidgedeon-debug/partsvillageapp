-- Lock unused relational tables: drop public write policies.
-- App data lives in shop_state JSON; these tables are unused by the app.
-- Keep SELECT policies; do not touch shop_state.

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
  end loop;
end $$;
