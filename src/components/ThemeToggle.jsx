import { useState, useRef, useEffect } from 'react';
import { THEMES, THEME_IDS, DEFAULT_ACCENT } from '../lib/themes';

/**
 * 테마 전환 토글 (主題 切換)
 * 우측 상단 아이콘 버튼, 클릭 시 드롭다운으로 테마/색상 선택
 */
export default function ThemeToggle({ themeId, accentId, onChange, colors }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // 외부 클릭 시 닫기
  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [open]);

  const currentTheme = THEMES[themeId];
  const accents = currentTheme ? Object.values(currentTheme.accents) : [];

  function handleThemeSelect(newThemeId) {
    const newAccentId = DEFAULT_ACCENT[newThemeId];
    onChange(newThemeId, newAccentId);
  }

  function handleAccentSelect(newAccentId) {
    onChange(themeId, newAccentId);
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(!open)}
        title="테마 변경"
        style={{
          width: 34,
          height: 34,
          background: colors.surface,
          border: `1px solid ${colors.border}`,
          borderRadius: 6,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          padding: 0,
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={colors.textSecondary} strokeWidth="2">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 3a9 9 0 0 1 0 18z" fill={colors.textSecondary} />
        </svg>
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 40,
            right: 0,
            background: colors.surface,
            border: `1px solid ${colors.border}`,
            borderRadius: 8,
            padding: 12,
            width: 240,
            zIndex: 100,
            boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
          }}
        >
          {/* 테마 선택 */}
          <div style={{ fontSize: 11, color: colors.textPrimary, fontWeight: 500, marginBottom: 2 }}>
            테마 선택
          </div>
          <div style={{ fontSize: 9, color: colors.textTertiary, letterSpacing: 0.5, marginBottom: 8 }}>
            主題
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
            {THEME_IDS.map((tid) => {
              const t = THEMES[tid];
              const selected = tid === themeId;
              return (
                <div
                  key={tid}
                  onClick={() => handleThemeSelect(tid)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: 7,
                    background: selected ? colors.primaryDim : 'transparent',
                    borderRadius: 4,
                    border: selected ? `1px solid ${colors.primary}` : '1px solid transparent',
                    cursor: 'pointer',
                  }}
                >
                  <div
                    style={{
                      width: 18,
                      height: 18,
                      background: t.base.bg,
                      border: `1px solid ${t.base.border}`,
                      borderRadius: 3,
                    }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, color: colors.textPrimary, fontWeight: selected ? 500 : 400 }}>
                      {t.name}
                    </div>
                    <div style={{ fontSize: 9, color: colors.textTertiary, marginTop: 1 }}>
                      {t.hanja}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 강조 색상 선택 */}
          <div style={{ borderTop: `1px solid ${colors.border}`, paddingTop: 10 }}>
            <div style={{ fontSize: 11, color: colors.textPrimary, fontWeight: 500, marginBottom: 2 }}>
              강조 색상
            </div>
            <div style={{ fontSize: 9, color: colors.textTertiary, letterSpacing: 0.5, marginBottom: 8 }}>
              强調 色
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {accents.map((acc) => {
                const selected = acc.id === accentId;
                return (
                  <div
                    key={acc.id}
                    onClick={() => handleAccentSelect(acc.id)}
                    style={{
                      flex: 1,
                      padding: '7px 4px',
                      background: selected ? colors.primaryDim : 'transparent',
                      border: selected ? `1px solid ${acc.primary}` : `1px solid ${colors.border}`,
                      borderRadius: 4,
                      textAlign: 'center',
                      cursor: 'pointer',
                    }}
                  >
                    <div
                      style={{
                        width: 16,
                        height: 16,
                        background: acc.primary,
                        borderRadius: '50%',
                        margin: '0 auto 4px',
                      }}
                    />
                    <div style={{ fontSize: 9, color: colors.textPrimary, fontWeight: selected ? 500 : 400 }}>
                      {acc.name}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
