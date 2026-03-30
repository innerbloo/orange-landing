/**
 * Google Sheets API v4 클라이언트
 * 구글시트에 데이터 행 추가 (동적 필드 지원)
 */

const SHEETS_API_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';

function formatKoreanDate(date) {
  return date.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
}

/**
 * 시트 첫 행을 읽어서 헤더 반환. 비어있으면 헤더 생성.
 */
async function ensureHeader(sheetId, sheetName, fieldKeys, headers) {
  const range = encodeURIComponent(sheetName) + '!1:1';
  const url = `${SHEETS_API_BASE}/${sheetId}/values/${range}`;
  const res = await fetch(url, { headers });

  if (!res.ok) return null;

  const data = await res.json();

  // 이미 헤더가 있으면 그대로 반환
  if (data.values && data.values.length > 0 && data.values[0].length > 0) {
    return data.values[0];
  }

  // 헤더 생성: 제출일시 + fields 키들
  const header = ['제출일시', ...fieldKeys];
  const putUrl = `${SHEETS_API_BASE}/${sheetId}/values/${encodeURIComponent(sheetName)}!A1?valueInputOption=USER_ENTERED`;
  await fetch(putUrl, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ values: [header] }),
  });

  return header;
}

/**
 * 구글시트에 행 추가 (동적 필드)
 *
 * data 구조:
 * {
 *   sheetId: "시트ID" (선택, 없으면 env.SHEET_ID),
 *   project: "탭이름" (선택, 없으면 env.SHEET_NAME),
 *   fields: { "이름": "홍길동", "연락처": "010-..." }
 * }
 */
/**
 * gid로 시트 메타데이터를 조회하여 현재 탭 이름 반환
 */
async function getSheetNameByGid(sheetId, gid, headers) {
  const url = `${SHEETS_API_BASE}/${sheetId}?fields=sheets.properties`;
  const res = await fetch(url, { headers });
  if (!res.ok) return null;

  const meta = await res.json();
  const sheet = meta.sheets?.find(s => s.properties.sheetId === gid);
  return sheet?.properties?.title || null;
}

export async function appendToSheet(accessToken, env, data) {
  const sheetId = data.sheetId || env.SHEET_ID;
  const sheetName = data.project || env.SHEET_NAME;
  const tabId = data.tabId;   // gid (숫자, 선택)
  const fields = data.fields || {};
  const fieldKeys = Object.keys(fields);

  const headers = {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  };

  // 헤더 확인/생성
  const existingHeader = await ensureHeader(sheetId, sheetName, fieldKeys, headers);

  // 헤더 순서에 맞춰 row 생성
  let row;
  if (existingHeader) {
    row = existingHeader.map((col) => {
      if (col === '제출일시') return formatKoreanDate(new Date());
      return fields[col] || '';
    });
  } else {
    row = [formatKoreanDate(new Date()), ...fieldKeys.map((k) => fields[k])];
  }

  const colCount = row.length;
  const colLetter = String.fromCharCode(64 + colCount); // 1=A, 2=B, ...
  const body = JSON.stringify({ values: [row] });

  // 1차: 탭 이름으로 저장 시도
  const url = `${SHEETS_API_BASE}/${sheetId}/values/${encodeURIComponent(sheetName)}!A:${colLetter}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
  const response = await fetch(url, { method: 'POST', headers, body });

  if (response.ok) {
    return await response.json();
  }

  // 2차: tabId(gid)가 있으면 현재 탭 이름 조회 후 재시도
  if (tabId != null) {
    const resolvedName = await getSheetNameByGid(sheetId, tabId, headers);
    if (resolvedName) {
      // 변경된 탭 이름으로 헤더 재확인
      const resolvedHeader = await ensureHeader(sheetId, resolvedName, fieldKeys, headers);
      let resolvedRow;
      if (resolvedHeader) {
        resolvedRow = resolvedHeader.map((col) => {
          if (col === '제출일시') return formatKoreanDate(new Date());
          return fields[col] || '';
        });
      } else {
        resolvedRow = row;
      }

      const resolvedBody = JSON.stringify({ values: [resolvedRow] });
      const resolvedColLetter = String.fromCharCode(64 + resolvedRow.length);
      const resolvedUrl = `${SHEETS_API_BASE}/${sheetId}/values/${encodeURIComponent(resolvedName)}!A:${resolvedColLetter}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
      const resolvedRes = await fetch(resolvedUrl, { method: 'POST', headers, body: resolvedBody });

      if (resolvedRes.ok) {
        console.log(`탭 이름 변경 감지: "${sheetName}" → "${resolvedName}" (gid: ${tabId})`);
        return await resolvedRes.json();
      }
    }
  }

  // 최종 폴백: 첫 번째 시트
  const fallbackUrl = `${SHEETS_API_BASE}/${sheetId}/values/A:${colLetter}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
  const fallbackResponse = await fetch(fallbackUrl, { method: 'POST', headers, body });

  if (!fallbackResponse.ok) {
    const error = await fallbackResponse.text();
    throw new Error(`시트 저장 실패: ${fallbackResponse.status} ${error}`);
  }

  return await fallbackResponse.json();
}
