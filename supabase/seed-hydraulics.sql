-- Hydraulic Parts inventory seed (optional; app also loads from src/lib/hydraulics-inventory.ts)
-- Subcategories: Center Pin, Ball Guide
insert into public.parts (id, part_number, name, category, quantity, reorder_at, cost, price, compatibility, box_number, inside_diameter_mm, cross_section_mm, notes)
values
  (
    'hydraulic-hpv116-cp-hd',
    'HPV116-CP-HD',
    'Center Pin',
    'Hydraulic Parts',
    10,
    2,
    0,
    0,
    ARRAY[
      'Fiat Hitachi EX215','Fiat Hitachi EX200-1','Fiat Hitachi EX220-1','Fiat Hitachi FH200','Fiat Hitachi FH220',
      'Fiat Kobelco EX215','Fiat Kobelco EX200-1','Fiat Kobelco EX220-1','Fiat Kobelco FH200','Fiat Kobelco FH220',
      'Hitachi EX200-1','Hitachi EX220-1','Hitachi ZX200','Hitachi ZX200-3','Hitachi ZX210-3','Hitachi ZX240-3','Hitachi ZX270-3',
      'John Deere 200CLC','John Deere 240D','John Deere 270CLC'
    ],
    null,
    null,
    null,
    'Subcategory: Center Pin · Manufacturer: Handok Hydraulic (South Korea) · Material: high-density hardened carbon steel · Surface: precision ground & polished to OEM micro-tolerances · Pump displacement 116cc / 118cc · OEM xref: HPV116-CENTER-PIN, 71402440, 9065880, 9065882, TH109461, HD-HPV116-CP · Fitment: Fiat Hitachi/Kobelco main pump group; Hitachi rotary group central piston; John Deere main hydraulic cylinder barrel guide pin'
  ),
  (
    'hydraulic-hpv145-cp-hd',
    'HPV145-CP-HD',
    'Center Pin',
    'Hydraulic Parts',
    10,
    2,
    0,
    0,
    ARRAY[
      'Fiat Hitachi EX355','Fiat Hitachi EX355-3','Fiat Hitachi FH330','Fiat Hitachi FH330-3',
      'New Holland EX355','New Holland EX355-3','New Holland FH330','New Holland FH330-3',
      'Hitachi EX300-3','Hitachi EX300-5','Hitachi ZX330','Hitachi ZX330-3','Hitachi ZX350','Hitachi ZX350-3','Hitachi ZX360','Hitachi ZX360-3G',
      'John Deere 330CLC','John Deere 350DLC'
    ],
    null,
    null,
    null,
    'Subcategory: Center Pin · Manufacturer: Handok Hydraulic (South Korea) · Material: high-density hardened carbon steel · Surface: precision ground & polished to OEM micro-tolerances · Pump displacement 145cc · OEM xref: HPV145-CENTER-PIN, 3081023, 4243645, 71402450, HD-HPV145-CP · Fitment: Fiat Hitachi/New Holland main pump group; Hitachi rotary group central piston; John Deere main hydraulic cylinder barrel guide pin'
  ),
  (
    'hydraulic-bg-03384',
    '03384',
    'Handok K3V112DT Spherical Ball Guide (Brass)',
    'Hydraulic Parts',
    11, 2, 0, 0,
    ARRAY['Kobelco SK200-6','Kobelco SK200-8','Kobelco SK210-8','Kobelco SK235SR','Kobelco SK250-8','Hyundai R210LC-7','Hyundai R210LC-9','Hyundai R220LC-7','Hyundai R225LC-7','Hyundai R250LC-7','Doosan DH220-5','Doosan DH225-7','Doosan SOLAR 220LC-V','Doosan SOLAR 225LC-V','Doosan DX225LCA','Volvo EC210','Volvo EC210B','Volvo EC210C','Volvo EC240','Volvo EC240B','Caterpillar 320C','Caterpillar 320D','Caterpillar 320E','Caterpillar 323D'],
    null, null, null,
    'Subcategory: Ball Guide · Handok · Brass · ~0.20 kg · xref: 03384, HD-03384, 2437U1145S60, XJBN-00191, 31N6-10140, 708-2G-12240, 204-60-71140'
  ),
  (
    'hydraulic-bg-k3v140',
    'K3V140-BG-HD',
    'Handok K3V140DT / H3V140 Spherical Ball Guide (Brass)',
    'Hydraulic Parts',
    9, 2, 0, 0,
    ARRAY['Kobelco SK290','Kobelco SK300-8','Kobelco SK295G','Hyundai R290LC-7','Hyundai R290LC-9','Hyundai R300LC-7','Volvo EC290','Volvo EC290B','Volvo EC290C','Doosan DX300LC'],
    null, null, null,
    'Subcategory: Ball Guide · Handok · Brass · ~0.24 kg · xref: K3V140-BG, H3V140-BG, 2437U1145S65, XJBN-00381'
  ),
  (
    'hydraulic-bg-33237',
    '33237',
    'Handok HPV95C Spherical Ball Guide (PC200-6/7)',
    'Hydraulic Parts',
    5, 1, 0, 0,
    ARRAY['Komatsu PC200-6','Komatsu PC200LC-6','Komatsu PC210-6','Komatsu PC220-6','Komatsu PC220LC-6','Komatsu PC250-6','Komatsu PC200-7','Komatsu PC200LC-7','Komatsu PC210-7','Komatsu PC220-7','Komatsu PC220LC-7','Komatsu PC270-7'],
    null, null, null,
    'Subcategory: Ball Guide · Handok · ~0.15 kg · xref: 33237, HD-33237, 708-2G-23340'
  ),
  (
    'hydraulic-bg-01786',
    '01786',
    'Handok M2X120 Spherical Ball Guide',
    'Hydraulic Parts',
    5, 1, 0, 0,
    ARRAY['Kobelco SK200','Kobelco SK200-3','Kobelco SK200-5','Kobelco SK220-3','Kobelco SK220-5','Kawasaki M2X120','Hitachi EX200-2','Hitachi EX200-3','Hitachi EX200-5'],
    null, null, null,
    'Subcategory: Ball Guide · Handok · ~0.12 kg · xref: 01786, HD-01786, M2X120-BG'
  ),
  (
    'hydraulic-bg-708-2h-23350',
    '708-2H-23350',
    'Handok HPV132 / HPV165 Spherical Ball Guide (PC300-6)',
    'Hydraulic Parts',
    4, 1, 0, 0,
    ARRAY['Komatsu PC300-6','Komatsu PC300LC-6','Komatsu PC350-6','Komatsu PC350LC-6'],
    null, null, null,
    'Subcategory: Ball Guide · Handok · ~0.26 kg · xref: 708-2H-23350, 57333'
  ),
  (
    'hydraulic-bg-63348',
    '63348',
    'Handok HPV140 Spherical Ball Guide (PC300-7/8)',
    'Hydraulic Parts',
    4, 1, 0, 0,
    ARRAY['Komatsu PC300-7','Komatsu PC300LC-7','Komatsu PC300-8','Komatsu PC300LC-8','Komatsu PC350-7','Komatsu PC350LC-7','Komatsu PC360-7','Komatsu PC390LL-10'],
    null, null, null,
    'Subcategory: Ball Guide · Handok · ~0.23 kg · xref: 63348, HD-63348, 708-2L-23350'
  ),
  (
    'hydraulic-bg-40532',
    '40532',
    'Handok K3V180DT Spherical Ball Guide (Brass)',
    'Hydraulic Parts',
    2, 1, 0, 0,
    ARRAY['Volvo EC360','Volvo EC360B','Volvo EC360C','Volvo EC380D','Hyundai R320LC-7','Hyundai R360LC-7','Doosan DH320-5','Doosan DX340LCA','Kobelco SK330-8','Caterpillar 330D','CAT 336D'],
    null, null, null,
    'Subcategory: Ball Guide · Handok · Brass · ~0.29 kg · xref: 40532, HD-40532, XJBN-00541, C7I-8152'
  ),
  (
    'hydraulic-bg-01761',
    '01761',
    'Handok KMF41 Spherical Ball Guide (PC60-7)',
    'Hydraulic Parts',
    2, 1, 0, 0,
    ARRAY['Komatsu PC60-7','Komatsu PC60-7-B','Komatsu PC60-7E','Komatsu PC70-7','Komatsu PC75UU-2','Komatsu PC78US-5','Komatsu PC78US-6'],
    null, null, null,
    'Subcategory: Ball Guide · Handok · ~0.13 kg · xref: 01761, HD-01761, 706-73-11140'
  ),
  (
    'hydraulic-bg-01649',
    '01649',
    'Handok H5V200DPH / K5V200 Spherical Ball Guide (Ductile)',
    'Hydraulic Parts',
    1, 1, 0, 0,
    ARRAY['Hitachi ZX450-3','Hitachi ZX470H-3','Hitachi ZX470LCH-3','Hitachi ZX500LC-3','Hitachi ZX520LCH-3','John Deere 450DLC'],
    null, null, null,
    'Subcategory: Ball Guide · Handok · Ductile · ~0.29 kg · xref: 01649, HD-01649, H5V200DPH-BG, K5V200-BG'
  ),
  (
    'hydraulic-bg-59721',
    '59721',
    'Handok GM35VA Thrust Ball Guide',
    'Hydraulic Parts',
    1, 1, 0, 0,
    ARRAY['Nabtesco GM35VA','Kobelco SK200-3','Kobelco SK200-5','Kobelco SK220-3','Kobelco SK220-5'],
    null, null, null,
    'Subcategory: Ball Guide · Handok · xref: 59721, HD-59721, GM35VA-BG'
  ),
  (
    'hydraulic-bg-03407',
    '03407',
    'Handok M2X150/170 Spherical Ball Guide',
    'Hydraulic Parts',
    1, 1, 0, 0,
    ARRAY['Kawasaki M2X150','Kawasaki M2X170','Kobelco SK300','Kobelco SK330-6','Hitachi EX300-3','Hitachi EX300-5'],
    null, null, null,
    'Subcategory: Ball Guide · Handok · ~0.12 kg · xref: 03407, HD-03407, M2X150-BG, M2X170-BG'
  ),
  (
    'hydraulic-bg-61372',
    '61372',
    'Handok HPV75 Spherical Ball Guide (PC60-7)',
    'Hydraulic Parts',
    1, 1, 0, 0,
    ARRAY['Komatsu PC60-7','Komatsu PC60-7-B','Komatsu PC60-7E','Komatsu PC70-7','Komatsu PC75UU-2','Komatsu PC78US-5','Komatsu PC78US-6'],
    null, null, null,
    'Subcategory: Ball Guide · Handok · ~0.14 kg · xref: 61372, HD-61372, 708-2G-23350'
  ),
  (
    'hydraulic-bg-08001',
    '08001',
    'Handok AP2D12 Spherical Ball Guide',
    'Hydraulic Parts',
    1, 1, 0, 0,
    ARRAY['Uchida AP2D12','Rexroth AP2D12','Komatsu PC30MR-1','Komatsu PC35MR-1','Kubota KX71','Kubota KX91-2','Takeuchi TB125','Takeuchi TB135'],
    null, null, null,
    'Subcategory: Ball Guide · Handok · ~0.12 kg · xref: 08001, HD-08001, AP2D12-BG'
  )
on conflict (id) do update set
  part_number = excluded.part_number,
  name = excluded.name,
  category = excluded.category,
  quantity = excluded.quantity,
  reorder_at = excluded.reorder_at,
  compatibility = excluded.compatibility,
  notes = excluded.notes;
