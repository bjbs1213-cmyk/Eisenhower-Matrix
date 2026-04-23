// ─────────────────────────────────────────────────────────────
//  Routine Utilities (습관 추적 헬퍼)
// ─────────────────────────────────────────────────────────────

import { keyToDate, todayKey } from './dateUtils.js';

/**
 * 특정 날짜에 해당 루틴이 '활성(活性)'인지 판단
 * - daily: 항상 활성
 * - weekdays: 월~금 활성
 * - weekends: 토·일 활성
 * - weekly: target_days 에 포함된 요일만 활성
 */
export function isRoutineActiveOn(routine, dateKey) {
  const day = keyToDate(dateKey).getDay(); // 0=일, 1=월, ..., 6=토
  
  switch (routine.frequency) {
    case 'daily':
      return true;
    case 'weekdays':
      return day >= 1 && day <= 5;
    case 'weekends':
      return day === 0 || day === 6;
    case 'weekly':
      return (routine.target_days || []).includes(day);
    default:
      return true;
  }
}

/**
 * 오늘 활성인 루틴만 필터링
 */
export function getActiveRoutines(routines, dateKey) {
  return routines.filter((r) => !r.archived && isRoutineActiveOn(r, dateKey));
}

/**
 * 특정 루틴의 연속 기록(Streak) 계산
 * - 오늘(또는 어제)부터 역방향으로 활성 날짜에 완료 기록이 끊기지 않고 이어진 일수
 * - 오늘 아직 완료 안 했어도 어제까지 이어졌으면 streak는 유지
 * 
 * @param {Object} routine - 루틴 객체
 * @param {Set<string>} completionDates - 이 루틴의 완료 date_key Set
 * @param {string} todayDateKey - 기준 날짜 (오늘)
 * @returns {number} 연속 일수
 */
export function calculateStreak(routine, completionDates, todayDateKey) {
  let streak = 0;
  const today = keyToDate(todayDateKey);
  
  // 오늘부터 시작해서 과거로 이동
  let cursor = new Date(today);
  let graceUsed = false; // 오늘 하루 미완료 허용 (어제까지 연속이면 streak 유지)
  
  while (true) {
    const cursorKey = todayKey(cursor);
    
    // 활성 날짜가 아니면 건너뛰고 계속 과거로
    if (!isRoutineActiveOn(routine, cursorKey)) {
      cursor.setDate(cursor.getDate() - 1);
      // 너무 과거로 가지 않도록 안전장치 (최대 365일)
      if (streak === 0 && (today - cursor) / (1000 * 60 * 60 * 24) > 365) break;
      continue;
    }
    
    // 완료 기록이 있으면 streak 증가
    if (completionDates.has(cursorKey)) {
      streak++;
    } else {
      // 오늘에 한해 미완료여도 어제까지 연속이면 유지
      if (cursorKey === todayDateKey && !graceUsed) {
        graceUsed = true;
      } else {
        break;
      }
    }
    
    cursor.setDate(cursor.getDate() - 1);
    if (streak > 365) break; // 무한 루프 방지
  }
  
  return streak;
}

/**
 * 최근 N일간 완료 이력을 [{date, done, active}] 배열로 반환
 * 히트맵(Heatmap) 렌더링용
 */
export function getRecentHistory(routine, completionDates, todayDateKey, days = 7) {
  const result = [];
  const today = keyToDate(todayDateKey);
  
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = todayKey(d);
    result.push({
      date: key,
      active: isRoutineActiveOn(routine, key),
      done: completionDates.has(key),
    });
  }
  
  return result;
}

/**
 * 이번 주 (월~일) 달성률 계산
 */
export function getWeekCompletionRate(routine, completionDates, weekKeys) {
  let activeCount = 0;
  let doneCount = 0;
  
  weekKeys.forEach((key) => {
    if (isRoutineActiveOn(routine, key)) {
      activeCount++;
      if (completionDates.has(key)) doneCount++;
    }
  });
  
  return {
    done: doneCount,
    total: activeCount,
    pct: activeCount ? Math.round((doneCount / activeCount) * 100) : 0,
  };
}

/**
 * 루틴 배열 + 완료 배열을 받아서 루틴별 완료 Set 맵으로 변환
 * { [routineId]: Set<dateKey> }
 */
export function buildCompletionMap(completions) {
  const map = {};
  (completions || []).forEach((c) => {
    if (!map[c.routine_id]) map[c.routine_id] = new Set();
    map[c.routine_id].add(c.date_key);
  });
  return map;
}

/**
 * 빈도(頻度) 라벨 한글 변환
 */
export function getFrequencyLabel(routine) {
  switch (routine.frequency) {
    case 'daily': return '매일';
    case 'weekdays': return '평일';
    case 'weekends': return '주말';
    case 'weekly': {
      const names = ['일', '월', '화', '수', '목', '금', '토'];
      const days = (routine.target_days || []).map((d) => names[d]).join('·');
      return days || '주간';
    }
    default: return '';
  }
}

// 기본 이모지 후보 (빠른 선택용)
export const ROUTINE_EMOJI_PRESETS = [
  '🧘', '📖', '💪', '🏃', '💧', '🥗',
  '📝', '🎯', '🌱', '☀️', '🌙', '✨',
  '🎨', '🎵', '🧠', '💤', '🚶', '☕',
];

// 기본 색상 옵션
export const ROUTINE_COLORS = [
  { key: 'q1', label: 'Do First' },
  { key: 'q2', label: 'Schedule' },
  { key: 'q3', label: 'Delegate' },
  { key: 'q4', label: 'Eliminate' },
  { key: 'accent', label: 'Accent' },
];
