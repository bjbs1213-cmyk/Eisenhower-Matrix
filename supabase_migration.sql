-- ============================================================
-- Migration: Add workspace column to support 2 workspaces
-- Run this in Supabase SQL Editor
-- ============================================================

-- Add workspace column (default 'work' for backward compatibility)
alter table tasks add column if not exists workspace text not null default 'work'
  check (workspace in ('work', 'self'));

alter table daily_reflections add column if not exists workspace text not null default 'work'
  check (workspace in ('work', 'self'));

alter table weekly_reflections add column if not exists workspace text not null default 'work'
  check (workspace in ('work', 'self'));

-- Update primary keys for reflections to include workspace
alter table daily_reflections drop constraint if exists daily_reflections_pkey;
alter table daily_reflections add primary key (passcode, date_key, workspace);

alter table weekly_reflections drop constraint if exists weekly_reflections_pkey;
alter table weekly_reflections add primary key (passcode, week_start, workspace);

-- Update indexes
drop index if exists idx_tasks_passcode_date;
create index if not exists idx_tasks_pdw on tasks(passcode, date_key, workspace);
