import { createClient } from '@supabase/supabase-js';

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

const DEFAULT_THEME_BY_WORKSPACE = { work: 'winter', self: 'spring' };
const VALID_THEMES = ['spring', 'summer', 'autumn', 'winter'];

export const getThemeForWorkspace = (workspace) => {
  const stored = localStorage.getItem(`eisen:theme:${workspace}`);
  if (stored && VALID_THEMES.includes(stored)) return stored;
  return DEFAULT_THEME_BY_WORKSPACE[workspace] || 'winter';
};

export const setThemeForWorkspace = (workspace, themeId) => {
  localStorage.setItem(`eisen:theme:${workspace}`, themeId);
};

// Legacy compat
export const getStoredTheme = () => getThemeForWorkspace(getStoredWorkspace());
export const setStoredTheme = (v) => setThemeForWorkspace(getStoredWorkspace(), v);
