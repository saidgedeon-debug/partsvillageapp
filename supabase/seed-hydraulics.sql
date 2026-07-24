-- Hydraulic Parts inventory seed (optional; app also loads from src/lib/hydraulics-inventory.ts)
insert into public.parts (id, part_number, name, category, quantity, reorder_at, cost, price, compatibility, box_number, inside_diameter_mm, cross_section_mm, notes)
values
  (
    'hydraulic-hpv116-cp-hd',
    'HPV116-CP-HD',
    'Handok HPV116 Hydraulic Pump Center Piston (Cylinder Guide Hub)',
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
    'Manufacturer: Handok Hydraulic (South Korea) · Material: high-density hardened carbon steel · Surface: precision ground & polished to OEM micro-tolerances · Pump displacement 116cc / 118cc · OEM xref: HPV116-CENTER-PIN, 71402440, 9065880, 9065882, TH109461, HD-HPV116-CP · Fitment: Fiat Hitachi/Kobelco main pump group; Hitachi rotary group central piston; John Deere main hydraulic cylinder barrel guide pin'
  ),
  (
    'hydraulic-hpv145-cp-hd',
    'HPV145-CP-HD',
    'Handok HPV145 Hydraulic Pump Center Piston (Cylinder Guide Hub)',
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
    'Manufacturer: Handok Hydraulic (South Korea) · Material: high-density hardened carbon steel · Surface: precision ground & polished to OEM micro-tolerances · Pump displacement 145cc · OEM xref: HPV145-CENTER-PIN, 3081023, 4243645, 71402450, HD-HPV145-CP · Fitment: Fiat Hitachi/New Holland main pump group; Hitachi rotary group central piston; John Deere main hydraulic cylinder barrel guide pin'
  )
on conflict (id) do update set
  part_number = excluded.part_number,
  name = excluded.name,
  category = excluded.category,
  quantity = excluded.quantity,
  reorder_at = excluded.reorder_at,
  compatibility = excluded.compatibility,
  notes = excluded.notes;
