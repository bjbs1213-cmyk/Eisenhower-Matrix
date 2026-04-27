/**
 * 1-3-5 Rule 카운터 (法則)
 *
 * 오늘의 큰일 1개, 중간 3개, 작은일 5개 한도(限度) 표시.
 * task의 size 필드(big/medium/small) 기준 집계.
 *
 * v2.1 호환:
 * - task.done(완료 여부) 기준으로 미완료 task만 집계
 * - size 필드는 v6에서 추가됨, 없으면 'small'로 처리
 *
 * @param {Array} tasks - 오늘의 task 배열 (이미 workspace + date 필터링 완료)
 */
export default function OneThreeFiveCounter({ tasks }) {
  // 미완료(未完了) task만 한도 카운트에 포함
  const pending = (tasks || []).filter((t) => !t.done);

  const big = pending.filter((t) => (t.size || 'small') === 'big').length;
  const medium = pending.filter((t) => (t.size || 'small') === 'medium').length;
  const small = pending.filter((t) => (t.size || 'small') === 'small').length;

  const items = [
    { label: '큰일', hanja: '大', count: big, limit: 1, color: 'q1' },
    { label: '중간', hanja: '中', count: medium, limit: 3, color: 'q2' },
    { label: '작은일', hanja: '小', count: small, limit: 5, color: 'q3' },
  ];

  // 한도 대비 색상: 0이면 mute, 한도 미만 success, 한도 초과 warn
  function getColor(count, limit) {
    if (count === 0) return 'var(--text-mute)';
    if (count > limit) return 'var(--warn)';
    if (count === limit) return 'var(--accent)';
    return 'var(--text-dim)';
  }

  return (
    <div
      style={{
        padding: '10px 12px',
        background: 'var(--panel2)',
        border: '1px solid var(--border)',
        borderRadius: 8,
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {items.map((it) => (
          <div
            key={it.label}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              fontFamily: 'NoonnuGothic, Pretendard, sans-serif',
              fontSize: 11,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span
                style={{
                  display: 'inline-block',
                  width: 14,
                  textAlign: 'center',
                  fontSize: 10,
                  color: 'var(--text-mute)',
                  fontFamily: 'Inter, sans-serif',
                }}
              >
                {it.hanja}
              </span>
              <span style={{ color: 'var(--text)' }}>{it.label}</span>
            </div>
            <div
              style={{
                fontFamily: 'Inter, sans-serif',
                fontSize: 11,
                fontWeight: 600,
                color: getColor(it.count, it.limit),
              }}
            >
              {it.count} / {it.limit}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
