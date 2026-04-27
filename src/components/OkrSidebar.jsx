import { useState } from 'react';

/**
 * OKR 사이드바 (分期 目標 + 主要 結果)
 * Objective 1개 + KR 최대 5개
 */
export default function OkrSidebar({ objective, keyResults, onObjectiveChange, onKrChange, onKrAdd, onKrDelete, colors, tasks }) {
  const [editingObj, setEditingObj] = useState(false);
  const [objText, setObjText] = useState(objective?.title || '');
  const [editingKrId, setEditingKrId] = useState(null);

  function handleObjSave() {
    onObjectiveChange({ ...objective, title: objText });
    setEditingObj(false);
  }

  // KR별 진척률 계산: 해당 KR 태그가 붙은 업무 중 완료된 업무 비율
  function calculateKrProgress(krId) {
    if (!tasks || tasks.length === 0) return 0;
    const tagged = tasks.filter((t) => t.kr_id === krId);
    if (tagged.length === 0) return 0;
    const done = tagged.filter((t) => t.completed).length;
    return Math.round((done / tagged.length) * 100);
  }

  return (
    <div>
      <div style={{ fontSize: 12, color: colors.textPrimary, fontWeight: 500, marginBottom: 2 }}>
        분기 목표
      </div>
      <div style={{ fontSize: 9, color: colors.primary, letterSpacing: 0.8, marginBottom: 8 }}>
        {getCurrentQuarter()} · 分期 目標
      </div>

      {/* Objective */}
      {editingObj ? (
        <div style={{ marginBottom: 8 }}>
          <textarea
            value={objText}
            onChange={(e) => setObjText(e.target.value)}
            onBlur={handleObjSave}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleObjSave())}
            autoFocus
            style={{
              width: '100%',
              background: colors.taskBg,
              border: `1px solid ${colors.primary}`,
              borderRadius: 6,
              padding: '8px 10px',
              fontSize: 11,
              color: colors.textPrimary,
              fontFamily: 'inherit',
              resize: 'none',
              minHeight: 50,
              outline: 'none',
            }}
          />
        </div>
      ) : (
        <div
          onClick={() => {
            setObjText(objective?.title || '');
            setEditingObj(true);
          }}
          style={{
            background: colors.primaryDim,
            borderLeft: `2px solid ${colors.primary}`,
            borderRadius: '0 6px 6px 0',
            padding: '9px 10px',
            marginBottom: 10,
            cursor: 'pointer',
            minHeight: 36,
          }}
        >
          <div style={{ fontSize: 11, color: colors.textPrimary, lineHeight: 1.4 }}>
            {objective?.title || '클릭하여 분기 목표 설정'}
          </div>
        </div>
      )}

      {/* Key Results */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {keyResults.map((kr, idx) => {
          const progress = calculateKrProgress(kr.id);
          const isEditing = editingKrId === kr.id;

          return (
            <div
              key={kr.id}
              style={{
                background: colors.taskBg,
                borderRadius: 5,
                padding: '6px 8px',
                position: 'relative',
              }}
            >
              {isEditing ? (
                <input
                  type="text"
                  defaultValue={kr.title}
                  autoFocus
                  onBlur={(e) => {
                    onKrChange(kr.id, { ...kr, title: e.target.value });
                    setEditingKrId(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      onKrChange(kr.id, { ...kr, title: e.target.value });
                      setEditingKrId(null);
                    }
                    if (e.key === 'Escape') setEditingKrId(null);
                  }}
                  style={{
                    width: '100%',
                    background: 'transparent',
                    border: `1px solid ${colors.primary}`,
                    borderRadius: 3,
                    padding: '2px 4px',
                    fontSize: 10,
                    color: colors.textPrimary,
                    fontFamily: 'inherit',
                    outline: 'none',
                  }}
                />
              ) : (
                <>
                  <div
                    onClick={() => setEditingKrId(kr.id)}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: 10,
                      marginBottom: 3,
                      cursor: 'pointer',
                    }}
                  >
                    <span style={{ color: colors.textSecondary, flex: 1 }}>{kr.title || `KR-${idx + 1}`}</span>
                    <span style={{ color: colors.textPrimary, fontWeight: 500 }}>{progress}%</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: 8, color: colors.primary }}>KR-{idx + 1}</div>
                    <div
                      onClick={() => {
                        if (confirm(`KR-${idx + 1}을(를) 삭제할까요?`)) onKrDelete(kr.id);
                      }}
                      style={{
                        fontSize: 9,
                        color: colors.textMuted,
                        cursor: 'pointer',
                        padding: '0 2px',
                      }}
                      title="삭제"
                    >
                      ×
                    </div>
                  </div>
                  <div style={{ height: 3, background: colors.border, borderRadius: 2, marginTop: 4 }}>
                    <div
                      style={{
                        width: `${progress}%`,
                        height: '100%',
                        background: colors.primary,
                        borderRadius: 2,
                        transition: 'width 0.3s ease',
                      }}
                    />
                  </div>
                </>
              )}
            </div>
          );
        })}

        {keyResults.length < 5 && (
          <div
            onClick={onKrAdd}
            style={{
              fontSize: 10,
              color: colors.textTertiary,
              padding: '6px 8px',
              textAlign: 'center',
              border: `1px dashed ${colors.border}`,
              borderRadius: 5,
              cursor: 'pointer',
            }}
          >
            + KR 추가
          </div>
        )}
      </div>
    </div>
  );
}

function getCurrentQuarter() {
  const now = new Date();
  const year = now.getFullYear();
  const quarter = Math.floor(now.getMonth() / 3) + 1;
  return `${year} Q${quarter}`;
}
