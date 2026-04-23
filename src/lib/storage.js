import { supabase, isSupabaseConfigured, getStoredPasscode } from './supabase.js';

// ─────────────────────────────────────────────────────────────
//  Storage layer - workspace aware (work / self) + routines
// ─────────────────────────────────────────────────────────────

const LS_DATA = 'eisen:data';
const LS_WEEKLY = 'eisen:weekly';
const LS_ROUTINES = 'eisen:routines';
const LS_COMPLETIONS = 'eisen:completions';

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

// ---- Remote ----
async function remoteFetchAll() {
  const passcode = getStoredPasscode();
  if (!passcode || !supabase) return {
    data: { work: {}, self: {} },
    weekly: { work: {}, self: {} },
    routines: [],
    completions: [],
  };

  const [tasksRes, reflRes, weeklyRes, routinesRes, completionsRes] = await Promise.all([
    supabase.from('tasks').select('*').eq('passcode', passcode),
    supabase.from('daily_reflections').select('*').eq('passcode', passcode),
    supabase.from('weekly_reflections').select('*').eq('passcode', passcode),
    supabase.from('routines').select('*').eq('passcode', passcode).order('sort_order'),
    supabase.from('routine_completions').select('*').eq('passcode', passcode),
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

  return {
    data,
    weekly,
    routines: routinesRes.data || [],
    completions: completionsRes.data || [],
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
  });
}

async function remoteDeleteTask(id) {
  if (!supabase) return;
  await supabase.from('tasks').delete().eq('id', id);
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

function subscribeRemote(onChange) {
  const passcode = getStoredPasscode();
  if (!passcode || !supabase) return () => {};

  const channel = supabase
    .channel(`eisen-${passcode}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks', filter: `passcode=eq.${passcode}` }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_reflections', filter: `passcode=eq.${passcode}` }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'weekly_reflections', filter: `passcode=eq.${passcode}` }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'routines', filter: `passcode=eq.${passcode}` }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'routine_completions', filter: `passcode=eq.${passcode}` }, onChange)
    .subscribe();

  return () => { supabase.removeChannel(channel); };
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

    return {
      data,
      weekly,
      routines: localGetRoutines(),
      completions: localGetCompletions(),
    };
  },

  async saveTask(workspace, dateKey, task) {
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

  subscribe(onChange) {
    if (this.remote()) return subscribeRemote(onChange);
    return () => {};
  },
};
