import { supabase, isSupabaseConfigured, getStoredPasscode } from './supabase.js';

// ─────────────────────────────────────────────────────────────
//  Storage layer - workspace aware (work / self) + routines + settings
//  v4: sort_order(정렬), settings(이월·레이아웃 설정) 추가
//  v5: task 상세 항목(詳細 項目) - notes, due_date, tags, checklist, url
//  v6: OKR (분기 목표) + Key Results 추가
//      - objectives 테이블, key_results 테이블
//      - tasks에 kr_id, size 컬럼 활용
//      - 기존 storage 구조 그대로 유지 (호환성 100%)
// ─────────────────────────────────────────────────────────────

const LS_DATA = 'eisen:data';
const LS_WEEKLY = 'eisen:weekly';
const LS_ROUTINES = 'eisen:routines';
const LS_COMPLETIONS = 'eisen:completions';
const LS_SETTINGS = 'eisen:settings';
const LS_OBJECTIVES = 'eisen:objectives';     // v6 신규
const LS_KEY_RESULTS = 'eisen:keyresults';   // v6 신규

// 기본 설정값 (基本 設定値)
export const DEFAULT_SETTINGS = {
  // 이월 설정: 사분면별 boolean
  carryover: {
    Q1: true,   // Do First
    Q2: true,   // Schedule (기존 동작 유지)
    Q3: false,  // Delegate
    Q4: false,  // Eliminate
  },
  // 레이아웃 비율 (단위: %)
  layout: {
    colRatio: 50,    // 좌측 사분면(Q1, Q3) 비율
    rowRatio: 50,    // 상단 사분면(Q1, Q2) 비율
    sidebarWidth: 300, // 사이드바 너비 (px)
  },
};

// 깊은 병합 (deep merge) - 기본값과 저장값 병합
function mergeSettings(saved) {
  if (!saved || typeof saved !== 'object') return { ...DEFAULT_SETTINGS };
  return {
    carryover: { ...DEFAULT_SETTINGS.carryover, ...(saved.carryover || {}) },
    layout: { ...DEFAULT_SETTINGS.layout, ...(saved.layout || {}) },
  };
}

// ---- Local ----
const localGetData = () => {
  try { return JSON.parse(localStorage.getItem(LS_DATA) || '{}'); } catch { return {}; }
};
const localSetData = (d) => localStorage.setItem(LS_DATA, JSON.stringify(d));
const localGetWeekly = () => {
  try { return JSON.parse(localStorage.getItem(LS_WEEKLY) || '{}'); } catch { return {}; }
};
const localSetWeekly = (d) => localStorage.setItem(LS_WEEKLY, JSON.stringify(d));
const localGetRoutines = () => {
  try { return JSON.parse(localStorage.getItem(LS_ROUTINES) || '[]'); } catch { return []; }
};
const localSetRoutines = (d) => localStorage.setItem(LS_ROUTINES, JSON.stringify(d));
const localGetCompletions = () => {
  try { return JSON.parse(localStorage.getItem(LS_COMPLETIONS) || '[]'); } catch { return []; }
};
const localSetCompletions = (d) => localStorage.setItem(LS_COMPLETIONS, JSON.stringify(d));
const localGetSettings = () => {
  try { return mergeSettings(JSON.parse(localStorage.getItem(LS_SETTINGS) || '{}')); }
  catch { return { ...DEFAULT_SETTINGS }; }
};
const localSetSettings = (s) => localStorage.setItem(LS_SETTINGS, JSON.stringify(s));

// v6 신규: OKR / KR 로컬 저장
const localGetObjectives = () => {
  try { return JSON.parse(localStorage.getItem(LS_OBJECTIVES) || '[]'); } catch { return []; }
};
const localSetObjectives = (d) => localStorage.setItem(LS_OBJECTIVES, JSON.stringify(d));
const localGetKeyResults = () => {
  try { return JSON.parse(localStorage.getItem(LS_KEY_RESULTS) || '[]'); } catch { return []; }
};
const localSetKeyResults = (d) => localStorage.setItem(LS_KEY_RESULTS, JSON.stringify(d));

// ---- Remote ----
async function remoteFetchAll() {
  const passcode = getStoredPasscode();
  if (!passcode || !supabase) return {
    data: { work: {}, self: {} },
    weekly: { work: {}, self: {} },
    routines: [],
    completions: [],
    settings: { ...DEFAULT_SETTINGS },
    objectives: [],
    keyResults: [],
  };

  const [tasksRes, reflRes, weeklyRes, routinesRes, completionsRes, settingsRes, objectivesRes, krsRes] = await Promise.all([
    supabase.from('tasks').select('*').eq('passcode', passcode),
    supabase.from('daily_reflections').select('*').eq('passcode', passcode),
    supabase.from('weekly_reflections').select('*').eq('passcode', passcode),
    supabase.from('routines').select('*').eq('passcode', passcode).order('sort_order'),
    supabase.from('routine_completions').select('*').eq('passcode', passcode),
    supabase.from('user_settings').select('settings').eq('passcode', passcode).maybeSingle(),
    // v6 신규: OKR / KR 조회 (테이블 없으면 빈 배열)
    supabase.from('objectives').select('*').eq('passcode', passcode).then(r => r).catch(() => ({ data: [] })),
    supabase.from('key_results').select('*').eq('passcode', passcode).order('order_index').then(r => r).catch(() => ({ data: [] })),
  ]);

  const data = { work: {}, self: {} };
  (tasksRes.data || []).forEach((row) => {
    const ws = row.workspace || 'work';
    if (!data[ws][row.date_key]) data[ws][row.date_key] = { tasks: [], evening: '' };
    data[ws][row.date_key].tasks.push({
      id: row.id,
      text: row.text,
      q: row.quadrant,
      done: row.done,
      created: new Date(row.created_at).getTime(),
      carriedFrom: row.carried_from,
      carriedFromDate: row.carried_from_date,
      sort_order: row.sort_order ?? 0,
      // 상세 항목 (詳細 項目) - v5
      notes: row.notes || '',
      due_date: row.due_date || null,
      tags: Array.isArray(row.tags) ? row.tags : [],
      checklist: Array.isArray(row.checklist) ? row.checklist : [],
      url: row.url || '',
      updated_at: row.updated_at ? new Date(row.updated_at).getTime() : null,
      // v6 신규: OKR 연동
      kr_id: row.kr_id || null,
      size: row.size || 'small',  // 'big' | 'medium' | 'small' (1-3-5 Rule)
    });
  });

  // 사분면 내(內) sort_order 기준 정렬 (오름차순)
  Object.keys(data).forEach((ws) => {
    Object.keys(data[ws]).forEach((dk) => {
      data[ws][dk].tasks.sort((a, b) => {
        const ao = a.sort_order ?? 0;
        const bo = b.sort_order ?? 0;
        if (ao !== bo) return ao - bo;
        return (a.created || 0) - (b.created || 0); // tie-breaker
      });
    });
  });

  (reflRes.data || []).forEach((row) => {
    const ws = row.workspace || 'work';
    if (!data[ws][row.date_key]) data[ws][row.date_key] = { tasks: [], evening: '' };
    data[ws][row.date_key].evening = row.content || '';
  });

  const weekly = { work: {}, self: {} };
  (weeklyRes.data || []).forEach((row) => {
    const ws = row.workspace || 'work';
    weekly[ws][row.week_start] = row.content || '';
  });

  const settings = mergeSettings(settingsRes?.data?.settings);

  return {
    data,
    weekly,
    routines: routinesRes.data || [],
    completions: completionsRes.data || [],
    settings,
    objectives: objectivesRes.data || [],
    keyResults: krsRes.data || [],
  };
}

async function remoteUpsertTask(workspace, dateKey, task) {
  const passcode = getStoredPasscode();
  if (!passcode || !supabase) return;
  await supabase.from('tasks').upsert({
    id: task.id,
    passcode,
    workspace,
    date_key: dateKey,
    text: task.text,
    quadrant: task.q,
    done: task.done,
    carried_from: task.carriedFrom || null,
    carried_from_date: task.carriedFromDate || null,
    sort_order: task.sort_order ?? 0,
    // 상세 항목 (詳細 項目) - v5
    notes: task.notes || null,
    due_date: task.due_date || null,
    tags: task.tags || [],
    checklist: task.checklist || [],
    url: task.url || null,
    // v6 신규: OKR 연동
    kr_id: task.kr_id || null,
    size: task.size || 'small',
  });
}

async function remoteDeleteTask(id) {
  if (!supabase) return;
  await supabase.from('tasks').delete().eq('id', id);
}

// 여러 task의 sort_order(또는 quadrant + sort_order)를 한꺼번에 갱신
async function remoteUpdateTaskOrders(updates) {
  if (!supabase || !updates?.length) return;
  // 동시 다발 update — supabase는 batch upsert가 가장 효율적
  const passcode = getStoredPasscode();
  if (!passcode) return;
  // upsert는 id 기준으로 동작, 다른 필드는 그대로 두려면 update가 안전
  await Promise.all(
    updates.map((u) => {
      const patch = { sort_order: u.sort_order };
      if (u.quadrant !== undefined) patch.quadrant = u.quadrant;
      return supabase.from('tasks').update(patch).eq('id', u.id);
    })
  );
}

async function remoteUpsertReflection(workspace, dateKey, content) {
  const passcode = getStoredPasscode();
  if (!passcode || !supabase) return;
  await supabase.from('daily_reflections').upsert({
    passcode,
    workspace,
    date_key: dateKey,
    content,
  }, { onConflict: 'passcode,date_key,workspace' });
}

async function remoteUpsertWeekly(workspace, weekStart, content) {
  const passcode = getStoredPasscode();
  if (!passcode || !supabase) return;
  await supabase.from('weekly_reflections').upsert({
    passcode,
    workspace,
    week_start: weekStart,
    content,
  }, { onConflict: 'passcode,week_start,workspace' });
}

async function remoteUpsertRoutine(routine) {
  const passcode = getStoredPasscode();
  if (!passcode || !supabase) return;
  await supabase.from('routines').upsert({
    id: routine.id,
    passcode,
    workspace: routine.workspace,
    title: routine.title,
    emoji: routine.emoji || '✨',
    frequency: routine.frequency,
    target_days: routine.target_days || [],
    color: routine.color || 'q2',
    sort_order: routine.sort_order ?? 0,
    archived: !!routine.archived,
  });
}

async function remoteDeleteRoutine(id) {
  if (!supabase) return;
  await supabase.from('routines').delete().eq('id', id);
}

async function remoteToggleCompletion(routineId, dateKey, done) {
  const passcode = getStoredPasscode();
  if (!passcode || !supabase) return;
  if (done) {
    await supabase.from('routine_completions').upsert({
      passcode,
      routine_id: routineId,
      date_key: dateKey,
    }, { onConflict: 'passcode,routine_id,date_key' });
  } else {
    await supabase.from('routine_completions')
      .delete()
      .eq('passcode', passcode)
      .eq('routine_id', routineId)
      .eq('date_key', dateKey);
  }
}

async function remoteUpsertSettings(settings) {
  const passcode = getStoredPasscode();
  if (!passcode || !supabase) return;
  await supabase.from('user_settings').upsert({
    passcode,
    settings,
  }, { onConflict: 'passcode' });
}

// v6 신규: OKR / KR remote 함수
async function remoteUpsertObjective(objective) {
  const passcode = getStoredPasscode();
  if (!passcode || !supabase) return;
  await supabase.from('objectives').upsert({
    id: objective.id,
    passcode,
    workspace: objective.workspace || 'work',
    quarter: objective.quarter,
    title: objective.title,
  }, { onConflict: 'id' });
}

async function remoteDeleteObjective(id) {
  if (!supabase) return;
  await supabase.from('objectives').delete().eq('id', id);
}

async function remoteUpsertKeyResult(kr) {
  const passcode = getStoredPasscode();
  if (!passcode || !supabase) return;
  await supabase.from('key_results').upsert({
    id: kr.id,
    passcode,
    objective_id: kr.objective_id,
    title: kr.title,
    order_index: kr.order_index ?? 0,
  }, { onConflict: 'id' });
}

async function remoteDeleteKeyResult(id) {
  if (!supabase) return;
  // KR 삭제 시 해당 KR을 참조하는 tasks의 kr_id를 NULL로
  await supabase.from('tasks').update({ kr_id: null }).eq('kr_id', id);
  await supabase.from('key_results').delete().eq('id', id);
}

function subscribeRemote(onChange) {
  const passcode = getStoredPasscode();
  if (!passcode || !supabase) return () => {};

  // user_settings는 자기 변경에도 트리거되어 무한 루프 + 디폴트 복귀 위험
  // 그래서 user_settings 구독 제외 - 다른 기기에서 변경한 settings는 새로고침해야 반영됨
  const channel = supabase
    .channel(`eisen-${passcode}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks', filter: `passcode=eq.${passcode}` }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_reflections', filter: `passcode=eq.${passcode}` }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'weekly_reflections', filter: `passcode=eq.${passcode}` }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'routines', filter: `passcode=eq.${passcode}` }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'routine_completions', filter: `passcode=eq.${passcode}` }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'objectives', filter: `passcode=eq.${passcode}` }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'key_results', filter: `passcode=eq.${passcode}` }, onChange)
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}

// ─────────────────────────────────────────────────────────────
//  sort_order 헬퍼 (보조 함수)
// ─────────────────────────────────────────────────────────────
const ORDER_STEP = 1000;

// 새로 추가될 task의 sort_order: 해당 사분면의 마지막 + STEP
function nextOrderFor(tasks, q) {
  const inQ = (tasks || []).filter((t) => t.q === q);
  if (inQ.length === 0) return ORDER_STEP;
  const max = Math.max(...inQ.map((t) => t.sort_order ?? 0));
  return max + ORDER_STEP;
}

// 정렬 후 sort_order를 1000, 2000, 3000…으로 재배치 (rebalance)
// 수많은 드래그(drag) 후 값이 너무 촘촘해지면 호출
function rebalanceOrders(tasks) {
  return tasks.map((t, idx) => ({ ...t, sort_order: (idx + 1) * ORDER_STEP }));
}

// v6 헬퍼: 현재 분기 키 (예: '2026-Q2')
function getCurrentQuarterKey() {
  const now = new Date();
  const year = now.getFullYear();
  const q = Math.floor(now.getMonth() / 3) + 1;
  return `${year}-Q${q}`;
}

// ---- Public API ----
export const storage = {
  remote: () => isSupabaseConfigured() && !!getStoredPasscode(),

  async fetchAll() {
    if (this.remote()) return await remoteFetchAll();

    const raw = localGetData();
    let data;
    let weekly;

    if (raw && !raw.work && !raw.self && Object.keys(raw).some((k) => /^\d{4}-\d{2}-\d{2}$/.test(k))) {
      data = { work: raw, self: {} };
      localSetData(data);
      weekly = { work: localGetWeekly(), self: {} };
    } else {
      data = raw && (raw.work || raw.self) ? raw : { work: {}, self: {} };
      const w = localGetWeekly();
      weekly = w && (w.work || w.self) ? w : { work: w || {}, self: {} };
    }

    // 로컬 데이터에도 sort_order 정렬 적용
    Object.keys(data).forEach((ws) => {
      Object.keys(data[ws]).forEach((dk) => {
        if (Array.isArray(data[ws][dk]?.tasks)) {
          data[ws][dk].tasks.sort((a, b) => {
            const ao = a.sort_order ?? 0;
            const bo = b.sort_order ?? 0;
            if (ao !== bo) return ao - bo;
            return (a.created || 0) - (b.created || 0);
          });
        }
      });
    });

    return {
      data,
      weekly,
      routines: localGetRoutines(),
      completions: localGetCompletions(),
      settings: localGetSettings(),
      objectives: localGetObjectives(),
      keyResults: localGetKeyResults(),
    };
  },

  async saveTask(workspace, dateKey, task) {
    // sort_order가 없으면 자동 부여
    if (task.sort_order == null) {
      const d = localGetData();
      const existing = d[workspace]?.[dateKey]?.tasks || [];
      task.sort_order = nextOrderFor(existing, task.q);
    }
    if (this.remote()) await remoteUpsertTask(workspace, dateKey, task);
    const d = localGetData();
    if (!d[workspace]) d[workspace] = {};
    const existing = d[workspace][dateKey] || { tasks: [], evening: '' };
    const idx = existing.tasks.findIndex((t) => t.id === task.id);
    if (idx >= 0) existing.tasks[idx] = task;
    else existing.tasks.push(task);
    d[workspace][dateKey] = existing;
    localSetData(d);
  },

  async deleteTask(workspace, dateKey, id) {
    if (this.remote()) await remoteDeleteTask(id);
    const d = localGetData();
    if (d[workspace]?.[dateKey]) {
      d[workspace][dateKey].tasks = d[workspace][dateKey].tasks.filter((t) => t.id !== id);
      localSetData(d);
    }
  },

  /**
   * 한 날짜의 task 순서를 재정렬 (사분면 이동 + 순서 변경 모두 지원)
   * @param {string} workspace
   * @param {string} dateKey
   * @param {Array<{id, q, sort_order}>} updates - 변경된 task의 id, 새 사분면, 새 sort_order
   */
  async reorderTasks(workspace, dateKey, updates) {
    if (!Array.isArray(updates) || updates.length === 0) return;

    // 원격(remote) 업데이트
    if (this.remote()) {
      await remoteUpdateTaskOrders(
        updates.map((u) => ({ id: u.id, quadrant: u.q, sort_order: u.sort_order }))
      );
    }

    // 로컬(local) 업데이트
    const d = localGetData();
    if (!d[workspace]?.[dateKey]?.tasks) {
      // 로컬에 데이터가 없으면 끝
      return;
    }
    const tasks = d[workspace][dateKey].tasks;
    updates.forEach((u) => {
      const idx = tasks.findIndex((t) => t.id === u.id);
      if (idx >= 0) {
        tasks[idx] = { ...tasks[idx], q: u.q, sort_order: u.sort_order };
      }
    });
    // 정렬
    tasks.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    d[workspace][dateKey].tasks = tasks;
    localSetData(d);
  },

  async saveReflection(workspace, dateKey, content) {
    if (this.remote()) await remoteUpsertReflection(workspace, dateKey, content);
    const d = localGetData();
    if (!d[workspace]) d[workspace] = {};
    d[workspace][dateKey] = { ...(d[workspace][dateKey] || { tasks: [] }), evening: content };
    localSetData(d);
  },

  async saveWeekly(workspace, weekStart, content) {
    if (this.remote()) await remoteUpsertWeekly(workspace, weekStart, content);
    const w = localGetWeekly();
    if (!w[workspace]) w[workspace] = {};
    w[workspace][weekStart] = content;
    localSetWeekly(w);
  },

  // ---- Routine API ----
  async saveRoutine(routine) {
    if (this.remote()) await remoteUpsertRoutine(routine);
    const list = localGetRoutines();
    const idx = list.findIndex((r) => r.id === routine.id);
    if (idx >= 0) list[idx] = routine;
    else list.push(routine);
    localSetRoutines(list);
  },

  async deleteRoutine(id) {
    if (this.remote()) await remoteDeleteRoutine(id);
    const list = localGetRoutines().filter((r) => r.id !== id);
    localSetRoutines(list);
    const comps = localGetCompletions().filter((c) => c.routine_id !== id);
    localSetCompletions(comps);
  },

  async toggleRoutineCompletion(routineId, dateKey, done) {
    if (this.remote()) await remoteToggleCompletion(routineId, dateKey, done);
    let comps = localGetCompletions();
    if (done) {
      const exists = comps.some((c) => c.routine_id === routineId && c.date_key === dateKey);
      if (!exists) comps.push({ routine_id: routineId, date_key: dateKey });
    } else {
      comps = comps.filter((c) => !(c.routine_id === routineId && c.date_key === dateKey));
    }
    localSetCompletions(comps);
  },

  // ---- Settings API (이월·레이아웃) ----
  async saveSettings(settings) {
    const merged = mergeSettings(settings);
    if (this.remote()) await remoteUpsertSettings(merged);
    localSetSettings(merged);
  },

  // ─────────────────────────────────────────────
  //  v6 신규: OKR / KR API (분기 목표 · 主要 結果)
  // ─────────────────────────────────────────────

  /**
   * 분기 목표 저장 (작성 또는 수정)
   * @param {object} objective - { id, workspace, quarter, title }
   *   workspace: 'work' | 'self' (기본 'work')
   *   quarter: '2026-Q2' 형식
   */
  async saveObjective(objective) {
    if (this.remote()) await remoteUpsertObjective(objective);
    const list = localGetObjectives();
    const idx = list.findIndex((o) => o.id === objective.id);
    if (idx >= 0) list[idx] = objective;
    else list.push(objective);
    localSetObjectives(list);
  },

  async deleteObjective(id) {
    if (this.remote()) await remoteDeleteObjective(id);
    const list = localGetObjectives().filter((o) => o.id !== id);
    localSetObjectives(list);
    // 연관된 KR도 삭제
    const krList = localGetKeyResults().filter((kr) => kr.objective_id !== id);
    localSetKeyResults(krList);
  },

  /**
   * KR 저장 (작성 또는 수정)
   * @param {object} kr - { id, objective_id, title, order_index }
   */
  async saveKeyResult(kr) {
    if (this.remote()) await remoteUpsertKeyResult(kr);
    const list = localGetKeyResults();
    const idx = list.findIndex((k) => k.id === kr.id);
    if (idx >= 0) list[idx] = kr;
    else list.push(kr);
    localSetKeyResults(list);
  },

  async deleteKeyResult(id) {
    if (this.remote()) await remoteDeleteKeyResult(id);
    const list = localGetKeyResults().filter((k) => k.id !== id);
    localSetKeyResults(list);
  },

  subscribe(onChange) {
    if (this.remote()) return subscribeRemote(onChange);
    return () => {};
  },
};

// 외부에서도 헬퍼를 쓸 수 있도록 export
export { ORDER_STEP, nextOrderFor, rebalanceOrders, getCurrentQuarterKey };
