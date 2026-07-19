-- ============================================================================
-- Rezina Civic — Supabase Migration 001
-- Run this SQL in Supabase Dashboard → SQL Editor
-- ============================================================================

-- Enable UUID generation
create extension if not exists "pgcrypto";

-- ─── Reports ─────────────────────────────────────────────────────────────────

create table if not exists reports (
  id             uuid             primary key default gen_random_uuid(),
  title          text             not null,
  category       text             not null,
  description    text             not null,
  latitude       double precision not null,
  longitude      double precision not null,
  photo_url      text,
  status         text             not null default 'pending',
  votes          integer          not null default 0,
  resolved       boolean          not null default false,
  fingerprint    text,
  gps_accuracy   double precision,
  address        text,
  reporter_name  text,
  reporter_email text,
  created_at     timestamptz      not null default now()
);

-- ─── Report Votes ─────────────────────────────────────────────────────────────

create table if not exists report_votes (
  id          uuid        primary key default gen_random_uuid(),
  report_id   uuid        not null references reports(id) on delete cascade,
  fingerprint text        not null,
  created_at  timestamptz not null default now(),
  -- Prevent duplicate votes: one fingerprint per report
  unique (report_id, fingerprint)
);

-- ─── Row Level Security ───────────────────────────────────────────────────────

alter table reports     enable row level security;
alter table report_votes enable row level security;

-- Reports policies
create policy "public_read_reports"
  on reports for select using (true);

create policy "public_create_reports"
  on reports for insert with check (true);

create policy "public_update_votes"
  on reports for update using (true) with check (true);

create policy "public_delete_reports"
  on reports for delete using (true);

-- Report votes policies
create policy "public_read_votes"
  on report_votes for select using (true);

create policy "public_insert_votes"
  on report_votes for insert with check (true);

-- ─── Storage ─────────────────────────────────────────────────────────────────
-- Run this separately in Supabase Dashboard → Storage → New Bucket
-- Or use the Supabase CLI / Dashboard UI:
--
--   Bucket name:  report-images
--   Public:       yes
--
-- Then add this storage policy (Dashboard → Storage → Policies):
--
-- insert policy "public_upload_images"
--   on storage.objects for insert
--   with check (bucket_id = 'report-images');
--
-- select policy "public_read_images"
--   on storage.objects for select
--   using (bucket_id = 'report-images');
