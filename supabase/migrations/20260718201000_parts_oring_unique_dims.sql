-- Allow same part code in one box when dimensions differ (source data duplicates).

drop index if exists parts_box_part_number_uidx;

create unique index if not exists parts_box_part_dims_uidx
  on public.parts (box_number, part_number, inside_diameter_mm, cross_section_mm)
  where box_number is not null;
