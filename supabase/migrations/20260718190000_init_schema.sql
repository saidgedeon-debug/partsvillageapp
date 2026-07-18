-- Parts Pro Central schema

create extension if not exists "pgcrypto";

create table public.clients (
  id text primary key default ('c_' || substr(gen_random_uuid()::text, 1, 8)),
  name text not null,
  contact_name text not null,
  email text not null,
  phone text not null default '',
  address text not null default '',
  created_at timestamptz not null default now()
);

create table public.parts (
  id text primary key default ('p_' || substr(gen_random_uuid()::text, 1, 8)),
  part_number text not null unique,
  name text not null,
  category text not null,
  quantity integer not null default 0 check (quantity >= 0),
  reorder_at integer not null default 0 check (reorder_at >= 0),
  cost numeric(12, 2) not null default 0,
  price numeric(12, 2) not null default 0,
  compatibility text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table public.machines (
  id text primary key default ('m_' || substr(gen_random_uuid()::text, 1, 8)),
  client_id text not null references public.clients (id) on delete cascade,
  make text not null,
  model text not null,
  serial_number text not null,
  year integer not null,
  hours integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.orders (
  id text primary key default ('o_' || substr(gen_random_uuid()::text, 1, 8)),
  client_id text not null references public.clients (id) on delete cascade,
  machine_id text not null references public.machines (id) on delete restrict,
  date date not null,
  status text not null default 'Pending' check (status in ('Paid', 'Pending', 'Quoted')),
  created_at timestamptz not null default now()
);

create table public.order_lines (
  id uuid primary key default gen_random_uuid(),
  order_id text not null references public.orders (id) on delete cascade,
  part_id text not null references public.parts (id) on delete restrict,
  qty integer not null check (qty > 0),
  unit_price numeric(12, 2) not null check (unit_price >= 0)
);

create table public.quotations (
  id text primary key,
  client_id text not null references public.clients (id) on delete cascade,
  date date not null,
  total numeric(12, 2) not null default 0,
  status text not null default 'Draft' check (status in ('Draft', 'Sent', 'Accepted', 'Rejected')),
  created_at timestamptz not null default now()
);

create table public.invoices (
  id text primary key,
  client_id text not null references public.clients (id) on delete cascade,
  date date not null,
  total numeric(12, 2) not null default 0,
  status text not null default 'Unpaid' check (status in ('Paid', 'Unpaid', 'Overdue')),
  created_at timestamptz not null default now()
);

create table public.supplier_inquiries (
  id text primary key,
  supplier text not null,
  date date not null,
  part_numbers text[] not null default '{}',
  status text not null default 'Open' check (status in ('Open', 'Answered', 'Closed')),
  created_at timestamptz not null default now()
);

create index machines_client_id_idx on public.machines (client_id);
create index orders_client_id_idx on public.orders (client_id);
create index orders_machine_id_idx on public.orders (machine_id);
create index order_lines_order_id_idx on public.order_lines (order_id);
create index quotations_client_id_idx on public.quotations (client_id);
create index invoices_client_id_idx on public.invoices (client_id);

alter table public.clients enable row level security;
alter table public.parts enable row level security;
alter table public.machines enable row level security;
alter table public.orders enable row level security;
alter table public.order_lines enable row level security;
alter table public.quotations enable row level security;
alter table public.invoices enable row level security;
alter table public.supplier_inquiries enable row level security;

-- Public read for the operations dashboard (tighten when auth is added)
create policy "Public read clients" on public.clients for select using (true);
create policy "Public read parts" on public.parts for select using (true);
create policy "Public read machines" on public.machines for select using (true);
create policy "Public read orders" on public.orders for select using (true);
create policy "Public read order_lines" on public.order_lines for select using (true);
create policy "Public read quotations" on public.quotations for select using (true);
create policy "Public read invoices" on public.invoices for select using (true);
create policy "Public read supplier_inquiries" on public.supplier_inquiries for select using (true);
