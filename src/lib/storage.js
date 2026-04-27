// Supabase 스토리지 (v6)
// v5 대비 변경사항:
// - tasks 테이블에 area, kr_id, size 컬럼 추가
// - objectives 테이블 신설 (분기 목표)
// - key_results 테이블 신설 (KR)
// - reflections 테이블에 kr_progress_note 컬럼 추가

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// =================
// Tasks
// =================
export async function fetchTasks() {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) {
    console.error('업무 조회 실패:', error);
    return [];
  }
  return data || [];
}

export async function createTask(task) {
  const payload = {
    title: task.title,
    quadrant: task.quadrant,
    completed: false,
    date: task.date || new Date().toISOString().slice(0, 10),
    area: task.area || 'work',
    kr_id: task.kr_id || null,
    size: task.size || 'small',
    notes: task.notes || null,
    due_date: task.due_date || null,
    tags: task.tags || [],
    checklist: task.checklist || [],
    url: task.url || null,
  };

  const { data, error } = await supabase.from('tasks').insert(payload).select().single();
  if (error) {
    console.error('업무 생성 실패:', error);
    return null;
  }
  return data;
}

export async function updateTask(id, updates) {
  const { data, error } = await supabase
    .from('tasks')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) {
    console.error('업무 수정 실패:', error);
    return null;
  }
  return data;
}

export async function deleteTask(id) {
  const { error } = await supabase.from('tasks').delete().eq('id', id);
  if (error) {
    console.error('업무 삭제 실패:', error);
    return false;
  }
  return true;
}

// =================
// Objectives (분기 목표)
// =================
export async function fetchObjective(quarter) {
  const { data, error } = await supabase
    .from('objectives')
    .select('*')
    .eq('quarter', quarter)
    .maybeSingle();
  if (error) {
    console.error('목표 조회 실패:', error);
    return null;
  }
  return data;
}

export async function upsertObjective(objective) {
  const { data, error } = await supabase
    .from('objectives')
    .upsert({
      quarter: objective.quarter,
      title: objective.title,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'quarter' })
    .select()
    .single();
  if (error) {
    console.error('목표 저장 실패:', error);
    return null;
  }
  return data;
}

// =================
// Key Results
// =================
export async function fetchKeyResults(objectiveId) {
  const { data, error } = await supabase
    .from('key_results')
    .select('*')
    .eq('objective_id', objectiveId)
    .order('order_index', { ascending: true });
  if (error) {
    console.error('KR 조회 실패:', error);
    return [];
  }
  return data || [];
}

export async function createKeyResult(kr) {
  const { data, error } = await supabase
    .from('key_results')
    .insert({
      objective_id: kr.objective_id,
      title: kr.title,
      order_index: kr.order_index || 0,
    })
    .select()
    .single();
  if (error) {
    console.error('KR 생성 실패:', error);
    return null;
  }
  return data;
}

export async function updateKeyResult(id, updates) {
  const { data, error } = await supabase
    .from('key_results')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) {
    console.error('KR 수정 실패:', error);
    return null;
  }
  return data;
}

export async function deleteKeyResult(id) {
  // KR 삭제 시 해당 KR을 참조하는 tasks의 kr_id를 NULL로
  await supabase.from('tasks').update({ kr_id: null }).eq('kr_id', id);
  const { error } = await supabase.from('key_results').delete().eq('id', id);
  if (error) {
    console.error('KR 삭제 실패:', error);
    return false;
  }
  return true;
}

// =================
// Reflections
// =================
export async function fetchReflection(date, type) {
  const { data, error } = await supabase
    .from('reflections')
    .select('*')
    .eq('date', date)
    .eq('type', type)
    .maybeSingle();
  if (error) {
    console.error('회고 조회 실패:', error);
    return null;
  }
  return data;
}

export async function upsertReflection(reflection) {
  const { data, error } = await supabase
    .from('reflections')
    .upsert(
      {
        date: reflection.date,
        type: reflection.type,
        content: reflection.content,
        kr_progress_note: reflection.kr_progress_note || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'date,type' }
    )
    .select()
    .single();
  if (error) {
    console.error('회고 저장 실패:', error);
    return null;
  }
  return data;
}

// =================
// Routines (기존 v5 유지)
// =================
export async function fetchRoutines() {
  const { data, error } = await supabase
    .from('routines')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) {
    console.error('루틴 조회 실패:', error);
    return [];
  }
  return data || [];
}

export async function fetchRoutineCompletions() {
  const { data, error } = await supabase.from('routine_completions').select('*');
  if (error) {
    console.error('루틴 완료 조회 실패:', error);
    return [];
  }
  return data || [];
}

export async function createRoutine(routine) {
  const { data, error } = await supabase
    .from('routines')
    .insert({ title: routine.title, description: routine.description || null })
    .select()
    .single();
  if (error) {
    console.error('루틴 생성 실패:', error);
    return null;
  }
  return data;
}

export async function deleteRoutine(id) {
  await supabase.from('routine_completions').delete().eq('routine_id', id);
  const { error } = await supabase.from('routines').delete().eq('id', id);
  if (error) {
    console.error('루틴 삭제 실패:', error);
    return false;
  }
  return true;
}

export async function toggleRoutineCompletion(routineId, date) {
  const { data: existing } = await supabase
    .from('routine_completions')
    .select('*')
    .eq('routine_id', routineId)
    .eq('date', date)
    .maybeSingle();

  if (existing) {
    await supabase.from('routine_completions').delete().eq('id', existing.id);
    return false;
  } else {
    await supabase
      .from('routine_completions')
      .insert({ routine_id: routineId, date });
    return true;
  }
}

// =================
// Helpers
// =================
export function getCurrentQuarterKey() {
  const now = new Date();
  const year = now.getFullYear();
  const q = Math.floor(now.getMonth() / 3) + 1;
  return `${year}-Q${q}`;
}
