// 한국 공휴일 (公休日) 정적 데이터
// 2026년 기준, 매년 갱신 필요
// 음력 기반 공휴일은 양력 변환된 날짜로 등록

export const KOREAN_HOLIDAYS = {
  '2026-01-01': { name: '신정', hanja: '新正' },
  '2026-02-16': { name: '설날 연휴', hanja: '舊正' },
  '2026-02-17': { name: '설날', hanja: '舊正' },
  '2026-02-18': { name: '설날 연휴', hanja: '舊正' },
  '2026-03-01': { name: '삼일절', hanja: '三一節' },
  '2026-03-02': { name: '삼일절 대체공휴일', hanja: '代替' },
  '2026-05-01': { name: '근로자의 날', hanja: '勤勞日' },
  '2026-05-05': { name: '어린이날', hanja: '兒童日' },
  '2026-05-24': { name: '부처님오신날', hanja: '釋誕日' },
  '2026-05-25': { name: '부처님오신날 대체', hanja: '代替' },
  '2026-06-06': { name: '현충일', hanja: '顯忠日' },
  '2026-08-15': { name: '광복절', hanja: '光復節' },
  '2026-08-17': { name: '광복절 대체공휴일', hanja: '代替' },
  '2026-09-24': { name: '추석 연휴', hanja: '秋夕' },
  '2026-09-25': { name: '추석', hanja: '秋夕' },
  '2026-09-26': { name: '추석 연휴', hanja: '秋夕' },
  '2026-10-03': { name: '개천절', hanja: '開天節' },
  '2026-10-05': { name: '개천절 대체공휴일', hanja: '代替' },
  '2026-10-09': { name: '한글날', hanja: '한글날' },
  '2026-12-25': { name: '성탄절', hanja: '聖誕節' },

  '2027-01-01': { name: '신정', hanja: '新正' },
  '2027-02-06': { name: '설날 연휴', hanja: '舊正' },
  '2027-02-07': { name: '설날', hanja: '舊正' },
  '2027-02-08': { name: '설날 연휴', hanja: '舊正' },
  '2027-03-01': { name: '삼일절', hanja: '三一節' },
  '2027-05-01': { name: '근로자의 날', hanja: '勤勞日' },
  '2027-05-05': { name: '어린이날', hanja: '兒童日' },
  '2027-05-13': { name: '부처님오신날', hanja: '釋誕日' },
  '2027-06-06': { name: '현충일', hanja: '顯忠日' },
  '2027-08-15': { name: '광복절', hanja: '光復節' },
  '2027-09-14': { name: '추석 연휴', hanja: '秋夕' },
  '2027-09-15': { name: '추석', hanja: '秋夕' },
  '2027-09-16': { name: '추석 연휴', hanja: '秋夕' },
  '2027-10-03': { name: '개천절', hanja: '開天節' },
  '2027-10-09': { name: '한글날', hanja: '한글날' },
  '2027-12-25': { name: '성탄절', hanja: '聖誕節' },
};

/**
 * 특정 날짜가 공휴일인지 확인
 * @param {Date} date
 * @returns {{name: string, hanja: string} | null}
 */
export function getHoliday(date) {
  const key = formatDateKey(date);
  return KOREAN_HOLIDAYS[key] || null;
}

/**
 * 날짜의 종류 반환 (공휴일 / 일요일 / 토요일 / 평일)
 * @param {Date} date
 * @returns {'holiday' | 'sunday' | 'saturday' | 'weekday'}
 */
export function getDayType(date) {
  const holiday = getHoliday(date);
  if (holiday) return 'holiday';
  const day = date.getDay();
  if (day === 0) return 'sunday';
  if (day === 6) return 'saturday';
  return 'weekday';
}

/**
 * 날짜 포맷: YYYY-MM-DD
 * @param {Date} date
 * @returns {string}
 */
function formatDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
