-- Drop remaining public SELECT on unused legacy relational tables.

do $$
declare
  t text;
begin
  foreach t in array array[
    'clients',
    'parts',
    'machines',
    'orders',
    'order_lines',
    'quotations',
    'invoices',
    'supplier_inquiries'
  ]
  loop
    execute format('drop policy if exists "Public read %s" on public.%I', t, t);
    execute format('drop policy if exists "Enable read access for all users" on public.%I', t);
    begin
      execute format('revoke all on table public.%I from anon, authenticated', t);
    exception when undefined_table then
      null;
    end;
  end loop;
end $$;
