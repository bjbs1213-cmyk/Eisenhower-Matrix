import { createClient } from '@supabase/supabase-js';
import { THEMES, WORKSPACES, normalizeThemeId } from './themes.js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = url && key ? createClient(url, key) : null;
export const isSupabaseConfigured = () => supabase !== null;

const PASSCODE_KEY = 'eisen:passcode';
export const getStoredPasscode = () => localStorage.getItem(PASSCODE_KEY) || '';
export const setStoredPasscode = (v) => localStorage.setItem(PASSCODE_KEY, v);
export const clearPasscode = () => localStorage.removeItem(PASSCODE_KEY);

export const getStoredWorkspace = () => localStorage.getItem('eisen:workspace') || 'work';
export const setStoredWorkspace = (v) => localStorage.setItem('eisen:workspace', v);

// ─────────────────────────────────────────────
// 테마 저장/조회 (v2.2)
//
// 변경사항 (v2.1 → v2.2):
//   - VALID_THEMES가 4계절 → 9가지 조합으로 변경
//   - normalizeThemeId()로 레거시 값 자동 매핑
//   - 알 수 없는 테마 ID도 안전하게 fallback
// ─────────────────────────────────────────────

const DEFAULT_THEME_BY_WORKSPACE = {
  work: WORKSPACES.work.defaultTheme,    // 'midnight-blue'
  self: WORKSPACES.self.defaultTheme,    // 'paper-olive'
};

export const getThemeForWorkspace = (workspace) => {
  const stored = localStorage.getItem(`eisen:theme:${workspace}`);
  // normalizeThemeId가 모든 검증과 fallback 처리:
  //   - v2.2 테마 그대로 반환
  //   - 레거시(spring/summer/autumn/winter) → 자동 매핑
  //   - 알 수 없는 값 → 기본값
  if (stored) {
    const normalized = normalizeThemeId(stored);
    // 정규화된 값이 다르면 자동 업데이트 (다음번 로드 빠르게)
    if (normalized !== stored) {
      localStorage.setItem(`eisen:theme:${workspace}`, normalized);
    }
    return normalized;
  }
  return DEFAULT_THEME_BY_WORKSPACE[workspace] || DEFAULT_THEME_BY_WORKSPACE.work;
};

export const setThemeForWorkspace = (workspace, themeId) => {
  // 정규화 후 저장 (잘못된 값이 들어와도 안전)
  const safe = normalizeThemeId(themeId);
  localStorage.setItem(`eisen:theme:${workspace}`, safe);
};

// Legacy compat
export const getStoredTheme = () => getThemeForWorkspace(getStoredWorkspace());
export const setStoredTheme = (v) => setThemeForWorkspace(getStoredWorkspace(), v);
