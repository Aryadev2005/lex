-- Enable pg_cron and pg_net extensions (requires Supabase Pro or higher)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Daily eCourts sync at 2:00 AM IST (20:30 UTC previous day)
-- Calls the Railway API endpoint to trigger the pipeline.
-- Replace <RAILWAY_API_URL> and <ADMIN_SECRET> before activating.
--
-- NOTE: This is infrastructure-ready scaffolding.
-- Run manually until the Railway endpoint is wired:
--   cd data && pnpm sync:ecourts --days 1
--
SELECT cron.schedule(
  'ecourts-daily-sync',
  '30 20 * * *',
  $$
    SELECT net.http_post(
      url     := '<RAILWAY_API_URL>/api/admin/sync-ecourts',
      headers := '{"Authorization": "Bearer <ADMIN_SECRET>", "Content-Type": "application/json"}'::jsonb,
      body    := '{"days": 1}'::jsonb
    );
  $$
);
