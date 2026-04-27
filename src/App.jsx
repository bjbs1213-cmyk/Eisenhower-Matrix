import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Plus, Check, Calendar, CalendarDays, BarChart3, Moon, ChevronLeft, ChevronRight,
  X, ArrowRight, LogOut, Cloud, CloudOff, Briefcase, Sprout, Repeat, Keyboard,
} from 'lucide-react';
import { DndContext, closestCenter, pointerWithin, rectIntersection, getFirstCollision, PointerSensor, KeyboardSensor, useSensor, useSensors, useDroppable, DragOverlay } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import DraggableTaskItem from './components/DraggableTaskItem.jsx';
import Login from './components/Login.jsx';
import RoutinesView from './components/RoutinesView.jsx';
import DatePickerPopup from './components/DatePickerPopup.jsx';
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
import OkrSidebar from './components/OkrSidebar.jsx';
import OneThreeFiveCounter from './components/OneThreeFiveCounter.jsx';

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
  const [settings, setSettings] = useState({ carryover: { Q1: true, Q2: true, Q3: false, Q4: false }, layout: { colRatio: 50, rowRatio: 50, sidebarWidth: 300 } });
  const [objectives, setObjectives] = useState([]);
  const [keyResults, setKeyResults] = useState([]);
  const [activeQuadrant, setActiveQuadrant] = useState(null);
  const [newTaskText, setNewTaskText] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [carriedNotice, setCarriedNotice] = useState(null);
  const [syncStatus, setSyncStatus] = useState('syncing');
  const [width, setWidth] = useState(window.innerWidth);
  // 전역 (全域) UI 상태 - 단축키 제어용
  const [pickerOpen, setPickerOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [goMode, setGoMode] = useState(false); // G 키 후 뷰 전환 대기 모드 (待機)
  const goModeTimerRef = useRef(null);
  // 레이아웃 (配置) - 드래그 중에는 임시 상태로 부드럽게, 종료 시 settings 저장
  const [tempLayout, setTempLayout] = useState(null);
  // 업무 상세 패널 (業務 詳細 板) - 선택된 task ID
  const [selectedTaskId, setSelectedTaskId] = useState(null);
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
    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);
    if (!navigator.onLine) setSyncStatus('offline');
    return () => {
      window.removeEventListener('online', updateStatus);
      window.removeEventListener('offline', updateStatus);
    };
  }, []);

  const reload = async ({ includeSettings = false } = {}) => {
    setSyncStatus('syncing');
    try {
      const { data: d, weekly, routines: r, completions: c, settings: s, objectives: o, keyResults: kr } = await storage.fetchAll();
      setData(d);
      setWeeklyReflections(weekly);
      setRoutines(r || []);
      setCompletions(c || []);
      setObjectives(o || []);
      setKeyResults(kr || []);
      // 초기 로드 또는 명시적 요청 시에만 settings 덮어쓰기 (자기 변경 보호)
      if (includeSettings && s) setSettings(s);
      if (navigator.onLine && storage.remote()) setSyncStatus('synced');
      else setSyncStatus('offline');
    } catch (err) {
      console.warn('[reload] fetch failed:', err);
      if (navigator.onLine && storage.remote()) setSyncStatus('synced');
      else setSyncStatus('offline');
    }
  };

  // 초기 로드 시에만 settings 포함
  useEffect(() => { reload({ includeSettings: true }).then(() => setLoaded(true)); }, []);

  useEffect(() => {
    if (!loaded) return;
    const unsub = storage.subscribe(() => reload());
    return unsub;
  }, [loaded]);

  // 자동 이월 (自動 移越) - 워크스페이스별로 어제까지 미완료 업무를 오늘로 이어줌
  // 핵심: 평일/주말 구분 없이 끊김 없이 (월·화·수·목·금·토·일 連續)
  // 며칠 동안 앱을 안 열어도, 다시 열면 누락된 미완료 업무 모두 오늘로 모아줌
  useEffect(() => {
    if (!loaded) return;
    const wsData = data[workspace] || {};
    const todayTasks = wsData[currentDate]?.tasks || [];

    // 오늘 이미 이월된 업무들의 조상(祖上) ID 추적
    // task.carriedFrom 체인을 따라 끝까지 올라감
    const collectAncestors = () => {
      const ancestors = new Set();
      // 모든 ws 데이터에서 id → task 맵
      const idMap = new Map();
      Object.keys(wsData).forEach((dk) => {
        (wsData[dk]?.tasks || []).forEach((t) => idMap.set(t.id, t));
      });
      // 오늘에 있는 carry된 업무들 각각의 조상 따라가기
      todayTasks.forEach((t) => {
        if (!t.carriedFrom) return;
        let cur = t.carriedFrom;
        const guard = new Set();
        while (cur && !guard.has(cur)) {
          ancestors.add(cur);
          guard.add(cur);
          const parent = idMap.get(cur);
          cur = parent?.carriedFrom || null;
        }
      });
      return ancestors;
    };
    const alreadyAncestors = collectAncestors();

    // currentDate 이전의 모든 날 키 정렬 (昇順)
    const pastKeys = Object.keys(wsData)
      .filter((k) => k < currentDate)
      .sort();
    if (pastKeys.length === 0) return;

    // 각 (carriedFromDate + text) 조합으로 마지막 인스턴스만 골라 오늘로 가져옴
    // 즉 한 원천 업무가 여러 날 거쳐도 오늘에는 한 번만 등장
    // 가장 최근 날(最近 日)의 미완료 인스턴스를 우선
    const candidatesByRoot = new Map(); // key: rootDate|text → {task, sk}
    pastKeys.forEach((sk) => {
      (wsData[sk]?.tasks || []).forEach((t) => {
        if (t.done) return;
        if (!settings.carryover?.[t.q]) return;
        if (alreadyAncestors.has(t.id)) return;
        // root 정보 (최초 발생일 + 내용)
        const rootDate = t.carriedFromDate || sk;
        const key = `${rootDate}|${t.text}|${t.q}`;
        // 더 최근 sk가 있으면 덮어쓰기 (체인의 마지막 인스턴스 우선)
        const prev = candidatesByRoot.get(key);
        if (!prev || sk > prev.sk) {
          candidatesByRoot.set(key, { task: t, sk, rootDate });
        }
      });
    });

    const toCarry = [];
    candidatesByRoot.forEach(({ task: t, rootDate }) => {
      toCarry.push({
        ...t,
        id: newId(),
        carriedFrom: t.id,
        carriedFromDate: rootDate, // 최초 발생일 유지
        done: false,
        created: Date.now(),
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
  }, [currentDate, workspace, loaded, data, settings]);

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

  // 이월 통계 (移越 統計) - 오늘 / 이번 주 / 분면별
  const carryStats = useMemo(() => {
    const stats = {
      today: 0,                                      // 오늘 화면에 떠있는 이월 업무 수 (數)
      todayUndone: 0,                                // 그 중 미완료 (未完了) 수
      week: 0,                                       // 이번 주 누적 이월 (累積)
      byQ: { Q1: 0, Q2: 0, Q3: 0, Q4: 0 },          // 분면별 오늘 이월 (分面別)
      maxDays: 0,                                    // 가장 오래된 이월 일수 (日數)
    };
    // 오늘 분
    (dayData.tasks || []).forEach((t) => {
      if (t.carriedFromDate) {
        stats.today++;
        if (!t.done) stats.todayUndone++;
        if (stats.byQ[t.q] !== undefined) stats.byQ[t.q]++;
        // 며칠 전 이월인지 계산
        const past = keyToDate(t.carriedFromDate);
        const today = keyToDate(currentDate);
        const days = Math.round((today - past) / (1000 * 60 * 60 * 24));
        if (days > stats.maxDays) stats.maxDays = days;
      }
    });
    // 이번 주 누적
    weekKeys.forEach((k) => {
      (wsData[k]?.tasks || []).forEach((t) => {
        if (t.carriedFromDate) stats.week++;
      });
    });
    return stats;
  }, [dayData, wsData, weekKeys, currentDate]);

  // Mutations
  const addTask = async () => {
    if (!newTaskText.trim() || !activeQuadrant) return;
    const task = {
      id: newId(),
      text: newTaskText.trim(),
      q: activeQuadrant,
      done: false,
      created: Date.now(),
      // 상세 항목 기본값 (詳細 項目 基本値) - v5
      notes: '',
      due_date: null,
      tags: [],
      checklist: [],
      url: '',
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
    // ⚠️ setActiveQuadrant(null) 제거 → 연속 추가 모드 (連續 追加 模式)
    // 모달 닫기는 AddTaskModal 내부에서 명시적으로 처리
    await storage.saveTask(workspace, currentDate, task);
    return task; // 방금 추가된 업무 반환 → 피드백 표시용
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
    // 삭제 시 선택된 패널도 닫기
    if (selectedTaskId === id) setSelectedTaskId(null);
    await storage.deleteTask(workspace, currentDate, id);
  };

  // task 부분 업데이트 (部分 更新) - 패널에서 메모/마감일 등 수정 시 사용
  const updateTask = async (id, patch) => {
    const current = (wsData[currentDate]?.tasks || []).find((t) => t.id === id);
    if (!current) return;
    const updated = { ...current, ...patch };
    setData((prev) => ({
      ...prev,
      [workspace]: {
        ...prev[workspace],
        [currentDate]: {
          ...(prev[workspace]?.[currentDate] || { evening: '' }),
          tasks: (prev[workspace]?.[currentDate]?.tasks || []).map((t) =>
            t.id === id ? updated : t
          ),
        },
      },
    }));
    await storage.saveTask(workspace, currentDate, updated);
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

  // ─────────────────────────────────────────────────────────────
  // 글로벌 단축키 (全域 短縮 鍵)
  // - input/textarea 안에서는 무시
  // - 다른 모달이 열려있을 때는 무시 (각 모달 자체 키 처리에 양보)
  // - IME (한자/한글 조합) 활성 시 무시
  // - F 모드: F 누른 후 1.5초 안에 1~4 누르면 뷰 전환 (View Switch)
  // ─────────────────────────────────────────────────────────────
  // F 모드 헬퍼 (헬퍼)
  const enterGoMode = () => {
    setGoMode(true);
    if (goModeTimerRef.current) clearTimeout(goModeTimerRef.current);
    goModeTimerRef.current = setTimeout(() => setGoMode(false), 1500);
  };
  const exitGoMode = () => {
    setGoMode(false);
    if (goModeTimerRef.current) {
      clearTimeout(goModeTimerRef.current);
      goModeTimerRef.current = null;
    }
  };

  // 언마운트 시 타이머 정리 (整理)
  useEffect(() => () => {
    if (goModeTimerRef.current) clearTimeout(goModeTimerRef.current);
  }, []);

  useEffect(() => {
    const handleGlobalKey = (e) => {
      // IME 조합 중이면 무시 (한자/한글 入力 衝突 防止)
      if (e.isComposing || e.keyCode === 229) return;
      // 입력 영역 안에서는 무시 (例外: Esc는 통과)
      const tag = (e.target?.tagName || '').toLowerCase();
      const isEditable = tag === 'input' || tag === 'textarea' || e.target?.isContentEditable;
      if (isEditable && e.key !== 'Escape') return;
      // 도움말 모달 열려있을 때 - Esc로만 닫기
      if (helpOpen) {
        if (e.key === 'Escape') {
          e.preventDefault();
          setHelpOpen(false);
        }
        return;
      }
      // 업무 상세 패널 (業務 詳細 板) 열려있을 때 - Esc로 닫기
      if (selectedTaskId && e.key === 'Escape') {
        e.preventDefault();
        setSelectedTaskId(null);
        return;
      }
      // AddTaskModal 열려있을 때 - 모달 자체 키 처리에 양보 (讓步)
      if (activeQuadrant) return;
      // DatePicker 열려있을 때 - DatePicker 자체 ESC 처리에 양보
      if (pickerOpen) return;
      // Cmd/Ctrl/Alt + 키는 시스템 단축키 보호 (保護)
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      // ── F 모드 처리 (View Switch) ──
      if (goMode) {
        e.preventDefault();
        switch (e.key) {
          case '1': setView('matrix');   exitGoMode(); return;
          case '2': setView('routines'); exitGoMode(); return;
          case '3': setView('reflect');  exitGoMode(); return;
          case '4': setView('weekly');   exitGoMode(); return;
          case 'Escape':                 exitGoMode(); return;
          default:                       exitGoMode(); return; // 다른 키 누르면 F 모드 해제
        }
      }

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          shiftDate(-1);
          break;
        case 'ArrowRight':
          e.preventDefault();
          shiftDate(1);
          break;
        case 't':
        case 'T':
          e.preventDefault();
          setCurrentDate(todayKey());
          break;
        case 'c':
        case 'C':
          e.preventDefault();
          setPickerOpen(true);
          break;
        case 'f':
        case 'F':
          e.preventDefault();
          enterGoMode();
          break;
        case '1':
          e.preventDefault();
          setActiveQuadrant('Q1');
          break;
        case '2':
          e.preventDefault();
          setActiveQuadrant('Q2');
          break;
        case '3':
          e.preventDefault();
          setActiveQuadrant('Q3');
          break;
        case '4':
          e.preventDefault();
          setActiveQuadrant('Q4');
          break;
        case '?':
        case '/':
          // ? 키 (Shift + /) 또는 / 단독으로 도움말
          if (e.key === '?' || (e.key === '/' && !e.shiftKey)) {
            e.preventDefault();
            setHelpOpen(true);
          }
          break;
        default:
          break;
      }
    };
    window.addEventListener('keydown', handleGlobalKey);
    return () => window.removeEventListener('keydown', handleGlobalKey);
  }, [currentDate, activeQuadrant, pickerOpen, helpOpen, goMode, selectedTaskId]);

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

  // 드래그 앤 드롭 핸들러
  const handleReorder = async ({ activeId, overId, fromQ, toQ }) => {
    const dayKey = currentDate;
    const tasks = (wsData[dayKey]?.tasks || []).map((t) => ({ ...t }));

    const activeIdx = tasks.findIndex((t) => t.id === activeId);
    if (activeIdx < 0) return;

    const moved = { ...tasks[activeIdx], q: toQ };
    const targetTasks = tasks.filter((t) => t.q === toQ && t.id !== activeId);

    if (String(overId).startsWith('droppable-') || !targetTasks.find((t) => t.id === overId)) {
      const lastOrder = targetTasks.length
        ? Math.max(...targetTasks.map((t) => t.sort_order ?? 0))
        : 0;
      moved.sort_order = lastOrder + 1000;
    } else {
      const overIdx = targetTasks.findIndex((t) => t.id === overId);
      const prevOrder = overIdx > 0 ? (targetTasks[overIdx - 1].sort_order ?? 0) : 0;
      const nextOrder = targetTasks[overIdx].sort_order ?? 0;
      moved.sort_order = (prevOrder + nextOrder) / 2 || (nextOrder - 500);
    }

    const newTasks = tasks.map((t) => (t.id === activeId ? moved : t));
    newTasks.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

    setData((prev) => ({
      ...prev,
      [workspace]: {
        ...prev[workspace],
        [dayKey]: {
          ...(prev[workspace]?.[dayKey] || { evening: '' }),
          tasks: newTasks,
        },
      },
    }));

    await storage.reorderTasks(workspace, dayKey, [
      { id: activeId, q: toQ, sort_order: moved.sort_order },
    ]);
  };
  // 설정 저장 (이월·레이아웃)
  const saveSettings = async (next) => {
    setSettings(next);
    await storage.saveSettings(next);
  };

  // ── OKR / KR 핸들러 (分期 目標 處理器) v2.2 ──
  const saveObjective = async (objective) => {
    setObjectives((prev) => {
      const idx = prev.findIndex((o) => o.id === objective.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = objective;
        return next;
      }
      return [...prev, objective];
    });
    await storage.saveObjective(objective);
  };

  const deleteObjective = async (id) => {
    setObjectives((prev) => prev.filter((o) => o.id !== id));
    setKeyResults((prev) => prev.filter((kr) => kr.objective_id !== id));
    await storage.deleteObjective(id);
  };

  const saveKeyResult = async (kr) => {
    setKeyResults((prev) => {
      const idx = prev.findIndex((k) => k.id === kr.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = kr;
        return next;
      }
      return [...prev, kr];
    });
    await storage.saveKeyResult(kr);
  };

  const deleteKeyResult = async (id) => {
    setKeyResults((prev) => prev.filter((k) => k.id !== id));
    // UI에서 해당 KR 참조하는 task의 kr_id를 NULL로 (DB는 storage에서 처리)
    setData((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((ws) => {
        Object.keys(next[ws] || {}).forEach((dk) => {
          const tasks = next[ws][dk]?.tasks;
          if (tasks) {
            next[ws][dk] = {
              ...next[ws][dk],
              tasks: tasks.map((t) => (t.kr_id === id ? { ...t, kr_id: null } : t)),
            };
          }
        });
      });
      return next;
    });
    await storage.deleteKeyResult(id);
  };

  // ── 레이아웃 핸들러 (配置 處理器) ──
  // 드래그 중: tempLayout으로 즉각 반영(반영) → 부드러운 시각 피드백
  // 드래그 종료: settings에 저장 → DB 영구 저장 (永久 貯藏)
  const effectiveLayout = tempLayout || settings.layout || { colRatio: 50, rowRatio: 50, sidebarWidth: 300 };
  const setLayoutTemp = (next) => setTempLayout(next);
  const commitLayout = async (next) => {
    setTempLayout(null);
    await saveSettings({ ...settings, layout: { ...settings.layout, ...next } });
  };

  const sharedProps = {
    theme, themeId, setThemeId,
    workspace, setWorkspace,
    currentDate, setCurrentDate, shiftDate,
    view, setView,
    data, wsData, dayData, tasksByQ, dayStats,
    weekKeys, weekStart, weekStats, weekTotal, weekDone, weekPct,
    carryStats,
    weeklyReflections,
    routines, completions,
    activeQuadrant, setActiveQuadrant,
    newTaskText, setNewTaskText,
    carriedNotice, syncStatus,
    pickerOpen, setPickerOpen,
    helpOpen, setHelpOpen,
    goMode,
    layout: effectiveLayout, setLayoutTemp, commitLayout,
    addTask, toggleTask, deleteTask, updateTask, updateEvening, updateWeekly,
    selectedTaskId, setSelectedTaskId,
    onReorder: handleReorder,
    settings, saveSettings,
    objectives, keyResults,
    saveObjective, deleteObjective, saveKeyResult, deleteKeyResult,
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
      /* 모던 산세리프 폰트 (現代的 산세리프) - Inter + Pretendard */
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
      @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.css');

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
        /* 폰트 변수 (字體 變數) */
        --font-display-en: 'Inter', 'Pretendard', system-ui, sans-serif;
        --font-display-kr: 'Pretendard', 'Inter', system-ui, sans-serif;
      }
      body { background: var(--bg); color: var(--text); }
      .ui { font-family: 'NoonnuGothic', Inter, sans-serif; font-style: normal; }
      .serif { font-family: 'Pretendard', 'Inter', sans-serif; }
      /* serif-i 는 더 이상 italic 아님 - 모던 산세리프 영문 디스플레이용 (現代 산세리프 英文 表示) */
      .serif-i {
        font-family: 'Inter', 'Pretendard', sans-serif !important;
        font-style: normal !important;
        font-weight: 700 !important;
        letter-spacing: -0.015em;
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

      /* ─── Resizer (調節 棒) ─── */
      .resizer {
        position: relative;
        background: transparent;
        transition: background 0.15s ease;
        display: flex; align-items: center; justify-content: center;
        z-index: 5;
      }
      .resizer:hover, .resizer.resizer-active {
        background: var(--text);
        opacity: 0.15;
      }
      .resizer-h { margin: 0 -3px; }   /* 사이 공간 차지 보정 (補正) */
      .resizer-v { margin: -3px 0; }
      .resizer-grip {
        opacity: 0;
        transition: opacity 0.15s ease;
        background: var(--text);
        border-radius: 2px;
      }
      .resizer:hover .resizer-grip,
      .resizer.resizer-active .resizer-grip {
        opacity: 0.6;
      }
      .resizer-h .resizer-grip { width: 2px; height: 32px; }
      .resizer-v .resizer-grip { height: 2px; width: 32px; }
      .arrow-btn:hover { background: var(--panel2); }
      .icon-btn {
        background: transparent; border: none; padding: 8px;
        border-radius: 6px; color: var(--text-dim); cursor: pointer;
        display: flex; align-items: center;
      }
      .icon-btn:hover { background: var(--panel2); color: var(--text); }
      /* 드래그 핸들 */
      .task-handle {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 18px;
        height: 24px;
        background: transparent;
        border: none;
        padding: 0;
        margin-right: 4px;
        color: var(--text-mute);
        cursor: grab;
        border-radius: 4px;
        opacity: 0;
        transition: opacity 0.15s, background 0.15s;
        flex-shrink: 0;
      }
      .task:hover .task-handle {
        opacity: 0.6;
      }
      .task-handle:hover {
        opacity: 1 !important;
        background: var(--panel2);
        color: var(--text);
      }
      .task-handle:active {
        cursor: grabbing;
      }
      .draggable-task.is-dragging {
        cursor: grabbing;
      }
      .draggable-task.is-dragging .task-handle {
        opacity: 1;
      }
        /* === 리사이저 (Resizer) === */
        .resizer {
          position: relative;
          background: transparent;
          transition: background 0.15s ease;
          z-index: 5;
        }
        .resizer-v {
          cursor: col-resize;
          min-width: 6px;
        }
        .resizer-h {
          cursor: row-resize;
          min-height: 6px;
        }
        .resizer-center {
          cursor: move;
        }
        .resizer-sidebar {
          width: 6px;
          flex-shrink: 0;
          cursor: col-resize;
          align-self: stretch;
        }
        .resizer:hover {
          background: var(--border);
        }
        .resizer:active {
          background: var(--text-mute);
        }
        .resizer-grip-v {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 2px;
          height: 28px;
          background: var(--border);
          border-radius: 2px;
          opacity: 0;
          transition: opacity 0.15s ease, background 0.15s ease;
        }
        .resizer-grip-h {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 28px;
          height: 2px;
          background: var(--border);
          border-radius: 2px;
          opacity: 0;
          transition: opacity 0.15s ease, background 0.15s ease;
        }
        .resizer-grip-center {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 8px;
          height: 8px;
          background: var(--border);
          border-radius: 50%;
          opacity: 0;
          transition: opacity 0.15s ease, background 0.15s ease;
        }
        .resizer:hover .resizer-grip-v,
        .resizer:hover .resizer-grip-h,
        .resizer:hover .resizer-grip-center {
          opacity: 1;
          background: var(--text-dim);
        }
        .layout-reset-btn {
          position: absolute;
          top: -8px;
          right: -8px;
          width: 26px;
          height: 26px;
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: 50%;
          color: var(--text-mute);
          font-size: 14px;
          cursor: pointer;
          z-index: 10;
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0.4;
          transition: all 0.15s ease;
          padding: 0;
        }
        .layout-reset-btn:hover {
          opacity: 1;
          background: var(--panel2);
          color: var(--text);
          transform: rotate(-90deg);
        }

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
        font-family: 'Inter', 'Pretendard', sans-serif !important;
        font-style: normal !important;
        font-weight: 700;
        font-size: 18px;
        letter-spacing: -0.02em;
      }
      .card-sub {
        font-family: 'Pretendard', 'NoonnuGothic', sans-serif;
        font-size: 13px; color: var(--text-dim); margin-top: 3px;
        letter-spacing: -0.005em;
      }
      .task-list {
        flex: 1; display: flex; flex-direction: column; gap: 10px;
        margin-bottom: 12px;
      }
      .task {
        display: flex; align-items: flex-start; gap: 10px;
        font-size: 15px; line-height: 1.5;
        transition: opacity 0.25s ease;
      }
      .chk {
        flex: 0 0 18px; width: 18px; height: 18px;
        border-radius: 4px; margin-top: 2px;
        display: flex; align-items: center; justify-content: center;
        cursor: pointer; padding: 0; background: transparent;
        border-width: 1.5px; border-style: solid;
        transition: background-color 0.2s ease, border-color 0.2s ease, transform 0.15s ease;
      }
      .chk:hover {
        transform: scale(1.1);
      }
      .chk:active {
        transform: scale(0.92);
      }
      /* 체크된 상태에서 체크 마크 등장 애니메이션 (印 出現) */
      .chk svg {
        animation: chkPop 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
      }
      @keyframes chkPop {
        0%   { transform: scale(0) rotate(-30deg); opacity: 0; }
        60%  { transform: scale(1.2) rotate(8deg);  opacity: 1; }
        100% { transform: scale(1) rotate(0);      opacity: 1; }
      }
      .task-txt {
        flex: 1; word-break: break-word;
        font-family: 'NoonnuGothic', sans-serif; color: var(--text);
        display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
        font-size: 15px;
        transition: color 0.25s ease, opacity 0.25s ease;
        padding: 2px 4px;
        margin: -2px -4px;
        border-radius: 4px;
      }
      /* 클릭 가능한 텍스트 영역 (可能 領域) - 호버 시 살짝 강조 */
      .task-txt[style*="pointer"]:hover {
        background: var(--panel2);
      }
      /* 취소선 부드럽게 - 그라데이션 배경으로 슥 긋는 효과 (取消線) */
      .task-txt > span:first-child {
        position: relative;
        transition: color 0.3s ease;
      }
      .task-txt.done > span:first-child {
        color: var(--text-dim);
      }
      .task-txt.done > span:first-child::after {
        content: '';
        position: absolute;
        left: 0; top: 50%;
        width: 100%; height: 1px;
        background: currentColor;
        transform-origin: left;
        animation: strikeIn 0.35s cubic-bezier(0.4, 0, 0.2, 1) forwards;
      }
      @keyframes strikeIn {
        from { transform: scaleX(0); }
        to   { transform: scaleX(1); }
      }
      .task-txt.done {
        opacity: 0.45; color: var(--text-dim);
      }
      .carry-badge {
        display: inline-flex; align-items: center; gap: 3px;
        font-family: 'NoonnuGothic', sans-serif; font-size: 10px;
        padding: 2px 7px;
        border: 1px solid;
        border-radius: 10px;
        font-weight: 600;
        line-height: 1.2;
        white-space: nowrap;
        flex-shrink: 0;
        cursor: help;
        transition: all 0.15s;
      }
      .carry-badge-label {
        letter-spacing: 0.01em;
      }
      .carry-badge-date {
        font-family: 'Inter', sans-serif;
        font-weight: 500;
        opacity: 0.7;
        font-size: 9px;
      }
      .task.is-carried {
        border-radius: 4px;
        transition: background 0.2s;
      }
      .task.is-carried:hover {
        background: var(--panel2) !important;
      }
      /* 모바일에서 뱃지 텍스트 일부 숨김 (空間 節約) */
      @media (max-width: 600px) {
        .carry-badge-date { display: none; }
      }
      /* 카드 내 상세 인디케이터 (詳細 表示器) - 메모/D-day/체크리스트/태그 공통 */
      .task-indicator {
        display: inline-flex;
        align-items: center;
        gap: 3px;
        padding: 2px 6px;
        border-radius: 8px;
        border: 1px solid;
        font-family: 'Inter', 'Pretendard', sans-serif;
        font-size: 10px;
        font-weight: 600;
        letter-spacing: -0.005em;
        line-height: 1.2;
        white-space: nowrap;
      }
      .task-indicator.notes-icon {
        padding: 2px 4px;
        border-color: transparent;
        background: transparent !important;
      }
      .task-indicator.tag-badge {
        font-family: 'Pretendard', sans-serif;
      }
      .task-indicator.dday-badge {
        font-weight: 700;
      }
      /* 모바일에서 인디케이터 약간 축소 */
      @media (max-width: 600px) {
        .task-indicator { font-size: 9px; padding: 1px 5px; }
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
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      }
      .nav-btn > svg { flex-shrink: 0; }
      .nav-btn:hover { background: var(--panel2); color: var(--text); }
      .nav-btn.active { background: var(--text); color: var(--bg); font-weight: 500; }
      .nav-btn-row {
        display: flex; gap: 6px; align-items: stretch;
      }
      .nav-btn-row > .nav-btn { margin-bottom: 0; }
      .nav-btn-icon-only {
        flex: 0 0 auto;
        width: auto;
        padding: 10px 12px;
        justify-content: center;
      }
      .nav-label {
        font-family: Inter, sans-serif; font-size: 11px;
        color: var(--text-mute); letter-spacing: 0.12em;
        text-transform: uppercase; margin-bottom: 10px;
      }
      .nav-label-row {
        display: flex; align-items: center; justify-content: space-between;
        margin-bottom: 10px; gap: 8px;
      }
      .carry-indicator {
        display: inline-flex; align-items: center; gap: 3px;
        padding: 2px 7px; border-radius: 10px;
        font-family: 'Inter', sans-serif;
        font-size: 9px; font-weight: 600; letter-spacing: 0.03em;
        cursor: help; transition: all 0.15s;
        white-space: nowrap;
      }
      .carry-indicator:hover { transform: translateY(-1px); }
      .qrow-carry {
        font-family: 'Inter', sans-serif; font-size: 9px; font-weight: 600;
        margin-left: 4px; opacity: 0.85;
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
        font-family: 'Inter', 'Pretendard', sans-serif !important;
        font-style: normal !important;
        font-weight: 700;
        font-size: 28px; color: var(--text); line-height: 1;
        letter-spacing: -0.02em;
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

      .mini-cal {
        display: grid;
        grid-template-columns: repeat(7, minmax(0, 1fr));
        gap: 3px;
        width: 100%;
        box-sizing: border-box;
      }
      .mini-day {
        min-width: 0;
        width: 100%;
        height: 48px;
        padding: 0;
        box-sizing: border-box;
        background: var(--panel); border: 1px solid var(--border);
        border-radius: 6px; cursor: pointer;
        display: flex; flex-direction: column; align-items: center;
        justify-content: center; font-size: 10px; color: var(--text-dim);
        transition: all 0.15s;
      }
      .mini-day:hover { border-color: var(--text); }
      .mini-day.today { border-color: var(--text); border-width: 1.5px; }
      .mini-day.weekend { background: var(--panel3); }
      .mini-day.active { background: var(--text); border-color: var(--text); }
      .mini-day.active .mini-wd, .mini-day.active .mini-d { color: var(--bg); }
      .mini-wd { font-family: Inter, sans-serif; font-size: 10px; }
      .mini-d {
        font-family: 'Inter', 'Pretendard', sans-serif !important;
        font-style: normal !important;
        font-weight: 600;
        font-size: 16px; color: var(--text); margin-top: 2px;
        letter-spacing: -0.02em;
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
        font-family: 'Pretendard', 'Inter', sans-serif;
        font-weight: 700;
        font-size: 26px;
        color: var(--text);
        margin: 0 0 4px;
        letter-spacing: -0.025em;
        line-height: 1.2;
      }
      .section-sub {
        font-family: 'Pretendard', sans-serif;
        font-size: 13px; color: var(--text-dim);
        letter-spacing: -0.005em; margin-bottom: 20px;
      }
      /* 영문 캡션 (英文 캡션) - 한글 헤더 위/아래 보조 텍스트 */
      .section-caption {
        font-family: 'Inter', sans-serif;
        font-size: 10px;
        font-weight: 700;
        color: var(--text-mute);
        letter-spacing: 0.18em;
        text-transform: uppercase;
        margin-bottom: 6px;
        line-height: 1;
      }
      .section-caption-inline {
        font-family: 'Inter', sans-serif;
        font-size: 10px;
        font-weight: 700;
        color: var(--text-mute);
        letter-spacing: 0.14em;
        text-transform: uppercase;
        margin-right: 8px;
      }
      .reflect-title {
        font-family: 'Pretendard', 'Inter', sans-serif;
        font-weight: 700;
        font-size: 17px;
        color: var(--text);
        letter-spacing: -0.015em;
      }
      .reflect-title-en {
        font-family: 'Inter', sans-serif;
        font-size: 9px;
        font-weight: 700;
        color: var(--text-mute);
        letter-spacing: 0.18em;
        text-transform: uppercase;
        margin-bottom: 4px;
        line-height: 1;
      }
      /* 사이드바 브랜드 헤더 (商標 헤더) */
      .brand-title {
        font-family: 'Pretendard', 'Inter', sans-serif;
        font-weight: 800;
        font-size: 22px;
        color: var(--text);
        letter-spacing: -0.025em;
        margin-bottom: 4px;
        line-height: 1.15;
      }
      .brand-caption {
        font-family: 'Inter', sans-serif;
        font-size: 9px;
        font-weight: 700;
        color: var(--text-mute);
        letter-spacing: 0.22em;
        text-transform: uppercase;
        margin-bottom: 2px;
      }
      .brand-sub {
        font-family: 'Pretendard', sans-serif;
        font-size: 12px;
        color: var(--text-dim);
        letter-spacing: -0.005em;
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
        font-family: 'Inter', 'Pretendard', sans-serif !important;
        font-style: normal !important;
        font-weight: 700;
        font-size: 30px;
        line-height: 1;
        letter-spacing: -0.02em;
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

function QuadrantCard({ q, qColor, tasks, onAdd, onToggle, onDelete, onSelect, isOverFromOther, keyResults }) {
  const quadrant = QUADRANTS[q];

  // 사분면을 Droppable Zone으로 등록
  const { setNodeRef, isOver } = useDroppable({
    id: `droppable-${q}`,
    data: { type: 'quadrant', quadrant: q },
  });

  // task의 id 배열 (SortableContext에 전달)
  const taskIds = tasks.map((t) => t.id);

  // 다른 분면에서 드래그 중인지 - 강한 강조 트리거
  const showStrongHighlight = isOver || isOverFromOther;

  return (
    <div
      ref={setNodeRef}
      className={`card ${showStrongHighlight ? 'is-over' : ''}`}
      style={{
        minHeight: 200,
        height: '100%',
        boxSizing: 'border-box',
        outline: showStrongHighlight ? `2px dashed ${qColor}` : 'none',
        outlineOffset: showStrongHighlight ? -4 : 0,
        background: showStrongHighlight ? `${qColor}11` : undefined,
        transition: 'background 0.15s, outline 0.15s',
      }}
    >
      <div className="card-head">
        <div className="card-label" style={{ color: qColor, fontSize: 20 }}>{quadrant.label}</div>
        <div className="card-sub" style={{ fontSize: 14 }}>{quadrant.sub}</div>
      </div>

      <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
        <div className="task-list">
          {tasks.length === 0 && (
            <div style={{
              fontFamily: 'NoonnuGothic, sans-serif',
              fontSize: 13,
              color: showStrongHighlight ? qColor : 'var(--text-mute)',
              padding: showStrongHighlight ? '20px 12px' : '8px 0',
              textAlign: showStrongHighlight ? 'center' : 'left',
              border: showStrongHighlight ? `1px dashed ${qColor}` : 'none',
              borderRadius: 6,
              fontWeight: showStrongHighlight ? 600 : 400,
              transition: 'all 0.15s',
            }}>
              {showStrongHighlight ? '여기에 놓기 ↓' : '아직 업무가 없습니다'}
            </div>
          )}
          {tasks.map((t) => (
            <DraggableTaskItem
              key={t.id}
              task={t}
              qColor={qColor}
              onToggle={onToggle}
              onDelete={onDelete}
              onSelect={onSelect}
              keyResults={keyResults}
            />
          ))}
        </div>
      </SortableContext>

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

function Matrix({ theme, tasksByQ, setActiveQuadrant, toggleTask, deleteTask, onSelect, onReorder, layout, setLayout, onLayoutCommit, keyResults }) {
  const colors = { Q1: theme.q1, Q2: theme.q2, Q3: theme.q3, Q4: theme.q4 };
  const matrixRef = useRef(null);

  // 비율 (比率) - 기본값 50:50
  const colRatio = layout?.colRatio ?? 50;
  const rowRatio = layout?.rowRatio ?? 50;

  // 드래그 상태 (拖 狀態) - 어디로 향하는지 추적
  const [activeTask, setActiveTask] = useState(null);  // 드래그 중인 task
  const [overQ, setOverQ] = useState(null);             // 호버 중인 분면 (Q1~Q4)

  // 드래그 센서 설정 (마우스 + 터치 + 키보드)
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 }, // 5px 이상 움직여야 드래그 시작
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // 모든 task의 평탄한 배열 (검색용)
  const allTasks = useMemo(() => {
    return ['Q1', 'Q2', 'Q3', 'Q4'].flatMap((q) => tasksByQ[q] || []);
  }, [tasksByQ]);

  const findTaskById = (id) => allTasks.find((t) => t.id === id);
  const findContainerOf = (id) => {
    // task id로 어느 사분면(Q1~Q4)에 속한지 찾기
    if (!id) return null;
    if (['Q1', 'Q2', 'Q3', 'Q4'].includes(String(id).replace('droppable-', ''))) {
      return String(id).replace('droppable-', '');
    }
    const t = findTaskById(id);
    return t?.q || null;
  };

  // 사용자(使用者) 정의 충돌 감지 - 분면 우선 + task 보조
  // pointerWithin: 마우스 포인터가 영역 안에 있는지 (가장 정확)
  // 실패 시 rectIntersection: 카드 영역 겹침
  // 둘 다 실패 시 closestCenter: 가장 가까운 중심 (예비책)
  const collisionDetection = (args) => {
    // 1. 포인터가 닿은 droppable이 있으면 그걸 우선 (most accurate)
    const pointerCollisions = pointerWithin(args);
    if (pointerCollisions.length > 0) return pointerCollisions;
    // 2. 카드끼리 겹침 감지
    const rectCollisions = rectIntersection(args);
    if (rectCollisions.length > 0) return rectCollisions;
    // 3. 예비책 - 가장 가까운 중심
    return closestCenter(args);
  };

  function handleDragStart(event) {
    const { active } = event;
    const t = findTaskById(active.id);
    if (t) setActiveTask(t);
  }

  function handleDragOver(event) {
    const { over } = event;
    if (!over) {
      setOverQ(null);
      return;
    }
    const targetQ = findContainerOf(over.id);
    setOverQ(targetQ);
  }

  function handleDragEnd(event) {
    const { active, over } = event;
    setActiveTask(null);
    setOverQ(null);
    if (!active || !over) return;
    if (active.id === over.id) return;

    const fromQ = findContainerOf(active.id);
    let toQ = findContainerOf(over.id);

    // over가 droppable zone(빈 사분면)인 경우
    if (String(over.id).startsWith('droppable-')) {
      toQ = String(over.id).replace('droppable-', '');
    }

    if (!fromQ || !toQ) return;

    onReorder?.({
      activeId: active.id,
      overId: over.id,
      fromQ,
      toQ,
    });
  }

  function handleDragCancel() {
    setActiveTask(null);
    setOverQ(null);
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div
        ref={matrixRef}
        style={{
          display: 'grid',
          gridTemplateColumns: `${colRatio}fr 6px ${100 - colRatio}fr`,
          gridTemplateRows: `${rowRatio}fr 6px ${100 - rowRatio}fr`,
          minHeight: 0,
          height: '100%',
          flex: 1,
        }}
      >
        {/* Q1 (상단 좌) */}
        <div style={{ gridColumn: 1, gridRow: 1, paddingRight: 8, paddingBottom: 8, minWidth: 0, minHeight: 0 }}>
          <QuadrantCard
            q="Q1" qColor={colors.Q1} tasks={tasksByQ.Q1}
            onAdd={setActiveQuadrant} onToggle={toggleTask} onDelete={deleteTask} onSelect={onSelect}
            isOverFromOther={overQ === 'Q1' && activeTask && activeTask.q !== 'Q1'}
            keyResults={keyResults}
          />
        </div>
        {/* 가로 리사이저 (좌우) - 상단 */}
        <div style={{ gridColumn: 2, gridRow: 1, minHeight: 0 }}>
          <Resizer
            direction="horizontal"
            mode="percent"
            containerRef={matrixRef}
            current={colRatio}
            min={25}
            max={75}
            onChange={(v) => setLayout({ ...layout, colRatio: v })}
            onCommit={(v) => onLayoutCommit?.({ ...layout, colRatio: v })}
            onReset={() => onLayoutCommit?.({ ...layout, colRatio: 50 })}
          />
        </div>
        {/* Q2 (상단 우) */}
        <div style={{ gridColumn: 3, gridRow: 1, paddingLeft: 8, paddingBottom: 8, minWidth: 0, minHeight: 0 }}>
          <QuadrantCard
            q="Q2" qColor={colors.Q2} tasks={tasksByQ.Q2}
            onAdd={setActiveQuadrant} onToggle={toggleTask} onDelete={deleteTask} onSelect={onSelect}
            isOverFromOther={overQ === 'Q2' && activeTask && activeTask.q !== 'Q2'}
            keyResults={keyResults}
          />
        </div>

        {/* 세로 리사이저 (위아래) - 좌측 */}
        <div style={{ gridColumn: 1, gridRow: 2, minWidth: 0 }}>
          <Resizer
            direction="vertical"
            mode="percent"
            containerRef={matrixRef}
            current={rowRatio}
            min={25}
            max={75}
            onChange={(v) => setLayout({ ...layout, rowRatio: v })}
            onCommit={(v) => onLayoutCommit?.({ ...layout, rowRatio: v })}
            onReset={() => onLayoutCommit?.({ ...layout, rowRatio: 50 })}
          />
        </div>
        {/* 중앙 교차점 (空白) */}
        <div style={{ gridColumn: 2, gridRow: 2 }} />
        {/* 세로 리사이저 (위아래) - 우측 */}
        <div style={{ gridColumn: 3, gridRow: 2, minWidth: 0 }}>
          <Resizer
            direction="vertical"
            mode="percent"
            containerRef={matrixRef}
            current={rowRatio}
            min={25}
            max={75}
            onChange={(v) => setLayout({ ...layout, rowRatio: v })}
            onCommit={(v) => onLayoutCommit?.({ ...layout, rowRatio: v })}
            onReset={() => onLayoutCommit?.({ ...layout, rowRatio: 50 })}
          />
        </div>

        {/* Q3 (하단 좌) */}
        <div style={{ gridColumn: 1, gridRow: 3, paddingRight: 8, paddingTop: 8, minWidth: 0, minHeight: 0 }}>
          <QuadrantCard
            q="Q3" qColor={colors.Q3} tasks={tasksByQ.Q3}
            onAdd={setActiveQuadrant} onToggle={toggleTask} onDelete={deleteTask} onSelect={onSelect}
            isOverFromOther={overQ === 'Q3' && activeTask && activeTask.q !== 'Q3'}
            keyResults={keyResults}
          />
        </div>
        {/* 가로 리사이저 (좌우) - 하단 */}
        <div style={{ gridColumn: 2, gridRow: 3, minHeight: 0 }}>
          <Resizer
            direction="horizontal"
            mode="percent"
            containerRef={matrixRef}
            current={colRatio}
            min={25}
            max={75}
            onChange={(v) => setLayout({ ...layout, colRatio: v })}
            onCommit={(v) => onLayoutCommit?.({ ...layout, colRatio: v })}
            onReset={() => onLayoutCommit?.({ ...layout, colRatio: 50 })}
          />
        </div>
        {/* Q4 (하단 우) */}
        <div style={{ gridColumn: 3, gridRow: 3, paddingLeft: 8, paddingTop: 8, minWidth: 0, minHeight: 0 }}>
          <QuadrantCard
            q="Q4" qColor={colors.Q4} tasks={tasksByQ.Q4}
            onAdd={setActiveQuadrant} onToggle={toggleTask} onDelete={deleteTask} onSelect={onSelect}
            isOverFromOther={overQ === 'Q4' && activeTask && activeTask.q !== 'Q4'}
            keyResults={keyResults}
          />
        </div>
      </div>

      {/* DragOverlay - 드래그 중인 카드의 분리된 미리보기 (預覽) */}
      <DragOverlay
        dropAnimation={{
          duration: 200,
          easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)',
        }}
      >
        {activeTask ? (
          <div
            className="task drag-overlay-task"
            style={{
              background: theme.panel,
              padding: '10px 12px',
              borderRadius: 6,
              border: `1px solid ${colors[activeTask.q]}`,
              borderLeft: `3px solid ${colors[activeTask.q]}`,
              boxShadow: '0 8px 24px -4px rgba(0,0,0,0.25)',
              cursor: 'grabbing',
              transform: 'rotate(-1.5deg)',
              fontFamily: 'NoonnuGothic, sans-serif',
              fontSize: 15,
              color: theme.text,
              maxWidth: 360,
              display: 'flex', alignItems: 'flex-start', gap: 10,
            }}
          >
            <div
              className="chk"
              style={{
                flex: '0 0 18px', width: 18, height: 18,
                borderRadius: 4, marginTop: 2,
                border: `1.5px solid ${colors[activeTask.q]}`,
                background: activeTask.done ? colors[activeTask.q] : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              {activeTask.done && <Check size={11} color="#FFF" strokeWidth={3} />}
            </div>
            <span style={{
              flex: 1,
              textDecoration: activeTask.done ? 'line-through' : 'none',
              opacity: activeTask.done ? 0.5 : 1,
              wordBreak: 'break-word',
            }}>
              {activeTask.text}
            </span>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

// ═══════════════════════════════════════════════════════════════
// VIEW SWITCH MODE INDICATOR (畵面 轉換 模式 指標) - F 키 누른 후 1~4 대기 표시
// ═══════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════
// RESIZER (調節 棒) - 가로/세로 드래그로 비율 조정
// - direction: 'horizontal' (좌↔우) | 'vertical' (위↔아래)
// - mode: 'percent' (%, 부모 박스 기준) | 'pixel' (px, 절대값)
// - onChange(value): 드래그 중 호출
// - onCommit(value): 드래그 종료 시 호출 (저장용)
// - onReset(): 더블클릭 시 호출
// ═══════════════════════════════════════════════════════════════
function Resizer({
  direction = 'horizontal',
  mode = 'percent',
  containerRef,           // 비율 계산 기준 컨테이너 (% 모드에서 필수)
  current,                // 현재 값 (예: 50 또는 300)
  min = 25,
  max = 75,
  onChange,
  onCommit,
  onReset,
  thickness = 6,
}) {
  const [dragging, setDragging] = useState(false);
  const startRef = useRef({ pos: 0, value: 0 });

  useEffect(() => {
    if (!dragging) return;
    const handleMove = (e) => {
      e.preventDefault();
      const containerRect = containerRef?.current?.getBoundingClientRect();
      if (!containerRect && mode === 'percent') return;

      const clientPos = direction === 'horizontal' ? e.clientX : e.clientY;
      const delta = clientPos - startRef.current.pos;

      let next;
      if (mode === 'percent') {
        const total = direction === 'horizontal' ? containerRect.width : containerRect.height;
        const deltaPct = (delta / total) * 100;
        next = startRef.current.value + deltaPct;
      } else {
        next = startRef.current.value + delta;
      }
      next = Math.min(max, Math.max(min, next));
      onChange?.(next);
    };
    const handleUp = () => {
      setDragging(false);
      onCommit?.(current);
    };
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [dragging, direction, mode, min, max, current, onChange, onCommit, containerRef]);

  const handleMouseDown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    startRef.current = {
      pos: direction === 'horizontal' ? e.clientX : e.clientY,
      value: current,
    };
    setDragging(true);
  };

  const handleDoubleClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onReset?.();
  };

  const isHorizontal = direction === 'horizontal';
  return (
    <>
      {dragging && (
        <style>{`
          body { user-select: none !important; cursor: ${isHorizontal ? 'col-resize' : 'row-resize'} !important; }
          body * { pointer-events: none !important; }
        `}</style>
      )}
      <div
        className={`resizer ${isHorizontal ? 'resizer-h' : 'resizer-v'} ${dragging ? 'resizer-active' : ''}`}
        onMouseDown={handleMouseDown}
        onDoubleClick={handleDoubleClick}
        style={{
          flexShrink: 0,
          ...(isHorizontal
            ? { width: thickness, cursor: 'col-resize', alignSelf: 'stretch' }
            : { height: thickness, cursor: 'row-resize', width: '100%' }
          ),
        }}
        title="드래그로 크기 조절 · 더블클릭으로 초기화"
      >
        <div className="resizer-grip" />
      </div>
    </>
  );
}

// 태그 입력 컴포넌트 (標識 入力) - 칩 형태로 추가/삭제
function TagInput({ tags, onChange, theme }) {
  const [input, setInput] = useState('');
  const list = Array.isArray(tags) ? tags : [];

  const addTag = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    if (list.includes(trimmed)) {
      setInput('');
      return; // 중복 방지
    }
    onChange([...list, trimmed]);
    setInput('');
  };

  const removeTag = (tag) => {
    onChange(list.filter((t) => t !== tag));
  };

  return (
    <div style={{
      display: 'flex', flexWrap: 'wrap', gap: 6,
      padding: 8,
      background: theme.panel2,
      border: `1px solid ${theme.borderSoft || theme.border}`,
      borderRadius: 6,
      minHeight: 38,
      alignItems: 'center',
    }}>
      {list.map((tag) => {
        const c = getTagColor(tag);
        return (
          <span key={tag} style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '3px 4px 3px 10px',
            background: `${c}1A`,
            border: `1px solid ${c}55`,
            borderRadius: 12,
            color: c,
            fontFamily: 'Pretendard, sans-serif',
            fontSize: 12,
            fontWeight: 600,
          }}>
            {tag}
            <button
              onClick={() => removeTag(tag)}
              aria-label={`${tag} 삭제`}
              style={{
                width: 16, height: 16,
                background: 'transparent',
                border: 'none',
                color: c,
                cursor: 'pointer',
                opacity: 0.65,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: 0,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = 1)}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = 0.65)}
            >
              <X size={11} strokeWidth={2.5} />
            </button>
          </span>
        );
      })}
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            addTag();
          } else if (e.key === 'Backspace' && !input && list.length > 0) {
            // 빈 입력 + Backspace → 마지막 태그 삭제
            removeTag(list[list.length - 1]);
          }
        }}
        onBlur={addTag}
        placeholder={list.length === 0 ? '태그 입력 후 Enter' : '+ 추가'}
        style={{
          flex: 1, minWidth: 80,
          background: 'transparent',
          border: 'none',
          outline: 'none',
          color: theme.text,
          fontFamily: 'Pretendard, sans-serif',
          fontSize: 13,
          padding: '3px 4px',
        }}
      />
    </div>
  );
}

// 체크리스트 입력 컴포넌트 (細部 業務 入力)
function ChecklistInput({ items, onChange, theme }) {
  const [input, setInput] = useState('');
  const list = Array.isArray(items) ? items : [];

  const addItem = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    const newItem = {
      id: (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID()
        : String(Date.now() + Math.random()),
      text: trimmed,
      done: false,
    };
    onChange([...list, newItem]);
    setInput('');
  };

  const toggleItem = (id) => {
    onChange(list.map((i) => (i.id === id ? { ...i, done: !i.done } : i)));
  };

  const removeItem = (id) => {
    onChange(list.filter((i) => i.id !== id));
  };

  const updateText = (id, text) => {
    onChange(list.map((i) => (i.id === id ? { ...i, text } : i)));
  };

  return (
    <div style={{
      background: theme.panel2,
      border: `1px solid ${theme.borderSoft || theme.border}`,
      borderRadius: 6,
      padding: 6,
    }}>
      {list.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 6 }}>
          {list.map((item) => (
            <div key={item.id} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '5px 6px',
              borderRadius: 4,
              transition: 'background 0.12s',
            }}
              onMouseEnter={(e) => (e.currentTarget.style.background = theme.panel)}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <button
                onClick={() => toggleItem(item.id)}
                aria-label={item.done ? '완료 취소' : '완료 체크'}
                style={{
                  width: 16, height: 16, flexShrink: 0,
                  borderRadius: 3,
                  border: `1.5px solid ${item.done ? theme.success : theme.border}`,
                  background: item.done ? theme.success : 'transparent',
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  padding: 0,
                }}
              >
                {item.done && <Check size={10} color={theme.bg} strokeWidth={3} />}
              </button>
              <input
                value={item.text}
                onChange={(e) => updateText(item.id, e.target.value)}
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: item.done ? theme.textMute : theme.text,
                  textDecoration: item.done ? 'line-through' : 'none',
                  fontFamily: 'Pretendard, sans-serif',
                  fontSize: 13,
                  padding: 0,
                }}
              />
              <button
                onClick={() => removeItem(item.id)}
                aria-label="삭제"
                style={{
                  width: 18, height: 18, flexShrink: 0,
                  background: 'transparent',
                  border: 'none',
                  color: theme.textMute,
                  cursor: 'pointer',
                  opacity: 0.5,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  padding: 0,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = 1)}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = 0.5)}
              >
                <X size={12} strokeWidth={2.5} />
              </button>
            </div>
          ))}
        </div>
      )}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '4px 6px',
      }}>
        <Plus size={13} style={{ color: theme.textMute, flexShrink: 0 }} />
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addItem();
            }
          }}
          placeholder={list.length === 0 ? '항목 입력 후 Enter' : '+ 항목 추가'}
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: theme.text,
            fontFamily: 'Pretendard, sans-serif',
            fontSize: 13,
            padding: '4px 0',
          }}
        />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TASK DETAIL PANEL (業務 詳細 板) - 우측 슬라이드 패널
// - 업무 클릭 시 우측에서 슬라이드
// - 메모, 마감일, 태그, 체크리스트, URL 편집
// ═══════════════════════════════════════════════════════════════

// D-day 계산 (計算) - 오늘 기준 마감일까지 남은 일수
function calcDDay(dueDate, currentDate) {
  if (!dueDate) return null;
  const today = new Date(currentDate);
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  const diff = Math.round((due - today) / (1000 * 60 * 60 * 24));
  if (diff === 0) return { label: 'D-day', tone: 'urgent', days: 0 };
  if (diff < 0) return { label: `D+${Math.abs(diff)}`, tone: 'overdue', days: diff };
  if (diff <= 2) return { label: `D-${diff}`, tone: 'urgent', days: diff };
  if (diff <= 7) return { label: `D-${diff}`, tone: 'soon', days: diff };
  return { label: `D-${diff}`, tone: 'normal', days: diff };
}

// 태그 색상 (標識 色相) - 문자열 해시로 일관된 색상 부여
const TAG_COLORS = [
  '#E66B5C', '#5C9BE6', '#5CB893', '#C97FC9',
  '#E6A65C', '#5CC9C9', '#9C5CE6', '#E65C9C',
];
function getTagColor(tag) {
  if (!tag) return TAG_COLORS[0];
  let hash = 0;
  for (let i = 0; i < tag.length; i++) {
    hash = (hash * 31 + tag.charCodeAt(i)) >>> 0;
  }
  return TAG_COLORS[hash % TAG_COLORS.length];
}

function TaskDetailPanel({ task, theme, currentDate, onClose, onUpdate, onDelete, keyResults }) {
  const [localText, setLocalText] = useState(task?.text || '');
  const [localNotes, setLocalNotes] = useState(task?.notes || '');
  const saveTimerRef = useRef(null);

  // task 변경 시 로컬 상태 동기화 (同期化)
  useEffect(() => {
    if (task) {
      setLocalText(task.text || '');
      setLocalNotes(task.notes || '');
    }
  }, [task?.id]);

  // 디바운스 저장 (지연 貯藏) - 0.5초
  const debouncedSave = (patch) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      onUpdate(task.id, patch);
    }, 500);
  };

  // 언마운트 시 즉시 저장
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        // 패널 닫힐 때 미저장 변경 즉시 반영
        if (task && (localText !== task.text || localNotes !== task.notes)) {
          onUpdate(task.id, { text: localText.trim() || task.text, notes: localNotes });
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!task) return null;
  const q = QUADRANTS[task.q];
  const qColor = theme[task.q.toLowerCase()];

  // 생성일 / 수정일 포맷 (作成日 / 修正日)
  const formatTime = (ts) => {
    if (!ts) return '';
    const d = new Date(ts);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  // 이월 정보
  const isCarried = !!task.carriedFromDate;

  return (
    <>
      {/* 배경 오버레이 (背景 ovelay) - 외부 클릭으로 닫기 */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.18)',
          zIndex: 90,
          animation: 'overlay-in 0.18s ease',
        }}
      />
      {/* 패널 본체 (本體) */}
      <aside
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0,
          width: 'min(420px, 92vw)',
          background: theme.panel,
          borderLeft: `1px solid ${theme.border}`,
          boxShadow: '-12px 0 40px -8px rgba(0,0,0,0.18)',
          zIndex: 100,
          display: 'flex', flexDirection: 'column',
          animation: 'panel-slide-in 0.22s cubic-bezier(0.32, 0.72, 0.24, 1)',
          fontFamily: 'Pretendard, Inter, sans-serif',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 (頭部) */}
        <header style={{
          padding: '20px 24px 16px',
          borderBottom: `1px solid ${theme.borderSoft || theme.border}`,
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
          gap: 12,
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: 9, fontWeight: 700,
              color: theme.textMute,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              marginBottom: 4,
            }}>
              TASK DETAIL
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center',
                padding: '3px 9px',
                borderRadius: 10,
                background: `${qColor}18`,
                border: `1px solid ${qColor}55`,
                color: qColor,
                fontFamily: 'Inter, sans-serif',
                fontSize: 11, fontWeight: 700,
                letterSpacing: '-0.005em',
              }}>
                {q.label}
              </span>
              <span style={{
                fontFamily: 'Pretendard, sans-serif',
                fontSize: 12,
                color: theme.textDim,
              }}>
                {q.sub}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="닫기"
            style={{
              flexShrink: 0,
              width: 30, height: 30,
              background: 'transparent',
              border: `1px solid ${theme.border}`,
              borderRadius: 6,
              color: theme.textDim,
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.15s',
            }}
            title="닫기 (Esc)"
          >
            <X size={15} />
          </button>
        </header>

        {/* 본문 (本文) - 스크롤 영역 */}
        <div style={{
          flex: 1, overflowY: 'auto',
          padding: '20px 24px 24px',
        }}>
          {/* 업무 제목 (業務 題目) - 편집 가능 */}
          <div style={{ marginBottom: 22 }}>
            <div className="td-label">제목 (題目)</div>
            <textarea
              value={localText}
              onChange={(e) => {
                setLocalText(e.target.value);
                debouncedSave({ text: e.target.value });
              }}
              placeholder="업무 내용을 입력하세요"
              className="td-input td-input-title"
              rows={2}
              style={{
                fontFamily: 'Pretendard, sans-serif',
                fontSize: 16,
                fontWeight: 600,
                lineHeight: 1.4,
                color: task.done ? theme.textDim : theme.text,
                textDecoration: task.done ? 'line-through' : 'none',
              }}
            />
          </div>

          {/* OKR 연결 (分期 目標 連結) - v2.2 신규 */}
          <div style={{ marginBottom: 22 }}>
            <div className="td-label">분기 목표 (分期 目標) · KR 연결</div>
            <select
              value={task.kr_id || ''}
              onChange={(e) => onUpdate(task.id, { kr_id: e.target.value || null })}
              className="td-input"
              style={{
                width: '100%',
                fontFamily: 'Pretendard, Inter, sans-serif',
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              <option value="">— 연결 안 함 —</option>
              {(keyResults || []).map((kr, idx) => (
                <option key={kr.id} value={kr.id}>
                  KR-{idx + 1}: {kr.title || '(이름 없음)'}
                </option>
              ))}
            </select>
            {(!keyResults || keyResults.length === 0) && (
              <div style={{
                marginTop: 6,
                fontSize: 11,
                color: theme.textMute,
                fontFamily: 'Pretendard, sans-serif',
              }}>
                사이드바 "분기 목표"에서 KR을 먼저 추가하세요.
              </div>
            )}
          </div>

          {/* 업무 크기 (業務 規模) · 1-3-5 法則 - v2.2 신규 */}
          <div style={{ marginBottom: 22 }}>
            <div className="td-label">업무 크기 (業務 規模) · 1-3-5 法則</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {[
                { id: 'big', label: '큰일', hanja: '大', limit: 1, color: theme.q1 },
                { id: 'medium', label: '중간', hanja: '中', limit: 3, color: theme.q2 },
                { id: 'small', label: '작은일', hanja: '小', limit: 5, color: theme.q3 },
              ].map((opt) => {
                const active = (task.size || 'small') === opt.id;
                return (
                  <button
                    key={opt.id}
                    onClick={() => onUpdate(task.id, { size: opt.id })}
                    style={{
                      flex: 1,
                      padding: '10px 8px',
                      background: active ? `${opt.color}22` : 'transparent',
                      border: `1px solid ${active ? opt.color : theme.border}`,
                      borderRadius: 6,
                      cursor: 'pointer',
                      fontFamily: 'Pretendard, sans-serif',
                      transition: 'all 0.15s ease',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 2,
                    }}
                  >
                    <span style={{
                      fontFamily: 'Inter, sans-serif',
                      fontSize: 14,
                      fontWeight: 600,
                      color: active ? opt.color : theme.textDim,
                    }}>
                      {opt.hanja}
                    </span>
                    <span style={{
                      fontSize: 11,
                      color: active ? theme.text : theme.textMute,
                      fontWeight: active ? 600 : 400,
                    }}>
                      {opt.label}
                    </span>
                    <span style={{
                      fontFamily: 'Inter, sans-serif',
                      fontSize: 9,
                      color: theme.textMute,
                    }}>
                      한도 {opt.limit}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 메모 (備忘) - Step 3에서 활성화될 자리 */}
          <div style={{ marginBottom: 22 }}>
            <div className="td-label">메모 (備忘)</div>
            <textarea
              value={localNotes}
              onChange={(e) => {
                setLocalNotes(e.target.value);
                debouncedSave({ notes: e.target.value });
              }}
              placeholder="자세한 내용, 참고 사항, 진행 메모 등을 자유롭게 적으세요…"
              className="td-input"
              rows={5}
              style={{
                fontFamily: 'Pretendard, sans-serif',
                fontSize: 14,
                lineHeight: 1.6,
                minHeight: 120,
                resize: 'vertical',
              }}
            />
          </div>

          {/* 마감일 (締切日) */}
          <div style={{ marginBottom: 22 }}>
            <div className="td-label">마감일 (締切日)</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="date"
                value={task.due_date || ''}
                onChange={(e) => onUpdate(task.id, { due_date: e.target.value || null })}
                className="td-input"
                style={{ flex: 1, fontFamily: 'Inter, Pretendard, sans-serif', fontSize: 13 }}
              />
              {task.due_date && (() => {
                const dd = calcDDay(task.due_date, currentDate);
                if (!dd) return null;
                const toneColor = dd.tone === 'overdue' ? theme.q1
                  : dd.tone === 'urgent' ? theme.q1
                  : dd.tone === 'soon' ? theme.q3
                  : theme.q2;
                return (
                  <span style={{
                    padding: '6px 12px',
                    borderRadius: 14,
                    background: `${toneColor}20`,
                    border: `1px solid ${toneColor}66`,
                    color: toneColor,
                    fontFamily: 'Inter, sans-serif',
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: '-0.01em',
                    flexShrink: 0,
                  }}>
                    {dd.label}
                  </span>
                );
              })()}
              {task.due_date && (
                <button
                  onClick={() => onUpdate(task.id, { due_date: null })}
                  title="마감일 지우기"
                  style={{
                    padding: '6px 8px',
                    background: 'transparent',
                    border: `1px solid ${theme.border}`,
                    borderRadius: 6,
                    color: theme.textDim,
                    cursor: 'pointer',
                    fontFamily: 'Pretendard, sans-serif',
                    fontSize: 11,
                    flexShrink: 0,
                  }}
                >
                  지우기
                </button>
              )}
            </div>
          </div>

          {/* 태그 (標識) */}
          <div style={{ marginBottom: 22 }}>
            <div className="td-label">태그 (標識)</div>
            <TagInput
              tags={task.tags || []}
              onChange={(newTags) => onUpdate(task.id, { tags: newTags })}
              theme={theme}
            />
          </div>

          {/* 체크리스트 (細部 業務) */}
          <div style={{ marginBottom: 22 }}>
            <div className="td-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span>체크리스트 (細部 業務)</span>
              {(task.checklist || []).length > 0 && (() => {
                const items = task.checklist || [];
                const done = items.filter((i) => i.done).length;
                const total = items.length;
                const pct = total ? Math.round((done / total) * 100) : 0;
                return (
                  <span style={{
                    fontSize: 10, fontWeight: 700,
                    color: pct === 100 ? theme.success : theme.textDim,
                    letterSpacing: '0.04em',
                  }}>
                    {done}/{total} · {pct}%
                  </span>
                );
              })()}
            </div>
            <ChecklistInput
              items={task.checklist || []}
              onChange={(newItems) => onUpdate(task.id, { checklist: newItems })}
              theme={theme}
            />
          </div>

          {/* 메타 정보 (情報) */}
          <div style={{
            paddingTop: 16,
            borderTop: `1px solid ${theme.borderSoft || theme.border}`,
            fontFamily: 'Inter, sans-serif',
            fontSize: 11,
            color: theme.textMute,
            display: 'flex', flexDirection: 'column', gap: 4,
            letterSpacing: '0.01em',
          }}>
            {task.created && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 600 }}>생성</span>
                <span>{formatTime(task.created)}</span>
              </div>
            )}
            {task.updated_at && task.updated_at !== task.created && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 600 }}>수정</span>
                <span>{formatTime(task.updated_at)}</span>
              </div>
            )}
            {isCarried && (
              <div style={{
                display: 'flex', justifyContent: 'space-between',
                color: qColor, marginTop: 2,
              }}>
                <span style={{ fontWeight: 600 }}>이월</span>
                <span>{task.carriedFromDate}에서</span>
              </div>
            )}
          </div>
        </div>

        {/* 풋터 (脚部) - 액션 버튼 */}
        <footer style={{
          padding: '14px 24px',
          borderTop: `1px solid ${theme.borderSoft || theme.border}`,
          display: 'flex', gap: 8,
          background: theme.panel2,
        }}>
          <button
            onClick={() => {
              if (window.confirm('이 업무를 삭제하시겠습니까?')) {
                onDelete(task.id);
                onClose();
              }
            }}
            style={{
              padding: '8px 14px',
              background: 'transparent',
              border: `1px solid ${theme.border}`,
              borderRadius: 6,
              color: theme.textDim,
              fontFamily: 'Pretendard, sans-serif',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            삭제
          </button>
          <div style={{ flex: 1 }} />
          <button
            onClick={onClose}
            style={{
              padding: '8px 18px',
              background: theme.text,
              border: 'none',
              borderRadius: 6,
              color: theme.bg,
              fontFamily: 'Pretendard, sans-serif',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.15s',
              letterSpacing: '-0.005em',
            }}
          >
            완료
          </button>
        </footer>
      </aside>

      <style>{`
        @keyframes panel-slide-in {
          from { transform: translateX(100%); }
          to   { transform: translateX(0); }
        }
        @keyframes overlay-in {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        .td-label {
          font-family: 'Inter', sans-serif;
          font-size: 10px;
          font-weight: 700;
          color: ${theme.textMute};
          letter-spacing: 0.14em;
          text-transform: uppercase;
          margin-bottom: 8px;
        }
        .td-input {
          width: 100%;
          padding: 10px 12px;
          background: ${theme.panel2};
          border: 1px solid ${theme.borderSoft || theme.border};
          border-radius: 6px;
          color: ${theme.text};
          font-family: 'Pretendard', sans-serif;
          font-size: 13px;
          line-height: 1.6;
          resize: none;
          outline: none;
          transition: border-color 0.15s, background 0.15s;
          box-sizing: border-box;
        }
        .td-input:focus {
          border-color: ${theme.text};
          background: ${theme.panel};
        }
        .td-input::placeholder {
          color: ${theme.textMute};
        }
      `}</style>
    </>
  );
}

function GoModeIndicator({ active, theme }) {
  if (!active) return null;
  return (
    <div style={{
      position: 'fixed',
      bottom: 24, right: 24,
      zIndex: 200,
      padding: '10px 14px',
      background: theme.panel,
      border: `1px solid ${theme.border}`,
      borderRadius: 8,
      boxShadow: '0 8px 24px -4px rgba(0,0,0,0.18)',
      animation: 'goModePop 0.18s ease',
      fontFamily: 'NoonnuGothic, sans-serif',
      fontSize: 12,
      color: theme.textDim,
      display: 'flex', alignItems: 'center', gap: 10,
    }}>
      <span style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        minWidth: 22, height: 20, padding: '0 6px',
        fontFamily: 'Inter, sans-serif',
        fontSize: 10, fontWeight: 700,
        color: theme.text,
        background: theme.panel2,
        border: `1px solid ${theme.border}`,
        borderRadius: 4,
        boxShadow: `0 1px 0 ${theme.border}`,
      }}>F</span>
      <span style={{ color: theme.text, fontWeight: 600 }}>
        뷰 전환…
      </span>
      <span style={{ color: theme.textMute, fontSize: 11 }}>
        1 매트릭스 · 2 루틴 · 3 회고 · 4 주간
      </span>
      <style>{`
        @keyframes goModePop {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// SHORTCUT HELP MODAL (短縮 鍵 도움말)
// ═══════════════════════════════════════════════════════════════
function ShortcutHelpModal({ open, onClose, theme }) {
  if (!open) return null;
  const groups = [
    {
      title: '날짜 이동 (日字 移動)',
      items: [
        { keys: ['←'], desc: '어제로' },
        { keys: ['→'], desc: '내일로' },
        { keys: ['T'], desc: '오늘로' },
        { keys: ['C'], desc: '달력 열기' },
      ],
    },
    {
      title: '뷰 전환 (畵面 轉換)',
      items: [
        { keys: ['F', '→', '1'], desc: 'Matrix (매트릭스)' },
        { keys: ['F', '→', '2'], desc: 'Routines (루틴)' },
        { keys: ['F', '→', '3'], desc: 'Reflect (회고)' },
        { keys: ['F', '→', '4'], desc: 'Weekly (주간)' },
      ],
    },
    {
      title: '업무 추가 (業務 追加)',
      items: [
        { keys: ['1'], desc: 'Do First (긴급·중요)' },
        { keys: ['2'], desc: 'Schedule (중요·비긴급)' },
        { keys: ['3'], desc: 'Delegate (긴급·비중요)' },
        { keys: ['4'], desc: 'Eliminate (비긴급·비중요)' },
      ],
    },
    {
      title: '입력창 안에서 (入力欄)',
      items: [
        { keys: ['Enter'], desc: '추가' },
        { keys: ['Shift', '+', 'Enter'], desc: '줄바꿈' },
        { keys: ['Alt', '+', '1~4'], desc: '분면 전환' },
        { keys: ['Tab'], desc: '다음 분면' },
        { keys: ['Esc'], desc: '닫기' },
      ],
    },
    {
      title: '기타 (其他)',
      items: [
        { keys: ['?'], desc: '이 도움말 열기' },
        { keys: ['Esc'], desc: '모달 / 도움말 닫기' },
      ],
    },
  ];
  return (
    <div className="backdrop" onClick={onClose}>
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: 480,
          borderTopColor: theme.text,
        }}
      >
        <div style={{
          display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
          marginBottom: 4,
        }}>
          <div style={{
            fontFamily: 'Inter, Pretendard, sans-serif', fontStyle: 'normal', fontWeight: 700,
            fontSize: 18, color: theme.text, letterSpacing: '-0.015em',
          }}>
            Shortcuts
          </div>
          <div style={{
            fontFamily: 'NoonnuGothic, sans-serif', fontSize: 11,
            color: theme.textDim,
          }}>
            단축키 안내 (短縮 鍵 案內)
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 18px', marginTop: 14 }}>
          {groups.map((g) => (
            <div key={g.title}>
              <div style={{
                fontFamily: 'Inter, sans-serif',
                fontSize: 10, fontWeight: 600,
                color: theme.textMute,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                marginBottom: 8,
                paddingBottom: 4,
                borderBottom: `1px solid ${theme.borderSoft || theme.border}`,
              }}>
                {g.title}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {g.items.map((it, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    gap: 8, fontSize: 12,
                  }}>
                    <span style={{
                      fontFamily: 'NoonnuGothic, sans-serif',
                      color: theme.textDim,
                      flex: 1,
                    }}>
                      {it.desc}
                    </span>
                    <span style={{ display: 'inline-flex', gap: 2, alignItems: 'center' }}>
                      {it.keys.map((k, ki) => (
                        (k === '+' || k === '→' || k === '~') ? (
                          <span key={ki} style={{
                            fontFamily: 'Inter, sans-serif',
                            fontSize: 10, color: theme.textMute,
                            margin: '0 1px',
                          }}>{k}</span>
                        ) : (
                          <kbd key={ki} style={{
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            minWidth: 22, padding: '2px 6px',
                            fontFamily: 'Inter, sans-serif',
                            fontSize: 10, fontWeight: 600,
                            color: theme.text,
                            background: theme.panel2,
                            border: `1px solid ${theme.border}`,
                            borderRadius: 4,
                            boxShadow: `0 1px 0 ${theme.border}`,
                            lineHeight: 1.4,
                          }}>
                            {k}
                          </kbd>
                        )
                      ))}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div style={{
          marginTop: 16,
          paddingTop: 12,
          borderTop: `1px solid ${theme.borderSoft || theme.border}`,
          fontFamily: 'NoonnuGothic, sans-serif',
          fontSize: 10,
          color: theme.textMute,
          textAlign: 'center',
        }}>
          입력창 밖에서 눌러야 작동합니다 · ? 또는 / 로 다시 열기
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 14, justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost" onClick={onClose}>닫기 (Esc)</button>
        </div>
      </div>
    </div>
  );
}

function AddTaskModal({ activeQuadrant, setActiveQuadrant, newTaskText, setNewTaskText, addTask, currentDate, theme }) {
  const [lastAdded, setLastAdded] = useState(null); // 방금 추가된 업무 표시용 (表示用)
  const [addedCount, setAddedCount] = useState(0);  // 이번 세션 추가 개수 (個數) - 분면별 합계
  const [addedByQ, setAddedByQ] = useState({ Q1: 0, Q2: 0, Q3: 0, Q4: 0 }); // 분면별 카운터
  const inputRef = useRef(null);
  const fadeTimerRef = useRef(null);
  const sessionStartedRef = useRef(false); // 세션 시작 여부 (분면 전환 시 초기화 방지)

  const QORDER = ['Q1', 'Q2', 'Q3', 'Q4'];

  // 모달이 열릴 때만 초기화 (분면 전환 시는 유지) - 模態 開閉 時 初期化
  useEffect(() => {
    if (activeQuadrant && !sessionStartedRef.current) {
      // 새 세션 시작
      setLastAdded(null);
      setAddedCount(0);
      setAddedByQ({ Q1: 0, Q2: 0, Q3: 0, Q4: 0 });
      sessionStartedRef.current = true;
    } else if (!activeQuadrant) {
      // 모달 닫힘 → 다음 오픈을 새 세션으로
      sessionStartedRef.current = false;
    }
    if (activeQuadrant) {
      const t = setTimeout(() => inputRef.current?.focus(), 0);
      return () => clearTimeout(t);
    }
  }, [activeQuadrant]);

  // 언마운트 시 타이머 정리
  useEffect(() => {
    return () => {
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    };
  }, []);

  if (!activeQuadrant) return null;
  const q = QUADRANTS[activeQuadrant];
  const qColor = theme[activeQuadrant.toLowerCase()];

  // 분면 전환 핸들러 (分面 轉換 處理) - 입력창 포커스 유지
  const switchQuadrant = (target) => {
    if (target === activeQuadrant) return;
    setActiveQuadrant(target);
    // 다음 tick에 포커스 (분면 전환 후)
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  // 연속 추가 핸들러 (連續 追加 處理)
  const handleAdd = async () => {
    if (!newTaskText.trim()) {
      // 빈 상태에서 추가 시도 → 모달 닫기
      setActiveQuadrant(null);
      return;
    }
    const taskText = newTaskText.trim();
    const targetQ = activeQuadrant; // 추가 시점의 분면 기억
    const result = await addTask();
    if (result) {
      setLastAdded({ text: taskText, q: targetQ });
      setAddedCount((c) => c + 1);
      setAddedByQ((prev) => ({ ...prev, [targetQ]: (prev[targetQ] || 0) + 1 }));
      // 2.5초 후 피드백 자동 사라짐 (自動 消失)
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
      fadeTimerRef.current = setTimeout(() => setLastAdded(null), 2500);
      // 다시 입력창에 포커스
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e) => {
    // Esc → 닫기
    if (e.key === 'Escape') {
      e.preventDefault();
      setActiveQuadrant(null);
      return;
    }
    // Alt/Option + 1~4 → 분면 전환 (分面 轉換)
    if (e.altKey && ['1', '2', '3', '4'].includes(e.key)) {
      e.preventDefault();
      const idx = parseInt(e.key, 10) - 1;
      switchQuadrant(QORDER[idx]);
      return;
    }
    // Tab → 다음 분면, Shift+Tab → 이전 분면
    if (e.key === 'Tab') {
      e.preventDefault();
      const curIdx = QORDER.indexOf(activeQuadrant);
      const nextIdx = e.shiftKey
        ? (curIdx - 1 + QORDER.length) % QORDER.length
        : (curIdx + 1) % QORDER.length;
      switchQuadrant(QORDER[nextIdx]);
      return;
    }
    // Cmd/Ctrl+Enter → 추가 (호환성 互換性)
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleAdd();
      return;
    }
    // Shift+Enter → 줄바꿈 (기본 동작 유지)
    if (e.key === 'Enter' && e.shiftKey) {
      return;
    }
    // Enter (단독) → 추가 또는 닫기
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
      return;
    }
  };

  // 마지막 추가된 업무의 분면 색상 (피드백용)
  const lastAddedColor = lastAdded ? theme[lastAdded.q.toLowerCase()] : qColor;
  const lastAddedLabel = lastAdded ? QUADRANTS[lastAdded.q].label : '';

  return (
    <div className="backdrop" onClick={() => setActiveQuadrant(null)}>
      <div className="modal" style={{ borderTopColor: qColor, transition: 'border-top-color 0.2s ease' }} onClick={(e) => e.stopPropagation()}>
        {/* 분면 전환 탭 (分面 轉換 卓) */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 4,
          marginBottom: 14,
          padding: 3,
          background: theme.panel2,
          borderRadius: 6,
        }}>
          {QORDER.map((qid) => {
            const isActive = qid === activeQuadrant;
            const c = theme[qid.toLowerCase()];
            const cnt = addedByQ[qid] || 0;
            return (
              <button
                key={qid}
                onClick={() => switchQuadrant(qid)}
                style={{
                  position: 'relative',
                  padding: '8px 4px 6px',
                  background: isActive ? theme.panel : 'transparent',
                  border: 'none',
                  borderRadius: 4,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  fontFamily: 'Inter, Pretendard, sans-serif',
                  fontStyle: 'normal',
                  fontWeight: 700,
                  fontSize: 12,
                  color: isActive ? c : theme.textDim,
                  letterSpacing: '-0.01em',
                  boxShadow: isActive ? `inset 0 -2px 0 ${c}` : 'none',
                }}
                title={`${QUADRANTS[qid].label} (Alt+${qid.slice(1)})`}
              >
                {QUADRANTS[qid].label}
                {cnt > 0 && (
                  <span style={{
                    position: 'absolute',
                    top: 2,
                    right: 4,
                    fontFamily: 'Inter, sans-serif',
                    fontStyle: 'normal',
                    fontSize: 9,
                    fontWeight: 600,
                    color: c,
                    background: theme.panel,
                    borderRadius: 8,
                    padding: '1px 4px',
                    minWidth: 14,
                    lineHeight: 1.2,
                  }}>
                    {cnt}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div style={{
          display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
          marginBottom: 2,
        }}>
          <div style={{
            fontFamily: 'NoonnuGothic, sans-serif',
            fontSize: 13, color: theme.text, fontWeight: 600,
          }}>
            {q.sub}
          </div>
          {addedCount > 0 && (
            <div style={{
              fontFamily: 'Inter, sans-serif', fontSize: 10,
              color: theme.textMute, letterSpacing: '0.05em',
            }}>
              +{addedCount} 추가됨
            </div>
          )}
        </div>
        <div style={{
          fontFamily: 'NoonnuGothic, sans-serif', fontSize: 11,
          color: theme.textDim, marginBottom: 14,
        }}>
          {q.desc}
        </div>
        {activeQuadrant === 'Q2' && (
          <div style={{
            fontFamily: 'NoonnuGothic, sans-serif', fontSize: 10,
            color: theme.textDim,
            padding: '6px 10px', background: theme.panel2,
            borderRadius: 4, marginBottom: 10,
            borderLeft: `2px solid ${qColor}`,
          }}>
            미완료 시 자동 이월 · 매일 끊김 없이 (連續)
          </div>
        )}
        <textarea
          ref={inputRef}
          className="input"
          placeholder="업무 내용을 입력하세요…"
          value={newTaskText}
          onChange={(e) => setNewTaskText(e.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus
        />
        {/* 방금 추가된 업무 피드백 (反應 表示) */}
        {lastAdded && (
          <div
            key={lastAdded.text + addedCount}
            style={{
              marginTop: 8,
              padding: '6px 10px',
              background: theme.panel2,
              borderLeft: `2px solid ${lastAddedColor}`,
              borderRadius: 4,
              fontFamily: 'NoonnuGothic, sans-serif',
              fontSize: 11,
              color: theme.textDim,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              animation: 'addedFade 0.25s ease',
            }}
          >
            <Check size={11} style={{ color: lastAddedColor, flexShrink: 0 }} />
            <span style={{
              fontFamily: 'Inter, Pretendard, sans-serif', fontStyle: 'normal',
              color: lastAddedColor, fontSize: 10, fontWeight: 700,
              flexShrink: 0, letterSpacing: '-0.005em',
            }}>
              {lastAddedLabel}
            </span>
            <span style={{
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {lastAdded.text}
            </span>
          </div>
        )}
        <div style={{
          fontSize: 10, color: theme.textMute, fontFamily: 'Inter',
          marginTop: 8, letterSpacing: '0.02em',
        }}>
          Enter 추가 · Alt+1~4 분면 전환 · Tab 다음 분면 · Esc 닫기
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button className="btn btn-ghost" onClick={() => setActiveQuadrant(null)}>
            {addedCount > 0 ? '완료' : '취소'}
          </button>
          <button className="btn btn-primary" style={{ background: qColor }} onClick={handleAdd}>
            추가
          </button>
        </div>
      </div>
      <style>{`
        @keyframes addedFade {
          from { opacity: 0; transform: translateY(-3px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

// Top bar: date navigation + track badge + calendar popup
function DateNav({ currentDate, shiftDate, setCurrentDate, trackLabel, dayStats, wsData, pickerOpen, setPickerOpen }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, position: 'relative' }}>
      <button className="arrow-btn" onClick={() => shiftDate(-1)} title="어제 (←)"><ChevronLeft size={20} /></button>
      <div>
        <div className="serif-i" style={{ fontSize: 24, color: 'var(--text)' }}>
          <span className="kor" style={{ fontWeight: 700 }}>{formatDate(currentDate)}</span>
          <span className="track-badge">{trackLabel}</span>
        </div>
        <div style={{ fontFamily: 'NoonnuGothic, sans-serif', fontSize: 13, color: 'var(--text-dim)', marginTop: 4 }}>
          {dayStats.done} / {dayStats.total} 완료 · {dayStats.pct}%
        </div>
      </div>
      <button className="arrow-btn" onClick={() => shiftDate(1)} title="내일 (→)"><ChevronRight size={20} /></button>
      <button className="arrow-btn" onClick={() => setCurrentDate(todayKey())} title="오늘 (T)">
        <Calendar size={16} />
      </button>
      <button
        className="arrow-btn"
        onClick={() => setPickerOpen(!pickerOpen)}
        title="달력에서 날짜 선택 (C)"
        style={pickerOpen ? { background: 'var(--panel2)', borderColor: 'var(--text)' } : {}}
      >
        <CalendarDays size={16} />
      </button>
      {pickerOpen && (
        <DatePickerPopup
          currentDate={currentDate}
          setCurrentDate={setCurrentDate}
          wsData={wsData}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  );
}

// Mobile date bar with calendar popup
function MobileDateBar(p) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '14px 18px', borderBottom: '1px solid var(--border-soft)',
      position: 'relative',
    }}>
      <button className="icon-btn" onClick={() => p.shiftDate(-1)}>
        <ChevronLeft size={20} />
      </button>
      <div
        style={{ textAlign: 'center', flex: 1, cursor: 'pointer' }}
        onClick={() => p.setPickerOpen(!p.pickerOpen)}
      >
        <div className="serif-i" style={{
          fontSize: 18, color: 'var(--text)',
          display: 'inline-flex', alignItems: 'center', gap: 6,
        }}>
          <span className="kor" style={{ fontWeight: 700 }}>{formatDate(p.currentDate)}</span>
          <CalendarDays size={14} style={{ color: 'var(--text-dim)' }} />
          <span className="track-badge" style={{ marginLeft: 2, fontSize: 10 }}>{p.trackLabel}</span>
        </div>
        <div style={{ fontFamily: 'NoonnuGothic, sans-serif', fontSize: 12, color: 'var(--text-dim)', marginTop: 3 }}>
          {p.dayStats.done} / {p.dayStats.total} 완료 · {p.dayStats.pct}%
        </div>
      </div>
      <button className="icon-btn" onClick={() => p.shiftDate(1)}>
        <ChevronRight size={20} />
      </button>
      {p.pickerOpen && (
        <DatePickerPopup
          currentDate={p.currentDate}
          setCurrentDate={p.setCurrentDate}
          wsData={p.wsData}
          onClose={() => p.setPickerOpen(false)}
          mobile
        />
      )}
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
            style={{ cursor: 'pointer' }}
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
function CarryIndicator({ carryStats, theme }) {
  // 가장 강한 분면 색상 사용 (오늘 이월이 가장 많은 분면)
  const topQ = ['Q1', 'Q2', 'Q3', 'Q4'].reduce(
    (max, q) => (carryStats.byQ[q] > (carryStats.byQ[max] || 0) ? q : max),
    'Q1'
  );
  const c = theme[topQ.toLowerCase()] || theme.text;
  const tooltip = carryStats.maxDays > 1
    ? `오늘 이월 ${carryStats.today}건 · 미완료 ${carryStats.todayUndone}건 · 최대 ${carryStats.maxDays}일 누적`
    : `오늘 이월 ${carryStats.today}건 · 미완료 ${carryStats.todayUndone}건`;
  return (
    <span
      className="carry-indicator"
      style={{
        color: c,
        background: `${c}15`,
        border: `1px solid ${c}55`,
      }}
      title={tooltip}
    >
      ↳ {carryStats.today}건
      {carryStats.maxDays > 1 && (
        <span style={{ opacity: 0.7, fontWeight: 500 }}>
          · {carryStats.maxDays}d
        </span>
      )}
    </span>
  );
}

function QuadrantStats({ weekStats, theme, carryByQ }) {
  const colors = { Q1: theme.q1, Q2: theme.q2, Q3: theme.q3, Q4: theme.q4 };
  return (
    <div>
      {Object.values(QUADRANTS).map((q) => {
        const s = weekStats[q.id];
        const pct = s.t ? (s.d / s.t) * 100 : 0;
        const carryCnt = carryByQ?.[q.id] || 0;
        return (
          <div key={q.id} className="qrow">
            <div className="qdot" style={{ background: colors[q.id] }} />
            <div style={{ flex: 1 }}>
              <div className="qrow-lbl">
                {q.label}
                {carryCnt > 0 && (
                  <span
                    className="qrow-carry"
                    style={{ color: colors[q.id] }}
                    title={`오늘 이월 ${carryCnt}건`}
                  >
                    ↳{carryCnt}
                  </span>
                )}
              </div>
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
        <Resizer
          direction="horizontal"
          mode="pixel"
          current={p.layout?.sidebarWidth ?? 300}
          min={220}
          max={420}
          onChange={(v) => p.setLayoutTemp({ ...p.layout, sidebarWidth: v })}
          onCommit={(v) => p.commitLayout({ ...p.layout, sidebarWidth: v })}
          onReset={() => p.commitLayout({ ...p.layout, sidebarWidth: 300 })}
        />
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
        <ShortcutHelpModal open={p.helpOpen} onClose={() => p.setHelpOpen(false)} theme={p.theme} />
        <GoModeIndicator active={p.goMode} theme={p.theme} />
        <TaskDetailPanel
          task={p.selectedTaskId ? (p.dayData.tasks || []).find((t) => t.id === p.selectedTaskId) : null}
          theme={p.theme}
          currentDate={p.currentDate}
          onClose={() => p.setSelectedTaskId(null)}
          onUpdate={p.updateTask}
          onDelete={p.deleteTask}
          keyResults={p.keyResults}
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
        <Resizer
          direction="horizontal"
          mode="pixel"
          current={p.layout?.sidebarWidth ?? 300}
          min={220}
          max={420}
          onChange={(v) => p.setLayoutTemp({ ...p.layout, sidebarWidth: v })}
          onCommit={(v) => p.commitLayout({ ...p.layout, sidebarWidth: v })}
          onReset={() => p.commitLayout({ ...p.layout, sidebarWidth: 300 })}
        />
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
        <ShortcutHelpModal open={p.helpOpen} onClose={() => p.setHelpOpen(false)} theme={p.theme} />
        <GoModeIndicator active={p.goMode} theme={p.theme} />
        <TaskDetailPanel
          task={p.selectedTaskId ? (p.dayData.tasks || []).find((t) => t.id === p.selectedTaskId) : null}
          theme={p.theme}
          currentDate={p.currentDate}
          onClose={() => p.setSelectedTaskId(null)}
          onUpdate={p.updateTask}
          onDelete={p.deleteTask}
          keyResults={p.keyResults}
        />
      </div>
    </>
  );
}

// Shared Sidebar for Standard/Wide
function Sidebar(p) {
  const sidebarWidth = p.layout?.sidebarWidth ?? 300;
  return (
    <aside className="sidebar-scroll" style={{
      width: sidebarWidth,
      borderRight: '1px solid var(--border-soft)',
      padding: '24px 16px',
      background: 'var(--panel3)',
      flexShrink: 0,
      display: 'flex',
      flexDirection: 'column',
      maxHeight: '100vh',
      overflowY: 'auto',
      position: 'sticky',
      top: 0,
      boxSizing: 'border-box',
    }}>
      <div className="brand-caption">EISENHOWER MATRIX</div>
      <div className="brand-title">아이젠하워 매트릭스</div>
      <div className="brand-sub" style={{ marginBottom: 18 }}>일일 우선순위 (日日 優先順位)</div>
      <div style={{ marginBottom: 22 }}><SyncBadge status={p.syncStatus} /></div>

      {/* Views */}
      <div style={{ marginBottom: 22 }}>
        <div className="nav-label">Views</div>
        <button
          className={`nav-btn ${p.view === 'matrix' ? 'active' : ''}`}
          onClick={() => p.setView('matrix')}
          title="Matrix (F → 1)"
        >
          <Calendar size={16} /> Matrix
        </button>
        <button
          className={`nav-btn ${p.view === 'routines' ? 'active' : ''}`}
          onClick={() => p.setView('routines')}
          title="Routines (F → 2)"
        >
          <Repeat size={16} /> Routines
        </button>
        <button
          className={`nav-btn ${p.view === 'reflect' ? 'active' : ''}`}
          onClick={() => p.setView('reflect')}
          title="Reflect (F → 3)"
        >
          <Moon size={16} /> Reflect
        </button>
        <button
          className={`nav-btn ${p.view === 'weekly' ? 'active' : ''}`}
          onClick={() => p.setView('weekly')}
          title="Weekly (F → 4)"
        >
          <BarChart3 size={16} /> Weekly
        </button>
      </div>

      {/* Workspace */}
      <div style={{ marginBottom: 22 }}>
        <div className="nav-label">Workspace</div>
        <WorkspaceToggle workspace={p.workspace} setWorkspace={p.setWorkspace} vertical />
      </div>

      {/* OKR · 분기 목표 (v2.2) */}
      <div style={{ marginBottom: 22 }}>
        <OkrSidebar
          workspace={p.workspace}
          objectives={p.objectives}
          keyResults={p.keyResults}
          wsData={p.wsData}
          onObjectiveSave={p.saveObjective}
          onObjectiveDelete={p.deleteObjective}
          onKeyResultSave={p.saveKeyResult}
          onKeyResultDelete={p.deleteKeyResult}
        />
      </div>

      {/* 오늘의 한도 · 1-3-5 法則 (v2.2) */}
      <div style={{ marginBottom: 22 }}>
        <div className="nav-label">오늘의 한도 · 1-3-5 法則</div>
        <OneThreeFiveCounter
          tasks={p.wsData?.[p.currentDate]?.tasks || []}
        />
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

      {/* By Priority */}
      <div style={{ marginBottom: 22 }}>
        <div className="nav-label-row">
          <span className="nav-label" style={{ marginBottom: 0 }}>과업 중요도 · 주간</span>
          {p.carryStats?.today > 0 && (
            <CarryIndicator carryStats={p.carryStats} theme={p.theme} />
          )}
        </div>
        <QuadrantStats weekStats={p.weekStats} theme={p.theme} carryByQ={p.carryStats?.byQ} />
      </div>
      {/* Carryover 이월 설정 */}
      <div style={{ marginBottom: 22 }}>
        <div className="nav-label-row">
          <span className="nav-label" style={{ marginBottom: 0 }}>Carryover · 이월</span>
          {p.carryStats?.week > 0 && (
            <span style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: 9, fontWeight: 600,
              color: 'var(--text-mute)',
              letterSpacing: '0.05em',
            }}>
              주 {p.carryStats.week}건
            </span>
          )}
        </div>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          padding: '10px 12px',
          background: 'var(--panel2)',
          border: '1px solid var(--border)',
          borderRadius: 8,
        }}>
          {['Q1', 'Q2', 'Q3', 'Q4'].map((q) => {
            const qColor = p.theme[q.toLowerCase()];
            const checked = !!p.settings?.carryover?.[q];
            return (
              <label
                key={q}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontFamily: 'NoonnuGothic, sans-serif',
                  fontSize: 12,
                  color: 'var(--text)',
                  cursor: 'pointer',
                  userSelect: 'none',
                }}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => p.saveSettings({
                    ...p.settings,
                    carryover: {
                      ...(p.settings?.carryover || {}),
                      [q]: e.target.checked,
                    },
                  })}
                  style={{ accentColor: qColor, cursor: 'pointer' }}
                />
                <span style={{ color: qColor, fontSize: 10 }}>●</span>
                <span>{QUADRANTS[q].label}</span>
                <span style={{
                  marginLeft: 'auto',
                  fontSize: 10,
                  color: 'var(--text-mute)',
                }}>
                  {QUADRANTS[q].sub}
                </span>
              </label>
            );
          })}
        </div>
      </div>

      {/* Logout + Shortcuts (短縮 鍵) */}
      <div style={{ marginTop: 'auto' }}>
        <div className="nav-btn-row">
          <button className="nav-btn" onClick={p.onLogout} title="로그아웃">
            <LogOut size={16} />
            <span>로그아웃</span>
          </button>
          <button
            className="nav-btn nav-btn-icon-only"
            onClick={() => p.setHelpOpen(true)}
            title="단축키 안내 (?)"
          >
            <Keyboard size={16} />
          </button>
        </div>
      </div>
    </aside>
  );
}

// Shared MainArea
function MainArea(p) {
  return (
    <main style={{
      flex: 1,
      padding: '24px 32px',
      overflowY: 'auto',
      minWidth: 0,
      display: 'flex',
      flexDirection: 'column',
      minHeight: '100vh',
      boxSizing: 'border-box',
    }}>
      {/* Top bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 22, gap: 16, flexWrap: 'wrap',
        flexShrink: 0,
      }}>
        <DateNav
          currentDate={p.currentDate}
          shiftDate={p.shiftDate}
          setCurrentDate={p.setCurrentDate}
          trackLabel={p.trackLabel}
          dayStats={p.dayStats}
          wsData={p.wsData}
          pickerOpen={p.pickerOpen}
          setPickerOpen={p.setPickerOpen}
        />
        <ThemeToggle themeId={p.themeId} setThemeId={p.setThemeId} />
      </div>

      {p.carriedNotice && p.view === 'matrix' && (
        <div className="notice" style={{ marginBottom: 16, flexShrink: 0 }}>
          <ArrowRight size={14} />
          Q2 미완료 {p.carriedNotice.count}건을 오늘로 이월했습니다
        </div>
      )}

      {p.view === 'matrix' && (
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <Matrix
            theme={p.theme}
            tasksByQ={p.tasksByQ}
            setActiveQuadrant={p.setActiveQuadrant}
            toggleTask={p.toggleTask}
            deleteTask={p.deleteTask}
            onSelect={p.setSelectedTaskId}
            onReorder={p.onReorder}
            layout={p.layout}
            setLayout={p.setLayoutTemp}
            onLayoutCommit={p.commitLayout}
            keyResults={p.keyResults}
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
            <div className="brand-caption" style={{ fontSize: 8 }}>EISENHOWER MATRIX</div>
            <h1 className="brand-title" style={{ fontSize: 20, margin: '0 0 4px' }}>
              아이젠하워 매트릭스
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ fontFamily: 'NoonnuGothic, sans-serif', fontSize: 12, color: 'var(--text-dim)' }}>
                일일 우선순위
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

        {/* Date bar with calendar popup */}
        <MobileDateBar {...p} />

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
              onSelect={p.setSelectedTaskId}
              onReorder={p.onReorder}
              keyResults={p.keyResults}
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
        <ShortcutHelpModal open={p.helpOpen} onClose={() => p.setHelpOpen(false)} theme={p.theme} />
        <GoModeIndicator active={p.goMode} theme={p.theme} />
        <TaskDetailPanel
          task={p.selectedTaskId ? (p.dayData.tasks || []).find((t) => t.id === p.selectedTaskId) : null}
          theme={p.theme}
          currentDate={p.currentDate}
          onClose={() => p.setSelectedTaskId(null)}
          onUpdate={p.updateTask}
          onDelete={p.deleteTask}
          keyResults={p.keyResults}
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
      <div className="section-caption">WEEKLY OVERVIEW</div>
      <h2 className="section-title">주간 개요</h2>
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
          <div style={{ marginBottom: 18 }}>
            <div className="reflect-title-en">COMPLETION</div>
            <div className="reflect-title">완료율 (完了率)</div>
          </div>
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
          <div style={{ marginBottom: 18 }}>
            <div className="reflect-title-en">BY PRIORITY</div>
            <div className="reflect-title">과업 중요도 (課業 重要度)</div>
          </div>
          <QuadrantStats weekStats={p.weekStats} theme={p.theme} carryByQ={p.carryStats?.byQ} />
        </div>
      </div>

      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <BarChart3 size={20} />
          <div>
            <div className="reflect-title-en">WEEKLY REFLECTION</div>
            <div className="reflect-title">주간 회고 (週間 回顧)</div>
          </div>
        </div>
        <div style={{ fontFamily: 'NoonnuGothic, sans-serif', fontSize: 13, color: 'var(--text-dim)', marginBottom: 14, marginTop: 4 }}>
          {formatShort(p.weekKeys[0])} – {formatShort(p.weekKeys[6])}
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
      <div className="section-caption">EVENING REFLECTION</div>
      <h2 className="section-title">저녁 회고</h2>
      <div className="section-sub">夕 回顧 · {WORKSPACES[p.workspace].label}</div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: p.mobile ? '1fr' : '1fr 1fr',
        gap: 16,
      }}>
        <div className="card" style={{ minHeight: 'calc(100vh - 240px)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 4 }}>
            <Moon size={20} style={{ marginTop: 2 }} />
            <div>
              <div className="reflect-title-en">TODAY'S REFLECTION</div>
              <div className="reflect-title">오늘의 성찰 (省察)</div>
            </div>
          </div>
          <div style={{ fontFamily: 'NoonnuGothic, sans-serif', fontSize: 13, color: 'var(--text-dim)', marginBottom: 14, marginTop: 4 }}>
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
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 4 }}>
            <Check size={20} style={{ marginTop: 2 }} />
            <div>
              <div className="reflect-title-en">TODAY'S COMPLETED</div>
              <div className="reflect-title">오늘 완료 (今日 完了)</div>
            </div>
          </div>
          <div style={{ fontFamily: 'NoonnuGothic, sans-serif', fontSize: 13, color: 'var(--text-dim)', marginBottom: 14, marginTop: 4 }}>
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
