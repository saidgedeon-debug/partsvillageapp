-- Helpful indexes on relational tables (shop_state JSON remains primary for the app).

create index if not exists invoices_status_idx on public.invoices (status);
create index if not exists invoices_date_idx on public.invoices (date desc);
create index if not exists quotations_status_idx on public.quotations (status);
create index if not exists quotations_date_idx on public.quotations (date desc);
create index if not exists orders_status_idx on public.orders (status);
create index if not exists orders_date_idx on public.orders (date desc);
create index if not exists supplier_inquiries_status_idx on public.supplier_inquiries (status);
create index if not exists supplier_inquiries_date_idx on public.supplier_inquiries (date desc);
create index if not exists machines_client_id_idx on public.machines (client_id);
create index if not exists order_lines_order_id_idx on public.order_lines (order_id);
