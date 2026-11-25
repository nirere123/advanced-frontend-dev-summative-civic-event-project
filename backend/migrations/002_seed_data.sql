-- ============================================================================
-- 002_seed_data.sql — demo data for local development / the video walkthrough
-- Run AFTER 001_create_tables.sql:
--   psql -U postgres -d civic-events-db -h localhost -p 5432 -f ./migrations/002_seed_data.sql
--
-- Demo accounts (bcrypt hashes generated with the backend's bcrypt, cost 10):
--   admin@civicevents.test / Admin@1234   (role: admin)
--   jane@civicevents.test  / User@1234    (role: user)
-- Safe to re-run: rows are only inserted when they don't already exist.
-- ============================================================================

INSERT INTO users (full_name, email, password_hash, role, is_active)
VALUES
  ('City Admin', 'admin@civicevents.test', '$2b$10$PC2yvKb1lSn7QMrdbP2uIOpOIP9MwRx5FHljlOA17Q00lBMID45oq', 'admin', true),
  ('Jane Resident', 'jane@civicevents.test', '$2b$10$6ndYfcbedEnUEs/sDviKBOGtzo6fLX10dE7EwFQxW09JMjx0OWATu', 'user', true)
ON CONFLICT (email) DO NOTHING;

INSERT INTO events (title, description, location, starts_at, ends_at, published)
SELECT * FROM (VALUES
  ('Community Clean-Up Day',
   'Join neighbours to clean up the riverside park. Gloves, bags and refreshments provided. Wheelchair-accessible paths available.',
   'Riverside Park, North Gate', now() + interval '5 days', now() + interval '5 days 4 hours', true),
  ('Town Hall: 2027 City Budget',
   'Hear the proposed budget and ask questions directly to council members. Sign-language interpretation and live captions provided.',
   'City Hall, Council Chamber', now() + interval '12 days', now() + interval '12 days 2 hours', true),
  ('Night Market & Food Festival',
   'Local food vendors, artisans and live music. Family friendly, free entry.',
   'Main Square', now() + interval '20 days', now() + interval '20 days 5 hours', true),
  ('Digital Skills Workshop for Seniors',
   'A hands-on, beginner-friendly session on using smartphones, video calls and online city services.',
   'Central Library, Room 2', now() - interval '10 days', now() - interval '10 days' + interval '3 hours', true)
) AS v(title, description, location, starts_at, ends_at, published)
WHERE NOT EXISTS (SELECT 1 FROM events e WHERE e.title = v.title);

-- Register the demo user for the first upcoming event
INSERT INTO event_registrations (user_id, event_id)
SELECT u.id, e.id FROM users u, events e
WHERE u.email = 'jane@civicevents.test' AND e.title = 'Community Clean-Up Day'
ON CONFLICT (user_id, event_id) DO NOTHING;

-- Feedback on the past event
INSERT INTO event_feedback (user_id, event_id, rating, comment)
SELECT u.id, e.id, 5, 'Very patient trainers — I can now video call my grandchildren!'
FROM users u, events e
WHERE u.email = 'jane@civicevents.test' AND e.title = 'Digital Skills Workshop for Seniors'
ON CONFLICT (user_id, event_id) DO NOTHING;

-- Welcome broadcast notification
INSERT INTO notifications (title, message, type, recipient_id, metadata)
SELECT 'Welcome to CivicEvents', 'Browse upcoming events, listen to announcements and watch captioned promos.', 'system', NULL, '{}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM notifications WHERE title = 'Welcome to CivicEvents');
