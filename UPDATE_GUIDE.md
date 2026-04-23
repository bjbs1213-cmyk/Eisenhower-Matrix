# Eisenhower Matrix v3 — 업데이트 가이드 (習慣 追跡 추가)

## 🌱 v3 신규 기능 (v2 → v3)

- **Routines 탭 추가** — 반복적 실천(實踐) 추적 기능
- **4가지 빈도(頻度)**: 매일 / 평일 / 주말 / 요일 지정
- **연속 기록(Streak)** 시각화 — 🔥 아이콘과 함께 표시
- **7일 히트맵(Heatmap)** — 각 루틴별 최근 일주일 완료 패턴 한눈에
- **주간 달성률** — 각 루틴별 이번 주 완료 비율
- **워크스페이스별 독립** — 💼 업무 / 🌱 자기개발 루틴 분리
- **실시간 동기화** — 여러 기기에서 동시 접속 시 즉시 반영

---

## 🚀 업데이트 순서 (약 5분)

### ⚠️ 사전 확인 — 기존 테이블 충돌 방지

Supabase에 이미 `routines`, `routine_completions` 테이블이 있다면, 구조를 먼저 확인하세요.

**Supabase 대시보드 → SQL Editor → New query → `supabase_inspect_routines.sql` 전체 붙여넣기 → Run**

결과에서 테이블이 존재하고 **기존 데이터(行)가 있으면** 백업(複本)을 먼저 받아두시고, 없으면 그대로 다음 단계로 진행하셔도 됩니다.

### 1단계: Supabase 스키마 마이그레이션

**Supabase 대시보드 → SQL Editor → New query → `supabase_migration_v3.sql` 전체 붙여넣기 → Run**

> ⚠️ 이 스크립트는 기존 `routines` / `routine_completions` 테이블을 **DROP 후 재생성**합니다. 기존 데이터가 있다면 반드시 백업 후 실행하세요.
>
> 성공 시 결과 창 하단에 `routines`, `routine_completions` 두 행이 표시되고 `rowsecurity = true` 로 나와야 합니다.

### 2단계: GitHub에 코드 교체 업로드

1. GitHub `Eisenhower-Matrix` 저장소 → 기존 파일들 **완전히 삭제**
2. 이 프로젝트의 모든 파일 업로드 (ZIP 풀고 안쪽 내용물 전체 드래그&드롭)
3. Commit message: `v3: routines & habit tracking` → Commit

### 3단계: Vercel 자동 재배포

Vercel이 GitHub 커밋을 감지해서 자동으로 재빌드합니다. 기존 환경변수(`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`)는 그대로 유지됩니다. 1~2분 후 반영 완료.

---

## 📐 루틴 기능 사용법 (使用法)

### 루틴 생성(生成)
1. 사이드바(또는 모바일 하단 탭)에서 **Routines** 선택
2. "새 루틴 추가" 버튼 클릭
3. 제목·이모지·빈도·색상 지정 후 저장
4. 빈도가 "요일 지정"인 경우 원하는 요일 선택 (예: 월·수·금만)

### 루틴 완료 체크
- **루틴 카드 우측의 체크 박스** 클릭
- 해당 날짜가 해당 루틴의 활성(活性) 요일일 때만 체크 가능
- 비활성 날짜(예: 평일 루틴의 주말)에는 체크 박스가 표시되지 않음

### 연속 기록(Streak) 🔥
- **오늘**부터 과거로 역방향(逆方向) 계산
- 활성 날짜 중 **끊김 없이** 이어진 완료 일수
- **오늘 아직 미완료여도** 어제까지 이어졌으면 streak 유지 (관대한 grace 규칙)

### 7일 히트맵
- 각 루틴 카드 안에 최근 7일의 완료 상태 표시
- **진한 색 = 완료**, 연한 색 = 미완료(활성), 투명 = 비활성일

### 편집 / 삭제
- 루틴 카드 우측 하단의 ✏️ (편집) / 🗑️ (삭제) 아이콘 사용
- 삭제 시 **해당 루틴의 모든 완료 기록도 함께 삭제**됨 (복원 불가)

---

## 🎨 v2 기능 요약 (그대로 유지)

### 테마 전환
우측 상단의 **색상 칩 3개** 중 하나 클릭. 선택은 브라우저에 저장되어 다음 접속에도 유지됩니다.

### 워크스페이스 전환
- **PC**: 왼쪽 사이드바 "Workspace" 섹션에서 💼/🌱 전환
- **모바일**: 상단 바에서 전환
- 두 워크스페이스는 **할 일·회고·루틴** 모두 완전히 독립

### 반응형 동작
- **< 900px** (모바일/좁은 창): 상단 헤더 + 매트릭스 + 하단 4개 탭바 (Matrix · Routines · Reflect · Weekly)
- **900 ~ 1900px** (일반 PC): 왼쪽 사이드바 + 매트릭스
- **≥ 1900px** (QHD/4K/울트라와이드): 왼쪽 사이드바 + 매트릭스 + 오른쪽 인사이트 패널

### Q2 이월
- 평일 트랙: 월→화→수→목→금→(다음주)월
- 주말 트랙: 토→일→(다음주)토
- 워크스페이스별로 독립 이월

---

## 🛠️ 기술 변경 사항 (技術 變更)

### 새 파일
- `supabase_inspect_routines.sql` — 기존 테이블 조회용
- `supabase_migration_v3.sql` — 루틴 테이블 생성
- `src/lib/routineUtils.js` — streak/히트맵 계산 헬퍼
- `src/components/RoutinesView.jsx` — 메인 루틴 화면

### 수정 파일
- `src/lib/storage.js` — 루틴 CRUD + 실시간 구독 추가
- `src/App.jsx` — 사이드바·모바일 탭·라우팅에 Routines 추가

### 데이터베이스 스키마
- `routines` — 루틴 정의 (id, passcode, workspace, title, emoji, frequency, target_days, color, sort_order, archived)
- `routine_completions` — 완료 기록 (passcode, routine_id, date_key) — 복합 기본키(複合 Primary Key)
- 두 테이블 모두 RLS 활성 + 모든 정책 `true` (기존 passcode 기반 모델과 동일)
- Realtime publication에 자동 등록
