import { useState } from 'react';
import { Plus, X, GripVertical } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

/**
 * OKR 사이드바 (分期 目標 + 主要 結果) v2.2
 * - KR 드래그로 순서 변경 가능
 * - KR-N 라벨은 표시 순서대로 자동 부여
 * - order_index로 정렬 영구 저장
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

  const currentObjective = (objectives || []).find(
    (o) => (o.workspace || 'work') === workspace && o.quarter === quarter
  );

  const currentKrs = currentObjective
    ? (keyResults || [])
        .filter((kr) => kr.objective_id === currentObjective.id)
        .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
    : [];

  const [editingObj, setEditingObj] = useState(false);
  const [objText, setObjText] = useState(currentObjective?.title || '');
  const [editingKrId, setEditingKrId] = useState(null);
  const [editingKrText, setEditingKrText] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  function calculateKrProgress(krId) {
    const allTasks = collectAllTasks(wsData);
    const tagged = allTasks.filter((t) => t.kr_id === krId);
    if (tagged.length === 0) return 0;
    const done = tagged.filter((t) => t.done).length;
    return Math.round((done / tagged.length) * 100);
  }

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

  // DnD 종료 - 순서 재배치
  async function handleDragEnd(event) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = currentKrs.findIndex((kr) => kr.id === active.id);
    const newIndex = currentKrs.findIndex((kr) => kr.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const reordered = arrayMove(currentKrs, oldIndex, newIndex);

    for (let i = 0; i < reordered.length; i++) {
      const kr = reordered[i];
      if (kr.order_index !== i) {
        await onKeyResultSave({ ...kr, order_index: i });
      }
    }
  }

  return (
    <div>
      <div className="nav-label-row">
        <span className="nav-label" style={{ marginBottom: 0 }}>
          분기 목표 · 分期 目標
        </span>
        <span style={{
          fontFamily: 'Inter, sans-serif',
          fontSize: 9, fontWeight: 600,
          color: 'var(--text-mute)',
          letterSpacing: '0.05em',
        }}>
          {quarter}
        </span>
      </div>

      {/* Objective */}
      <div style={{
        padding: '10px 12px',
        background: 'var(--panel2)',
        border: '1px solid var(--border)',
        borderLeft: currentObjective?.title ? '3px solid var(--accent)' : '1px solid var(--border)',
        borderRadius: 8,
        marginBottom: 10,
      }}>
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

      {/* KR 리스트 - DnD 정렬 */}
      {currentObjective && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={currentKrs.map((kr) => kr.id)}
            strategy={verticalListSortingStrategy}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {currentKrs.map((kr, idx) => (
                <SortableKr
                  key={kr.id}
                  kr={kr}
                  idx={idx}
                  isEditing={editingKrId === kr.id}
                  editingText={editingKrText}
                  setEditingText={setEditingKrText}
                  onStartEdit={(t) => {
                    setEditingKrId(kr.id);
                    setEditingKrText(t || '');
                  }}
                  onCancelEdit={() => {
                    setEditingKrId(null);
                    setEditingKrText('');
                    if (!kr.title) onKeyResultDelete(kr.id);
                  }}
                  onSave={() => handleKrSave(kr)}
                  onDelete={() => handleKrDelete(kr.id)}
                  progress={calculateKrProgress(kr.id)}
                  counts={countKrTasks(kr.id)}
                />
              ))}

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
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}

// 드래그 가능한 KR 한 줄
function SortableKr({
  kr, idx, isEditing, editingText, setEditingText,
  onStartEdit, onCancelEdit, onSave, onDelete,
  progress, counts,
}) {
  const {
    attributes, listeners, setNodeRef,
    transform, transition, isDragging,
  } = useSortable({ id: kr.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 10 : 'auto',
  };

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        background: 'var(--panel2)',
        border: '1px solid var(--border-soft)',
        borderRadius: 6,
        padding: '6px 8px',
      }}
    >
      {isEditing ? (
        <input
          type="text"
          value={editingText}
          onChange={(e) => setEditingText(e.target.value)}
          onBlur={onSave}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onSave();
            if (e.key === 'Escape') onCancelEdit();
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
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            marginBottom: 4,
          }}>
            {/* 드래그 핸들 */}
            <button
              {...attributes}
              {...listeners}
              title="드래그하여 순서 변경 (移動)"
              style={{
                background: 'transparent',
                border: 'none',
                padding: 0,
                cursor: 'grab',
                color: 'var(--text-mute)',
                display: 'flex',
                alignItems: 'center',
                touchAction: 'none',
              }}
            >
              <GripVertical size={11} />
            </button>

            <div
              onClick={() => onStartEdit(kr.title || '')}
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
              <span style={{
                fontFamily: 'Inter, sans-serif',
                fontSize: 9,
                fontWeight: 600,
                color: 'var(--accent)',
                marginRight: 4,
              }}>
                KR-{idx + 1}
              </span>
              {kr.title || <span style={{ color: 'var(--text-mute)' }}>이름 없음</span>}
            </div>

            <span style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: 11,
              fontWeight: 600,
              color: 'var(--text-dim)',
            }}>
              {progress}%
            </span>

            <button
              onClick={onDelete}
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

          <div style={{
            height: 3,
            background: 'var(--border)',
            borderRadius: 2,
            overflow: 'hidden',
          }}>
            <div style={{
              width: `${progress}%`,
              height: '100%',
              background: 'var(--accent)',
              transition: 'width 0.3s ease',
            }} />
          </div>

          {counts.total > 0 && (
            <div style={{
              marginTop: 3,
              fontFamily: 'Inter, sans-serif',
              fontSize: 9,
              color: 'var(--text-mute)',
              textAlign: 'right',
            }}>
              {counts.done} / {counts.total} 업무
            </div>
          )}
        </>
      )}
    </div>
  );
}

// 헬퍼 함수
function getCurrentQuarter() {
  const now = new Date();
  const year = now.getFullYear();
  const q = Math.floor(now.getMonth() / 3) + 1;
  return `${year}-Q${q}`;
}

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
