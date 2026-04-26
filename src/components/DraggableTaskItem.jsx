import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Check, X, CornerDownRight, GripVertical, FileText, Calendar, ListChecks } from 'lucide-react';
import { keyToDate } from '../lib/dateUtils.js';

/**
 * 드래그 가능한 task 한 줄 (Draggable Task Row)
 * - useSortable: 같은 사분면 내 정렬 + 다른 사분면으로 이동 모두 지원
 * - 핸들(handle) 영역: 좌측 grip 아이콘 (모바일 친화)
 * - 체크박스/삭제 버튼은 드래그 안 됨 (이벤트 분리)
 * - 이월 (移越) 시각화: 좌측 색상 띠 + 뱃지 + 툴팁
 * - 상세 인디케이터 (詳細 表示): 메모/마감일/체크리스트 아이콘
 */

// 이월 정보 포맷팅 - 移越 情報
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const formatCarryBadge = (key) => {
  // 짧은 형식 (뱃지용): 25일(금)
  const dt = keyToDate(key);
  return `${dt.getDate()}일 (${WEEKDAYS[dt.getDay()]})`;
};
const formatCarryTooltip = (key) => {
  // 긴 형식 (툴팁용): 4월 25일 (금)에서 이월
  const dt = keyToDate(key);
  return `${dt.getMonth() + 1}월 ${dt.getDate()}일 (${WEEKDAYS[dt.getDay()]})에서 이월`;
};

// 며칠 전인지 계산 (X日 前)
const daysAgo = (key) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const past = keyToDate(key);
  past.setHours(0, 0, 0, 0);
  const diff = Math.round((today - past) / (1000 * 60 * 60 * 24));
  return diff;
};

// D-day 계산 - 카드용 짧은 라벨
const dDayLabel = (dueDate) => {
  if (!dueDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  const diff = Math.round((due - today) / (1000 * 60 * 60 * 24));
  if (diff === 0) return { label: 'D-day', tone: 'urgent' };
  if (diff < 0) return { label: `D+${Math.abs(diff)}`, tone: 'overdue' };
  if (diff <= 2) return { label: `D-${diff}`, tone: 'urgent' };
  if (diff <= 7) return { label: `D-${diff}`, tone: 'soon' };
  return { label: `D-${diff}`, tone: 'normal' };
};

export default function DraggableTaskItem({ task, qColor, onToggle, onDelete, onSelect }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    data: { type: 'task', task },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 100 : 'auto',
  };

  // 이월 여부 (移越 與否)
  const isCarried = !!task.carriedFromDate;
  const carriedDays = isCarried ? daysAgo(task.carriedFromDate) : 0;
  // 누적 이월 표시: 1일 → "어제", 2일 이상 → "X일 전"
  const carriedLabel = isCarried
    ? (carriedDays === 1 ? '어제' : `${carriedDays}일 전`)
    : '';

  // 상세 항목 표시 (詳細 項目 表示)
  const hasNotes = !!(task.notes && task.notes.trim());
  const dd = dDayLabel(task.due_date);
  const checklist = Array.isArray(task.checklist) ? task.checklist : [];
  const checklistDone = checklist.filter((c) => c.done).length;
  const checklistTotal = checklist.length;
  const tags = Array.isArray(task.tags) ? task.tags : [];

  // D-day 색상 매핑
  const ddTone = dd ? (
    dd.tone === 'overdue' || dd.tone === 'urgent' ? '#E66B5C'
    : dd.tone === 'soon' ? '#E6A65C'
    : qColor
  ) : null;

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        // 좌측 색상 띠 (左側 色相 帶) - 이월 업무 식별용
        ...(isCarried && {
          borderLeft: `3px solid ${qColor}`,
          paddingLeft: 8,
          background: `${qColor}08`, // 매우 연한 배경 (8 = ~3% opacity in hex)
        }),
      }}
      className={`task draggable-task ${isDragging ? 'is-dragging' : ''} ${isCarried ? 'is-carried' : ''}`}
      title={isCarried ? formatCarryTooltip(task.carriedFromDate) : undefined}
    >
      {/* 드래그 핸들 - 이 영역만 드래그 가능 */}
      <button
        className="task-handle"
        {...attributes}
        {...listeners}
        aria-label="드래그하여 이동"
        title="드래그하여 이동"
      >
        <GripVertical size={12} />
      </button>

      {/* 체크박스 - 클릭만, 드래그 X */}
      <button
        className="chk"
        style={{
          borderColor: qColor,
          background: task.done ? qColor : 'transparent',
        }}
        onClick={(e) => {
          e.stopPropagation();
          onToggle(task.id);
        }}
      >
        {task.done && <Check size={11} color="#FFF" strokeWidth={3} />}
      </button>

      {/* 텍스트 + 이월 뱃지 (移越 章) - 클릭 시 상세 패널 열림 */}
      <div
        className={`task-txt ${task.done ? 'done' : ''}`}
        onClick={(e) => {
          e.stopPropagation();
          onSelect?.(task.id);
        }}
        style={{ cursor: onSelect ? 'pointer' : 'default' }}
        title="클릭하여 상세 보기"
      >
        <span>{task.text}</span>
        {isCarried && (
          <span
            className="carry-badge"
            style={{
              color: qColor,
              borderColor: `${qColor}55`,
              background: `${qColor}12`,
            }}
            title={formatCarryTooltip(task.carriedFromDate)}
          >
            <CornerDownRight size={9} strokeWidth={2.5} />
            <span className="carry-badge-label">{carriedLabel}</span>
            <span className="carry-badge-date">· {formatCarryBadge(task.carriedFromDate)}</span>
          </span>
        )}
        {/* D-day 뱃지 (마감일 表示) */}
        {dd && (
          <span
            className="task-indicator dday-badge"
            style={{
              color: ddTone,
              borderColor: `${ddTone}66`,
              background: `${ddTone}18`,
            }}
            title={`마감일 ${task.due_date}`}
          >
            <Calendar size={9} strokeWidth={2.5} />
            <span>{dd.label}</span>
          </span>
        )}
        {/* 메모 있음 (備忘) */}
        {hasNotes && (
          <span
            className="task-indicator notes-icon"
            title="메모 있음"
            style={{ color: 'var(--text-mute)' }}
          >
            <FileText size={11} strokeWidth={2} />
          </span>
        )}
        {/* 체크리스트 진행률 (進行率) */}
        {checklistTotal > 0 && (
          <span
            className="task-indicator checklist-badge"
            title={`체크리스트 ${checklistDone}/${checklistTotal}`}
            style={{
              color: checklistDone === checklistTotal ? 'var(--success)' : 'var(--text-dim)',
              borderColor: 'var(--border)',
              background: 'var(--panel2)',
            }}
          >
            <ListChecks size={10} strokeWidth={2} />
            <span>{checklistDone}/{checklistTotal}</span>
          </span>
        )}
        {/* 태그 (標識) - 최대 2개만 카드에 표시 */}
        {tags.length > 0 && tags.slice(0, 2).map((tag) => (
          <span
            key={tag}
            className="task-indicator tag-badge"
            title={tag}
            style={{
              color: 'var(--text-dim)',
              borderColor: 'var(--border)',
              background: 'var(--panel2)',
            }}
          >
            #{tag.length > 6 ? tag.slice(0, 6) + '…' : tag}
          </span>
        ))}
        {tags.length > 2 && (
          <span
            className="task-indicator tag-badge"
            title={tags.slice(2).join(', ')}
            style={{
              color: 'var(--text-mute)',
              borderColor: 'var(--border)',
              background: 'var(--panel2)',
            }}
          >
            +{tags.length - 2}
          </span>
        )}
      </div>

      {/* 삭제 버튼 */}
      <button
        className="task-x"
        onClick={(e) => {
          e.stopPropagation();
          onDelete(task.id);
        }}
        aria-label="삭제"
      >
        <X size={13} />
      </button>
    </div>
  );
}