-- Extend parts for O-ring inventory fields
-- Same part codes can exist in multiple boxes, so drop global unique on part_number.

alter table public.parts drop constraint if exists parts_part_number_key;

alter table public.parts
  add column if not exists box_number integer,
  add column if not exists inside_diameter_mm text not null default '',
  add column if not exists cross_section_mm text not null default '',
  add column if not exists notes text not null default '';

create unique index if not exists parts_box_part_number_uidx
  on public.parts (box_number, part_number)
  where box_number is not null;

create index if not exists parts_category_idx on public.parts (category);
create index if not exists parts_box_number_idx on public.parts (box_number);
