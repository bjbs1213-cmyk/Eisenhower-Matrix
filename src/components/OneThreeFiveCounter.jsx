/**
 * 1-3-5 Rule 카운터 (法則)
 * 큰일 1개, 중간 3개, 작은일 5개 한도
 * tasks 배열에서 size 필드(big/medium/small) 기준으로 집계
 */
export default function OneThreeFiveCounter({ tasks, colors }) {
  const todayTasks = tasks.filter((t) => !t.completed);

  const big = todayTasks.filter((t) => t.size === 'big').length;
  const medium = todayTasks.filter((t) => t.size === 'medium').length;
  const small = todayTasks.filter((t) => t.size === 'small').length;

  const items = [
    { label: '큰일', count: big, limit: 1 },
    { label: '중간', count: medium, limit: 3 },
    { label: '작은일', count: small, limit: 5 },
  ];

  function getColor(count, limit) {
    if (count === 0) return colors.textTertiary;
    if (count >= limit) return colors.danger;
    if (count >= limit * 0.7) return colors.warning;
    return colors.success;
  }

  return (
    <div style={{ background: colors.surfaceAlt, borderRadius: 6, padding: '9px 10px' }}>
      <div style={{ fontSize: 11, color: colors.textPrimary, fontWeight: 500, marginBottom: 2 }}>
        오늘의 한도
      </div>
      <div style={{ fontSize: 9, color: colors.warning, letterSpacing: 0.8, marginBottom: 6 }}>
        1-3-5 法則
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {items.map((it) => (
          <div
            key={it.label}
            style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10 }}
          >
            <span style={{ color: colors.textSecondary }}>{it.label}</span>
            <span style={{ color: getColor(it.count, it.limit), fontWeight: 500 }}>
              {it.count} / {it.limit}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
