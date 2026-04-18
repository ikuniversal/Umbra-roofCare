insert into organizations (name, slug, type, state) values
  ('Umbra RoofCare HoldCo', 'umbra-holdco', 'holdco', null),
  ('Umbra RoofCare DFW', 'umbra-dfw', 'opco', 'TX'),
  ('Umbra RoofCare Phoenix', 'umbra-phx', 'opco', 'AZ')
on conflict (slug) do nothing;
