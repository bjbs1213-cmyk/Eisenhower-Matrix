-- ============================================================
-- Eisenhower Matrix — Supabase Schema
-- Run this in Supabase SQL Editor (https://supabase.com/dashboard)
-- ============================================================

-- Tasks table
create table if not exists tasks (
  id text primary key,
  passcode text not null,
  date_key text not null,
  text text not null,
  quadrant text not null check (quadrant in ('Q1','Q2','Q3','Q4')),
  done boolean default false not null,
  carried_from text,
  carried_from_date text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create index if not exists idx_tasks_passcode_date on tasks(passcode, date_key);

-- Daily reflections (one per day per passcode)
create table if not exists daily_reflections (
  passcode text not null,
  date_key text not null,
  content text default '',
  updated_at timestamptz default now() not null,
  primary key (passcode, date_key)
);

-- Weekly reflections (one per week per passcode)
create table if not exists weekly_reflections (
  passcode text not null,
  week_start text not null,
  content text default '',
  updated_at timestamptz default now() not null,
  primary key (passcode, week_start)
);

-- Row Level Security
-- 주의: 이 앱은 passcode로만 구분되는 간단 모델이므로,
--       Supabase Auth 없이 anon 키로 직접 읽고 씁니다.
--       RLS를 켜되 모두 통과시키는 정책을 사용합니다.
--       (개인용이며 passcode가 사실상의 비밀번호 역할)

alter table tasks enable row level security;
alter table daily_reflections enable row level security;
alter table weekly_reflections enable row level security;

-- 기존 정책 제거 후 재생성 (재실행 가능)
drop policy if exists "anyone with passcode can read tasks" on tasks;
drop policy if exists "anyone with passcode can write tasks" on tasks;
drop policy if exists "anyone with passcode can update tasks" on tasks;
drop policy if exists "anyone with passcode can delete tasks" on tasks;

create policy "anyone with passcode can read tasks" on tasks for select using (true);
create policy "anyone with passcode can write tasks" on tasks for insert with check (true);
create policy "anyone with passcode can update tasks" on tasks for update using (true);
create policy "anyone with passcode can delete tasks" on tasks for delete using (true);

drop policy if exists "read daily" on daily_reflections;
drop policy if exists "write daily" on daily_reflections;
drop policy if exists "update daily" on daily_reflections;

create policy "read daily" on daily_reflections for select using (true);
create policy "write daily" on daily_reflections for insert with check (true);
create policy "update daily" on daily_reflections for update using (true);

drop policy if exists "read weekly" on weekly_reflections;
drop policy if exists "write weekly" on weekly_reflections;
drop policy if exists "update weekly" on weekly_reflections;

create policy "read weekly" on weekly_reflections for select using (true);
create policy "write weekly" on weekly_reflections for insert with check (true);
create policy "update weekly" on weekly_reflections for update using (true);

-- Realtime 활성화
alter publication supabase_realtime add table tasks;
alter publication supabase_realtime add table daily_reflections;
alter publication supabase_realtime add table weekly_reflections;
