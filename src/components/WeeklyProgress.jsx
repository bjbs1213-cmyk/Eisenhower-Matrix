/**
 * 이번 주 진척도 (週間 進陟)
 * 이번 주 전체 업무 달성률 + 요일별 점/원 표시
 */
export default function WeeklyProgress({ tasks, currentDate, colors }) {
  const monday = getMondayOfWeek(currentDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    days.push(d);
  }

  const dayLabels = ['월', '화', '수', '목', '금', '토', '일'];

  // 이번 주 전체 진척률
  const weekTasks = tasks.filter((t) => {
    if (!t.date) return false;
    const td = new Date(t.date);
    return td >= monday && td < new Date(monday.getTime() + 7 * 24 * 60 * 60 * 1000);
  });

  const total = weekTasks.length;
  const done = weekTasks.filter((t) => t.completed).length;
  const overall = total === 0 ? 0 : Math.round((done / total) * 100);

  function getDayStatus(date) {
    const dayTasks = tasks.filter((t) => {
      if (!t.date) return false;
      const td = new Date(t.date);
      return (
        td.getFullYear() === date.getFullYear() &&
        td.getMonth() === date.getMonth() &&
        td.getDate() === date.getDate()
      );
    });

    if (date > today) return 'future';
    if (dayTasks.length === 0) return 'empty';
    const dayDone = dayTasks.filter((t) => t.completed).length;
    if (dayDone === dayTasks.length) return 'done';
    if (dayDone > 0) return 'partial';
    return 'pending';
  }

  function getStatusSymbol(status) {
    switch (status) {
      case 'done': return '●';
      case 'partial': return '◐';
      case 'pending': return '○';
      case 'empty': return '·';
      case 'future': return '·';
      default: return '·';
    }
  }

  function getStatusColor(status) {
    switch (status) {
      case 'done': return colors.success;
      case 'partial': return colors.warning;
      case 'pending': return colors.textSecondary;
      default: return colors.textMuted;
    }
  }

  return (
    <div style={{ background: colors.surfaceAlt, borderRadius: 6, padding: '9px 10px' }}>
      <div style={{ fontSize: 11, color: colors.textPrimary, fontWeight: 500, marginBottom: 2 }}>
        이번 주 진척도
      </div>
      <div style={{ fontSize: 9, color: colors.success, letterSpacing: 0.8, marginBottom: 6 }}>
        週間 進陟
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 10,
          marginBottom: 4,
        }}
      >
        <span style={{ color: colors.textSecondary }}>전체 달성률</span>
        <span style={{ color: colors.success, fontWeight: 500 }}>{overall}%</span>
      </div>
      <div
        style={{
          height: 4,
          background: colors.border,
          borderRadius: 2,
          marginBottom: 8,
        }}
      >
        <div
          style={{
            width: `${overall}%`,
            height: '100%',
            background: colors.success,
            borderRadius: 2,
            transition: 'width 0.3s ease',
          }}
        />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9 }}>
        {days.map((d, i) => {
          const status = getDayStatus(d);
          return (
            <span key={d.toISOString()} style={{ color: colors.textTertiary }}>
              {dayLabels[i]} <span style={{ color: getStatusColor(status) }}>{getStatusSymbol(status)}</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}

function getMondayOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}
