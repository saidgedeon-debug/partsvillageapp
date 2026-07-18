-- Seed demo data matching src/lib/mock-data.ts

insert into public.clients (id, name, contact_name, email, phone, address) values
  ('c1', 'Ironclad Excavation Co.', 'Marcus Reid', 'marcus@ironclad.co', '+1 555-0142', '1420 Foundry Rd, Pittsburgh, PA'),
  ('c2', 'Bluewater Construction', 'Elena Vasquez', 'elena@bluewater.build', '+1 555-0187', '88 Harbor Way, Tampa, FL'),
  ('c3', 'Highland Quarry LLC', 'Ronan McKay', 'ronan@highlandq.com', '+1 555-0219', '776 Ridge Line, Denver, CO'),
  ('c4', 'Northwind Logging', 'Sara Nilsen', 'sara@northwindlog.com', '+1 555-0304', '12 Timber Rd, Bend, OR'),
  ('c5', 'Delta Road Works', 'Jamal Carter', 'jamal@deltaroads.com', '+1 555-0355', '301 Asphalt Ave, Houston, TX');

insert into public.parts (id, part_number, name, category, quantity, reorder_at, cost, price, compatibility) values
  ('p1', 'CAT-1R-0750', 'Fuel Filter', 'Filters', 42, 20, 18, 34, array['CAT 320D', 'CAT 336F']),
  ('p2', 'KOM-6754-81-9540', 'Air Filter Element', 'Filters', 8, 15, 55, 112, array['Komatsu PC200-8', 'Komatsu PC220-8']),
  ('p3', 'VOL-15082709', 'Track Chain Assembly', 'Undercarriage', 3, 2, 2400, 4150, array['Volvo EC210', 'Volvo EC220']),
  ('p4', 'JD-RE504836', 'Hydraulic Pump', 'Hydraulics', 5, 3, 1800, 3200, array['John Deere 310L', 'John Deere 410L']),
  ('p5', 'CAT-234-4642', 'Bucket Tooth', 'Attachments', 120, 40, 24, 48, array['CAT 320D', 'CAT 349F']),
  ('p6', 'BOB-7024037', 'Drive Motor', 'Hydraulics', 2, 2, 3100, 5400, array['Bobcat S650', 'Bobcat T770']),
  ('p7', 'CAT-9X-8802', 'Cutting Edge', 'Attachments', 18, 10, 210, 385, array['CAT D6T', 'CAT D8T']),
  ('p8', 'KOM-208-70-14152', 'Bucket Pin', 'Attachments', 6, 12, 85, 165, array['Komatsu PC300-8', 'Komatsu PC400-8']),
  ('p9', 'JD-AT310588', 'Alternator 12V', 'Electrical', 11, 5, 240, 445, array['John Deere 310L', 'John Deere 544K']),
  ('p10', 'VOL-11110961', 'Starter Motor', 'Electrical', 4, 4, 380, 690, array['Volvo L120H', 'Volvo L150H']);

insert into public.machines (id, client_id, make, model, serial_number, year, hours) values
  ('m1', 'c1', 'CAT', '320D', 'SN-9F02214', 2019, 6420),
  ('m2', 'c1', 'CAT', '349F', 'SN-3H10087', 2021, 3120),
  ('m3', 'c2', 'Komatsu', 'PC200-8', 'SN-KM88401', 2018, 8890),
  ('m4', 'c2', 'Volvo', 'EC210', 'SN-VO55221', 2020, 4510),
  ('m5', 'c3', 'CAT', 'D8T', 'SN-D8T7723', 2017, 11200),
  ('m6', 'c3', 'Komatsu', 'PC400-8', 'SN-PC44018', 2022, 1890),
  ('m7', 'c4', 'John Deere', '310L', 'SN-JD31099', 2021, 2760),
  ('m8', 'c5', 'Volvo', 'L150H', 'SN-VL15012', 2019, 7010),
  ('m9', 'c5', 'Bobcat', 'S650', 'SN-BS65044', 2023, 620);

insert into public.orders (id, client_id, machine_id, date, status) values
  ('o1', 'c1', 'm1', '2026-06-14', 'Paid'),
  ('o2', 'c1', 'm2', '2026-05-02', 'Paid'),
  ('o3', 'c2', 'm3', '2026-06-30', 'Pending'),
  ('o4', 'c2', 'm4', '2026-07-05', 'Paid'),
  ('o5', 'c3', 'm5', '2026-04-19', 'Paid'),
  ('o6', 'c3', 'm6', '2026-07-11', 'Quoted'),
  ('o7', 'c4', 'm7', '2026-06-24', 'Paid'),
  ('o8', 'c5', 'm8', '2026-07-08', 'Paid'),
  ('o9', 'c5', 'm9', '2026-07-15', 'Pending');

insert into public.order_lines (order_id, part_id, qty, unit_price) values
  ('o1', 'p1', 4, 34),
  ('o1', 'p5', 12, 48),
  ('o2', 'p5', 8, 48),
  ('o3', 'p2', 2, 112),
  ('o3', 'p8', 4, 165),
  ('o4', 'p3', 1, 4150),
  ('o5', 'p7', 2, 385),
  ('o6', 'p8', 6, 165),
  ('o7', 'p4', 1, 3200),
  ('o7', 'p9', 1, 445),
  ('o8', 'p10', 1, 690),
  ('o9', 'p6', 1, 5400);

insert into public.quotations (id, client_id, date, total, status) values
  ('Q-2026-0141', 'c3', '2026-07-11', 990, 'Sent'),
  ('Q-2026-0142', 'c1', '2026-07-14', 2860, 'Draft'),
  ('Q-2026-0143', 'c5', '2026-07-15', 5400, 'Accepted'),
  ('Q-2026-0140', 'c2', '2026-07-02', 780, 'Rejected');

insert into public.invoices (id, client_id, date, total, status) values
  ('INV-2026-2201', 'c1', '2026-06-14', 712, 'Paid'),
  ('INV-2026-2202', 'c2', '2026-07-05', 4150, 'Paid'),
  ('INV-2026-2203', 'c4', '2026-06-24', 3645, 'Unpaid'),
  ('INV-2026-2199', 'c3', '2026-05-10', 1120, 'Overdue');

insert into public.supplier_inquiries (id, supplier, date, part_numbers, status) values
  ('SI-2026-081', 'Caterpillar Global Parts', '2026-07-12', array['CAT-234-4642', 'CAT-9X-8802'], 'Answered'),
  ('SI-2026-082', 'Komatsu OEM Direct', '2026-07-14', array['KOM-208-70-14152'], 'Open'),
  ('SI-2026-083', 'Volvo CE Distribution', '2026-07-15', array['VOL-15082709'], 'Open');
