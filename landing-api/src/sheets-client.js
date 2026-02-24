/**
 * Google Sheets API v4 클라이언트
 * 구글시트에 데이터 행 추가
 */

const SHEETS_API_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';

function formatKoreanDate(date) {
  return date.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
}

/**
 * 구글시트에 행 추가
 * 기존 Code.gs의 appendRow()와 동일한 컬럼 포맷 유지
 */
export async function appendToSheet(accessToken, env, data) {
  const sheetName = data.project || env.SHEET_NAME;
  const url = `${SHEETS_API_BASE}/${env.SHEET_ID}/values/${encodeURIComponent(sheetName)}!A:F:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;

  const row = [
    formatKoreanDate(new Date()),    // 제출일시
    data.name || '',                // 이름
    data.phone || '',               // 연락처
    data.email || '',               // 이메일
    data.privacy ? 'Y' : 'N',      // 개인정보동의
    '',                             // 버즈빌응답 (향후)
  ];

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ values: [row] }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`시트 저장 실패: ${response.status} ${error}`);
  }

  return await response.json();
}
