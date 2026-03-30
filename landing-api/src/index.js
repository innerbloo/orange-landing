/**
 * Cloudflare Worker — 랜딩페이지 폼 백엔드
 */

import { getAccessToken } from './google-auth.js';
import { appendToSheet } from './sheets-client.js';
import { isDuplicate, saveToD1, logError, getSubmissions } from './d1-client.js';
import { sendSmsCode } from './sms-client.js';

// Rate Limiting: IP별 요청 횟수 (메모리 기반, 인스턴스 재시작 시 초기화)
const rateLimitMap = new Map();
const RATE_LIMIT = 5;          // 최대 요청 수
const RATE_WINDOW_MS = 60000;  // 1분

function checkRateLimit(ip) {
  const now = Date.now();
  const record = rateLimitMap.get(ip);

  if (!record || now - record.start > RATE_WINDOW_MS) {
    rateLimitMap.set(ip, { start: now, count: 1 });
    return true;
  }

  record.count++;
  if (record.count > RATE_LIMIT) {
    return false;
  }
  return true;
}

// 허용된 도메인 목록
const ALLOWED_ORIGINS = [
  'https://planetdb.co.kr',
  'http://localhost',
  'http://127.0.0.1',
];

function isAllowedOrigin(origin) {
  if (!origin) return false;
  return ALLOWED_ORIGINS.some((allowed) => origin.startsWith(allowed));
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return corsResponse(origin, new Response(null, { status: 204 }));
    }

    // Router
    if (url.pathname === '/api/health' && request.method === 'GET') {
      return corsResponse(origin, jsonResponse({ status: 'ok', message: 'Worker가 정상 작동 중입니다.' }));
    }

    if (url.pathname === '/api/submit' && request.method === 'POST') {
      return corsResponse(origin, await handleSubmit(request, env, origin));
    }

    if (url.pathname === '/api/send-code' && request.method === 'POST') {
      return corsResponse(origin, await handleSendCode(request, env, origin));
    }

    if (url.pathname === '/api/verify-code' && request.method === 'POST') {
      return corsResponse(origin, await handleVerifyCode(request, env, origin));
    }

    if (url.pathname === '/api/sync' && request.method === 'POST') {
      return corsResponse(origin, await handleSync(request, env));
    }

    return corsResponse(origin, jsonResponse({ error: 'Not found' }, 404));
  },
};

/**
 * 폼 제출 처리
 */
async function handleSubmit(request, env, origin) {
  try {
    // 1. CORS 검증
    if (!isAllowedOrigin(origin)) {
      return jsonResponse({ success: false, error: '허용되지 않은 출처입니다.' }, 403);
    }

    // 2. Rate Limiting
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    if (!checkRateLimit(ip)) {
      return jsonResponse({ success: false, error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' }, 429);
    }

    // 3. Body 파싱
    let data;
    try {
      data = await request.json();
    } catch {
      return jsonResponse({ success: false, error: '잘못된 요청 형식입니다.' }, 400);
    }

    // 4. 입력 검증
    if (!data.fields || typeof data.fields !== 'object' || Object.keys(data.fields).length === 0) {
      return jsonResponse({ success: false, error: 'fields 항목이 필요합니다.' }, 400);
    }

    const project = data.project || env.SHEET_NAME;
    const phone = data.fields['연락처'] || '';

    // 5. 연락처 유효성 검사
    if (phone) {
      const digits = phone.replace(/-/g, '');
      const validPattern = /^010[2-9]\d{7}$/;
      if (!validPattern.test(digits)) {
        return jsonResponse({ success: false, error: '올바른 연락처를 입력해주세요.' }, 400);
      }
      const mid = digits.slice(3, 7);
      const last = digits.slice(7, 11);
      const allSame = /^(\d)\1{3}$/.test(mid) && /^(\d)\1{3}$/.test(last) && mid === last;
      const blocked = ['01012345678', '01056781234', '01011112222', '01099998888'];
      if (allSame || blocked.includes(digits)) {
        return jsonResponse({ success: false, error: '유효하지 않은 연락처입니다.' }, 400);
      }
    }

    // 6. SMS 인증 완료 확인
    if (phone) {
      const verified = await env.DB.prepare(
        'SELECT id FROM verification_codes WHERE phone = ? AND verified = 1 ORDER BY created_at DESC LIMIT 1'
      ).bind(phone.replace(/-/g, '')).first();
      if (!verified) {
        return jsonResponse({ success: false, error: '휴대폰 인증을 완료해주세요.' }, 403);
      }
    }

    // 7. D1 중복 체크 (랜딩별)
    if (phone) {
      const duplicate = await isDuplicate(env.DB, project, phone);
      if (duplicate) {
        return jsonResponse({ success: false, error: '이미 신청하셨습니다.' }, 409);
      }
    }

    // 6. 구글시트 저장 (핵심 — 실패 시 에러 응답)
    const accessToken = await getAccessToken(env);
    await appendToSheet(accessToken, env, data);

    // 7. D1 저장 (중복 체크용 — 실패해도 무시)
    if (phone) {
      try {
        await saveToD1(env.DB, project, phone, data.fields);
      } catch (e) {
        console.error('D1 저장 실패 (무시):', e);
      }
    }

    // 8. 인증 레코드 정리 (실패해도 무시)
    if (phone) {
      try {
        await env.DB.prepare('DELETE FROM verification_codes WHERE phone = ?')
          .bind(phone.replace(/-/g, '')).run();
      } catch (_) {}
    }

    // 9. 성공 응답
    return jsonResponse({ success: true, message: '신청이 완료되었습니다.' });
  } catch (error) {
    console.error('제출 처리 오류:', error);

    // D1 에러 로깅 (실패해도 무시)
    try {
      await logError(env.DB, error.message, request.url);
    } catch (_) {}

    return jsonResponse({ success: false, error: '저장 중 오류가 발생했습니다.' }, 500);
  }
}

/**
 * SMS 인증번호 발송
 */
async function handleSendCode(request, env, origin) {
  try {
    if (!isAllowedOrigin(origin)) {
      return jsonResponse({ success: false, error: '허용되지 않은 출처입니다.' }, 403);
    }

    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    if (!checkRateLimit(ip)) {
      return jsonResponse({ success: false, error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' }, 429);
    }

    let data;
    try {
      data = await request.json();
    } catch {
      return jsonResponse({ success: false, error: '잘못된 요청 형식입니다.' }, 400);
    }

    const phone = (data.phone || '').replace(/-/g, '');
    if (!/^010[2-9]\d{7}$/.test(phone)) {
      return jsonResponse({ success: false, error: '올바른 연락처를 입력해주세요.' }, 400);
    }

    // 6자리 인증번호 생성
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 3 * 60 * 1000); // 3분

    // 기존 미인증 코드 삭제
    await env.DB.prepare('DELETE FROM verification_codes WHERE phone = ? AND verified = 0')
      .bind(phone).run();

    // 인증코드 저장
    await env.DB.prepare(
      'INSERT INTO verification_codes (phone, code, expires_at, created_at) VALUES (?, ?, ?, ?)'
    ).bind(phone, code, expiresAt.toISOString(), now.toISOString()).run();

    // SMS 발송
    await sendSmsCode(env, phone, code);

    return jsonResponse({ success: true, message: '인증번호가 발송되었습니다.' });
  } catch (error) {
    console.error('인증번호 발송 오류:', error);
    return jsonResponse({ success: false, error: 'SMS 발송 중 오류가 발생했습니다.' }, 500);
  }
}

/**
 * SMS 인증번호 확인
 */
async function handleVerifyCode(request, env, origin) {
  try {
    if (!isAllowedOrigin(origin)) {
      return jsonResponse({ success: false, error: '허용되지 않은 출처입니다.' }, 403);
    }

    let data;
    try {
      data = await request.json();
    } catch {
      return jsonResponse({ success: false, error: '잘못된 요청 형식입니다.' }, 400);
    }

    const phone = (data.phone || '').replace(/-/g, '');
    const code = data.code || '';

    if (!phone || !code) {
      return jsonResponse({ success: false, error: '연락처와 인증번호를 입력해주세요.' }, 400);
    }

    // 유효한 인증코드 조회
    const row = await env.DB.prepare(
      'SELECT * FROM verification_codes WHERE phone = ? AND code = ? AND verified = 0 ORDER BY created_at DESC LIMIT 1'
    ).bind(phone, code).first();

    if (!row) {
      return jsonResponse({ success: false, error: '인증번호가 일치하지 않습니다.' }, 400);
    }

    // 만료 체크
    if (new Date(row.expires_at) < new Date()) {
      return jsonResponse({ success: false, error: '인증번호가 만료되었습니다. 다시 요청해주세요.' }, 400);
    }

    // 인증 완료 처리
    await env.DB.prepare('UPDATE verification_codes SET verified = 1 WHERE id = ?')
      .bind(row.id).run();

    return jsonResponse({ success: true, message: '인증이 완료되었습니다.' });
  } catch (error) {
    console.error('인증 확인 오류:', error);
    return jsonResponse({ success: false, error: '인증 확인 중 오류가 발생했습니다.' }, 500);
  }
}

/**
 * D1 → 구글시트 재동기화
 * POST /api/sync { "project": "오렌지플래닛", "sheetId": "선택" }
 */
async function handleSync(request, env) {
  try {
    let data;
    try {
      data = await request.json();
    } catch {
      return jsonResponse({ success: false, error: '잘못된 요청 형식입니다.' }, 400);
    }

    const project = data.project;
    if (!project) {
      return jsonResponse({ success: false, error: 'project 항목이 필요합니다.' }, 400);
    }

    // D1에서 해당 프로젝트 데이터 조회
    const submissions = await getSubmissions(env.DB, project);
    if (submissions.length === 0) {
      return jsonResponse({ success: true, message: '동기화할 데이터가 없습니다.', synced: 0 });
    }

    // 구글시트에 한 건씩 append
    const accessToken = await getAccessToken(env);
    let synced = 0;

    for (const row of submissions) {
      const fields = JSON.parse(row.fields);
      const sheetData = {
        sheetId: data.sheetId,
        project: row.project,
        fields,
      };

      try {
        await appendToSheet(accessToken, env, sheetData);
        synced++;
      } catch (e) {
        console.error(`동기화 실패 (${row.phone}):`, e);
      }
    }

    return jsonResponse({ success: true, message: `${synced}/${submissions.length}건 동기화 완료`, synced });
  } catch (error) {
    console.error('동기화 오류:', error);
    return jsonResponse({ success: false, error: '동기화 중 오류가 발생했습니다.' }, 500);
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
function corsResponse(origin, response) {
  const headers = new Headers(response.headers);
  const allowedOrigin = isAllowedOrigin(origin) ? origin : ALLOWED_ORIGINS[0];
  headers.set('Access-Control-Allow-Origin', allowedOrigin);
  headers.set('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type');

  return new Response(response.body, {
    status: response.status,
    headers,
  });
}
