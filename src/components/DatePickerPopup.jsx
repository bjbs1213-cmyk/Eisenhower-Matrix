import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { todayKey, keyToDate } from '../lib/dateUtils.js';

/**
 * 팝업 월별 달력 (月別 達曆)
 * - 상단 날짜 영역 옆 📅 버튼 클릭 시 드롭다운 표시
 * - 업무 있는 날 점(●) 표시: 완료시 초록, 진행중 회색
 * - 날짜 클릭 시 해당 날짜로 이동
 * - 외부 클릭 또는 ESC 키로 닫힘
 */
export default function DatePickerPopup({ currentDate, setCurrentDate, wsData, onClose, mobile }) {
  const [viewMonth, setViewMonth] = useState(() => {
    const dt = keyToDate(currentDate);
    return { year: dt.getFullYear(), month: dt.getMonth() };
  });

  const popupRef = useRef(null);

  // 외부 클릭 & ESC 감지
  useEffect(() => {
    const onClickOutside = (e) => {
      if (popupRef.current && !popupRef.current.contains(e.target)) onClose();
    };
    const onEsc = (e) => {
      if (e.key === 'Escape') onClose();
    };
    // 다음 tick에 등록 (버튼 클릭이 바로 닫히지 않도록)
    const t = setTimeout(() => {
      document.addEventListener('mousedown', onClickOutside);
      document.addEventListener('keydown', onEsc);
    }, 0);
    return () => {
      clearTimeout(t);
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onEsc);
    };
  }, [onClose]);

  // 월 내 날짜 격자 생성 (6주 x 7일 = 42칸)
  const grid = useMemo(() => {
    const { year, month } = viewMonth;
    const first = new Date(year, month, 1);
    const firstDayIdx = (first.getDay() + 6) % 7; // 월요일 시작
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const cells = [];
    // 이전달 꼬리
    const prevMonthDays = new Date(year, month, 0).getDate();
    for (let i = firstDayIdx - 1; i >= 0; i--) {
      const day = prevMonthDays - i;
      const dt = new Date(year, month - 1, day);
      cells.push({ date: dt, inMonth: false });
    }
    // 이번달
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ date: new Date(year, month, d), inMonth: true });
    }
    // 다음달 머리 (42칸 채우기)
    const remaining = 42 - cells.length;
    for (let d = 1; d <= remaining; d++) {
      cells.push({ date: new Date(year, month + 1, d), inMonth: false });
    }
    return cells;
  }, [viewMonth]);

  const shiftMonth = (delta) => {
    setViewMonth((prev) => {
      const d = new Date(prev.year, prev.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  };

  const goToToday = () => {
    const dt = new Date();
    setViewMonth({ year: dt.getFullYear(), month: dt.getMonth() });
    setCurrentDate(todayKey(dt));
    onClose();
  };

  const handleSelect = (dt) => {
    setCurrentDate(todayKey(dt));
    onClose();
  };

  const today = todayKey();
  const weekdayNames = ['월', '화', '수', '목', '금', '토', '일'];
  const monthLabel = `${viewMonth.year}년 ${viewMonth.month + 1}월`;

  return (
    <>
      <style>{`
        .dp-popup {
          position: absolute;
          top: calc(100% + 8px);
          left: 0;
          z-index: 90;
          width: 320px;
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: 10px;
          box-shadow: 0 12px 40px -8px rgba(0,0,0,0.18);
          padding: 16px;
          animation: dp-fade 0.15s ease;
        }
        .dp-popup.mobile {
          left: 50%;
          transform: translateX(-50%);
          width: calc(100vw - 32px);
          max-width: 340px;
          animation: dp-fade-m 0.15s ease;
        }
        @keyframes dp-fade {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes dp-fade-m {
          from { opacity: 0; transform: translate(-50%, -4px); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }
        .dp-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 12px;
        }
        .dp-month-label {
          font-family: 'Lora', Georgia, serif;
          font-style: italic;
          font-weight: 600;
          font-size: 16px;
          color: var(--text);
        }
        .dp-nav {
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .dp-nav-btn {
          width: 28px;
          height: 28px;
          background: transparent;
          border: 1px solid var(--border);
          border-radius: 5px;
          color: var(--text-dim);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.15s;
        }
        .dp-nav-btn:hover {
          background: var(--panel2);
          color: var(--text);
        }
        .dp-weekdays {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 2px;
          margin-bottom: 6px;
        }
        .dp-wd {
          text-align: center;
          font-family: 'Inter', sans-serif;
          font-size: 10px;
          color: var(--text-mute);
          letter-spacing: 0.05em;
          padding: 4px 0;
        }
        .dp-wd.sun { color: var(--warn); opacity: 0.7; }
        .dp-grid {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 2px;
        }
        .dp-cell {
          aspect-ratio: 1;
          background: transparent;
          border: 1px solid transparent;
          border-radius: 6px;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 2px;
          padding: 0;
          font-family: 'Lora', Georgia, serif;
          font-weight: 500;
          font-size: 13px;
          color: var(--text);
          transition: all 0.1s;
          position: relative;
        }
        .dp-cell:hover {
          background: var(--panel2);
          border-color: var(--border);
        }
        .dp-cell.out {
          color: var(--text-mute);
          opacity: 0.4;
        }
        .dp-cell.today {
          border-color: var(--text);
          font-weight: 700;
        }
        .dp-cell.selected {
          background: var(--text);
          color: var(--bg);
          border-color: var(--text);
        }
        .dp-cell.selected:hover {
          background: var(--text);
          opacity: 0.9;
        }
        .dp-cell.sun:not(.selected):not(.out) {
          color: var(--warn);
        }
        .dp-dot {
          width: 5px;
          height: 5px;
          border-radius: 50%;
        }
        .dp-dot.done { background: var(--success); }
        .dp-dot.progress { background: var(--text-mute); }
        .dp-cell.selected .dp-dot.done,
        .dp-cell.selected .dp-dot.progress {
          background: var(--bg);
        }
        .dp-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-top: 12px;
          padding-top: 12px;
          border-top: 1px solid var(--border-soft);
        }
        .dp-today-btn {
          padding: 5px 12px;
          background: var(--panel2);
          border: 1px solid var(--border);
          border-radius: 5px;
          color: var(--text);
          font-family: 'NoonnuGothic', sans-serif;
          font-size: 12px;
          cursor: pointer;
          transition: all 0.15s;
        }
        .dp-today-btn:hover {
          background: var(--panel3);
        }
        .dp-legend {
          display: flex;
          align-items: center;
          gap: 10px;
          font-family: 'NoonnuGothic', sans-serif;
          font-size: 10px;
          color: var(--text-dim);
        }
        .dp-legend-item {
          display: inline-flex;
          align-items: center;
          gap: 3px;
        }
      `}</style>

      <div ref={popupRef} className={`dp-popup ${mobile ? 'mobile' : ''}`}>
        <div className="dp-head">
          <div className="dp-month-label">{monthLabel}</div>
          <div className="dp-nav">
            <button className="dp-nav-btn" onClick={() => shiftMonth(-1)} aria-label="이전 달">
              <ChevronLeft size={14} />
            </button>
            <button className="dp-nav-btn" onClick={() => shiftMonth(1)} aria-label="다음 달">
              <ChevronRight size={14} />
            </button>
            <button className="dp-nav-btn" onClick={onClose} aria-label="닫기">
              <X size={14} />
            </button>
          </div>
        </div>

        <div className="dp-weekdays">
          {weekdayNames.map((w, i) => (
            <div key={w} className={`dp-wd ${i === 6 ? 'sun' : ''}`}>{w}</div>
          ))}
        </div>

        <div className="dp-grid">
          {grid.map((cell, idx) => {
            const key = todayKey(cell.date);
            const tasks = wsData[key]?.tasks || [];
            const hasTasks = tasks.length > 0;
            const allDone = hasTasks && tasks.every((t) => t.done);
            const isToday = key === today;
            const isSelected = key === currentDate;
            const dayOfWeek = cell.date.getDay();
            const isSun = dayOfWeek === 0;

            let cls = 'dp-cell';
            if (!cell.inMonth) cls += ' out';
            if (isToday) cls += ' today';
            if (isSelected) cls += ' selected';
            if (isSun) cls += ' sun';

            return (
              <button
                key={idx}
                className={cls}
                onClick={() => handleSelect(cell.date)}
              >
                <span>{cell.date.getDate()}</span>
                {hasTasks && cell.inMonth && (
                  <div className={`dp-dot ${allDone ? 'done' : 'progress'}`} />
                )}
              </button>
            );
          })}
        </div>

        <div className="dp-footer">
          <div className="dp-legend">
            <span className="dp-legend-item">
              <span className="dp-dot done" /> 완료
            </span>
            <span className="dp-legend-item">
              <span className="dp-dot progress" /> 진행중
            </span>
          </div>
          <button className="dp-today-btn" onClick={goToToday}>오늘</button>
        </div>
      </div>
    </>
  );
}
