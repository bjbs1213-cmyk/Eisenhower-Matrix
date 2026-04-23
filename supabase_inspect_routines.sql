-- ============================================================
-- 기존 routines / routine_completions 테이블 구조 조회 (照會)
-- ============================================================
-- 목적: 마이그레이션 전 기존 구조 확인하여 충돌(衝突) 방지
-- 실행 위치: Supabase Dashboard → SQL Editor → New query
-- 사용법: 이 쿼리를 먼저 실행하고 결과를 레온에게 공유
-- ============================================================

-- ① routines 테이블 컬럼 구조
select 
  column_name, 
  data_type, 
  is_nullable, 
  column_default
from information_schema.columns
where table_schema = 'public' 
  and table_name = 'routines'
order by ordinal_position;

-- ② routine_completions 테이블 컬럼 구조
select 
  column_name, 
  data_type, 
  is_nullable, 
  column_default
from information_schema.columns
where table_schema = 'public' 
  and table_name = 'routine_completions'
order by ordinal_position;

-- ③ 두 테이블의 기본키(基本鍵) 확인
select 
  tc.table_name,
  kcu.column_name,
  tc.constraint_name
from information_schema.table_constraints tc
join information_schema.key_column_usage kcu 
  on tc.constraint_name = kcu.constraint_name
where tc.table_schema = 'public'
  and tc.table_name in ('routines', 'routine_completions')
  and tc.constraint_type = 'PRIMARY KEY';

-- ④ 기존 데이터 건수 (데이터 보존 여부 판단용)
select 'routines' as table_name, count(*) as row_count from routines
union all
select 'routine_completions', count(*) from routine_completions;
