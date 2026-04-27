import { getDayType, getHoliday } from '../lib/holidays';

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

/**
 * 1주(週) 요일 스트립
 * 월요일을 기준으로 7일 표시
 * 평일: 회색 / 토: 파란색 / 일: 빨간색 / 공휴일: 빨간색 + 언더라인
 */
export default function WeekStrip({ currentDate, onDateChange, colors }) {
  // 현재 날짜가 속한 주의 월요일 찾기
  const monday = getMondayOfWeek(currentDate);
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    days.push(d);
  }

  function handlePrev() {
    const prev = new Date(monday);
    prev.setDate(monday.getDate() - 7);
    onDateChange(prev);
  }

  function handleNext() {
    const next = new Date(monday);
    next.setDate(monday.getDate() + 7);
    onDateChange(next);
  }

  function isSameDay(a, b) {
    return (
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
    );
  }

  function getDayColor(date) {
    const type = getDayType(date);
    switch (type) {
      case 'saturday':
        return colors.saturday;
      case 'sunday':
      case 'holiday':
        return colors.sunday;
      default:
        return colors.textTertiary;
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        gap: 3,
        alignItems: 'center',
      }}
    >
      <span
        onClick={handlePrev}
        style={{
          fontSize: 12,
          color: colors.textTertiary,
          padding: '0 6px',
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        ‹
      </span>

      {days.map((d) => {
        const isToday = isSameDay(d, currentDate);
        const dayType = getDayType(d);
        const holiday = getHoliday(d);
        const dayLabel = DAY_LABELS[d.getDay()];
        const dayColor = getDayColor(d);
        const isHoliday = dayType === 'holiday';

        return (
          <div
            key={d.toISOString()}
            onClick={() => onDateChange(d)}
            title={holiday ? `${holiday.name} (${holiday.hanja})` : ''}
            style={{
              textAlign: 'center',
              padding: '4px 8px',
              minWidth: 32,
              background: isToday ? colors.primary : 'transparent',
              borderRadius: 4,
              cursor: 'pointer',
              position: 'relative',
            }}
          >
            <div
              style={{
                fontSize: 8,
                color: isToday ? '#fff' : dayColor,
                opacity: isToday ? 0.85 : 1,
              }}
            >
              {dayLabel}
            </div>
            <div
              style={{
                fontSize: 11,
                color: isToday ? '#fff' : dayColor,
                fontWeight: isToday ? 500 : 400,
                marginTop: 1,
                position: 'relative',
                display: 'inline-block',
                paddingBottom: isHoliday && !isToday ? 1 : 0,
                borderBottom: isHoliday && !isToday ? `1.5px solid ${colors.holiday}` : 'none',
              }}
            >
              {d.getDate()}
            </div>
          </div>
        );
      })}

      <span
        onClick={handleNext}
        style={{
          fontSize: 12,
          color: colors.textTertiary,
          padding: '0 6px',
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        ›
      </span>
    </div>
  );
}

/**
 * 주어진 날짜가 속한 주의 월요일 반환
 */
function getMondayOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0=일, 1=월, ..., 6=토
  const diff = day === 0 ? -6 : 1 - day; // 일요일이면 -6, 그 외엔 1-day
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}
