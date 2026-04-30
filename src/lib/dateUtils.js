export const todayKey = (d = new Date()) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const keyToDate = (key) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const formatDate = (key) => {
  const date = keyToDate(key);
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  return `${date.getMonth() + 1}월 ${date.getDate()}일 ${days[date.getDay()]}요일`;
};

export const formatShort = (key) => {
  const [, m, d] = key.split('-');
  return `${+m}/${+d}`;
};

// 이월 대상일 (移越 對象日) - 무조건 다음날 (요일 구분 없음)
// v2.2 이전: 평일/주말 분리 → v2.2 이후: 월~일 연속(連續) 이월
export const getCarryTarget = (key) => {
  const date = keyToDate(key);
  const next = new Date(date);
  next.setDate(date.getDate() + 1);
  return todayKey(next);
};

export const isWeekend = (key) => {
  const d = keyToDate(key).getDay();
  return d === 0 || d === 6;
};

export const getWeekKeys = (dateKey) => {
  const date = keyToDate(dateKey);
  const day = date.getDay();
  const monday = new Date(date);
  monday.setDate(date.getDate() - ((day + 6) % 7));
  const keys = [];
  for (let i = 0; i < 7; i++) {
    const dt = new Date(monday);
    dt.setDate(monday.getDate() + i);
    keys.push(todayKey(dt));
  }
  return keys;
};

export const QUADRANTS = {
  Q1: { id: 'Q1', label: 'Do First', sub: '긴급 · 중요', desc: 'Urgent & Important' },
  Q2: { id: 'Q2', label: 'Schedule', sub: '중요 · 비긴급', desc: 'Important, Not Urgent' },
  Q3: { id: 'Q3', label: 'Delegate', sub: '긴급 · 비중요', desc: 'Urgent, Not Important' },
  Q4: { id: 'Q4', label: 'Eliminate', sub: '비긴급 · 비중요', desc: 'Neither' },
};
