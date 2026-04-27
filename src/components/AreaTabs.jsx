/**
 * 업무·자기개발 분야 탭 (業務 · 自己開發)
 */
export const AREAS = {
  work: { id: 'work', name: '업무', hanja: '業務' },
  growth: { id: 'growth', name: '자기개발', hanja: '自己開發' },
};

export const AREA_IDS = ['work', 'growth'];

export default function AreaTabs({ currentArea, onChange, colors }) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 4,
        background: colors.surface,
        borderRadius: 6,
        padding: 4,
        border: `1px solid ${colors.border}`,
      }}
    >
      {AREA_IDS.map((id) => {
        const a = AREAS[id];
        const selected = currentArea === id;
        return (
          <div
            key={id}
            onClick={() => onChange(id)}
            style={{
              background: selected ? colors.primarySoft : 'transparent',
              color: selected ? colors.primary : colors.textTertiary,
              padding: '7px 14px',
              borderRadius: 4,
              fontSize: 11,
              fontWeight: selected ? 500 : 400,
              cursor: 'pointer',
              userSelect: 'none',
              transition: 'all 0.15s ease',
            }}
          >
            {a.name}{' '}
            <span style={{ fontSize: 9, opacity: 0.7 }}>{a.hanja}</span>
          </div>
        );
      })}
    </div>
  );
}
