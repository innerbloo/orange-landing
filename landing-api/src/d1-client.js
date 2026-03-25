/**
 * D1 클라이언트 — 중복 체크 + 원본 저장 + 에러 로깅
 */

function formatKoreanDate(date) {
  return date.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
}

/**
 * 랜딩별 연락처 중복 체크
 */
export async function isDuplicate(db, project, phone) {
  const result = await db.prepare(
    'SELECT id FROM submissions WHERE project = ? AND phone = ?'
  ).bind(project, phone).first();

  return !!result;
}

/**
 * D1에 제출 데이터 저장
 */
export async function saveToD1(db, project, phone, fields) {
  await db.prepare(
    'INSERT INTO submissions (project, phone, fields, created_at) VALUES (?, ?, ?, ?)'
  ).bind(project, phone, JSON.stringify(fields), formatKoreanDate(new Date())).run();
}

/**
 * D1에 에러 로그 저장
 */
export async function logError(db, message, url) {
  await db.prepare(
    'INSERT INTO error_logs (message, url, created_at) VALUES (?, ?, ?)'
  ).bind(message, url, formatKoreanDate(new Date())).run();
}

/**
 * 프로젝트별 D1 제출 데이터 조회
 */
export async function getSubmissions(db, project) {
  const { results } = await db.prepare(
    'SELECT project, phone, fields, created_at FROM submissions WHERE project = ? ORDER BY id ASC'
  ).bind(project).all();

  return results;
}
