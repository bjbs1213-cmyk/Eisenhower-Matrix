import React, { useState, useMemo } from 'react';
import { Plus, Check, X, Trash2, Flame, Edit3, Archive } from 'lucide-react';
import { WORKSPACES } from '../lib/themes.js';
import {
  isRoutineActiveOn,
  calculateStreak,
  getRecentHistory,
  getWeekCompletionRate,
  buildCompletionMap,
  getFrequencyLabel,
  ROUTINE_EMOJI_PRESETS,
  ROUTINE_COLORS,
} from '../lib/routineUtils.js';

const newId = () =>
  (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : String(Date.now() + Math.random());

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

export default function RoutinesView(p) {
  const { routines, completions, workspace, currentDate, weekKeys, theme, saveRoutine, deleteRoutine, toggleCompletion, mobile } = p;
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingRoutine, setEditingRoutine] = useState(null);

  // 현재 워크스페이스의 루틴만 필터
  const myRoutines = useMemo(
    () => (routines || [])
      .filter((r) => r.workspace === workspace && !r.archived)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
    [routines, workspace]
  );

  // 루틴별 완료 맵 구축
  const completionMap = useMemo(() => buildCompletionMap(completions), [completions]);

  // 오늘 활성인 루틴
  const todayActive = useMemo(
    () => myRoutines.filter((r) => isRoutineActiveOn(r, currentDate)),
    [myRoutines, currentDate]
  );

  const todayDoneCount = useMemo(
    () => todayActive.filter((r) => (completionMap[r.id] || new Set()).has(currentDate)).length,
    [todayActive, completionMap, currentDate]
  );
  const todayPct = todayActive.length ? Math.round((todayDoneCount / todayActive.length) * 100) : 0;

  const openNew = () => {
    setEditingRoutine(null);
    setEditorOpen(true);
  };

  const openEdit = (routine) => {
    setEditingRoutine(routine);
    setEditorOpen(true);
  };

  const handleSave = async (routine) => {
    const toSave = editingRoutine
      ? { ...editingRoutine, ...routine }
      : {
          id: newId(),
          workspace,
          sort_order: myRoutines.length,
          archived: false,
          ...routine,
        };
    await saveRoutine(toSave);
    setEditorOpen(false);
    setEditingRoutine(null);
  };

  const handleDelete = async (id) => {
    if (!confirm('이 루틴과 모든 완료 기록을 삭제할까요?')) return;
    await deleteRoutine(id);
  };

  return (
    <div>
      <style>{`
        .routine-card {
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: 10px;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          transition: border-color 0.15s;
        }
        .routine-card:hover { border-color: var(--text-mute); }

        .routine-head {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .routine-emoji {
          font-size: 28px;
          line-height: 1;
          flex-shrink: 0;
        }
        .routine-title {
          font-family: 'NoonnuGothic', sans-serif;
          font-size: 16px;
          font-weight: 500;
          color: var(--text);
          flex: 1;
        }
        .routine-meta {
          font-family: 'Inter', sans-serif;
          font-size: 11px;
          color: var(--text-dim);
          padding: 2px 7px;
          border-radius: 4px;
          background: var(--panel2);
          border: 1px solid var(--border-soft);
        }
        .routine-check {
          width: 42px;
          height: 42px;
          border-radius: 10px;
          border: 2px solid var(--border);
          background: var(--panel2);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.15s;
          flex-shrink: 0;
        }
        .routine-check:hover { border-color: var(--text-dim); }
        .routine-check.done {
          background: var(--rColor);
          border-color: var(--rColor);
          color: var(--panel);
        }

        .routine-stats {
          display: flex;
          align-items: center;
          gap: 16px;
          font-family: 'Inter', sans-serif;
          font-size: 12px;
          color: var(--text-dim);
        }
        .streak {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          color: var(--warn);
          font-weight: 500;
        }

        .heatmap {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 4px;
          flex: 1;
        }
        .heat-cell {
          aspect-ratio: 1;
          border-radius: 3px;
          border: 1px solid var(--border-soft);
          position: relative;
        }
        .heat-cell.inactive {
          background: transparent;
          opacity: 0.3;
        }
        .heat-cell.active.empty {
          background: var(--panel2);
        }
        .heat-cell.active.done {
          background: var(--rColor);
          border-color: var(--rColor);
        }
        .heat-cell.today {
          outline: 1.5px solid var(--text);
          outline-offset: 1px;
        }

        .routine-actions {
          display: flex;
          gap: 6px;
          margin-left: auto;
        }
        .mini-icon-btn {
          width: 28px; height: 28px;
          background: transparent;
          border: none;
          border-radius: 5px;
          color: var(--text-mute);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.15s;
        }
        .mini-icon-btn:hover {
          background: var(--panel2);
          color: var(--text-dim);
        }

        .add-routine-btn {
          width: 100%;
          padding: 16px;
          background: transparent;
          border: 1.5px dashed var(--border);
          border-radius: 10px;
          color: var(--text-dim);
          font-family: 'NoonnuGothic', sans-serif;
          font-size: 14px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          transition: all 0.15s;
        }
        .add-routine-btn:hover {
          border-color: var(--text-dim);
          color: var(--text);
          background: var(--panel2);
        }

        .empty-state {
          text-align: center;
          padding: 50px 20px;
          color: var(--text-dim);
          font-family: 'NoonnuGothic', sans-serif;
        }
      `}</style>

      <h2 className="section-title">Routines</h2>
      <div className="section-sub">
        {WORKSPACES[workspace].emoji} {WORKSPACES[workspace].label} · 오늘 {todayDoneCount}/{todayActive.length} · {todayPct}%
      </div>

      {/* 오늘 요약 (Progress) */}
      {todayActive.length > 0 && (
        <div className="stat-card" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <div className="serif-i" style={{ fontSize: 28 }}>Today's Practice</div>
            <div className="stat-big">{todayPct}%</div>
          </div>
          <div className="progress-bar"><div className="progress-fill" style={{ width: `${todayPct}%` }} /></div>
          <div className="stat-sub">{todayDoneCount} of {todayActive.length} routines complete</div>
        </div>
      )}

      {/* 루틴 카드 목록 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: mobile ? '1fr' : 'repeat(auto-fill, minmax(320px, 1fr))',
        gap: 14,
        marginBottom: 16,
      }}>
        {myRoutines.map((routine) => {
          const doneSet = completionMap[routine.id] || new Set();
          const isActiveToday = isRoutineActiveOn(routine, currentDate);
          const doneToday = doneSet.has(currentDate);
          const streak = calculateStreak(routine, doneSet, currentDate);
          const history = getRecentHistory(routine, doneSet, currentDate, 7);
          const weekStats = getWeekCompletionRate(routine, doneSet, weekKeys);
          const rColor = theme[routine.color] || theme.q2;

          return (
            <div key={routine.id} className="routine-card" style={{ '--rColor': rColor }}>
              <div className="routine-head">
                <div className="routine-emoji">{routine.emoji || '✨'}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="routine-title" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {routine.title}
                  </div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                    <span className="routine-meta">{getFrequencyLabel(routine)}</span>
                    {!isActiveToday && (
                      <span className="routine-meta" style={{ color: 'var(--text-mute)' }}>오늘 비활성</span>
                    )}
                  </div>
                </div>
                {isActiveToday && (
                  <button
                    className={`routine-check ${doneToday ? 'done' : ''}`}
                    onClick={() => toggleCompletion(routine.id, currentDate, !doneToday)}
                    aria-label={doneToday ? '완료 취소' : '완료 체크'}
                  >
                    {doneToday && <Check size={22} strokeWidth={3} />}
                  </button>
                )}
              </div>

              {/* 7일 히트맵 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div className="heatmap">
                  {history.map((h, i) => {
                    const day = DAY_NAMES[new Date(h.date).getDay()];
                    const isToday = h.date === currentDate;
                    let cls = 'heat-cell';
                    if (!h.active) cls += ' inactive';
                    else if (h.done) cls += ' active done';
                    else cls += ' active empty';
                    if (isToday) cls += ' today';
                    return <div key={i} className={cls} title={`${h.date} ${day}`} />;
                  })}
                </div>
              </div>

              {/* 통계 푸터 */}
              <div className="routine-stats">
                {streak > 0 && (
                  <div className="streak">
                    <Flame size={13} fill="currentColor" />
                    <span>{streak}일 연속</span>
                  </div>
                )}
                <div>
                  이번 주 {weekStats.done}/{weekStats.total} · {weekStats.pct}%
                </div>
                <div className="routine-actions">
                  <button className="mini-icon-btn" onClick={() => openEdit(routine)} aria-label="편집">
                    <Edit3 size={14} />
                  </button>
                  <button className="mini-icon-btn" onClick={() => handleDelete(routine.id)} aria-label="삭제">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 새 루틴 추가 버튼 */}
      <button className="add-routine-btn" onClick={openNew}>
        <Plus size={18} />
        새 루틴 추가
      </button>

      {myRoutines.length === 0 && (
        <div className="empty-state">
          아직 루틴이 없습니다.<br />
          위 버튼으로 첫 루틴을 만들어보세요.
        </div>
      )}

      {editorOpen && (
        <RoutineEditor
          routine={editingRoutine}
          workspace={workspace}
          theme={theme}
          onSave={handleSave}
          onCancel={() => { setEditorOpen(false); setEditingRoutine(null); }}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Routine Editor Modal
// ═══════════════════════════════════════════════════════════════
function RoutineEditor({ routine, workspace, theme, onSave, onCancel }) {
  const [title, setTitle] = useState(routine?.title || '');
  const [emoji, setEmoji] = useState(routine?.emoji || '✨');
  const [frequency, setFrequency] = useState(routine?.frequency || 'daily');
  const [targetDays, setTargetDays] = useState(routine?.target_days || [1, 2, 3, 4, 5]);
  const [color, setColor] = useState(routine?.color || 'q2');

  const toggleDay = (d) => {
    setTargetDays((prev) => prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort());
  };

  const handleSubmit = () => {
    if (!title.trim()) return;
    onSave({
      title: title.trim(),
      emoji,
      frequency,
      target_days: frequency === 'weekly' ? targetDays : [],
      color,
      workspace,
    });
  };

  return (
    <>
      <style>{`
        .editor-overlay {
          position: fixed; inset: 0;
          background: rgba(0, 0, 0, 0.45);
          display: flex; align-items: center; justify-content: center;
          z-index: 100;
          padding: 16px;
        }
        .editor-modal {
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 24px;
          width: 100%;
          max-width: 480px;
          max-height: 90vh;
          overflow-y: auto;
        }
        .editor-title {
          font-family: 'Lora', Georgia, serif;
          font-style: italic;
          font-weight: 600;
          font-size: 22px;
          color: var(--text);
          margin-bottom: 18px;
        }
        .editor-label {
          font-family: 'NoonnuGothic', sans-serif;
          font-size: 12px;
          color: var(--text-dim);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 8px;
        }
        .editor-input {
          width: 100%;
          padding: 10px 12px;
          background: var(--panel2);
          border: 1px solid var(--border);
          border-radius: 6px;
          color: var(--text);
          font-family: 'NoonnuGothic', sans-serif;
          font-size: 15px;
          outline: none;
        }
        .editor-input:focus { border-color: var(--text-dim); }

        .emoji-grid {
          display: grid;
          grid-template-columns: repeat(9, 1fr);
          gap: 4px;
        }
        .emoji-btn {
          aspect-ratio: 1;
          background: var(--panel2);
          border: 1.5px solid transparent;
          border-radius: 6px;
          font-size: 20px;
          cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          transition: all 0.1s;
        }
        .emoji-btn:hover { background: var(--panel3); }
        .emoji-btn.selected {
          border-color: var(--text);
          background: var(--panel);
        }

        .freq-btns {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
        }
        .freq-btn {
          padding: 8px 14px;
          background: var(--panel2);
          border: 1px solid var(--border);
          border-radius: 6px;
          color: var(--text-dim);
          font-family: 'NoonnuGothic', sans-serif;
          font-size: 13px;
          cursor: pointer;
          transition: all 0.15s;
        }
        .freq-btn.active {
          background: var(--text);
          color: var(--bg);
          border-color: var(--text);
        }

        .day-btns {
          display: flex;
          gap: 4px;
        }
        .day-btn {
          flex: 1;
          aspect-ratio: 1;
          background: var(--panel2);
          border: 1px solid var(--border);
          border-radius: 6px;
          color: var(--text-dim);
          font-family: 'NoonnuGothic', sans-serif;
          font-size: 13px;
          cursor: pointer;
          transition: all 0.15s;
        }
        .day-btn.active {
          background: var(--text);
          color: var(--bg);
          border-color: var(--text);
        }

        .color-btns {
          display: flex;
          gap: 6px;
        }
        .color-swatch {
          width: 36px; height: 36px;
          border-radius: 8px;
          border: 2px solid transparent;
          cursor: pointer;
          transition: all 0.15s;
        }
        .color-swatch.active {
          border-color: var(--text);
          transform: scale(1.08);
        }

        .editor-footer {
          display: flex;
          gap: 8px;
          justify-content: flex-end;
          margin-top: 24px;
        }
        .editor-btn {
          padding: 9px 18px;
          border-radius: 6px;
          border: 1px solid var(--border);
          background: var(--panel2);
          color: var(--text);
          font-family: 'NoonnuGothic', sans-serif;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.15s;
        }
        .editor-btn:hover { background: var(--panel3); }
        .editor-btn.primary {
          background: var(--text);
          color: var(--bg);
          border-color: var(--text);
        }
        .editor-btn.primary:hover { opacity: 0.9; }
        .editor-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .field-block { margin-bottom: 18px; }
      `}</style>

      <div className="editor-overlay" onClick={(e) => e.target === e.currentTarget && onCancel()}>
        <div className="editor-modal">
          <div className="editor-title">{routine ? '루틴 편집' : '새 루틴'}</div>

          <div className="field-block">
            <div className="editor-label">제목</div>
            <input
              className="editor-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예: 아침 명상 10분"
              autoFocus
            />
          </div>

          <div className="field-block">
            <div className="editor-label">이모지</div>
            <div className="emoji-grid">
              {ROUTINE_EMOJI_PRESETS.map((e) => (
                <button
                  key={e}
                  className={`emoji-btn ${emoji === e ? 'selected' : ''}`}
                  onClick={() => setEmoji(e)}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          <div className="field-block">
            <div className="editor-label">빈도</div>
            <div className="freq-btns">
              {[
                { v: 'daily', l: '매일' },
                { v: 'weekdays', l: '평일' },
                { v: 'weekends', l: '주말' },
                { v: 'weekly', l: '요일 지정' },
              ].map(({ v, l }) => (
                <button
                  key={v}
                  className={`freq-btn ${frequency === v ? 'active' : ''}`}
                  onClick={() => setFrequency(v)}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>

          {frequency === 'weekly' && (
            <div className="field-block">
              <div className="editor-label">요일 선택</div>
              <div className="day-btns">
                {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                  <button
                    key={d}
                    className={`day-btn ${targetDays.includes(d) ? 'active' : ''}`}
                    onClick={() => toggleDay(d)}
                  >
                    {DAY_NAMES[d]}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="field-block">
            <div className="editor-label">색상</div>
            <div className="color-btns">
              {ROUTINE_COLORS.map(({ key, label }) => (
                <button
                  key={key}
                  className={`color-swatch ${color === key ? 'active' : ''}`}
                  style={{ background: theme[key] }}
                  onClick={() => setColor(key)}
                  title={label}
                />
              ))}
            </div>
          </div>

          <div className="editor-footer">
            <button className="editor-btn" onClick={onCancel}>
              <X size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />
              취소
            </button>
            <button
              className="editor-btn primary"
              onClick={handleSubmit}
              disabled={!title.trim()}
            >
              <Check size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />
              저장
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
