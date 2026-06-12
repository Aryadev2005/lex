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

-- Daily NCLT scrape at 2:30 AM IST (21:00 UTC previous day)
SELECT cron.schedule(
  'nclt-daily-scrape',
  '0 21 * * *',
  $$
    SELECT net.http_post(
      url     := '<RAILWAY_API_URL>/api/admin/scrape-nclt',
      headers := '{"Authorization": "Bearer <ADMIN_SECRET>"}'::jsonb,
      body    := '{"daysBack": 2}'::jsonb
    );
  $$
);

-- Daily ITAT scrape at 3:30 AM IST (22:00 UTC previous day)
SELECT cron.schedule(
  'itat-daily-scrape',
  '0 22 * * *',
  $$
    SELECT net.http_post(
      url     := '<RAILWAY_API_URL>/api/admin/scrape-itat',
      headers := '{"Authorization": "Bearer <ADMIN_SECRET>"}'::jsonb,
      body    := '{}'::jsonb
    );
  $$
);
