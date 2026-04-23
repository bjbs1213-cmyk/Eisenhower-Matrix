-- ============================================================
-- Eisenhower Matrix v3 - Routines Migration (習慣 追跡)
-- ============================================================
-- 실행 위치: Supabase Dashboard → SQL Editor → New query
-- 
-- ⚠️  주의 사항 (注意):
-- 1. 이 스크립트는 기존 routines / routine_completions 테이블이 있을 경우
--    DROP 후 재생성합니다. 기존 데이터가 있다면 먼저 백업(複本)하세요.
-- 2. 기존 구조를 유지하려면 supabase_inspect_routines.sql 로 먼저 확인하세요.
-- 3. 재실행 가능(idempotent)하도록 작성되었습니다.
-- ============================================================


-- ============================================================
-- 1. 기존 테이블 제거 (이름 충돌 방지)
-- ============================================================
-- 기존 테이블이 없으면 아무 일도 일어나지 않음 (IF EXISTS)
drop table if exists routine_completions cascade;
drop table if exists routines cascade;


-- ============================================================
-- 2. routines 테이블 (루틴 정의)
-- ============================================================
create table routines (
  id uuid primary key default gen_random_uuid(),
  passcode text not null,
  workspace text not null default 'self' 
    check (workspace in ('work', 'self')),
  
  -- 핵심 정보
  title text not null check (char_length(title) between 1 and 100),
  emoji text default '✨',
  
  -- 빈도 (頻度): daily=매일, weekdays=평일만, weekends=주말만, weekly=지정요일
  frequency text not null default 'daily'
    check (frequency in ('daily', 'weekdays', 'weekends', 'weekly')),
  
  -- weekly 모드에서만 사용: [1,3,5] = 월·수·금 (0=일, 1=월, ..., 6=토)
  target_days integer[] default array[]::integer[],
  
  -- 테마 색상 키 (q1/q2/q3/q4/accent)
  color text not null default 'q2'
    check (color in ('q1', 'q2', 'q3', 'q4', 'accent')),
  
  -- 정렬 순서
  sort_order integer not null default 0,
  
  -- 보관(保管) 여부
  archived boolean not null default false,
  
  -- 타임스탬프
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_routines_passcode_workspace on routines(passcode, workspace);
create index idx_routines_sort on routines(passcode, workspace, sort_order);


-- ============================================================
-- 3. routine_completions 테이블 (완료 기록)
-- ============================================================
create table routine_completions (
  passcode text not null,
  routine_id uuid not null references routines(id) on delete cascade,
  date_key text not null,              -- 'YYYY-MM-DD' 형식
  completed_at timestamptz not null default now(),
  
  primary key (passcode, routine_id, date_key)
);

create index idx_completions_passcode_date on routine_completions(passcode, date_key);
create index idx_completions_routine on routine_completions(routine_id);


-- ============================================================
-- 4. updated_at 자동 갱신 트리거
-- ============================================================
-- 기존에 set_updated_at() 함수가 없으면 생성
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_routines_updated_at on routines;
create trigger trg_routines_updated_at
  before update on routines
  for each row execute function set_updated_at();


-- ============================================================
-- 5. Row Level Security (기존 테이블과 동일한 passcode 기반 정책)
-- ============================================================
alter table routines enable row level security;
alter table routine_completions enable row level security;

-- routines 정책
drop policy if exists "routines select" on routines;
drop policy if exists "routines insert" on routines;
drop policy if exists "routines update" on routines;
drop policy if exists "routines delete" on routines;

create policy "routines select" on routines for select using (true);
create policy "routines insert" on routines for insert with check (true);
create policy "routines update" on routines for update using (true);
create policy "routines delete" on routines for delete using (true);

-- routine_completions 정책
drop policy if exists "completions select" on routine_completions;
drop policy if exists "completions insert" on routine_completions;
drop policy if exists "completions delete" on routine_completions;

create policy "completions select" on routine_completions for select using (true);
create policy "completions insert" on routine_completions for insert with check (true);
create policy "completions delete" on routine_completions for delete using (true);


-- ============================================================
-- 6. Realtime 활성화 (실시간 동기화)
-- ============================================================
-- 이미 publication에 포함되어 있어도 에러 없이 통과되도록 처리
do $$
begin
  begin
    alter publication supabase_realtime add table routines;
  exception when duplicate_object then null;
  end;
  
  begin
    alter publication supabase_realtime add table routine_completions;
  exception when duplicate_object then null;
  end;
end $$;


-- ============================================================
-- 마이그레이션 완료 (完了) ✓
-- ============================================================
-- 확인: 아래 쿼리 실행 시 두 테이블이 보여야 함
select tablename, rowsecurity 
from pg_tables 
where schemaname = 'public' 
  and tablename in ('routines', 'routine_completions')
order by tablename;
