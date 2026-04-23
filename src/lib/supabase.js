import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = url && key ? createClient(url, key) : null;
export const isSupabaseConfigured = () => supabase !== null;

const PASSCODE_KEY = 'eisen:passcode';
export const getStoredPasscode = () => localStorage.getItem(PASSCODE_KEY) || '';
export const setStoredPasscode = (v) => localStorage.setItem(PASSCODE_KEY, v);
export const clearPasscode = () => localStorage.removeItem(PASSCODE_KEY);

// Theme + workspace preferences
export const getStoredTheme = () => localStorage.getItem('eisen:theme') || 'beige';
export const setStoredTheme = (v) => localStorage.setItem('eisen:theme', v);
export const getStoredWorkspace = () => localStorage.getItem('eisen:workspace') || 'work';
export const setStoredWorkspace = (v) => localStorage.setItem('eisen:workspace', v);
