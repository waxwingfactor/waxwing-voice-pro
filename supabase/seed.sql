insert into clients (
  id,
  slug,
  name,
  timezone,
  manager_emails,
  owner_notification_emails,
  transfer_phone_number,
  application_url
) values (
  '00000000-0000-0000-0000-000000000001',
  'default',
  'Hunter Property Management',
  'America/Chicago',
  array['manager@example.com'],
  array['owner@example.com'],
  '+15555550100',
  'https://hunterpm.com/availability'
) on conflict (slug) do nothing;

insert into properties (
  client_id,
  street_number,
  street_name,
  city,
  state,
  beds,
  baths,
  monthly_rent_cents,
  pet_policy,
  stories,
  available_date,
  access_information_allowed
) values
('00000000-0000-0000-0000-000000000001', '109', 'Clear Water', 'Boerne', 'TX', 4, 2.5, 279500, 'dogs_only', 2, '2026-07-14', false),
('00000000-0000-0000-0000-000000000001', '605', 'Burleson', 'San Marcos', 'TX', 3, 2, 197000, 'not_allowed', 1, '2026-07-01', false),
('00000000-0000-0000-0000-000000000001', '152', 'Navarro Crossing', 'Seguin', 'TX', 3, 2, 149500, 'cats_and_dogs', 1, 'Now', false),
('00000000-0000-0000-0000-000000000001', '229', 'Craddock B', 'San Marcos', 'TX', 2, 1, 115000, 'cats_and_dogs', 1, 'Now', false),
('00000000-0000-0000-0000-000000000001', '366', 'Silver Springs', 'Kyle', 'TX', 3, 3, 219500, 'cats_and_dogs', 2, '2026-05-10', false),
('00000000-0000-0000-0000-000000000001', '138', 'Preston Trail', 'San Marcos', 'TX', 3, 2.5, 180000, 'cats_and_dogs', 2, '2026-06-26', false),
('00000000-0000-0000-0000-000000000001', '210', 'Addison Place', 'Lockhart', 'TX', 4, 2, 184500, 'cats_and_dogs', 1, 'Now', false),
('00000000-0000-0000-0000-000000000001', '238', 'Bushtail', 'New Braunfels', 'TX', 3, 2, 165000, 'cats_and_dogs', 1, 'Now', false);
