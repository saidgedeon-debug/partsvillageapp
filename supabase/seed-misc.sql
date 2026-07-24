-- MISC inventory seed (optional; app also loads from src/lib/misc-inventory.ts)
insert into public.parts (id, part_number, name, category, quantity, reorder_at, cost, price, compatibility, box_number, inside_diameter_mm, cross_section_mm, notes)
values
  (
    'misc-ec290-muffler-assy',
    'EC290-MUFFLER-ASSY',
    'EC290 Muffler Assy',
    'MISC',
    1, 1, 55, 270,
    ARRAY['Volvo EC290','Volvo EC290B','Volvo EC290C'],
    null, null, null,
    'Category: MISC · Cost FOB USD 55 · Selling USD 270'
  ),
  (
    'misc-ec290-water-tank-cap',
    'EC290-WATER-TANK',
    'EC290 Water Tank with Cap',
    'MISC',
    1, 1, 13, 48,
    ARRAY['Volvo EC290','Volvo EC290B','Volvo EC290C'],
    null, null, null,
    'Category: MISC · Cost FOB USD 13 · Selling USD 48'
  )
on conflict (id) do update set
  part_number = excluded.part_number,
  name = excluded.name,
  category = excluded.category,
  quantity = excluded.quantity,
  reorder_at = excluded.reorder_at,
  cost = excluded.cost,
  price = excluded.price,
  compatibility = excluded.compatibility,
  notes = excluded.notes;
