import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Plus, Check, Calendar, BarChart3, Moon, ChevronLeft, ChevronRight,
  X, ArrowRight, LogOut, Cloud, CloudOff, Briefcase, Sprout, Repeat,
} from 'lucide-react';
import Login from './components/Login.jsx';
import RoutinesView from './components/RoutinesView.jsx';
import { storage } from './lib/storage.js';
import {
  clearPasscode, getStoredPasscode,
  getThemeForWorkspace, setThemeForWorkspace,
  getStoredWorkspace, setStoredWorkspace,
} from './lib/supabase.js';
import { THEMES, WORKSPACES } from './lib/themes.js';
import {
  QUADRANTS, todayKey, keyToDate, formatDate, formatShort,
  getCarryTarget, isWeekend, getWeekKeys,
} from './lib/dateUtils.js';

// Responsive breakpoints
// < 900: Compact (mobile)
// 900~1900: Standard (sidebar + matrix)
// >= 1900: Wide (sidebar + matrix + insights panel)
const BP_COMPACT = 900;
const BP_WIDE = 1900;

// UUID helper
const newId = () =>
  (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : String(Date.now() + Math.random());

export default function App() {
  const [authed, setAuthed] = useState(!!getStoredPasscode());
  if (!authed) return <Login onLogin={() => setAuthed(true)} />;
  return <MainApp onLogout={() => { clearPasscode(); setAuthed(false); }} />;
}

function MainApp({ onLogout }) {
  const [currentDate, setCurrentDate] = useState(todayKey());
  const [view, setView] = useState('matrix');
  const [workspace, setWorkspace] = useState(getStoredWorkspace());
  // 현재 워크스페이스의 마지막 테마를 초기값으로
  const [themeId, setThemeId] = useState(() => getThemeForWorkspace(getStoredWorkspace()));
  const [data, setData] = useState({ work: {}, self: {} });
  const [weeklyReflections, setWeeklyReflections] = useState({ work: {}, self: {} });
  const [routines, setRoutines] = useState([]);
  const [completions, setCompletions] = useState([]);
  const [activeQuadrant, setActiveQuadrant] = useState(null);
  const [newTaskText, setNewTaskText] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [carriedNotice, setCarriedNotice] = useState(null);
  const [syncStatus, setSyncStatus] = useState('syncing');
  const [width, setWidth] = useState(window.innerWidth);
  const eveningTimer = useRef(null);
  const weeklyTimer = useRef(null);
  // 초기 로드 시 워크스페이스 변경 useEffect 트리거 방지용
  const isFirstRender = useRef(true);

  const theme = THEMES[themeId] || THEMES.winter;

  // 테마 변경 시 → 현재 워크스페이스의 테마로 저장
  useEffect(() => {
    setThemeForWorkspace(workspace, themeId);
  }, [themeId, workspace]);

  // 워크스페이스 전환 시 → 해당 워크스페이스의 마지막 테마로 자동 복원
  useEffect(() => {
    setStoredWorkspace(workspace);
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const savedTheme = getThemeForWorkspace(workspace);
    setThemeId(savedTheme);
  }, [workspace]);

  // Responsive
  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

// online status
  useEffect(() => {
    const updateStatus = () => {
      if (!navigator.onLine) setSyncStatus('offline');
      else if (storage.remote()) setSyncStatus('synced');
      else setSyncStatus('offline');
    };
    updateStatus(); // 초기 즉시 체크
    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);
    return () => {
      window.removeEventListener('online', updateStatus);
      window.removeEventListener('offline', updateStatus);
    };
  }, []);
  const reload = async () => {
    setSyncStatus('syncing');
    try {
      const { data: d, weekly, routines: r, completions: c } = await storage.fetchAll();
      setData(d);
      setWeeklyReflections(weekly);
      setRoutines(r || []);
      setCompletions(c || []);
      setSyncStatus(storage.remote() ? 'synced' : 'offline');
    } catch {
      setSyncStatus('offline');
    }
  };

  useEffect(() => { reload().then(() => setLoaded(true)); }, []);

  useEffect(() => {
    if (!loaded) return;
    const unsub = storage.subscribe(() => reload());
    return unsub;
  }, [loaded]);

  // Q2 auto carry (per workspace)
  useEffect(() => {
    if (!loaded) return;
    const wsData = data[workspace] || {};
    const todayTasks = wsData[currentDate]?.tasks || [];
    const already = new Set(
      todayTasks.filter((t) => t.carriedFrom != null).map((t) => t.carriedFrom)
    );
    const sourceKeys = Object.keys(wsData).filter((k) => k < currentDate && getCarryTarget(k) === currentDate);
    if (sourceKeys.length === 0) return;

    const toCarry = [];
    sourceKeys.forEach((sk) => {
      (wsData[sk]?.tasks || []).forEach((t) => {
        if (t.q === 'Q2' && !t.done && !already.has(t.id)) {
          toCarry.push({
            ...t,
            id: newId(),
            carriedFrom: t.id,
            carriedFromDate: sk,
            done: false,
            created: Date.now(),
          });
        }
      });
    });

    if (toCarry.length === 0) return;

    (async () => {
      for (const t of toCarry) await storage.saveTask(workspace, currentDate, t);
      setData((prev) => ({
        ...prev,
        [workspace]: {
          ...prev[workspace],
          [currentDate]: {
            ...(prev[workspace]?.[currentDate] || { evening: '' }),
            tasks: [...(prev[workspace]?.[currentDate]?.tasks || []), ...toCarry],
          },
        },
      }));
      setCarriedNotice({ count: toCarry.length });
      setTimeout(() => setCarriedNotice(null), 3500);
    })();
  }, [currentDate, workspace, loaded, data]);

  const wsData = data[workspace] || {};
  const dayData = wsData[currentDate] || { tasks: [], evening: '' };
  const tasksByQ = useMemo(() => {
    const m = { Q1: [], Q2: [], Q3: [], Q4: [] };
    (dayData.tasks || []).forEach((t) => m[t.q]?.push(t));
    return m;
  }, [dayData]);

  const dayStats = useMemo(() => {
    const total = (dayData.tasks || []).length;
    const done = (dayData.tasks || []).filter((t) => t.done).length;
    return { total, done, pct: total ? Math.round((done / total) * 100) : 0 };
  }, [dayData]);

  const weekKeys = useMemo(() => getWeekKeys(currentDate), [currentDate]);
  const weekStart = weekKeys[0];
  const weekStats = useMemo(() => {
    const s = { Q1: { t: 0, d: 0 }, Q2: { t: 0, d: 0 }, Q3: { t: 0, d: 0 }, Q4: { t: 0, d: 0 } };
    weekKeys.forEach((k) => {
      (wsData[k]?.tasks || []).forEach((t) => { s[t.q].t++; if (t.done) s[t.q].d++; });
    });
    return s;
  }, [wsData, weekKeys]);
  const weekTotal = Object.values(weekStats).reduce((a, b) => a + b.t, 0);
  const weekDone = Object.values(weekStats).reduce((a, b) => a + b.d, 0);
  const weekPct = weekTotal ? Math.round((weekDone / weekTotal) * 100) : 0;

  // Mutations
  const addTask = async () => {
    if (!newTaskText.trim() || !activeQuadrant) return;
    const task = {
      id: newId(),
      text: newTaskText.trim(),
      q: activeQuadrant,
      done: false,
      created: Date.now(),
    };
    setData((prev) => ({
      ...prev,
      [workspace]: {
        ...prev[workspace],
        [currentDate]: {
          ...(prev[workspace]?.[currentDate] || { evening: '' }),
          tasks: [...(prev[workspace]?.[currentDate]?.tasks || []), task],
        },
      },
    }));
    setNewTaskText('');
    setActiveQuadrant(null);
    await storage.saveTask(workspace, currentDate, task);
  };

  const toggleTask = async (id) => {
    const current = (wsData[currentDate]?.tasks || []).find((t) => t.id === id);
    if (!current) return;
    const updated = { ...current, done: !current.done };
    setData((prev) => ({
      ...prev,
      [workspace]: {
        ...prev[workspace],
        [currentDate]: {
          ...(prev[workspace]?.[currentDate] || { evening: '' }),
          tasks: (prev[workspace]?.[currentDate]?.tasks || []).map((t) => t.id === id ? updated : t),
        },
      },
    }));
    await storage.saveTask(workspace, currentDate, updated);
  };

  const deleteTask = async (id) => {
    setData((prev) => ({
      ...prev,
      [workspace]: {
        ...prev[workspace],
        [currentDate]: {
          ...(prev[workspace]?.[currentDate] || { evening: '' }),
          tasks: (prev[workspace]?.[currentDate]?.tasks || []).filter((t) => t.id !== id),
        },
      },
    }));
    await storage.deleteTask(workspace, currentDate, id);
  };

  const updateEvening = (text) => {
    setData((prev) => ({
      ...prev,
      [workspace]: {
        ...prev[workspace],
        [currentDate]: { ...(prev[workspace]?.[currentDate] || { tasks: [] }), evening: text },
      },
    }));
    if (eveningTimer.current) clearTimeout(eveningTimer.current);
    eveningTimer.current = setTimeout(() => storage.saveReflection(workspace, currentDate, text), 600);
  };

  const updateWeekly = (text) => {
    setWeeklyReflections((prev) => ({
      ...prev,
      [workspace]: { ...prev[workspace], [weekStart]: text },
    }));
    if (weeklyTimer.current) clearTimeout(weeklyTimer.current);
    weeklyTimer.current = setTimeout(() => storage.saveWeekly(workspace, weekStart, text), 600);
  };

  const shiftDate = (delta) => {
    const dt = keyToDate(currentDate);
    dt.setDate(dt.getDate() + delta);
    setCurrentDate(todayKey(dt));
  };

  // ---- Routine mutations ----
  const saveRoutine = async (routine) => {
    setRoutines((prev) => {
      const arr = Array.isArray(prev) ? prev : [];
      const idx = arr.findIndex((r) => r.id === routine.id);
      if (idx >= 0) {
        const next = [...arr];
        next[idx] = routine;
        return next;
      }
      return [...arr, routine];
    });
    await storage.saveRoutine(routine);
  };

  const deleteRoutine = async (id) => {
    setRoutines((prev) => (Array.isArray(prev) ? prev : []).filter((r) => r.id !== id));
    setCompletions((prev) => (Array.isArray(prev) ? prev : []).filter((c) => c.routine_id !== id));
    await storage.deleteRoutine(id);
  };

  const toggleCompletion = async (routineId, dateKey, done) => {
    setCompletions((prev) => {
      const arr = Array.isArray(prev) ? prev : [];
      if (done) {
        const exists = arr.some((c) => c.routine_id === routineId && c.date_key === dateKey);
        if (exists) return arr;
        return [...arr, { routine_id: routineId, date_key: dateKey }];
      }
      return arr.filter((c) => !(c.routine_id === routineId && c.date_key === dateKey));
    });
    await storage.toggleRoutineCompletion(routineId, dateKey, done);
  };

  const trackLabel = isWeekend(currentDate) ? 'Weekend' : 'Weekday';

  const sharedProps = {
    theme, themeId, setThemeId,
    workspace, setWorkspace,
    currentDate, setCurrentDate, shiftDate,
    view, setView,
    data, wsData, dayData, tasksByQ, dayStats,
    weekKeys, weekStart, weekStats, weekTotal, weekDone, weekPct,
    weeklyReflections,
    routines, completions,
    activeQuadrant, setActiveQuadrant,
    newTaskText, setNewTaskText,
    carriedNotice, syncStatus,
    addTask, toggleTask, deleteTask, updateEvening, updateWeekly,
    saveRoutine, deleteRoutine, toggleCompletion,
    trackLabel,
    onLogout,
  };

  // Route to layout
  if (width < BP_COMPACT) return <CompactLayout {...sharedProps} />;
  if (width < BP_WIDE) return <StandardLayout {...sharedProps} />;
  return <WideLayout {...sharedProps} />;
}

// ═══════════════════════════════════════════════════════════════
// SHARED: GlobalStyles (CSS variables from theme)
// ═══════════════════════════════════════════════════════════════
function ThemeStyles({ theme }) {
  return (
    <style>{`
      :root {
        --bg: ${theme.bg};
        --panel: ${theme.panel};
        --panel2: ${theme.panel2};
        --panel3: ${theme.panel3};
        --border: ${theme.border};
        --border-soft: ${theme.borderSoft};
        --text: ${theme.text};
        --text-dim: ${theme.textDim};
        --text-mute: ${theme.textMute};
        --accent: ${theme.accent};
        --success: ${theme.success};
        --warn: ${theme.warn};
        --q1: ${theme.q1};
        --q2: ${theme.q2};
        --q3: ${theme.q3};
        --q4: ${theme.q4};
      }
      body { background: var(--bg); color: var(--text); }
      .ui { font-family: 'NoonnuGothic', Inter, sans-serif; font-style: normal; }
      .serif { font-family: 'Lora', Georgia, serif; }
      .serif-i {
        font-family: 'Lora', Georgia, serif !important;
        font-style: italic !important;
        font-weight: 600;
      }
      .kor { font-family: 'NoonnuGothic', sans-serif; font-style: normal; }

      .btn-plain {
        background: transparent; border: none; cursor: pointer; color: inherit;
        font-family: inherit;
      }
      .arrow-btn {
        width: 36px; height: 36px;
        background: var(--panel); border: 1px solid var(--border);
        border-radius: 6px; color: var(--text);
        display: flex; align-items: center; justify-content: center;
        cursor: pointer; transition: all 0.15s;
      }
      .arrow-btn:hover { background: var(--panel2); }
      .icon-btn {
        background: transparent; border: none; padding: 8px;
        border-radius: 6px; color: var(--text-dim); cursor: pointer;
        display: flex; align-items: center;
      }
      .icon-btn:hover { background: var(--panel2); color: var(--text); }

      .workspace-bar {
        display: inline-flex; gap: 3px; padding: 4px;
        background: var(--panel2); border-radius: 9px;
        border: 1px solid var(--border);
      }
      .ws-btn {
        padding: 8px 14px; font-size: 14px;
        color: var(--text-dim); border-radius: 6px;
        cursor: pointer; display: flex; align-items: center; gap: 6px;
        font-family: 'NoonnuGothic', sans-serif;
        background: transparent; border: none;
        transition: all 0.15s;
      }
      .ws-btn.active {
        background: var(--panel); color: var(--text);
        font-weight: 500;
        box-shadow: 0 1px 2px rgba(0,0,0,0.05);
      }

      .theme-bar {
        display: inline-flex; gap: 4px; padding: 4px;
        background: var(--panel2); border-radius: 9px;
        border: 1px solid var(--border);
      }
      .theme-chip {
        width: 28px; height: 28px; border-radius: 6px;
        cursor: pointer; border: 2px solid transparent;
        transition: all 0.15s; padding: 0;
        position: relative;
      }
      .theme-chip.active { border-color: var(--text); }
      /* 4 seasons */
      .theme-chip.spring { background: linear-gradient(135deg, #FDF2F5 50%, #D4627A 50%); }
      .theme-chip.summer { background: linear-gradient(135deg, #E9F5F1 50%, #2D8B7A 50%); }
      .theme-chip.autumn { background: linear-gradient(135deg, #F6EADC 50%, #B4501C 50%); }
      .theme-chip.winter { background: linear-gradient(135deg, #E8EFF5 50%, #2C4A6E 50%); }

      .sync-badge {
        display: inline-flex; align-items: center; gap: 4px;
        font-family: Inter, sans-serif; font-size: 11px;
        padding: 4px 9px; border-radius: 10px;
        background: var(--panel2); border: 1px solid var(--border);
      }
      .sync-badge.synced { color: var(--success); }
      .sync-badge.offline { color: var(--warn); }
      .sync-badge.syncing { color: var(--text-dim); }

      .card {
        background: var(--panel); border: 1px solid var(--border);
        border-radius: 10px; padding: 18px;
        display: flex; flex-direction: column;
      }
      .card-head {
        padding-bottom: 12px; margin-bottom: 12px;
        border-bottom: 1px solid var(--border-soft);
      }
      .card-label {
        font-family: 'Lora', Georgia, serif !important;
        font-style: italic !important;
        font-weight: 600;
        font-size: 18px;
      }
      .card-sub {
        font-family: 'NoonnuGothic', sans-serif;
        font-size: 13px; color: var(--text-dim); margin-top: 3px;
      }
      .task-list {
        flex: 1; display: flex; flex-direction: column; gap: 10px;
        margin-bottom: 12px;
      }
      .task {
        display: flex; align-items: flex-start; gap: 10px;
        font-size: 15px; line-height: 1.5;
      }
      .chk {
        flex: 0 0 18px; width: 18px; height: 18px;
        border-radius: 4px; margin-top: 2px;
        display: flex; align-items: center; justify-content: center;
        cursor: pointer; padding: 0; background: transparent;
        border-width: 1.5px; border-style: solid;
      }
      .task-txt {
        flex: 1; word-break: break-word;
        font-family: 'NoonnuGothic', sans-serif; color: var(--text);
        display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
        font-size: 15px;
      }
      .task-txt.done {
        text-decoration: line-through; opacity: 0.4; color: var(--text-dim);
      }
      .carry-badge {
        display: inline-flex; align-items: center; gap: 2px;
        font-family: Inter, sans-serif; font-size: 10px; color: var(--text-dim);
        padding: 2px 6px; background: var(--panel2);
        border-radius: 4px;
      }
      .task-x {
        background: transparent; border: none; color: var(--text-mute);
        cursor: pointer; padding: 2px; display: flex;
      }
      .task-x:hover { color: var(--warn); }

      .add-btn {
        background: var(--panel2); border: 1px solid var(--border);
        color: var(--text-dim); padding: 10px;
        font-size: 13px; border-radius: 6px; cursor: pointer;
        display: flex; align-items: center; justify-content: center; gap: 5px;
        font-family: 'NoonnuGothic', sans-serif;
        margin-top: auto; transition: all 0.15s;
      }
      .add-btn:hover { border-color: var(--text); color: var(--text); }
      .count-tag {
        font-size: 11px; color: var(--text-dim); background: var(--panel);
        border: 1px solid var(--border);
        padding: 2px 7px; border-radius: 8px; margin-left: auto;
      }

      .backdrop {
        position: fixed; inset: 0; background: rgba(0,0,0,0.3);
        z-index: 100; display: flex; align-items: center; justify-content: center;
        animation: fade 0.2s ease;
      }
      @keyframes fade { from { opacity: 0; } to { opacity: 1; } }
      .modal {
        width: calc(100% - 40px); max-width: 460px; background: var(--panel);
        border-radius: 12px; padding: 26px;
        border-top: 2px solid var(--accent);
        box-shadow: 0 20px 60px -15px rgba(0,0,0,0.2);
      }
      .input {
        width: 100%; background: var(--panel3); border: 1px solid var(--border);
        color: var(--text); padding: 14px;
        font-family: 'NoonnuGothic', sans-serif; font-size: 16px;
        border-radius: 6px; outline: none; min-height: 100px; resize: vertical;
      }
      .input:focus { border-color: var(--accent); }
      .btn {
        flex: 1; padding: 13px;
        font-family: 'NoonnuGothic', sans-serif;
        font-size: 14px; font-weight: 500;
        border-radius: 6px; cursor: pointer;
        border: none;
      }
      .btn-primary { background: var(--text); color: var(--bg); }
      .btn-primary:hover { opacity: 0.85; }
      .btn-ghost {
        background: transparent; color: var(--text-dim);
        border: 1px solid var(--border);
      }
      .btn-ghost:hover { background: var(--panel2); }

      .reflect-input {
        width: 100%; min-height: 140px;
        background: var(--panel3); border: 1px solid var(--border); color: var(--text);
        padding: 14px;
        font-family: 'NoonnuGothic', sans-serif;
        font-size: 15px; line-height: 1.7;
        border-radius: 6px; outline: none; resize: vertical;
      }
      .reflect-input:focus { border-color: var(--text); }
      .reflect-input::placeholder { color: var(--text-mute); }

      .nav-btn {
        width: 100%; display: flex; align-items: center; gap: 11px;
        padding: 10px 12px; background: transparent; border: none;
        font-family: 'NoonnuGothic', sans-serif; font-size: 14px;
        color: var(--text-dim);
        border-radius: 6px; cursor: pointer; margin-bottom: 2px;
        text-align: left; transition: all 0.1s;
      }
      .nav-btn:hover { background: var(--panel2); color: var(--text); }
      .nav-btn.active { background: var(--text); color: var(--bg); font-weight: 500; }
      .nav-label {
        font-family: Inter, sans-serif; font-size: 11px;
        color: var(--text-mute); letter-spacing: 0.12em;
        text-transform: uppercase; margin-bottom: 10px;
      }

      .stat-card {
        padding: 14px; background: var(--panel);
        border: 1px solid var(--border); border-radius: 8px;
      }
      .stat-label {
        font-family: Inter, sans-serif; font-size: 11px;
        color: var(--text-dim); letter-spacing: 0.08em;
        text-transform: uppercase; margin-bottom: 6px;
      }
      .stat-big {
        font-family: 'Lora', Georgia, serif !important;
        font-style: italic !important; font-weight: 600;
        font-size: 28px; color: var(--text); line-height: 1;
      }
      .stat-sub {
        font-family: 'NoonnuGothic', sans-serif;
        font-size: 12px; color: var(--text-dim); margin-top: 5px;
      }
      .progress-bar {
        height: 4px; background: var(--panel2); border-radius: 2px;
        margin-top: 10px; overflow: hidden;
      }
      .progress-fill {
        height: 100%; background: var(--text); transition: width 0.4s;
      }

      .mini-cal { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; }
      .mini-day {
        aspect-ratio: 1;
        background: var(--panel); border: 1px solid var(--border);
        border-radius: 6px; cursor: pointer;
        display: flex; flex-direction: column; align-items: center;
        justify-content: center; font-size: 10px; color: var(--text-dim);
        transition: all 0.15s;
      }
      .mini-day:hover { border-color: var(--text); }
      .mini-day.today { border-color: var(--text); border-width: 1.5px; }
      .mini-day.active { background: var(--text); border-color: var(--text); }
      .mini-day.active .mini-wd, .mini-day.active .mini-d { color: var(--bg); }
      .mini-day.weekend { background: var(--panel3); }
      .mini-wd { font-family: Inter, sans-serif; font-size: 10px; }
      .mini-d {
        font-family: 'Lora', Georgia, serif !important;
        font-style: italic !important; font-weight: 500;
        font-size: 16px; color: var(--text); margin-top: 2px;
      }
      .mini-dot {
        width: 4px; height: 4px; border-radius: 50%;
        background: var(--text); margin-top: 3px;
      }
      .mini-day.active .mini-dot { background: var(--bg); }

      .qrow {
        display: flex; align-items: center; gap: 12px;
        padding: 10px 0; border-bottom: 1px solid var(--border-soft);
      }
      .qrow:last-child { border-bottom: none; }
      .qdot {
        width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0;
      }
      .qrow-lbl {
        flex: 1; font-family: 'NoonnuGothic', sans-serif; font-size: 13px;
        color: var(--text);
      }
      .qrow-sub {
        font-family: Inter, sans-serif; font-size: 10px;
        color: var(--text-dim); margin-top: 2px;
      }
      .qrow-bar {
        width: 70px; height: 4px; background: var(--panel2);
        border-radius: 2px; overflow: hidden;
      }
      .qrow-fill { height: 100%; transition: width 0.4s; }
      .qrow-num {
        font-family: Inter, sans-serif; font-size: 12px;
        color: var(--text-dim); min-width: 42px; text-align: right;
      }

      .notice {
        padding: 12px 16px; background: var(--panel2);
        border: 1px solid var(--border); border-radius: 6px;
        display: inline-flex; align-items: center; gap: 8px;
        font-size: 13px; color: var(--text);
        font-family: 'NoonnuGothic', sans-serif;
      }

      .track-badge {
        display: inline-block; padding: 3px 9px;
        background: var(--panel2); border: 1px solid var(--border);
        border-radius: 10px; color: var(--text-dim);
        font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase;
        font-family: Inter, sans-serif;
        margin-left: 10px; vertical-align: middle;
      }

      .section-title {
        font-family: 'Lora', Georgia, serif !important;
        font-style: italic !important; font-weight: 600;
        font-size: 24px; color: var(--text); margin: 0 0 6px;
      }
      .section-sub {
        font-family: 'NoonnuGothic', sans-serif;
        font-size: 13px; color: var(--text-dim);
        letter-spacing: 0.04em; margin-bottom: 20px;
      }
      .reflect-title {
        font-family: 'Lora', Georgia, serif !important;
        font-style: italic !important; font-weight: 600;
        font-size: 17px; color: var(--text);
      }

      /* ─── Weekly Overview ─ 주간 달력 strip (모바일 반응형) ─── */
      .weekly-strip {
        display: grid;
        grid-template-columns: repeat(7, minmax(0, 1fr));
        gap: 10px;
        margin-bottom: 20px;
        width: 100%;
      }
      .weekly-day {
        border-radius: 10px;
        padding: 18px 12px;
        cursor: pointer;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 8px;
        min-height: 110px;
        transition: all 0.15s;
        min-width: 0;
        overflow: hidden;
      }
      .weekly-day .wd-label {
        font-family: 'Inter', sans-serif;
        font-size: 13px;
        letter-spacing: 0.04em;
        font-weight: 500;
      }
      .weekly-day .wd-date {
        font-family: 'Lora', Georgia, serif !important;
        font-style: italic !important;
        font-weight: 600;
        font-size: 30px;
        line-height: 1;
      }
      .weekly-day .wd-count {
        font-family: 'Inter', sans-serif;
        font-size: 11px;
      }
      /* 모바일: 간격 줄이고 패딩 줄이고 폰트 축소 */
      @media (max-width: 540px) {
        .weekly-strip {
          gap: 4px;
        }
        .weekly-day {
          padding: 10px 2px;
          min-height: 82px;
          gap: 4px;
        }
        .weekly-day .wd-label { font-size: 10px; }
        .weekly-day .wd-date { font-size: 18px; }
        .weekly-day .wd-count { font-size: 9px; }
      }
    `}</style>
  );
}

// ═══════════════════════════════════════════════════════════════
// SHARED COMPONENTS
// ═══════════════════════════════════════════════════════════════
function SyncBadge({ status }) {
  const label = status === 'synced' ? 'Synced' : status === 'syncing' ? 'Syncing…' : 'Offline';
  const Icon = status === 'offline' ? CloudOff : Cloud;
  return (
    <span className={`sync-badge ${status}`}>
      <Icon size={10} />
      {label}
    </span>
  );
}

function WorkspaceToggle({ workspace, setWorkspace, vertical }) {
  return (
    <div className="workspace-bar" style={vertical ? { flexDirection: 'column', width: '100%' } : {}}>
      {Object.values(WORKSPACES).map((ws) => (
        <button
          key={ws.id}
          className={`ws-btn ${workspace === ws.id ? 'active' : ''}`}
          onClick={() => setWorkspace(ws.id)}
          style={vertical ? { width: '100%', justifyContent: 'flex-start' } : {}}
        >
          <span>{ws.emoji}</span>
          <span>{ws.label}</span>
        </button>
      ))}
    </div>
  );
}

function ThemeToggle({ themeId, setThemeId }) {
  return (
    <div className="theme-bar">
      {Object.values(THEMES).map((t) => (
        <button
          key={t.id}
          className={`theme-chip ${t.id} ${themeId === t.id ? 'active' : ''}`}
          onClick={() => setThemeId(t.id)}
          title={t.name}
        />
      ))}
    </div>
  );
}

function QuadrantCard({ q, qColor, tasks, onAdd, onToggle, onDelete }) {
  const quadrant = QUADRANTS[q];
  return (
    <div className="card" style={{ minHeight: 280 }}>
      <div className="card-head">
        <div className="card-label" style={{ color: qColor, fontSize: 20 }}>{quadrant.label}</div>
        <div className="card-sub" style={{ fontSize: 14 }}>{quadrant.sub}</div>
      </div>
      <div className="task-list">
        {tasks.length === 0 && (
          <div style={{ fontFamily: 'NoonnuGothic, sans-serif', fontSize: 13, color: 'var(--text-mute)', padding: '8px 0' }}>
            아직 업무가 없습니다
          </div>
        )}
        {tasks.map((t) => (
          <div key={t.id} className="task">
            <button
              className="chk"
              style={{
                borderColor: qColor,
                background: t.done ? qColor : 'transparent',
              }}
              onClick={() => onToggle(t.id)}
            >
              {t.done && <Check size={11} color="#FFF" strokeWidth={3} />}
            </button>
            <div className={`task-txt ${t.done ? 'done' : ''}`}>
              <span>{t.text}</span>
              {t.carriedFromDate && (
                <span className="carry-badge">
                  <ArrowRight size={8} /> {formatShort(t.carriedFromDate)}
                </span>
              )}
            </div>
            <button className="task-x" onClick={() => onDelete(t.id)}>
              <X size={13} />
            </button>
          </div>
        ))}
      </div>
      <button className="add-btn" onClick={() => onAdd(q)}>
        <Plus size={13} /> 업무 추가
        {tasks.length > 0 && (
          <span className="count-tag">
            {tasks.filter((t) => t.done).length}/{tasks.length}
          </span>
        )}
      </button>
    </div>
  );
}

function Matrix({ theme, tasksByQ, setActiveQuadrant, toggleTask, deleteTask }) {
  const colors = { Q1: theme.q1, Q2: theme.q2, Q3: theme.q3, Q4: theme.q4 };
  return (
    <div style={{
      flex: 1,
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gridTemplateRows: '1fr 1fr',
      gap: 16,
      minHeight: 0,
    }}>
      {['Q1', 'Q2', 'Q3', 'Q4'].map((q) => (
        <QuadrantCard
          key={q}
          q={q}
          qColor={colors[q]}
          tasks={tasksByQ[q]}
          onAdd={setActiveQuadrant}
          onToggle={toggleTask}
          onDelete={deleteTask}
        />
      ))}
    </div>
  );
}

function AddTaskModal({ activeQuadrant, setActiveQuadrant, newTaskText, setNewTaskText, addTask, currentDate, theme }) {
  if (!activeQuadrant) return null;
  const q = QUADRANTS[activeQuadrant];
  const qColor = theme[activeQuadrant.toLowerCase()];
  return (
    <div className="backdrop" onClick={() => setActiveQuadrant(null)}>
      <div className="modal" style={{ borderTopColor: qColor }} onClick={(e) => e.stopPropagation()}>
        <div style={{
          fontFamily: 'Lora, serif', fontStyle: 'italic', fontWeight: 600,
          fontSize: 18, color: qColor, marginBottom: 2,
        }}>{q.label}</div>
        <div style={{
          fontFamily: 'NoonnuGothic, sans-serif', fontSize: 11,
          color: theme.textDim, marginBottom: 14,
        }}>
          {q.sub} · {q.desc}
        </div>
        {activeQuadrant === 'Q2' && (
          <div style={{
            fontFamily: 'NoonnuGothic, sans-serif', fontSize: 10,
            color: theme.textDim,
            padding: '6px 10px', background: theme.panel2,
            borderRadius: 4, marginBottom: 10,
            borderLeft: `2px solid ${qColor}`,
          }}>
            미완료 시 자동 이월 · {isWeekend(currentDate) ? '주말 트랙 (토↔일)' : '평일 트랙 (월~금)'}
          </div>
        )}
        <textarea
          className="input"
          placeholder="업무 내용을 입력하세요…"
          value={newTaskText}
          onChange={(e) => setNewTaskText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) addTask(); }}
          autoFocus
        />
        <div style={{ fontSize: 10, color: theme.textMute, fontFamily: 'Inter', marginTop: 6 }}>
          ⌘/Ctrl + Enter로 추가
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button className="btn btn-ghost" onClick={() => setActiveQuadrant(null)}>취소</button>
          <button className="btn btn-primary" style={{ background: qColor }} onClick={addTask}>추가</button>
        </div>
      </div>
    </div>
  );
}

// Top bar: date navigation + track badge
function DateNav({ currentDate, shiftDate, setCurrentDate, trackLabel, dayStats }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      <button className="arrow-btn" onClick={() => shiftDate(-1)}><ChevronLeft size={20} /></button>
      <div>
        <div className="serif-i" style={{ fontSize: 24, color: 'var(--text)' }}>
          <span className="kor" style={{ fontWeight: 700 }}>{formatDate(currentDate)}</span>
          <span className="track-badge">{trackLabel}</span>
        </div>
        <div style={{ fontFamily: 'NoonnuGothic, sans-serif', fontSize: 13, color: 'var(--text-dim)', marginTop: 4 }}>
          {dayStats.done} / {dayStats.total} 완료 · {dayStats.pct}%
        </div>
      </div>
      <button className="arrow-btn" onClick={() => shiftDate(1)}><ChevronRight size={20} /></button>
      <button className="arrow-btn" onClick={() => setCurrentDate(todayKey())} title="오늘">
        <Calendar size={16} />
      </button>
    </div>
  );
}

// Mini calendar strip for sidebar
function MiniCalendar({ weekKeys, currentDate, setCurrentDate, wsData }) {
  const names = ['월', '화', '수', '목', '금', '토', '일'];
  return (
    <div className="mini-cal">
      {weekKeys.map((k) => {
        const dt = keyToDate(k);
        const idx = (dt.getDay() + 6) % 7;
        const count = (wsData[k]?.tasks || []).length;
        const weekend = isWeekend(k);
        const active = k === currentDate;
        const today = k === todayKey();
        return (
          <button
            key={k}
            className={`mini-day ${active ? 'active' : ''} ${today ? 'today' : ''} ${weekend ? 'weekend' : ''}`}
            onClick={() => setCurrentDate(k)}
            style={{ border: 'none', cursor: 'pointer' }}
          >
            <div className="mini-wd">{names[idx]}</div>
            <div className="mini-d">{+k.split('-')[2]}</div>
            {count > 0 && <div className="mini-dot" />}
          </button>
        );
      })}
    </div>
  );
}

// Quadrant stats (weekly)
function QuadrantStats({ weekStats, theme }) {
  const colors = { Q1: theme.q1, Q2: theme.q2, Q3: theme.q3, Q4: theme.q4 };
  return (
    <div>
      {Object.values(QUADRANTS).map((q) => {
        const s = weekStats[q.id];
        const pct = s.t ? (s.d / s.t) * 100 : 0;
        return (
          <div key={q.id} className="qrow">
            <div className="qdot" style={{ background: colors[q.id] }} />
            <div style={{ flex: 1 }}>
              <div className="qrow-lbl">{q.label}</div>
              <div className="qrow-sub">{q.sub}</div>
            </div>
            <div className="qrow-bar">
              <div className="qrow-fill" style={{ width: `${pct}%`, background: colors[q.id] }} />
            </div>
            <div className="qrow-num">{s.d}/{s.t}</div>
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// STANDARD LAYOUT (900 ~ 1600px) - Command Center
// ═══════════════════════════════════════════════════════════════
function StandardLayout(p) {
  return (
    <>
      <ThemeStyles theme={p.theme} />
      <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
        <Sidebar {...p} />
        <MainArea {...p} />
        <AddTaskModal
          activeQuadrant={p.activeQuadrant}
          setActiveQuadrant={p.setActiveQuadrant}
          newTaskText={p.newTaskText}
          setNewTaskText={p.setNewTaskText}
          addTask={p.addTask}
          currentDate={p.currentDate}
          theme={p.theme}
        />
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
// WIDE LAYOUT (≥ 1600px) - Command Center + Right Insights Panel
// ═══════════════════════════════════════════════════════════════
function WideLayout(p) {
  return (
    <>
      <ThemeStyles theme={p.theme} />
      <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)', maxWidth: 2200, margin: '0 auto' }}>
        <Sidebar {...p} />
        <MainArea {...p} />
        <InsightsPanel {...p} />
        <AddTaskModal
          activeQuadrant={p.activeQuadrant}
          setActiveQuadrant={p.setActiveQuadrant}
          newTaskText={p.newTaskText}
          setNewTaskText={p.setNewTaskText}
          addTask={p.addTask}
          currentDate={p.currentDate}
          theme={p.theme}
        />
      </div>
    </>
  );
}

// Shared Sidebar for Standard/Wide
function Sidebar(p) {
  return (
    <aside className="sidebar-scroll" style={{
      width: 270,
      borderRight: '1px solid var(--border-soft)',
      padding: '24px 20px',
      background: 'var(--panel3)',
      flexShrink: 0,
      display: 'flex',
      flexDirection: 'column',
      maxHeight: '100vh',
      overflowY: 'auto',
      position: 'sticky',
      top: 0,
    }}>
      <div className="serif-i" style={{ fontSize: 22, color: 'var(--text)', marginBottom: 3 }}>
        Eisenhower Matrix
      </div>
      <div style={{ fontFamily: 'NoonnuGothic, sans-serif', fontSize: 12, color: 'var(--text-dim)', marginBottom: 18 }}>
        Daily priority planner
      </div>
      <div style={{ marginBottom: 22 }}><SyncBadge status={p.syncStatus} /></div>

      {/* Views */}
      <div style={{ marginBottom: 22 }}>
        <div className="nav-label">Views</div>
        <button className={`nav-btn ${p.view === 'matrix' ? 'active' : ''}`} onClick={() => p.setView('matrix')}>
          <Calendar size={16} /> Matrix
        </button>
        <button className={`nav-btn ${p.view === 'routines' ? 'active' : ''}`} onClick={() => p.setView('routines')}>
          <Repeat size={16} /> Routines
        </button>
        <button className={`nav-btn ${p.view === 'reflect' ? 'active' : ''}`} onClick={() => p.setView('reflect')}>
          <Moon size={16} /> Reflect
        </button>
        <button className={`nav-btn ${p.view === 'weekly' ? 'active' : ''}`} onClick={() => p.setView('weekly')}>
          <BarChart3 size={16} /> Weekly
        </button>
      </div>

      {/* Workspace */}
      <div style={{ marginBottom: 22 }}>
        <div className="nav-label">Workspace</div>
        <WorkspaceToggle workspace={p.workspace} setWorkspace={p.setWorkspace} vertical />
      </div>

      {/* This Week */}
      <div style={{ marginBottom: 22 }}>
        <div className="nav-label">This Week</div>
        <div style={{ marginBottom: 12 }}>
          <MiniCalendar weekKeys={p.weekKeys} currentDate={p.currentDate} setCurrentDate={p.setCurrentDate} wsData={p.wsData} />
        </div>
        <div className="stat-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <div>
              <div className="stat-label">Today</div>
              <div className="stat-big">{p.dayStats.pct}%</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="stat-label">Week</div>
              <div className="stat-big" style={{ fontSize: 22, color: 'var(--text-dim)' }}>{p.weekPct}%</div>
            </div>
          </div>
          <div className="progress-bar"><div className="progress-fill" style={{ width: `${p.dayStats.pct}%` }} /></div>
          <div className="stat-sub">{p.dayStats.done}/{p.dayStats.total} today · {p.weekDone}/{p.weekTotal} week</div>
        </div>
      </div>

      {/* By Quadrant */}
      <div style={{ marginBottom: 22 }}>
        <div className="nav-label">By Quadrant · Week</div>
        <QuadrantStats weekStats={p.weekStats} theme={p.theme} />
      </div>

      {/* Logout */}
      <div style={{ marginTop: 'auto' }}>
        <button className="nav-btn" onClick={p.onLogout}>
          <LogOut size={16} /> 로그아웃
        </button>
      </div>
    </aside>
  );
}

// Shared MainArea
function MainArea(p) {
  return (
    <main style={{ flex: 1, padding: '24px 32px', overflowY: 'auto', minWidth: 0 }}>
      {/* Top bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 22, gap: 16, flexWrap: 'wrap',
      }}>
        <DateNav
          currentDate={p.currentDate}
          shiftDate={p.shiftDate}
          setCurrentDate={p.setCurrentDate}
          trackLabel={p.trackLabel}
          dayStats={p.dayStats}
        />
        <ThemeToggle themeId={p.themeId} setThemeId={p.setThemeId} />
      </div>

      {p.carriedNotice && p.view === 'matrix' && (
        <div className="notice" style={{ marginBottom: 16 }}>
          <ArrowRight size={14} />
          Q2 미완료 {p.carriedNotice.count}건을 오늘로 이월했습니다
        </div>
      )}

      {p.view === 'matrix' && (
        <div style={{ minHeight: 'calc(100vh - 140px)', display: 'flex', flexDirection: 'column' }}>
          <Matrix
            theme={p.theme}
            tasksByQ={p.tasksByQ}
            setActiveQuadrant={p.setActiveQuadrant}
            toggleTask={p.toggleTask}
            deleteTask={p.deleteTask}
          />
        </div>
      )}
      {p.view === 'weekly' && <WeeklyView {...p} />}
      {p.view === 'reflect' && <ReflectView {...p} />}
      {p.view === 'routines' && <RoutinesView {...p} />}
    </main>
  );
}

// Right insights panel (Wide only)
function InsightsPanel(p) {
  return (
    <aside className="sidebar-scroll" style={{
      width: 280,
      borderLeft: '1px solid var(--border-soft)',
      padding: '24px 20px',
      background: 'var(--panel3)',
      flexShrink: 0,
      maxHeight: '100vh',
      overflowY: 'auto',
      position: 'sticky',
      top: 0,
    }}>
      <div className="serif-i" style={{ fontSize: 19, color: 'var(--text)', marginBottom: 18 }}>
        Insights
      </div>

      <div style={{ marginBottom: 22 }}>
        <div className="nav-label">Today's Progress</div>
        <div className="stat-card">
          <div className="stat-big" style={{ fontSize: 36 }}>{p.dayStats.pct}%</div>
          <div className="stat-sub">{p.dayStats.done} / {p.dayStats.total} 업무 완료</div>
          <div className="progress-bar"><div className="progress-fill" style={{ width: `${p.dayStats.pct}%` }} /></div>
        </div>
      </div>

      <div style={{ marginBottom: 22 }}>
        <div className="nav-label">오늘의 성찰 (미리보기)</div>
        <div style={{
          padding: 14, background: 'var(--panel)',
          border: '1px solid var(--border)', borderRadius: 8,
          fontFamily: 'NoonnuGothic, sans-serif', fontSize: 13,
          color: 'var(--text-dim)', lineHeight: 1.6,
          minHeight: 90,
          whiteSpace: 'pre-wrap',
        }}>
          {p.dayData.evening || <span style={{ color: 'var(--text-mute)' }}>아직 작성된 회고가 없습니다. Reflect 뷰에서 작성해보세요.</span>}
        </div>
      </div>

      <div style={{ marginBottom: 22 }}>
        <div className="nav-label">주간 전체</div>
        <div className="stat-card">
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <div className="stat-big">{p.weekDone}</div>
            <div style={{ color: 'var(--text-dim)', fontSize: 18 }}>/ {p.weekTotal}</div>
            <div className="serif-i" style={{ marginLeft: 'auto', fontSize: 28 }}>
              {p.weekPct}%
            </div>
          </div>
          <div className="stat-sub">This week · 완료율</div>
          <div className="progress-bar"><div className="progress-fill" style={{ width: `${p.weekPct}%` }} /></div>
        </div>
      </div>

      <RoutinesMiniWidget {...p} />
    </aside>
  );
}

// Mini routines widget for Insights panel
function RoutinesMiniWidget(p) {
  const active = (Array.isArray(p.routines) ? p.routines : [])
    .filter((r) => r && r.workspace === p.workspace && !r.archived)
    .filter((r) => {
      const day = new Date(p.currentDate).getDay();
      if (r.frequency === 'daily') return true;
      if (r.frequency === 'weekdays') return day >= 1 && day <= 5;
      if (r.frequency === 'weekends') return day === 0 || day === 6;
      if (r.frequency === 'weekly') return (r.target_days || []).includes(day);
      return true;
    });

  const doneIds = new Set(
    (Array.isArray(p.completions) ? p.completions : [])
      .filter((c) => c.date_key === p.currentDate)
      .map((c) => c.routine_id)
  );
  const done = active.filter((r) => doneIds.has(r.id)).length;
  const pct = active.length ? Math.round((done / active.length) * 100) : 0;

  if (active.length === 0) return null;

  return (
    <div style={{ marginBottom: 22 }}>
      <div className="nav-label">오늘의 루틴</div>
      <div className="stat-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <div className="serif-i" style={{ fontSize: 18 }}>Practice</div>
          <div className="stat-big" style={{ fontSize: 22 }}>{pct}%</div>
        </div>
        <div className="progress-bar"><div className="progress-fill" style={{ width: `${pct}%` }} /></div>
        <div className="stat-sub">{done} / {active.length} 루틴 완료</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 10 }}>
          {active.slice(0, 12).map((r) => (
            <div
              key={r.id}
              style={{
                width: 24, height: 24,
                borderRadius: 6,
                background: doneIds.has(r.id) ? p.theme[r.color] || p.theme.q2 : 'var(--panel2)',
                border: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12,
                opacity: doneIds.has(r.id) ? 1 : 0.5,
              }}
              title={r.title}
            >
              {r.emoji || '✨'}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// COMPACT LAYOUT (< 900px) - Mobile/tablet
// ═══════════════════════════════════════════════════════════════
function CompactLayout(p) {
  return (
    <>
      <ThemeStyles theme={p.theme} />
      <div style={{
        background: 'var(--bg)', color: 'var(--text)',
        minHeight: '100vh', paddingBottom: 90,
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 18px 16px',
          borderBottom: '1px solid var(--border-soft)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12,
        }}>
          <div>
            <h1 className="serif-i" style={{ fontSize: 22, color: 'var(--text)', margin: '0 0 4px' }}>
              Eisenhower Matrix
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ fontFamily: 'NoonnuGothic, sans-serif', fontSize: 12, color: 'var(--text-dim)' }}>
                Daily priority planner
              </span>
              <SyncBadge status={p.syncStatus} />
            </div>
          </div>
          <button className="icon-btn" onClick={p.onLogout} title="로그아웃">
            <LogOut size={18} />
          </button>
        </div>

        {/* Top controls: workspace + theme */}
        <div style={{
          padding: '14px 18px',
          borderBottom: '1px solid var(--border-soft)',
          display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'space-between',
          flexWrap: 'wrap',
        }}>
          <WorkspaceToggle workspace={p.workspace} setWorkspace={p.setWorkspace} />
          <ThemeToggle themeId={p.themeId} setThemeId={p.setThemeId} />
        </div>

        {/* Date bar */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 18px', borderBottom: '1px solid var(--border-soft)',
        }}>
          <button className="icon-btn" onClick={() => p.shiftDate(-1)}>
            <ChevronLeft size={20} />
          </button>
          <div style={{ textAlign: 'center', flex: 1 }}>
            <div className="serif-i" style={{ fontSize: 18, color: 'var(--text)' }}>
              <span className="kor" style={{ fontWeight: 700 }}>{formatDate(p.currentDate)}</span>
              <span className="track-badge" style={{ marginLeft: 6, fontSize: 10 }}>{p.trackLabel}</span>
            </div>
            <div style={{ fontFamily: 'NoonnuGothic, sans-serif', fontSize: 12, color: 'var(--text-dim)', marginTop: 3 }}>
              {p.dayStats.done} / {p.dayStats.total} 완료 · {p.dayStats.pct}%
            </div>
          </div>
          <button className="icon-btn" onClick={() => p.shiftDate(1)}>
            <ChevronRight size={20} />
          </button>
        </div>

        {p.carriedNotice && p.view === 'matrix' && (
          <div className="notice" style={{ margin: '12px 18px 0' }}>
            <ArrowRight size={14} />
            Q2 미완료 {p.carriedNotice.count}건을 오늘로 이월했습니다
          </div>
        )}

        {p.view === 'matrix' && (
          <div style={{ padding: 18 }}>
            <Matrix
              theme={p.theme}
              tasksByQ={p.tasksByQ}
              setActiveQuadrant={p.setActiveQuadrant}
              toggleTask={p.toggleTask}
              deleteTask={p.deleteTask}
            />
          </div>
        )}
        {p.view === 'weekly' && <div style={{ padding: 18 }}><WeeklyView {...p} mobile /></div>}
        {p.view === 'reflect' && <div style={{ padding: 18 }}><ReflectView {...p} mobile /></div>}
        {p.view === 'routines' && <div style={{ padding: 18, paddingBottom: 80 }}><RoutinesView {...p} mobile /></div>}

        <AddTaskModal
          activeQuadrant={p.activeQuadrant}
          setActiveQuadrant={p.setActiveQuadrant}
          newTaskText={p.newTaskText}
          setNewTaskText={p.setNewTaskText}
          addTask={p.addTask}
          currentDate={p.currentDate}
          theme={p.theme}
        />

        {/* Bottom tabs */}
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          background: 'var(--bg)', borderTop: '1px solid var(--border)',
          display: 'flex', padding: '8px 8px 20px', zIndex: 50,
        }}>
          {[
            { id: 'matrix', label: 'Matrix', Icon: Calendar },
            { id: 'routines', label: 'Routines', Icon: Repeat },
            { id: 'reflect', label: 'Reflect', Icon: Moon },
            { id: 'weekly', label: 'Weekly', Icon: BarChart3 },
          ].map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => p.setView(id)}
              style={{
                flex: 1, background: 'transparent', border: 'none',
                color: p.view === id ? 'var(--text)' : 'var(--text-dim)',
                fontWeight: p.view === id ? 600 : 400,
                fontFamily: 'NoonnuGothic, sans-serif',
                fontSize: 12, padding: '10px 4px',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
                cursor: 'pointer',
              }}
            >
              <Icon size={20} />
              {label}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
// WEEKLY / REFLECT VIEWS
// ═══════════════════════════════════════════════════════════════
function WeeklyView(p) {
  const names = ['월', '화', '수', '목', '금', '토', '일'];
  return (
    <div>
      <h2 className="section-title">Weekly Overview</h2>
      <div className="section-sub">주간 집계 · {WORKSPACES[p.workspace].label}</div>

      {/* Large weekly calendar strip - responsive (모바일에서 7칸 축소) */}
      <div className="weekly-strip">
        {p.weekKeys.map((k) => {
          const dt = keyToDate(k);
          const idx = (dt.getDay() + 6) % 7;
          const dayTasks = p.wsData[k]?.tasks || [];
          const count = dayTasks.length;
          const doneCount = dayTasks.filter((t) => t.done).length;
          const weekend = isWeekend(k);
          const active = k === p.currentDate;
          const today = k === todayKey();
          return (
            <button
              key={k}
              onClick={() => p.setCurrentDate(k)}
              className="weekly-day"
              style={{
                background: active ? 'var(--text)' : (weekend ? 'var(--panel3)' : 'var(--panel)'),
                border: `${today ? 1.5 : 1}px solid ${active || today ? 'var(--text)' : 'var(--border)'}`,
              }}
            >
              <div className="wd-label" style={{
                color: active ? 'var(--bg)' : 'var(--text-dim)',
              }}>{names[idx]}</div>
              <div className="wd-date" style={{
                color: active ? 'var(--bg)' : 'var(--text)',
              }}>{+k.split('-')[2]}</div>
              {count > 0 && (
                <div className="wd-count" style={{
                  color: active ? 'var(--bg)' : 'var(--text-dim)',
                  opacity: active ? 0.85 : 1,
                }}>
                  {doneCount}/{count}
                </div>
              )}
            </button>
          );
        })}
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: p.mobile ? '1fr' : '1fr 1fr',
        gap: 16,
        marginBottom: 16,
      }}>
        <div className="card" style={{ minHeight: 220 }}>
          <div className="reflect-title" style={{ marginBottom: 18 }}>Completion</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
            <div className="stat-big" style={{ fontSize: 56 }}>{p.weekDone}</div>
            <div style={{ color: 'var(--text-dim)', fontSize: 24 }}>/ {p.weekTotal}</div>
            <div className="serif-i" style={{ marginLeft: 'auto', fontSize: 48, color: 'var(--text)' }}>
              {p.weekPct}%
            </div>
          </div>
          <div className="stat-sub" style={{ fontSize: 13 }}>This week · 완료율</div>
          <div className="progress-bar" style={{ height: 6 }}>
            <div className="progress-fill" style={{ width: `${p.weekPct}%` }} />
          </div>
          <div style={{
            marginTop: 'auto', paddingTop: 16,
            display: 'flex', justifyContent: 'space-between',
            fontFamily: 'NoonnuGothic, sans-serif', fontSize: 13, color: 'var(--text-dim)',
          }}>
            <span>총 {p.weekTotal}개 업무</span>
            <span>{p.weekDone}개 완료</span>
          </div>
        </div>

        <div className="card" style={{ minHeight: 220 }}>
          <div className="reflect-title" style={{ marginBottom: 18 }}>By Quadrant</div>
          <QuadrantStats weekStats={p.weekStats} theme={p.theme} />
        </div>
      </div>

      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <BarChart3 size={20} />
          <div className="reflect-title">Weekly Reflection</div>
        </div>
        <div style={{ fontFamily: 'NoonnuGothic, sans-serif', fontSize: 13, color: 'var(--text-dim)', marginBottom: 14 }}>
          주간 회고 · {formatShort(p.weekKeys[0])} – {formatShort(p.weekKeys[6])}
        </div>
        <textarea
          className="reflect-input"
          style={{ minHeight: 220 }}
          placeholder="이번 주의 성과, 배운 점, 다음 주 개선할 점을 적어보세요…"
          value={p.weeklyReflections[p.workspace]?.[p.weekStart] || ''}
          onChange={(e) => p.updateWeekly(e.target.value)}
        />
      </div>
    </div>
  );
}

function ReflectView(p) {
  return (
    <div>
      <h2 className="section-title">Evening Reflection</h2>
      <div className="section-sub">저녁 회고 · {WORKSPACES[p.workspace].label}</div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: p.mobile ? '1fr' : '1fr 1fr',
        gap: 16,
      }}>
        <div className="card" style={{ minHeight: 'calc(100vh - 240px)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <Moon size={20} />
            <div className="reflect-title">오늘의 성찰</div>
          </div>
          <div style={{ fontFamily: 'NoonnuGothic, sans-serif', fontSize: 13, color: 'var(--text-dim)', marginBottom: 14 }}>
            {formatDate(p.currentDate)}
          </div>
          <textarea
            className="reflect-input"
            style={{ flex: 1, minHeight: p.mobile ? 280 : 480, fontSize: 16 }}
            placeholder={'• 오늘 이룬 것은 무엇인가?\n• 무엇을 배웠는가?\n• 내일 개선할 점은?\n\n자유롭게 적어보세요…'}
            value={p.dayData.evening || ''}
            onChange={(e) => p.updateEvening(e.target.value)}
          />
        </div>

        <div className="card" style={{ minHeight: 'calc(100vh - 240px)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <Check size={20} />
            <div className="reflect-title">Today's Completed</div>
          </div>
          <div style={{ fontFamily: 'NoonnuGothic, sans-serif', fontSize: 13, color: 'var(--text-dim)', marginBottom: 14 }}>
            완료한 업무
          </div>
          {(p.dayData.tasks || []).filter((t) => t.done).length === 0 ? (
            <div style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-mute)',
              fontFamily: 'NoonnuGothic, sans-serif',
              fontSize: 14,
            }}>
              아직 완료한 업무가 없습니다
            </div>
          ) : (
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {(p.dayData.tasks || []).filter((t) => t.done).map((t) => {
                const qColor = p.theme[t.q.toLowerCase()];
                return (
                  <div key={t.id} style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0',
                    borderBottom: '1px solid var(--border-soft)', fontSize: 15,
                  }}>
                    <div style={{
                      fontFamily: 'Inter, sans-serif', fontSize: 11,
                      padding: '3px 9px', borderRadius: 4,
                      color: qColor, background: 'var(--panel2)', border: '1px solid var(--border)',
                      flexShrink: 0,
                    }}>
                      {QUADRANTS[t.q].label}
                    </div>
                    <div style={{ flex: 1, fontFamily: 'NoonnuGothic, sans-serif' }}>{t.text}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
