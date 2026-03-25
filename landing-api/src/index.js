/**
 * Cloudflare Worker — 랜딩페이지 폼 백엔드
 * Apps Script(Code.gs) 대체
 */

import { getAccessToken } from './google-auth.js';
import { appendToSheet } from './sheets-client.js';
// import { callBuzzvilApi } from './buzzvil-client.js'; // 향후 활성화

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return corsResponse(env, new Response(null, { status: 204 }));
    }

    // Router
    if (url.pathname === '/api/health' && request.method === 'GET') {
      return corsResponse(env, jsonResponse({ status: 'ok', message: 'Worker가 정상 작동 중입니다.' }));
    }

    if (url.pathname === '/api/submit' && request.method === 'POST') {
      return corsResponse(env, await handleSubmit(request, env));
    }

    return corsResponse(env, jsonResponse({ error: 'Not found' }, 404));
  },
};

/**
 * 폼 제출 처리
 */
async function handleSubmit(request, env) {
  try {
    // 1. Body 파싱
    let data;
    try {
      data = await request.json();
    } catch {
      return jsonResponse({ success: false, error: '잘못된 요청 형식입니다.' }, 400);
    }

    // 2. 입력 검증
    if (!data.fields || typeof data.fields !== 'object' || Object.keys(data.fields).length === 0) {
      return jsonResponse({ success: false, error: 'fields 항목이 필요합니다.' }, 400);
    }

    // 3. Google Sheets API 인증 + 저장
    const accessToken = await getAccessToken(env);
    await appendToSheet(accessToken, env, data);

    // 4. 버즈빌 API 호출 (향후 주석 해제)
    // await callBuzzvilApi(env, data);

    // 5. 성공 응답
    return jsonResponse({ success: true, message: '신청이 완료되었습니다.' });
  } catch (error) {
    console.error('제출 처리 오류:', error);
    return jsonResponse({ success: false, error: '저장 중 오류가 발생했습니다.' }, 500);
  }
}

/**
 * JSON 응답 생성
 */
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * CORS 헤더 추가
 */
function corsResponse(env, response) {
  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', env.ALLOWED_ORIGIN || '*');
  headers.set('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type');

  return new Response(response.body, {
    status: response.status,
    headers,
  });
}
