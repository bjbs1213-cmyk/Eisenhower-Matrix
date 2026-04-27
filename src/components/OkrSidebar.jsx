import { useState } from 'react';
import { Plus, X } from 'lucide-react';

/**
 * OKR 사이드바 (分期 目標 + 主要 結果)
 *
 * v2.1 호환:
 * - workspace별로 별도 Objective 보유 (work / self)
 * - task의 done(완료), kr_id(KR 연결) 필드 사용
 * - storage.saveObjective, saveKeyResult, deleteObjective, deleteKeyResult API 사용
 *
 * @param {string} workspace - 'work' | 'self'
 * @param {Array} objectives - 전체 Objective 목록
 * @param {Array} keyResults - 전체 KR 목록
 * @param {object} wsData - 현재 workspace의 모든 날짜별 task 데이터 (진척률 계산용)
 * @param {Function} onObjectiveSave - (objective) => void
 * @param {Function} onObjectiveDelete - (id) => void
 * @param {Function} onKeyResultSave - (kr) => void
 * @param {Function} onKeyResultDelete - (id) => void
 */
export default function OkrSidebar({
  workspace,
  objectives,
  keyResults,
  wsData,
  onObjectiveSave,
  onObjectiveDelete,
  onKeyResultSave,
  onKeyResultDelete,
}) {
  const quarter = getCurrentQuarter();

  // 현재 workspace + 분기의 Objective 찾기
  const currentObjective = (objectives || []).find(
    (o) => (o.workspace || 'work') === workspace && o.quarter === quarter
  );

  // 현재 Objective의 KR들
  const currentKrs = currentObjective
    ? (keyResults || [])
        .filter((kr) => kr.objective_id === currentObjective.id)
        .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
    : [];

  const [editingObj, setEditingObj] = useState(false);
  const [objText, setObjText] = useState(currentObjective?.title || '');
  const [editingKrId, setEditingKrId] = useState(null);
  const [editingKrText, setEditingKrText] = useState('');

  // KR별 진척률 계산: 해당 KR 태그가 붙은 모든 task 중 완료 비율
  function calculateKrProgress(krId) {
    const allTasks = collectAllTasks(wsData);
    const tagged = allTasks.filter((t) => t.kr_id === krId);
    if (tagged.length === 0) return 0;
    const done = tagged.filter((t) => t.done).length;
    return Math.round((done / tagged.length) * 100);
  }

  // KR별 연결된 task 개수
  function countKrTasks(krId) {
    const allTasks = collectAllTasks(wsData);
    const tagged = allTasks.filter((t) => t.kr_id === krId);
    return { total: tagged.length, done: tagged.filter((t) => t.done).length };
  }

  async function handleObjSave() {
    const trimmed = objText.trim();
    if (!trimmed) {
      setEditingObj(false);
      setObjText(currentObjective?.title || '');
      return;
    }
    if (currentObjective) {
      await onObjectiveSave({ ...currentObjective, title: trimmed });
    } else {
      await onObjectiveSave({
        id: newId(),
        workspace,
        quarter,
        title: trimmed,
      });
    }
    setEditingObj(false);
  }

  async function handleAddKr() {
    if (!currentObjective) return;
    const newKr = {
      id: newId(),
      objective_id: currentObjective.id,
      title: '',
      order_index: currentKrs.length,
    };
    await onKeyResultSave(newKr);
    setEditingKrId(newKr.id);
    setEditingKrText('');
  }

  async function handleKrSave(kr) {
    const trimmed = editingKrText.trim();
    if (!trimmed) {
      // 빈 KR은 삭제
      await onKeyResultDelete(kr.id);
    } else {
      await onKeyResultSave({ ...kr, title: trimmed });
    }
    setEditingKrId(null);
    setEditingKrText('');
  }

  async function handleKrDelete(krId) {
    if (confirm('이 KR을 삭제할까요? 연결된 업무의 KR 태그도 함께 해제됩니다.')) {
      await onKeyResultDelete(krId);
    }
  }

  return (
    <div>
      <div className="nav-label-row">
        <span className="nav-label" style={{ marginBottom: 0 }}>
          분기 목표 · 分期 目標
        </span>
        <span
          style={{
            fontFamily: 'Inter, sans-serif',
            fontSize: 9,
            fontWeight: 600,
            color: 'var(--text-mute)',
            letterSpacing: '0.05em',
          }}
        >
          {quarter}
        </span>
      </div>

      {/* Objective */}
      <div
        style={{
          padding: '10px 12px',
          background: 'var(--panel2)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          marginBottom: 10,
        }}
      >
        {editingObj ? (
          <textarea
            value={objText}
            onChange={(e) => setObjText(e.target.value)}
            onBlur={handleObjSave}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleObjSave();
              }
              if (e.key === 'Escape') {
                setObjText(currentObjective?.title || '');
                setEditingObj(false);
              }
            }}
            autoFocus
            placeholder="이번 분기 목표를 입력하세요"
            style={{
              width: '100%',
              background: 'var(--panel)',
              border: '1px solid var(--accent)',
              borderRadius: 6,
              padding: '6px 8px',
              fontSize: 12,
              color: 'var(--text)',
              fontFamily: 'NoonnuGothic, Pretendard, sans-serif',
              resize: 'none',
              minHeight: 50,
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        ) : (
          <div
            onClick={() => {
              setObjText(currentObjective?.title || '');
              setEditingObj(true);
            }}
            style={{
              fontSize: 12,
              color: currentObjective?.title ? 'var(--text)' : 'var(--text-mute)',
              fontFamily: 'NoonnuGothic, Pretendard, sans-serif',
              lineHeight: 1.5,
              cursor: 'pointer',
              minHeight: 18,
            }}
          >
            {currentObjective?.title || '클릭하여 분기 목표를 설정하세요'}
          </div>
        )}
      </div>

      {/* Key Results */}
      {currentObjective && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {currentKrs.map((kr, idx) => {
            const progress = calculateKrProgress(kr.id);
            const counts = countKrTasks(kr.id);
            const isEditing = editingKrId === kr.id;

            return (
              <div
                key={kr.id}
                style={{
                  background: 'var(--panel2)',
                  border: '1px solid var(--border-soft)',
                  borderRadius: 6,
                  padding: '6px 8px',
                }}
              >
                {isEditing ? (
                  <input
                    type="text"
                    value={editingKrText}
                    onChange={(e) => setEditingKrText(e.target.value)}
                    onBlur={() => handleKrSave(kr)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleKrSave(kr);
                      if (e.key === 'Escape') {
                        setEditingKrId(null);
                        setEditingKrText('');
                        if (!kr.title) onKeyResultDelete(kr.id);
                      }
                    }}
                    autoFocus
                    placeholder={`KR-${idx + 1} 핵심 결과`}
                    style={{
                      width: '100%',
                      background: 'var(--panel)',
                      border: '1px solid var(--accent)',
                      borderRadius: 4,
                      padding: '3px 6px',
                      fontSize: 11,
                      color: 'var(--text)',
                      fontFamily: 'NoonnuGothic, Pretendard, sans-serif',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                ) : (
                  <>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 6,
                        marginBottom: 4,
                      }}
                    >
                      <div
                        onClick={() => {
                          setEditingKrId(kr.id);
                          setEditingKrText(kr.title || '');
                        }}
                        style={{
                          flex: 1,
                          fontSize: 11,
                          color: 'var(--text)',
                          fontFamily: 'NoonnuGothic, Pretendard, sans-serif',
                          cursor: 'pointer',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                        title={kr.title}
                      >
                        <span
                          style={{
                            fontFamily: 'Inter, sans-serif',
                            fontSize: 9,
                            fontWeight: 600,
                            color: 'var(--accent)',
                            marginRight: 4,
                          }}
                        >
                          KR-{idx + 1}
                        </span>
                        {kr.title || <span style={{ color: 'var(--text-mute)' }}>이름 없음</span>}
                      </div>
                      <span
                        style={{
                          fontFamily: 'Inter, sans-serif',
                          fontSize: 11,
                          fontWeight: 600,
                          color: 'var(--text-dim)',
                        }}
                      >
                        {progress}%
                      </span>
                      <button
                        onClick={() => handleKrDelete(kr.id)}
                        title="KR 삭제"
                        style={{
                          background: 'transparent',
                          border: 'none',
                          padding: 0,
                          cursor: 'pointer',
                          color: 'var(--text-mute)',
                          display: 'flex',
                          alignItems: 'center',
                        }}
                      >
                        <X size={11} />
                      </button>
                    </div>
                    <div
                      style={{
                        height: 3,
                        background: 'var(--border)',
                        borderRadius: 2,
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          width: `${progress}%`,
                          height: '100%',
                          background: 'var(--accent)',
                          transition: 'width 0.3s ease',
                        }}
                      />
                    </div>
                    {counts.total > 0 && (
                      <div
                        style={{
                          marginTop: 3,
                          fontFamily: 'Inter, sans-serif',
                          fontSize: 9,
                          color: 'var(--text-mute)',
                          textAlign: 'right',
                        }}
                      >
                        {counts.done} / {counts.total} 업무
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}

          {currentKrs.length < 5 && (
            <button
              onClick={handleAddKr}
              style={{
                background: 'transparent',
                border: '1px dashed var(--border)',
                borderRadius: 6,
                padding: '6px 8px',
                fontSize: 11,
                color: 'var(--text-mute)',
                fontFamily: 'NoonnuGothic, Pretendard, sans-serif',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
              }}
            >
              <Plus size={11} /> KR 추가
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────
// 헬퍼 함수
// ─────────────────────────────────────────

function getCurrentQuarter() {
  const now = new Date();
  const year = now.getFullYear();
  const q = Math.floor(now.getMonth() / 3) + 1;
  return `${year}-Q${q}`;
}

// wsData = { '2026-04-27': { tasks: [...], evening: '' }, ... }
// 모든 날짜의 task를 한 배열로 모음
function collectAllTasks(wsData) {
  if (!wsData) return [];
  const all = [];
  Object.keys(wsData).forEach((dateKey) => {
    const tasks = wsData[dateKey]?.tasks || [];
    tasks.forEach((t) => all.push(t));
  });
  return all;
}

function newId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : String(Date.now() + Math.random());
}
