-- Gauges & Accessories inventory seed (optional; app also loads from src/lib/gauges-inventory.ts)
insert into public.parts (id, part_number, name, category, quantity, reorder_at, cost, price, compatibility, box_number, inside_diameter_mm, cross_section_mm, notes)
values
  (
    'gauge-153-2985-lq',
    '153-2985-LQ',
    'Caterpillar Hydraulic Tank Oil Level Sight Gauge (Low Quality - 127mm / 5-Inch)',
    'Gauges & Accessories',
    60,
    10,
    0,
    0,
    ARRAY[
      'Caterpillar E120B','Caterpillar E311','Caterpillar E312','Caterpillar 312B','Caterpillar 312C','Caterpillar 312D',
      'Caterpillar 320','Caterpillar 320B','Caterpillar 320C','Caterpillar 320D','Caterpillar 320D2','Caterpillar 320E',
      'Caterpillar 323D','Caterpillar 324D','Caterpillar 325C','Caterpillar 325D','Caterpillar 329D',
      'Caterpillar 330','Caterpillar 330B','Caterpillar 330C','Caterpillar 330D',
      'CAT E120B','CAT E311','CAT E312','CAT 312B','CAT 312C','CAT 312D',
      'CAT 320','CAT 320B','CAT 320C','CAT 320D','CAT 320D2','CAT 320E',
      'CAT 323D','CAT 324D','CAT 325C','CAT 325D','CAT 329D','CAT 330','CAT 330B','CAT 330C','CAT 330D'
    ],
    null,
    null,
    null,
    'Center-to-center 127.0 mm / 5.0 in · Mounting bolt thread M10×1.5 · Body: standard clear acrylic tube · End blocks: molded polymer · Grade: economy / utility replacement · Seals: standard rubber O-rings · CAT genuine xref: 153-2985, 1532985, 094-3245, 094-3246, 0943245, 0943246, 227-0620, 2270620 · Fitment: aftermarket hydraulic oil reservoir level window (E120B–330D)'
  ),
  (
    'gauge-4254452',
    '4254452',
    'Hitachi / Volvo Hydraulic Tank Oil Level Sight Glass Gauge (Low Quality )',
    'Gauges & Accessories',
    13,
    3,
    0,
    0,
    ARRAY[
      'Hitachi ZX70','Hitachi ZX120','Hitachi ZX130','Hitachi ZX200','Hitachi ZX200-3','Hitachi ZX200-5G',
      'Hitachi ZX210','Hitachi ZX240','Hitachi ZX240-3','Hitachi ZX250-5G','Hitachi ZX270','Hitachi ZX330','Hitachi ZX350-3','Hitachi ZX450',
      'Volvo EC140B','Volvo EC140C','Volvo EC210','Volvo EC210B','Volvo EC210C','Volvo EC240B',
      'Volvo EC240C','Volvo EC290B','Volvo EC290C','Volvo EC360B','Volvo EC460B',
      'John Deere 120C','John Deere 160C','John Deere 200CLC','John Deere 230CLC','John Deere 240D','John Deere 270CLC','John Deere 330CLC'
    ],
    null,
    null,
    null,
    'Center-to-center 127.0 mm / 5.0 in · Mounting bolt thread M10×1.5 · Body: standard clear acrylic tube · End blocks: molded polymer · Grade: economy / utility replacement · Seals: standard rubber O-rings · Hitachi xref: 4254452, 4344447, 4416035, 4189311 · Volvo xref: 14513451, VOE14513451, 14506822, VOE14506822 · John Deere xref: AT208447, AT310587 · Fitment: Hitachi ZX reservoir window; Volvo EC tank level indicator; John Deere Hitachi JV reservoir fluid indicator'
  )
on conflict (id) do update set
  part_number = excluded.part_number,
  name = excluded.name,
  category = excluded.category,
  quantity = excluded.quantity,
  reorder_at = excluded.reorder_at,
  compatibility = excluded.compatibility,
  notes = excluded.notes;
