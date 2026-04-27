// Theme definitions - v2.2
// 3 베이스 테마 (基底 主題) × 3 강조색 (强調 色) = 9가지 조합
//
// 시안 ① 미드나잇 포커스 (Midnight Focus, 深夜 集中) - 다크
// 시안 ② 종이 노트 (Warm Paper, 溫紙) - 따뜻한 라이트
// 시안 ③ 모더니즘 미니멀 (Modern Minimal, 簡潔) - 깨끗한 라이트
//
// 강조색 (强調 色):
//   - 미드나잇: 블루(靑) / 퍼플(紫) / 포레스트(林)
//   - 종이:     브라운(褐) / 올리브(綠褐) / 와인(葡)
//   - 모더니즘: 블랙(黑) / 네이비(藏靑) / 차콜(炭)
//
// 호환성 (互換性):
//   기존 v2.1 4계절 테마(spring/summer/autumn/winter)는 자동으로 새 테마로 매핑됨.
//   App.jsx는 theme.bg, theme.text, theme.q1 등 직접 키 접근 패턴 그대로 사용.

// ─────────────────────────────────────────────
// 강조색 변형 정의 (强調 色 變形)
// 각 베이스 테마는 동일한 q1~q4 사용, accent만 다름
// (4분면 색은 매트릭스 의미 식별자라 고정 - 變更 不可)
// ─────────────────────────────────────────────

const MIDNIGHT_BASE = {
  bg: '#0F1419',
  panel: '#161C24',
  panel2: '#1A2025',
  panel3: '#131820',
  border: '#1F2730',
  borderSoft: '#2A3340',
  text: '#FFFFFF',
  textDim: '#D8DDE6',
  textMute: '#6B7785',
  success: '#5FB3A0',
  warn: '#C4A35F',
  // 분면 색상 (基本)
  q1: '#D4554A',
  q2: '#4A90E2',
  q3: '#C4A35F',
  q4: '#6B7785',
};

const PAPER_BASE = {
  bg: '#F4EDE0',
  panel: '#EBE1CE',
  panel2: '#F4EDE0',
  panel3: '#FBF6EC',
  border: '#D4C4A8',
  borderSoft: '#E0D3B8',
  text: '#3D2F1F',
  textDim: '#6B5436',
  textMute: '#8B6F3F',
  success: '#2D5F4A',
  warn: '#B89B3F',
  q1: '#8B3A2E',
  q2: '#2D5F4A',
  q3: '#B89B3F',
  q4: '#6B5436',
};

const MINIMAL_BASE = {
  bg: '#FAFAF9',
  panel: '#FFFFFF',
  panel2: '#FAFAF9',
  panel3: '#F5F5F4',
  border: '#ECECEA',
  borderSoft: '#F0F0EE',
  text: '#1A1A1A',
  textDim: '#2C2C2A',
  textMute: '#888888',
  success: '#2D8A6B',
  warn: '#C08A2E',
  q1: '#D4554A',
  q2: '#4A90E2',
  q3: '#C4A35F',
  q4: '#888888',
};

// ─────────────────────────────────────────────
// 9가지 테마 (主題) 조합
// ─────────────────────────────────────────────

export const THEMES = {
  // ─── 시안 ① 미드나잇 포커스 (深夜 集中) ───
  'midnight-blue': {
    id: 'midnight-blue',
    name: '미드나잇 · 블루',
    nameEn: 'Midnight Blue',
    hanja: '深夜 靑',
    base: 'midnight',
    accentName: '블루',
    ...MIDNIGHT_BASE,
    accent: '#4A90E2',
  },
  'midnight-purple': {
    id: 'midnight-purple',
    name: '미드나잇 · 퍼플',
    nameEn: 'Midnight Purple',
    hanja: '深夜 紫',
    base: 'midnight',
    accentName: '퍼플',
    ...MIDNIGHT_BASE,
    accent: '#7D5FC3',
  },
  'midnight-forest': {
    id: 'midnight-forest',
    name: '미드나잇 · 포레스트',
    nameEn: 'Midnight Forest',
    hanja: '深夜 林',
    base: 'midnight',
    accentName: '포레스트',
    ...MIDNIGHT_BASE,
    accent: '#3A8A6B',
  },

  // ─── 시안 ② 종이 노트 (溫紙) ───
  'paper-brown': {
    id: 'paper-brown',
    name: '종이 · 브라운',
    nameEn: 'Paper Brown',
    hanja: '紙 褐',
    base: 'paper',
    accentName: '브라운',
    ...PAPER_BASE,
    accent: '#8B6F3F',
  },
  'paper-olive': {
    id: 'paper-olive',
    name: '종이 · 올리브',
    nameEn: 'Paper Olive',
    hanja: '紙 綠褐',
    base: 'paper',
    accentName: '올리브',
    ...PAPER_BASE,
    accent: '#6B7C3F',
  },
  'paper-wine': {
    id: 'paper-wine',
    name: '종이 · 와인',
    nameEn: 'Paper Wine',
    hanja: '紙 葡',
    base: 'paper',
    accentName: '와인',
    ...PAPER_BASE,
    accent: '#7A3A45',
  },

  // ─── 시안 ③ 모더니즘 미니멀 (簡潔) ───
  'minimal-black': {
    id: 'minimal-black',
    name: '모더니즘 · 블랙',
    nameEn: 'Minimal Black',
    hanja: '簡潔 黑',
    base: 'minimal',
    accentName: '블랙',
    ...MINIMAL_BASE,
    accent: '#1A1A1A',
  },
  'minimal-navy': {
    id: 'minimal-navy',
    name: '모더니즘 · 네이비',
    nameEn: 'Minimal Navy',
    hanja: '簡潔 藏靑',
    base: 'minimal',
    accentName: '네이비',
    ...MINIMAL_BASE,
    accent: '#1F3A5F',
  },
  'minimal-charcoal': {
    id: 'minimal-charcoal',
    name: '모더니즘 · 차콜',
    nameEn: 'Minimal Charcoal',
    hanja: '簡潔 炭',
    base: 'minimal',
    accentName: '차콜',
    ...MINIMAL_BASE,
    accent: '#3D3D3D',
  },
};

// ─────────────────────────────────────────────
// 베이스 테마 그룹 (基底 主題 群)
// 토글 UI에서 두 단계 선택용 (베이스 → 강조색)
// ─────────────────────────────────────────────

export const THEME_GROUPS = {
  midnight: {
    id: 'midnight',
    name: '미드나잇 포커스',
    nameEn: 'Midnight Focus',
    hanja: '深夜 集中',
    description: '차분하고 전문적인 야간 작업용',
    isDark: true,
    sampleBg: '#0F1419',
    accents: [
      { id: 'midnight-blue', name: '블루', hanja: '靑', color: '#4A90E2' },
      { id: 'midnight-purple', name: '퍼플', hanja: '紫', color: '#7D5FC3' },
      { id: 'midnight-forest', name: '포레스트', hanja: '林', color: '#3A8A6B' },
    ],
  },
  paper: {
    id: 'paper',
    name: '종이 노트',
    nameEn: 'Warm Paper',
    hanja: '溫紙',
    description: '따뜻하고 아날로그한 분위기',
    isDark: false,
    sampleBg: '#F4EDE0',
    accents: [
      { id: 'paper-brown', name: '브라운', hanja: '褐', color: '#8B6F3F' },
      { id: 'paper-olive', name: '올리브', hanja: '綠褐', color: '#6B7C3F' },
      { id: 'paper-wine', name: '와인', hanja: '葡', color: '#7A3A45' },
    ],
  },
  minimal: {
    id: 'minimal',
    name: '모더니즘 미니멀',
    nameEn: 'Modern Minimal',
    hanja: '簡潔',
    description: '깨끗하고 발표용으로 적합한 라이트 테마',
    isDark: false,
    sampleBg: '#FAFAF9',
    accents: [
      { id: 'minimal-black', name: '블랙', hanja: '黑', color: '#1A1A1A' },
      { id: 'minimal-navy', name: '네이비', hanja: '藏靑', color: '#1F3A5F' },
      { id: 'minimal-charcoal', name: '차콜', hanja: '炭', color: '#3D3D3D' },
    ],
  },
};

export const THEME_GROUP_IDS = ['midnight', 'paper', 'minimal'];

// ─────────────────────────────────────────────
// 워크스페이스 (作業 區劃)
// ─────────────────────────────────────────────

export const WORKSPACES = {
  work: {
    id: 'work',
    label: '업무',
    hanja: '業務',
    emoji: '💼',
    defaultTheme: 'midnight-blue', // 업무: 차분한 야간 집중
  },
  self: {
    id: 'self',
    label: '자기개발',
    hanja: '自己開發',
    emoji: '🌱',
    defaultTheme: 'paper-olive', // 자기개발: 따뜻한 종이 + 자연색
  },
};

// ─────────────────────────────────────────────
// 레거시 호환 (互換) - v2.1 4계절 테마 매핑
// localStorage에 'winter', 'spring' 등이 저장된 경우 자동 변환
// ─────────────────────────────────────────────

export const LEGACY_THEME_MAP = {
  winter: 'midnight-blue',  // 차분한 겨울 → 미드나잇 블루
  spring: 'paper-olive',    // 따뜻한 봄 → 종이 올리브 (자기개발 기본)
  summer: 'minimal-navy',   // 시원한 여름 → 모더니즘 네이비
  autumn: 'paper-brown',    // 깊은 가을 → 종이 브라운
};

/**
 * 레거시 또는 알 수 없는 테마 ID를 안전하게 매핑
 * @param {string} themeId
 * @returns {string} 유효한 v2.2 테마 ID
 */
export function normalizeThemeId(themeId) {
  if (!themeId) return WORKSPACES.work.defaultTheme;
  // 이미 v2.2 테마면 그대로
  if (THEMES[themeId]) return themeId;
  // 레거시 매핑
  if (LEGACY_THEME_MAP[themeId]) return LEGACY_THEME_MAP[themeId];
  // 알 수 없는 값이면 기본값
  return WORKSPACES.work.defaultTheme;
}

/**
 * 테마 ID에서 베이스 그룹 추출
 * @param {string} themeId - 예: 'midnight-blue'
 * @returns {string} 'midnight' | 'paper' | 'minimal'
 */
export function getThemeGroup(themeId) {
  const theme = THEMES[normalizeThemeId(themeId)];
  return theme?.base || 'midnight';
}

/**
 * 베이스 그룹의 첫 번째 강조색 테마 ID 반환
 * @param {string} groupId - 'midnight' | 'paper' | 'minimal'
 * @returns {string} 테마 ID
 */
export function getDefaultThemeForGroup(groupId) {
  const group = THEME_GROUPS[groupId];
  return group?.accents[0]?.id || 'midnight-blue';
}
