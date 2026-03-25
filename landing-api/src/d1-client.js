/**
 * D1 클라이언트 — 중복 체크 + 원본 저장
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
