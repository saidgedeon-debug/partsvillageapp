-- Hydraulic Parts inventory seed (optional; app also loads from src/lib/hydraulics-inventory.ts)
-- Subcategories: Center Pin, Ball Guide, shoe/thrust plate, Valve Plate, retainer / set plate, servo piston
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
    28, null, null,
    'Shelf 28 · Subcategory: Ball Guide · Handok · Brass · ~0.20 kg · xref: 03384, HD-03384, 2437U1145S60, XJBN-00191, 31N6-10140, 708-2G-12240, 204-60-71140'
  ),
  (
    'hydraulic-bg-k3v140',
    'K3V140-BG-HD',
    'Handok K3V140DT / H3V140 Spherical Ball Guide (Brass)',
    'Hydraulic Parts',
    9, 2, 0, 0,
    ARRAY['Kobelco SK290','Kobelco SK300-8','Kobelco SK295G','Hyundai R290LC-7','Hyundai R290LC-9','Hyundai R300LC-7','Volvo EC290','Volvo EC290B','Volvo EC290C','Doosan DX300LC'],
    28, null, null,
    'Shelf 28 · Subcategory: Ball Guide · Handok · Brass · ~0.24 kg · xref: K3V140-BG, H3V140-BG, 2437U1145S65, XJBN-00381'
  ),
  (
    'hydraulic-bg-33237',
    '33237',
    'Handok HPV95C Spherical Ball Guide (PC200-6/7)',
    'Hydraulic Parts',
    5, 1, 0, 0,
    ARRAY['Komatsu PC200-6','Komatsu PC200LC-6','Komatsu PC210-6','Komatsu PC220-6','Komatsu PC220LC-6','Komatsu PC250-6','Komatsu PC200-7','Komatsu PC200LC-7','Komatsu PC210-7','Komatsu PC220-7','Komatsu PC220LC-7','Komatsu PC270-7'],
    28, null, null,
    'Shelf 28 · Subcategory: Ball Guide · Handok · ~0.15 kg · xref: 33237, HD-33237, 708-2G-23340'
  ),
  (
    'hydraulic-bg-01786',
    '01786',
    'Handok M2X120 Spherical Ball Guide',
    'Hydraulic Parts',
    5, 1, 0, 0,
    ARRAY['Kobelco SK200','Kobelco SK200-3','Kobelco SK200-5','Kobelco SK220-3','Kobelco SK220-5','Kawasaki M2X120','Hitachi EX200-2','Hitachi EX200-3','Hitachi EX200-5'],
    28, null, null,
    'Shelf 28 · Subcategory: Ball Guide · Handok · ~0.12 kg · xref: 01786, HD-01786, M2X120-BG'
  ),
  (
    'hydraulic-bg-708-2h-23350',
    '708-2H-23350',
    'Handok HPV132 / HPV165 Spherical Ball Guide (PC300-6)',
    'Hydraulic Parts',
    4, 1, 0, 0,
    ARRAY['Komatsu PC300-6','Komatsu PC300LC-6','Komatsu PC350-6','Komatsu PC350LC-6'],
    28, null, null,
    'Shelf 28 · Subcategory: Ball Guide · Handok · ~0.26 kg · xref: 708-2H-23350, 57333'
  ),
  (
    'hydraulic-bg-63348',
    '63348',
    'Handok HPV140 Spherical Ball Guide (PC300-7/8)',
    'Hydraulic Parts',
    4, 1, 0, 0,
    ARRAY['Komatsu PC300-7','Komatsu PC300LC-7','Komatsu PC300-8','Komatsu PC300LC-8','Komatsu PC350-7','Komatsu PC350LC-7','Komatsu PC360-7','Komatsu PC390LL-10'],
    28, null, null,
    'Shelf 28 · Subcategory: Ball Guide · Handok · ~0.23 kg · xref: 63348, HD-63348, 708-2L-23350'
  ),
  (
    'hydraulic-bg-40532',
    '40532',
    'Handok K3V180DT Spherical Ball Guide (Brass)',
    'Hydraulic Parts',
    2, 1, 0, 0,
    ARRAY['Volvo EC360','Volvo EC360B','Volvo EC360C','Volvo EC380D','Hyundai R320LC-7','Hyundai R360LC-7','Doosan DH320-5','Doosan DX340LCA','Kobelco SK330-8','Caterpillar 330D','CAT 336D'],
    28, null, null,
    'Shelf 28 · Subcategory: Ball Guide · Handok · Brass · ~0.29 kg · xref: 40532, HD-40532, XJBN-00541, C7I-8152'
  ),
  (
    'hydraulic-bg-01761',
    '01761',
    'Handok KMF41 Spherical Ball Guide (PC60-7)',
    'Hydraulic Parts',
    2, 1, 0, 0,
    ARRAY['Komatsu PC60-7','Komatsu PC60-7-B','Komatsu PC60-7E','Komatsu PC70-7','Komatsu PC75UU-2','Komatsu PC78US-5','Komatsu PC78US-6'],
    28, null, null,
    'Shelf 28 · Subcategory: Ball Guide · Handok · ~0.13 kg · xref: 01761, HD-01761, 706-73-11140'
  ),
  (
    'hydraulic-bg-01649',
    '01649',
    'Handok H5V200DPH / K5V200 Spherical Ball Guide (Ductile)',
    'Hydraulic Parts',
    1, 1, 0, 0,
    ARRAY['Hitachi ZX450-3','Hitachi ZX470H-3','Hitachi ZX470LCH-3','Hitachi ZX500LC-3','Hitachi ZX520LCH-3','John Deere 450DLC'],
    28, null, null,
    'Shelf 28 · Subcategory: Ball Guide · Handok · Ductile · ~0.29 kg · xref: 01649, HD-01649, H5V200DPH-BG, K5V200-BG'
  ),
  (
    'hydraulic-bg-59721',
    '59721',
    'Handok GM35VA Thrust Ball Guide',
    'Hydraulic Parts',
    1, 1, 0, 0,
    ARRAY['Nabtesco GM35VA','Kobelco SK200-3','Kobelco SK200-5','Kobelco SK220-3','Kobelco SK220-5'],
    28, null, null,
    'Shelf 28 · Subcategory: Ball Guide · Handok · xref: 59721, HD-59721, GM35VA-BG'
  ),
  (
    'hydraulic-bg-03407',
    '03407',
    'Handok M2X150/170 Spherical Ball Guide',
    'Hydraulic Parts',
    2, 1, 0, 0,
    ARRAY['Kawasaki M2X150','Kawasaki M2X170','Kobelco SK300','Kobelco SK330-6','Hitachi EX300-3','Hitachi EX300-5'],
    28, null, null,
    'Shelf 28 · Subcategory: Ball Guide · Handok · ~0.12 kg · xref: 03407, HD-03407, M2X150-BG, M2X170-BG'
  ),
  (
    'hydraulic-bg-m2x150-170-eg',
    'M2X150-170-BG-EG',
    'Engrenax M2X150/170 Spherical Ball Guide',
    'Hydraulic Parts',
    1, 1, 0, 0,
    ARRAY['Kawasaki M2X150','Kawasaki M2X170','Kobelco SK300','Kobelco SK330-6','Hitachi EX300-3','Hitachi EX300-5'],
    28, null, null,
    'Shelf 28 · Subcategory: Ball Guide · Engrenax (Canada) · ~0.12 kg · xref: 03407, EG-M2X150-170-BG, M2X150-BG, M2X170-BG'
  ),
  (
    'hydraulic-bg-m2x120-eg',
    'M2X120-BG-EG',
    'Engrenax M2X120 Spherical Ball Guide',
    'Hydraulic Parts',
    8, 2, 0, 0,
    ARRAY['Kobelco SK200','Kobelco SK200-3','Kobelco SK200-5','Kobelco SK220-3','Kobelco SK220-5','Kawasaki M2X120','Hitachi EX200-2','Hitachi EX200-3','Hitachi EX200-5'],
    28, null, null,
    'Shelf 28 · Subcategory: Ball Guide · Engrenax (Canada) · ~0.12 kg · xref: 01786, EG-M2X120-BG, M2X120-BALL-GUIDE'
  ),
  (
    'hydraulic-bg-61372',
    '61372',
    'Handok HPV75 Spherical Ball Guide (PC60-7)',
    'Hydraulic Parts',
    1, 1, 0, 0,
    ARRAY['Komatsu PC60-7','Komatsu PC60-7-B','Komatsu PC60-7E','Komatsu PC70-7','Komatsu PC75UU-2','Komatsu PC78US-5','Komatsu PC78US-6'],
    28, null, null,
    'Shelf 28 · Subcategory: Ball Guide · Handok · ~0.14 kg · xref: 61372, HD-61372, 708-2G-23350'
  ),
  (
    'hydraulic-bg-08001',
    '08001',
    'Handok AP2D12 Spherical Ball Guide',
    'Hydraulic Parts',
    1, 1, 0, 0,
    ARRAY['Uchida AP2D12','Rexroth AP2D12','Komatsu PC30MR-1','Komatsu PC35MR-1','Kubota KX71','Kubota KX91-2','Takeuchi TB125','Takeuchi TB135'],
    28, null, null,
    'Shelf 28 · Subcategory: Ball Guide · Handok · ~0.12 kg · xref: 08001, HD-08001, AP2D12-BG'
  ),
  (
    'hydraulic-tp-m2x120-eg',
    'M2X120-TP-EG',
    'Engrenax M2X120 Thrust Plate / Shoe Plate',
    'Hydraulic Parts',
    8, 2, 0, 0,
    ARRAY['Kobelco SK200','Kobelco SK200-3','Kobelco SK200-5','Kobelco SK220-3','Kobelco SK220-5','Kawasaki M2X120','Hitachi EX200-2','Hitachi EX200-3','Hitachi EX200-5'],
    null, null, null,
    'Subcategory: shoe/thrust plate · Engrenax (Canada) · xref: M2X120-TP, EG-M2X120-TP'
  ),
  (
    'hydraulic-tp-m2x170-eg',
    'M2X170-TP-EG',
    'Engrenax M2X170 Thrust Plate / Shoe Plate',
    'Hydraulic Parts',
    2, 1, 0, 0,
    ARRAY['Kawasaki M2X150','Kawasaki M2X170','Kobelco SK300','Kobelco SK330-6','Hitachi EX300-3','Hitachi EX300-5'],
    null, null, null,
    'Subcategory: shoe/thrust plate · Engrenax (Canada) · xref: M2X170-TP, EG-M2X170-TP'
  ),
  (
    'hydraulic-tp-kmf41-hd',
    'KMF41-TP-HD',
    'Handok KMF41 Thrust Plate / Shoe Plate',
    'Hydraulic Parts',
    2, 1, 0, 0,
    ARRAY['Komatsu PC60-7','Komatsu PC60-7-B','Komatsu PC60-7E','Komatsu PC70-7','Komatsu PC75UU-2','Komatsu PC78US-5','Komatsu PC78US-6'],
    null, null, null,
    'Subcategory: shoe/thrust plate · Handok · xref: 706-73-11130, HD-KMF41-TP'
  ),
  (
    'hydraulic-tp-m2x63-hd',
    'M2X63-TP-HD',
    'Handok M2X63 Thrust Plate / Shoe Plate',
    'Hydraulic Parts',
    1, 1, 0, 0,
    ARRAY['Kobelco SK100','Kobelco SK120','Kobelco SK135SR','Kawasaki M2X63','Hitachi EX100-2','Hitachi EX100-3','Hitachi EX120-5'],
    null, null, null,
    'Subcategory: shoe/thrust plate · Handok · xref: M2X63-TP, HD-M2X63-TP'
  ),
  (
    'hydraulic-tp-m2x120-hd',
    'M2X120-TP-HD',
    'Handok M2X120 Thrust Plate / Shoe Plate',
    'Hydraulic Parts',
    3, 1, 0, 0,
    ARRAY['Kobelco SK200','Kobelco SK200-3','Kobelco SK200-5','Kobelco SK220-3','Kobelco SK220-5','Kawasaki M2X120','Hitachi EX200-2','Hitachi EX200-3','Hitachi EX200-5'],
    null, null, null,
    'Subcategory: shoe/thrust plate · Handok · xref: M2X120-TP, HD-M2X120-TP'
  ),
  (
    'hydraulic-tp-m2x150-170-hd',
    'M2X150-170-TP-HD',
    'Handok M2X150/170 Thrust Plate / Shoe Plate',
    'Hydraulic Parts',
    7, 2, 0, 0,
    ARRAY['Kawasaki M2X150','Kawasaki M2X170','Kobelco SK300','Kobelco SK330-6','Hitachi EX300-2','Hitachi EX300-3','Hitachi EX300-5'],
    null, null, null,
    'Subcategory: shoe/thrust plate · Handok · xref: M2X150-TP, M2X170-TP, HD-M2X150-170-TP'
  ),
  (
    'hydraulic-tp-m2x210-hd',
    'M2X210-TP-HD',
    'Handok M2X210 Thrust Plate / Shoe Plate',
    'Hydraulic Parts',
    7, 2, 0, 0,
    ARRAY['Kobelco SK400','Kobelco SK430','Kobelco SK450','Kawasaki M2X210','Hitachi EX400-3','Hitachi EX400-5'],
    null, null, null,
    'Subcategory: shoe/thrust plate · Handok · xref: M2X210-TP, HD-M2X210-TP'
  ),
  (
    'hydraulic-tp-sg08-hd',
    'SG08-TP-HD',
    'Handok SG08 Thrust Plate / Shoe Plate',
    'Hydraulic Parts',
    1, 1, 0, 0,
    ARRAY['Kobelco SK200-6','Kobelco SK200-8','Kobelco SK210-8','Kawasaki SG08','Hitachi ZX200','Hitachi ZX200-3','Hitachi ZX210-3'],
    null, null, null,
    'Subcategory: shoe/thrust plate · Handok · xref: SG08-TP, HD-SG08-TP, SG08-SHOE-PLATE'
  ),
  (
    'hydraulic-tp-ap2d36-af',
    'AP2D36-TP-AF',
    'Aftermarket AP2D36 Thrust Plate / Shoe Plate',
    'Hydraulic Parts',
    1, 1, 0, 0,
    ARRAY['Uchida AP2D36','Uchida AP2D36LV','Rexroth AP2D36','Rexroth AP2D36LV','Komatsu PC50MR-2','Komatsu PC55MR-2','Takeuchi TB145','Takeuchi TB153'],
    29, null, null,
    'Subcategory: shoe/thrust plate · Stand 29 · Aftermarket Premium Grade · xref: AP2D36-TP, AF-AP2D36-TP'
  (
    'hydraulic-vp-kmf41-hd',
    'KMF41-VP-HD',
    'Handok KMF41 Valve Plate (PC60-7)',
    'Hydraulic Parts',
    2, 1, 0, 0,
    ARRAY['Komatsu PC60-7','Komatsu PC70-7','Komatsu PC75UU-2','Komatsu PC78US-5','Komatsu PC78US-6'],
    30, null, null,
    'Subcategory: Valve Plate · Stand 30 · Manufacturer: Handok Hydraulic (South Korea) · OEM xref: KMF41-VP-HD, 706-73-11220, 7067311220, HD-KMF41-VP'
  ),
  (
    'hydraulic-vp-kmf90-old-hd',
    'KMF90-VP-OLD-HD',
    'Handok KMF90 Valve Plate (Old Type - 1 Pin - PC200-5)',
    'Hydraulic Parts',
    1, 1, 0, 0,
    ARRAY['Komatsu PC200-5','Komatsu PC200LC-5','Komatsu PC210-5','Komatsu PC220-5'],
    30, null, null,
    'Subcategory: Valve Plate · Stand 30 · Manufacturer: Handok Hydraulic (South Korea) · OEM xref: KMF90-VP-OLD-HD, HD-KMF90-VP-1PIN'
  ),
  (
    'hydraulic-vp-kmf125-hd',
    'KMF125-VP-HD',
    'Handok KMF125 Valve Plate',
    'Hydraulic Parts',
    2, 1, 0, 0,
    ARRAY['Komatsu PC300-5','Komatsu PC300-6','Komatsu PC350-6'],
    30, null, null,
    'Subcategory: Valve Plate · Stand 30 · Manufacturer: Handok Hydraulic (South Korea) · OEM xref: KMF125-VP-HD, 706-75-11220, 7067511220, HD-KMF125-VP'
  ),
  (
    'hydraulic-vp-kmf90-new-hd',
    'KMF90-VP-NEW-HD',
    'Handok KMF90 Valve Plate (New Type - PC200-5)',
    'Hydraulic Parts',
    1, 1, 0, 0,
    ARRAY['Komatsu PC200-5','Komatsu PC200LC-5','Komatsu PC220-5'],
    30, null, null,
    'Subcategory: Valve Plate · Stand 30 · Manufacturer: Handok Hydraulic (South Korea) · OEM xref: KMF90-VP-NEW-HD, HD-KMF90-VP-NEW'
  ),
  (
    'hydraulic-vp-kmf90-pc200-3-2pin-hd',
    'KMF90-VP-PC200-3-2PIN-HD',
    'Handok KMF90 Valve Plate (PC200-3 - 2 Pin)',
    'Hydraulic Parts',
    1, 1, 0, 0,
    ARRAY['Komatsu PC200-3','Komatsu PC200LC-3','Komatsu PC210-3','Komatsu PC220-3'],
    30, null, null,
    'Subcategory: Valve Plate · Stand 30 · Manufacturer: Handok Hydraulic (South Korea) · OEM xref: KMF90-VP-PC200-3-2PIN-HD, HD-KMF90-VP-2PIN'
  ),
  (
    'hydraulic-vp-kmf90-pc200-3-5-hd',
    'KMF90-VP-PC200-3-5-HD',
    'Handok KMF90 Valve Plate (PC200-3/5 Universal)',
    'Hydraulic Parts',
    2, 1, 0, 0,
    ARRAY['Komatsu PC200-3','Komatsu PC200-5','Komatsu PC220-3','Komatsu PC220-5'],
    30, null, null,
    'Subcategory: Valve Plate · Stand 30 · Manufacturer: Handok Hydraulic (South Korea) · OEM xref: KMF90-VP-PC200-3-5-HD, 706-74-11220, 7067411220, HD-KMF90-VP-3-5'
  ),
  (
    'hydraulic-vp-hpv75-new-hd',
    'HPV75-VP-NEW-HD',
    'Handok HPV75 Valve Plate (New Type - PC60-7)',
    'Hydraulic Parts',
    2, 1, 0, 0,
    ARRAY['Komatsu PC60-7','Komatsu PC70-7','Komatsu PC75UU-2','Komatsu PC78US-5','Komatsu PC78US-6'],
    30, null, null,
    'Subcategory: Valve Plate · Stand 30 · Manufacturer: Handok Hydraulic (South Korea) · OEM xref: HPV75-VP-NEW-HD, 708-2G-13230, 7082G13230, HD-HPV75-VP-NEW'
  ),
  (
    'hydraulic-vp-m2x150-170-hd',
    'M2X150-170-VP-HD',
    'Handok M2X150/170 Valve Plate',
    'Hydraulic Parts',
    2, 1, 0, 0,
    ARRAY['Kawasaki M2X150','Kawasaki M2X150B','Kawasaki M2X170','Kawasaki M2X170B'],
    30, null, null,
    'Subcategory: Valve Plate · Stand 30 · Manufacturer: Handok Hydraulic (South Korea) · OEM xref: M2X150-170-VP-HD, M2X150-VP, M2X170-VP, HD-M2X150-170-VP'
  ),
  (
    'hydraulic-vp-m2x120-hd',
    'M2X120-VP-HD',
    'Handok M2X120 Valve Plate',
    'Hydraulic Parts',
    1, 1, 0, 0,
    ARRAY['Kawasaki M2X120','Kawasaki M2X120B'],
    30, null, null,
    'Subcategory: Valve Plate · Stand 30 · Manufacturer: Handok Hydraulic (South Korea) · OEM xref: M2X120-VP-HD, M2X120-VP, HD-M2X120-VP'
  ),
  (
    'hydraulic-vp-m2x63-hd',
    'M2X63-VP-HD',
    'Handok M2X63 Valve Plate',
    'Hydraulic Parts',
    1, 1, 0, 0,
    ARRAY['Kawasaki M2X63','Kawasaki M2X63B'],
    30, null, null,
    'Subcategory: Valve Plate · Stand 30 · Manufacturer: Handok Hydraulic (South Korea) · OEM xref: M2X63-VP-HD, M2X63-VP, HD-M2X63-VP'
  ),
  (
    'hydraulic-vp-ap2d12-hd',
    'AP2D12-VP-HD',
    'Handok AP2D12 Valve Plate',
    'Hydraulic Parts',
    1, 1, 0, 0,
    ARRAY['Uchida AP2D12','Uchida AP2D12LV','Uchida AP2D12FL3','Rexroth AP2D12','Rexroth AP2D12LV','Rexroth AP2D12FL3'],
    30, null, null,
    'Subcategory: Valve Plate · Stand 30 · Manufacturer: Handok Hydraulic (South Korea) · OEM xref: AP2D12-VP-HD, AP2D12-VP, HD-AP2D12-VP'
  ),
  (
    'hydraulic-vp-gm35va-hd',
    'GM35VA-VP-HD',
    'Handok GM35VA Valve Plate',
    'Hydraulic Parts',
    1, 1, 0, 0,
    ARRAY['Teijin Seiki GM35VA','Nabtesco GM35VA'],
    30, null, null,
    'Subcategory: Valve Plate · Stand 30 · Manufacturer: Handok Hydraulic (South Korea) · OEM xref: GM35VA-VP-HD, GM35VA-VP, HD-GM35VA-VP'
  ),
  (
    'hydraulic-vp-hpv75-old-hd',
    'HPV75-VP-OLD-HD',
    'Handok HPV75 Valve Plate (Old Type - PC60-7)',
    'Hydraulic Parts',
    2, 1, 0, 0,
    ARRAY['Komatsu PC60-7','Komatsu PC60-7E','Komatsu PC60-7-B'],
    30, null, null,
    'Subcategory: Valve Plate · Stand 30 · Manufacturer: Handok Hydraulic (South Korea) · OEM xref: HPV75-VP-OLD-HD, 708-2G-13210, 7082G13210, HD-HPV75-VP-OLD'
  ),
node : count 31
At C:\Users\saidg\AppData\Local\Temp\ps-script-0c7fd5a1-543c-4181-9fa4-2d3986de5153.ps1:88 char:1
+ node "C:\Users\saidg\parts village app\scripts\gen-vp-sql.mjs" > "C:\ ...
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : NotSpecified: (count 31:String) [], RemoteException
    + FullyQualifiedErrorId : NativeCommandError
 
  (
    'hydraulic-vp-a8vo160-r-hd',
    'A8VO160-VP-R-HD',
    'Handok A8VO160 Valve Plate (Right)',
    'Hydraulic Parts',
    1, 1, 0, 0,
    ARRAY['Rexroth A8VO160','Rexroth A8VO160LA1HN1'],
    31, null, null,
    'Subcategory: Valve Plate · Stand 31 · Manufacturer: Handok Hydraulic (South Korea) · OEM xref: A8VO160-VP-R-HD, HD-A8VO160-VP-R'
  ),
  (
    'hydraulic-vp-a8vo160-l-hd',
    'A8VO160-VP-L-HD',
    'Handok A8VO160 Valve Plate (Left)',
    'Hydraulic Parts',
    3, 1, 0, 0,
    ARRAY['Rexroth A8VO160','Rexroth A8VO160LA1HN1'],
    31, null, null,
    'Subcategory: Valve Plate · Stand 31 · Manufacturer: Handok Hydraulic (South Korea) · OEM xref: A8VO160-VP-L-HD, HD-A8VO160-VP-L'
  ),
  (
    'hydraulic-vp-a8vo107-l-eg',
    'A8VO107-VP-L-EG',
    'Engrenax A8VO107 Valve Plate (Left)',
    'Hydraulic Parts',
    3, 1, 0, 0,
    ARRAY['Rexroth A8VO107','Rexroth A8VO107LA1HN1'],
    31, null, null,
    'Subcategory: Valve Plate · Stand 31 · Manufacturer: Engrenax (Canada) · OEM xref: A8VO107-VP-L-EG, EG-A8VO107-VP-L'
  ),
  (
    'hydraulic-vp-a8vo160-r-eg',
    'A8VO160-VP-R-EG',
    'Engrenax A8VO160 Valve Plate (Right)',
    'Hydraulic Parts',
    2, 1, 0, 0,
    ARRAY['Rexroth A8VO160','Rexroth A8VO160LA1HN1'],
    31, null, null,
    'Subcategory: Valve Plate · Stand 31 · Manufacturer: Engrenax (Canada) · OEM xref: A8VO160-VP-R-EG, EG-A8VO160-VP-R'
  ),
  (
    'hydraulic-vp-a8vo107-r-eg',
    'A8VO107-VP-R-EG',
    'Engrenax A8VO107 Valve Plate (Right)',
    'Hydraulic Parts',
    4, 2, 0, 0,
    ARRAY['Rexroth A8VO107','Rexroth A8VO107LA1HN1'],
    31, null, null,
    'Subcategory: Valve Plate · Stand 31 · Manufacturer: Engrenax (Canada) · OEM xref: A8VO107-VP-R-EG, EG-A8VO107-VP-R'
  ),
  (
    'hydraulic-vp-a8vo200-r-eg',
    'A8VO200-VP-R-EG',
    'Engrenax A8VO200 Valve Plate (Right)',
    'Hydraulic Parts',
    1, 1, 0, 0,
    ARRAY['Rexroth A8VO200'],
    31, null, null,
    'Subcategory: Valve Plate · Stand 31 · Manufacturer: Engrenax (Canada) · OEM xref: A8VO200-VP-R-EG, EG-A8VO200-VP-R'
  ),
  (
    'hydraulic-vp-m2x150-170-eg',
    'M2X150-170-VP-EG',
    'Engrenax M2X150/170 Valve Plate',
    'Hydraulic Parts',
    2, 1, 0, 0,
    ARRAY['Kawasaki M2X150','Kawasaki M2X170'],
    31, null, null,
    'Subcategory: Valve Plate · Stand 31 · Manufacturer: Engrenax (Canada) · OEM xref: M2X150-170-VP-EG, EG-M2X150-170-VP'
  ),
  (
    'hydraulic-vp-a7vo250-l-hd',
    'A7VO250-VP-L-HD',
    'Handok A7VO250 L/EL Valve Plate (Left)',
    'Hydraulic Parts',
    3, 1, 0, 0,
    ARRAY['Rexroth A7VO250','Rexroth A7VO250L','Rexroth A7VO250EL'],
    31, null, null,
    'Subcategory: Valve Plate · Stand 31 · Manufacturer: Handok Hydraulic (South Korea) · OEM xref: A7VO250-VP-L-HD, HD-A7VO250-VP-L'
  ),
  (
    'hydraulic-vp-a8vo107-l-hd',
    'A8VO107-VP-L-HD',
    'Handok A8VO107 Valve Plate (Left)',
    'Hydraulic Parts',
    2, 1, 0, 0,
    ARRAY['Rexroth A8VO107'],
    31, null, null,
    'Subcategory: Valve Plate · Stand 31 · Manufacturer: Handok Hydraulic (South Korea) · OEM xref: A8VO107-VP-L-HD, HD-A8VO107-VP-L'
  ),
  (
    'hydraulic-vp-a8vo107-r-hd',
    'A8VO107-VP-R-HD',
    'Handok A8VO107 Valve Plate (Right)',
    'Hydraulic Parts',
    2, 1, 0, 0,
    ARRAY['Rexroth A8VO107'],
    31, null, null,
    'Subcategory: Valve Plate · Stand 31 · Manufacturer: Handok Hydraulic (South Korea) · OEM xref: A8VO107-VP-R-HD, HD-A8VO107-VP-R'
  ),
  (
    'hydraulic-vp-a8v86-l-esbr-hd',
    'A8V86-VP-L-ESBR-HD',
    'Handok A8V86 ESBR Valve Plate (Left)',
    'Hydraulic Parts',
    2, 1, 0, 0,
    ARRAY['Rexroth A8V86','Rexroth A8V86ESBR'],
    31, null, null,
    'Subcategory: Valve Plate · Stand 31 · Manufacturer: Handok Hydraulic (South Korea) · OEM xref: A8V86-VP-L-ESBR-HD, HD-A8V86-VP-L'
  ),
  (
    'hydraulic-vp-a8v86-r-esbr-hd',
    'A8V86-VP-R-ESBR-HD',
    'Handok A8V86 ESBR Valve Plate (Right)',
    'Hydraulic Parts',
    2, 1, 0, 0,
    ARRAY['Rexroth A8V86','Rexroth A8V86ESBR'],
    31, null, null,
    'Subcategory: Valve Plate · Stand 31 · Manufacturer: Handok Hydraulic (South Korea) · OEM xref: A8V86-VP-R-ESBR-HD, HD-A8V86-VP-R'
  ),
  (
    'hydraulic-vp-a8v59-l-esbr-hd',
    'A8V59-VP-L-ESBR-HD',
    'Handok A8V59 ESBR Valve Plate (Left)',
    'Hydraulic Parts',
    1, 1, 0, 0,
    ARRAY['Rexroth A8V59','Rexroth A8V59ESBR'],
    31, null, null,
    'Subcategory: Valve Plate · Floor 31 · Manufacturer: Handok Hydraulic (South Korea) · OEM xref: A8V59-VP-L-ESBR-HD, HD-A8V59-VP-L'
  ),
  (
    'hydraulic-vp-a8v59-r-esbr-hd',
    'A8V59-VP-R-ESBR-HD',
    'Handok A8V59 ESBR Valve Plate (Right)',
    'Hydraulic Parts',
    1, 1, 0, 0,
    ARRAY['Rexroth A8V59','Rexroth A8V59ESBR'],
    31, null, null,
    'Subcategory: Valve Plate · Floor 31 · Manufacturer: Handok Hydraulic (South Korea) · OEM xref: A8V59-VP-R-ESBR-HD, HD-A8V59-VP-R'
  ),
  (
    'hydraulic-vp-a8v107sr1r-l-hd',
    'A8V107SR1R-VP-L-HD',
    'Handok A8V107SR1R Valve Plate (Left)',
    'Hydraulic Parts',
    1, 1, 0, 0,
    ARRAY['Rexroth A8V107SR1R'],
    31, null, null,
    'Subcategory: Valve Plate · Floor 31 · Manufacturer: Handok Hydraulic (South Korea) · OEM xref: A8V107SR1R-VP-L-HD, HD-A8V107SR1R-VP-L'
  ),
  (
    'hydraulic-vp-hmgf36-hd',
    'HMGF36-VP-HD',
    'Handok HMGF36 Valve Plate',
    'Hydraulic Parts',
    4, 2, 0, 0,
    ARRAY['Hydraulic Motors HMGF36 Series'],
    31, null, null,
    'Subcategory: Valve Plate · Floor 31 · Manufacturer: Handok Hydraulic (South Korea) · OEM xref: HMGF36-VP-HD, HD-HMGF36-VP'
  ),
  (
    'hydraulic-vp-a8vo200-l-hd',
    'A8VO200-VP-L-HD',
    'Handok A8VO200 Valve Plate (Left)',
    'Hydraulic Parts',
    1, 1, 0, 0,
    ARRAY['Rexroth A8VO200'],
    31, null, null,
    'Subcategory: Valve Plate · Floor 31 · Manufacturer: Handok Hydraulic (South Korea) · OEM xref: A8VO200-VP-L-HD, HD-A8VO200-VP-L'
  ),
  (
    'hydraulic-vp-a8vo200-r-hd',
    'A8VO200-VP-R-HD',
    'Handok A8VO200 Valve Plate (Right)',
    'Hydraulic Parts',
    1, 1, 0, 0,
    ARRAY['Rexroth A8VO200'],
    31, null, null,
    'Subcategory: Valve Plate · Floor 31 · Manufacturer: Handok Hydraulic (South Korea) · OEM xref: A8VO200-VP-R-HD, HD-A8VO200-VP-R'
  ),
  (
    'hydraulic-vp-yc35-6-af',
    'YC35-6-VP-AF',
    'Aftermarket YC35-6 Valve Plate',
    'Hydraulic Parts',
    1, 1, 0, 0,
    ARRAY['Yuchai YC35-6','Yuchai YC35','Yuchai YC35SR'],
    31, null, null,
    'Subcategory: Valve Plate · Stand 31 · Manufacturer: Aftermarket Premium Grade · OEM xref: YC35-6-VP-AF, YC35-6-VP, AF-YC35-6-VP'
  ),
  (
    'hydraulic-vp-ap2d36-r-af',
    'AP2D36-VP-R-AF',
    'Aftermarket AP2D36 Valve Plate (Right)',
    'Hydraulic Parts',
    1, 1, 0, 0,
    ARRAY['Uchida AP2D36','Uchida AP2D36LV','Rexroth AP2D36','Rexroth AP2D36LV','Komatsu PC50MR-2','Komatsu PC55MR-2','Takeuchi TB145','Takeuchi TB153'],
    31, null, null,
    'Subcategory: Valve Plate · Stand 31 · Manufacturer: Aftermarket Premium Grade · OEM xref: AP2D36-VP-R-AF, AP2D36-VP-R, AF-AP2D36-VP-R'
  ),
  (
    'hydraulic-vp-a10vo71-l-af',
    'A10VO71-VP-L-AF',
    'Aftermarket A10VO71 Valve Plate (Left)',
    'Hydraulic Parts',
    1, 1, 0, 0,
    ARRAY['Rexroth A10VO71','Rexroth A10VO71DFR','Rexroth A10VO71DR'],
    31, null, null,
    'Subcategory: Valve Plate · Stand 31 · Manufacturer: Aftermarket Premium Grade · OEM xref: A10VO71-VP-L-AF, A10VO71-VP-L, AF-A10VO71-VP-L, A10VO71FLR'
  ),
(
    'hydraulic-sp-a7vo250-flat-hd',
    'A7VO250-SP-FLAT-HD',
    'Handok A7VO250 Retainer / Set Plate (Flat Type - Old Type)',
    'Hydraulic Parts',
    2, 1, 0, 0,
    ARRAY['Rexroth A7VO250','Rexroth A7VO250L','Rexroth A7VO250EL'],
    27, null, null,
    'Subcategory: retainer / set plate · Stand 27 · Manufacturer: Handok Hydraulic (South Korea) · OEM xref: A7VO250-SP-FLAT-HD, A7VO250-SP-FLAT, HD-A7VO250-SP-OLD'
  ),
  (
    'hydraulic-sp-a8vo107-eg',
    'A8VO107-SP-EG',
    'Engrenax A8VO107 Retainer / Set Plate',
    'Hydraulic Parts',
    11, 2, 0, 0,
    ARRAY['Rexroth A8VO107','Rexroth A8VO107LA1HN1'],
    27, null, null,
    'Subcategory: retainer / set plate · Stand 27 · Manufacturer: Engrenax (Canada) · OEM xref: A8VO107-SP-EG, A8VO107-SP, EG-A8VO107-SP'
  ),
  (
    'hydraulic-sp-m2x120-eg',
    'M2X120-SP-EG',
    'Engrenax M2X120 Retainer / Set Plate',
    'Hydraulic Parts',
    8, 2, 0, 0,
    ARRAY['Kawasaki M2X120','Kawasaki M2X120B'],
    27, null, null,
    'Subcategory: retainer / set plate · Stand 27 · Manufacturer: Engrenax (Canada) · OEM xref: M2X120-SP-EG, M2X120-SP, EG-M2X120-SP'
  ),
  (
    'hydraulic-sp-m2x150-170-eg',
    'M2X150-170-SP-EG',
    'Engrenax M2X150/170 Retainer / Set Plate',
    'Hydraulic Parts',
    3, 1, 0, 0,
    ARRAY['Kawasaki M2X150','Kawasaki M2X170','Kawasaki M2X170B'],
    27, null, null,
    'Subcategory: retainer / set plate · Stand 27 · Manufacturer: Engrenax (Canada) · OEM xref: M2X150-170-SP-EG, M2X150-SP, M2X170-SP, EG-M2X150-170-SP'
  ),
  (
    'hydraulic-sp-a8vo160-eg',
    'A8VO160-SP-EG',
    'Engrenax A8VO160 Retainer / Set Plate',
    'Hydraulic Parts',
    6, 2, 0, 0,
    ARRAY['Rexroth A8VO160','Rexroth A8VO160LA1HN1'],
    27, null, null,
    'Subcategory: retainer / set plate · Stand 27 · Manufacturer: Engrenax (Canada) · OEM xref: A8VO160-SP-EG, A8VO160-SP, EG-A8VO160-SP'
  ),
  (
    'hydraulic-sp-a7vo250-hd',
    'A7VO250-SP-HD',
    'Handok A7VO250 Retainer / Set Plate',
    'Hydraulic Parts',
    1, 1, 0, 0,
    ARRAY['Rexroth A7VO250'],
    27, null, null,
    'Subcategory: retainer / set plate · Stand 27 · Manufacturer: Handok Hydraulic (South Korea) · OEM xref: A7VO250-SP-HD, A7VO250-SP, HD-A7VO250-SP'
  ),
  (
    'hydraulic-sp-a8v86-hd',
    'A8V86-SP-HD',
    'Handok A8V86 Retainer / Set Plate',
    'Hydraulic Parts',
    1, 1, 0, 0,
    ARRAY['Rexroth A8V86','Rexroth A8V86ESBR'],
    27, null, null,
    'Subcategory: retainer / set plate · Stand 27 · Manufacturer: Handok Hydraulic (South Korea) · OEM xref: A8V86-SP-HD, A8V86-SP, HD-A8V86-SP'
  ),
  (
    'hydraulic-sp-kmf90-pc200-3-taper-hd',
    'KMF90-SP-PC200-3-TAPER-HD',
    'Handok KMF90 Retainer / Set Plate (Taper Type - PC200-3)',
    'Hydraulic Parts',
    7, 2, 0, 0,
    ARRAY['Komatsu PC200-3','Komatsu PC200LC-3','Komatsu PC210-3','Komatsu PC220-3'],
    27, null, null,
    'Subcategory: retainer / set plate · Stand 27 · Manufacturer: Handok Hydraulic (South Korea) · OEM xref: KMF90-SP-PC200-3-TAPER-HD, 706-74-11110, 7067411110, HD-KMF90-SP-TAPER'
  ),
  (
    'hydraulic-sp-a7vo250-old-hd',
    'A7VO250-SP-OLD-HD',
    'Handok A7VO250 Retainer / Set Plate (Standard - Old Type)',
    'Hydraulic Parts',
    1, 1, 0, 0,
    ARRAY['Rexroth A7VO250'],
    27, null, null,
    'Subcategory: retainer / set plate · Stand 27 · Manufacturer: Handok Hydraulic (South Korea) · OEM xref: A7VO250-SP-OLD-HD, HD-A7VO250-SP-OLD-STD'
  ),
  (
    'hydraulic-sp-a8v107sr1r-hd',
    'A8V107SR1R-SP-HD',
    'Handok A8V107SR1R Retainer / Set Plate',
    'Hydraulic Parts',
    4, 2, 0, 0,
    ARRAY['Rexroth A8V107SR1R'],
    27, null, null,
    'Subcategory: retainer / set plate · Stand 27 · Manufacturer: Handok Hydraulic (South Korea) · OEM xref: A8V107SR1R-SP-HD, HD-A8V107SR1R-SP'
  ),
  (
    'hydraulic-sp-kmf125-7h-hd',
    'KMF125-SP-7H-HD',
    'Handok KMF125 Retainer / Set Plate (7 Holes)',
    'Hydraulic Parts',
    2, 1, 0, 0,
    ARRAY['Komatsu PC300-5','Komatsu PC300-6','Komatsu PC350-6'],
    27, null, null,
    'Subcategory: retainer / set plate · Stand 27 · Manufacturer: Handok Hydraulic (South Korea) · OEM xref: KMF125-SP-7H-HD, 706-75-11110, 7067511110, HD-KMF125-SP-7H'
  ),
  (
    'hydraulic-sp-m2x210-hd',
    'M2X210-SP-HD',
    'Handok M2X210 Retainer / Set Plate',
    'Hydraulic Parts',
    5, 2, 0, 0,
    ARRAY['Kawasaki M2X210','Kawasaki M2X210B'],
    26, null, null,
    'Subcategory: retainer / set plate · Stand 26 · Manufacturer: Handok Hydraulic (South Korea) · OEM xref: M2X210-SP-HD, M2X210-SP, HD-M2X210-SP'
  ),
  (
    'hydraulic-sp-ap2d12-hd',
    'AP2D12-SP-HD',
    'Handok AP2D12 Retainer / Set Plate',
    'Hydraulic Parts',
    1, 1, 0, 0,
    ARRAY['Uchida AP2D12','Uchida AP2D12LV','Rexroth AP2D12','Rexroth AP2D12LV'],
    26, null, null,
    'Subcategory: retainer / set plate · Stand 26 · Manufacturer: Handok Hydraulic (South Korea) · OEM xref: AP2D12-SP-HD, AP2D12-SP, HD-AP2D12-SP'
  ),
  (
    'hydraulic-sp-hpv160-hd',
    'HPV160-SP-HD',
    'Handok HPV160 Retainer / Set Plate',
    'Hydraulic Parts',
    1, 1, 0, 0,
    ARRAY['Komatsu HPV160 Series'],
    26, null, null,
    'Subcategory: retainer / set plate · Stand 26 · Manufacturer: Handok Hydraulic (South Korea) · OEM xref: HPV160-SP-HD, HD-HPV160-SP'
  ),
  (
    'hydraulic-sp-m2x150-170-hd',
    'M2X150-170-SP-HD',
    'Handok M2X150/170 Retainer / Set Plate',
    'Hydraulic Parts',
    2, 1, 0, 0,
    ARRAY['Kawasaki M2X150','Kawasaki M2X170'],
    26, null, null,
    'Subcategory: retainer / set plate · Stand 26 · Manufacturer: Handok Hydraulic (South Korea) · OEM xref: M2X150-170-SP-HD, M2X150-SP, M2X170-SP, HD-M2X150-170-SP'
  ),
  (
    'hydraulic-sp-hpv90-pc200-3-5-hd',
    'HPV90-SP-PC200-3-5-HD',
    'Handok HPV90 Retainer / Set Plate (PC200-3/5)',
    'Hydraulic Parts',
    5, 2, 0, 0,
    ARRAY['Komatsu PC200-3','Komatsu PC200-5','Komatsu PC220-3','Komatsu PC220-5'],
    26, null, null,
    'Subcategory: retainer / set plate · Stand 26 · Manufacturer: Handok Hydraulic (South Korea) · OEM xref: HPV90-SP-PC200-3-5-HD, 708-2H-11210, 7082H11210, HD-HPV90-SP'
  ),
  (
    'hydraulic-sp-hpv132c-pc300-6-hd',
    'HPV132C-SP-PC300-6-HD',
    'Handok HPV132C Retainer / Set Plate (PC300-6)',
    'Hydraulic Parts',
    4, 2, 0, 0,
    ARRAY['Komatsu PC300-6','Komatsu PC300LC-6'],
    26, null, null,
    'Subcategory: retainer / set plate · Stand 26 · Manufacturer: Handok Hydraulic (South Korea) · OEM xref: HPV132C-SP-PC300-6-HD, HD-HPV132C-SP'
  ),
  (
    'hydraulic-sp-hpv132-new-pc300-6-hd',
    'HPV132-SP-NEW-PC300-6-HD',
    'Handok HPV132 Retainer / Set Plate (New Type - PC300-6)',
    'Hydraulic Parts',
    2, 1, 0, 0,
    ARRAY['Komatsu PC300-6','Komatsu PC350-6'],
    26, null, null,
    'Subcategory: retainer / set plate · Stand 26 · Manufacturer: Handok Hydraulic (South Korea) · OEM xref: HPV132-SP-NEW-PC300-6-HD, 708-2H-11240, 7082H11240, HD-HPV132-SP-NEW'
  ),
  (
    'hydraulic-sp-hpv160-pc300-400-3-5-hd',
    'HPV160-SP-PC300-400-3-5-HD',
    'Handok HPV160 Retainer / Set Plate (PC300/400-3/5)',
    'Hydraulic Parts',
    8, 2, 0, 0,
    ARRAY['Komatsu PC300-3','Komatsu PC300-5','Komatsu PC400-3','Komatsu PC400-5'],
    26, null, null,
    'Subcategory: retainer / set plate · Stand 26 · Manufacturer: Handok Hydraulic (South Korea) · OEM xref: HPV160-SP-PC300-400-3-5-HD, 708-2L-11210, 7082L11210, HD-HPV160-SP-3-5'
  ),
  (
    'hydraulic-sp-sg08-hd',
    'SG08-SP-HD',
    'Handok SG08 Retainer / Set Plate',
    'Hydraulic Parts',
    1, 1, 0, 0,
    ARRAY['Kawasaki SG08'],
    26, null, null,
    'Subcategory: retainer / set plate · Stand 26 · Manufacturer: Handok Hydraulic (South Korea) · OEM xref: SG08-SP-HD, SG08-SP, HD-SG08-SP'
  ),
  (
    'hydraulic-sp-m2x120-hd',
    'M2X120-SP-HD',
    'Handok M2X120 Retainer / Set Plate',
    'Hydraulic Parts',
    3, 1, 0, 0,
    ARRAY['Kawasaki M2X120','Kawasaki M2X120B'],
    26, null, null,
    'Subcategory: retainer / set plate · Stand 26 · Manufacturer: Handok Hydraulic (South Korea) · OEM xref: M2X120-SP-HD, M2X120-SP, HD-M2X120-SP'
  ),
  (
    'hydraulic-sp-kmf41-hd',
    'KMF41-SP-HD',
    'Handok KMF41 Retainer / Set Plate',
    'Hydraulic Parts',
    2, 1, 0, 0,
    ARRAY['Komatsu PC60-7','Komatsu PC70-7'],
    26, null, null,
    'Subcategory: retainer / set plate · Stand 26 · Manufacturer: Handok Hydraulic (South Korea) · OEM xref: KMF41-SP-HD, 706-73-11110, 7067311110, HD-KMF41-SP'
  ),
  (
    'hydraulic-sp-hpv75-new-pc60-6-7-8-hd',
    'HPV75-SP-NEW-PC60-6-7-8-HD',
    'Handok HPV75 Retainer / Set Plate (New Type - PC60-6/7/8)',
    'Hydraulic Parts',
    2, 1, 0, 0,
    ARRAY['Komatsu PC60-6','Komatsu PC60-7','Komatsu PC60-8'],
    26, null, null,
    'Subcategory: retainer / set plate · Stand 26 · Manufacturer: Handok Hydraulic (South Korea) · OEM xref: HPV75-SP-NEW-PC60-6-7-8-HD, 708-2G-11220, 7082G11220, HD-HPV75-SP-NEW'
  ),
  (
    'hydraulic-sp-hpv95a-pc200-7-hd',
    'HPV95A-SP-PC200-7-HD',
    'Handok HPV95A Retainer / Set Plate (PC200-7)',
    'Hydraulic Parts',
    1, 1, 0, 0,
    ARRAY['Komatsu PC200-7','Komatsu PC220-7'],
    26, null, null,
    'Subcategory: retainer / set plate · Stand 26 · Manufacturer: Handok Hydraulic (South Korea) · OEM xref: HPV95A-SP-PC200-7-HD, 708-2G-11240, 7082G11240, HD-HPV95A-SP'
  ),
  (
    'hydraulic-sp-hpv140-pc300-7-8-hd',
    'HPV140-SP-PC300-7-8-HD',
    'Handok HPV140 Retainer / Set Plate (PC300-7/8)',
    'Hydraulic Parts',
    1, 1, 0, 0,
    ARRAY['Komatsu PC300-7','Komatsu PC300-8'],
    26, null, null,
    'Subcategory: retainer / set plate · Stand 26 · Manufacturer: Handok Hydraulic (South Korea) · OEM xref: HPV140-SP-PC300-7-8-HD, 708-2L-11230, 7082L11230, HD-HPV140-SP'
  ),
  (
    'hydraulic-servo-3069541',
    '3069541',
    'Handok HPVO102 Servo Piston',
    'Hydraulic Parts',
    2, 1, 0, 0,
    ARRAY['Hitachi EX200-2','Hitachi EX200-3','Hitachi EX220-2','Hitachi EX220-3'],
    25, null, null,
    'Subcategory: servo piston · Stand 25 · Manufacturer: Handok Hydraulic (South Korea) · Weight: ~0.84 kg · Pump series: Hitachi HPVO102 Series Regular Flow Group · OEM xref: 3069541, HD-3069541, HPVO102-SERVO'
  ),
  (
    'hydraulic-servo-37730',
    '37730',
    'Handok HPV116 Servo Piston',
    'Hydraulic Parts',
    9, 2, 0, 0,
    ARRAY['Hitachi ZX200','Hitachi ZX200-3','Hitachi ZX210-3','Hitachi ZX240-3','Hitachi ZX270-3','John Deere 200CLC','John Deere 240D','John Deere 270CLC'],
    25, null, null,
    'Subcategory: servo piston · Stand 25 · Manufacturer: Handok Hydraulic (South Korea) · Weight: ~0.84 kg · Pump series: Hitachi / Kawasaki HPV116 Series Drives · OEM xref: 37730, HD-37730, HPV116-SERVO, 9194210'
  ),
  (
    'hydraulic-servo-18210',
    '18210',
    'Handok H3V140 / 180DT Servo Piston',
    'Hydraulic Parts',
    2, 1, 0, 0,
    ARRAY['Kobelco SK330','Kobelco SK330-6','Kobelco SK350','Kobelco SK350-8','Hyundai R320LC-7','Hyundai R320LC-9','Hyundai R360LC-7','Volvo EC360B','Volvo EC360C'],
    25, null, null,
    'Subcategory: servo piston · Stand 25 · Manufacturer: Handok Hydraulic (South Korea) · Weight: ~0.99 kg · Pump series: Handok / Kawasaki H3V140 Series; H3V180DT Series Type · OEM xref: 18210, HD-18210, H3V140-SERVO, H3V180DT-SERVO'
  ),
  (
    'hydraulic-cp-04121',
    '04121',
    'Handok A8V172 / A8VO160 Center Pin',
    'Hydraulic Parts',
    2, 1, 0, 0,
    ARRAY['Rexroth A8V172','Rexroth A8VO160','Rexroth A8VO160LA1HN1'],
    25, null, null,
    'Subcategory: Center Pin · Stand 25 · Handok · Spherical Cylinder Barrel Core Guide Pin · ~0.48 kg · xref: 04121, HD-04121, A8V172-CP, A8VO160-CP'
  ),
  (
    'hydraulic-cp-63855',
    '63855',
    'Handok KMF125 Center Pin',
    'Hydraulic Parts',
    2, 1, 0, 0,
    ARRAY['Komatsu PC300-5','Komatsu PC300-6','Komatsu PC350-6'],
    25, null, null,
    'Subcategory: Center Pin · Stand 25 · Handok · Spherical Motor Block Hub Guide Shaft · ~0.31 kg · xref: 63855, HD-63855, KMF125-CP, 706-75-11120'
  ),
  (
    'hydraulic-cp-04145',
    '04145',
    'Handok A8VO107 Center Pin',
    'Hydraulic Parts',
    6, 2, 0, 0,
    ARRAY['Rexroth A8VO107','Rexroth A8VO107LA1HN1'],
    25, null, null,
    'Subcategory: Center Pin · Stand 25 · Handok · Spherical Cylinder Barrel Core Guide Pin · ~0.31 kg · xref: 04145, HD-04145, A8VO107-CP'
  ),
  (
    'hydraulic-cp-a8v86-hd',
    'A8V86-CP-HD',
    'Handok A8V86 Center Pin',
    'Hydraulic Parts',
    1, 1, 0, 0,
    ARRAY['Rexroth A8V86','Rexroth A8V86ESBR'],
    25, null, null,
    'Subcategory: Center Pin · Stand 25 · Handok · Spherical Cylinder Barrel Core Guide Pin · xref: A8V86-CP, HD-A8V86-CP'
  )
on conflict (id) do update set
  part_number = excluded.part_number,
  name = excluded.name,
  category = excluded.category,
  quantity = excluded.quantity,
  reorder_at = excluded.reorder_at,
  compatibility = excluded.compatibility,
  box_number = excluded.box_number,
  notes = excluded.notes;
