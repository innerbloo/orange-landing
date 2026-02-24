# Cloudflare Migration Design Document

> **Summary**: Apps Script → Cloudflare Worker 이관 상세 설계 (구글시트 유지, JWT 인증)
>
> **Project**: landing
> **Author**: jeonghoseong
> **Date**: 2026-02-24
> **Status**: Draft
> **Planning Doc**: [cloudflare-migration.plan.md](../../01-plan/features/cloudflare-migration.plan.md)

---

## 1. Overview

### 1.1 Design Goals

- Apps Script의 `doPost` 로직을 Cloudflare Worker로 1:1 이식
- 구글시트 저장을 Google Sheets API v4 REST 호출로 대체
- CORS를 정상 처리하여 프론트엔드에서 응답 본문을 파싱 가능하게 개선
- 모든 시크릿을 환경변수로 관리 (하드코딩 제거)

### 1.2 Design Principles

- 최소 변경: 프론트엔드 변경을 URL 교체 + fetch 옵션 수정으로 한정
- 동일 출력: 구글시트에 기존과 동일한 컬럼 포맷으로 저장
- 무상태: Worker는 상태를 갖지 않음 (JWT 토큰만 요청마다 생성)

---

## 2. Architecture

### 2.1 Component Diagram

```
┌──────────────┐     ┌───────────────────────┐     ┌──────────────────┐
│   Browser    │────▶│  Cloudflare Worker     │────▶│  Google Sheets   │
│  (script.js) │◀────│  POST /api/submit      │     │  (Sheets API v4) │
│              │     │  GET  /api/health       │     └──────────────────┘
└──────────────┘     │                         │     ┌──────────────────┐
                     │  modules:               │────▶│  Buzzvil API     │
                     │  - router               │     │  (향후 연동)      │
                     │  - google-auth (JWT)     │     └──────────────────┘
                     │  - sheets-client         │
                     │  - buzzvil-client        │
                     └───────────────────────────┘
```

### 2.2 Data Flow

```
1. 브라우저 POST /api/submit (JSON body)
2. Worker: CORS preflight 처리 (OPTIONS) 또는 본 요청 처리
3. Worker: 입력 데이터 검증
4. Worker: 서비스 계정 JWT 생성 → Google OAuth2 토큰 교환
5. Worker: Sheets API v4 append 호출 → 구글시트에 행 추가
6. Worker: (향후) 버즈빌 API 호출
7. Worker: JSON 응답 반환 { success: true/false, message: "..." }
```

### 2.3 Dependencies

| Component | Depends On | Purpose |
|-----------|-----------|---------|
| Worker (router) | - | HTTP 요청 라우팅 |
| google-auth | 서비스 계정 키 (env) | JWT 생성 → 액세스 토큰 발급 |
| sheets-client | google-auth | Sheets API v4 호출 |
| buzzvil-client | API Key (env) | 버즈빌 API 호출 |

---

## 3. API Specification

### 3.1 Endpoint List

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| POST | `/api/submit` | 폼 데이터 제출 → 시트 저장 | None (공개) |
| GET | `/api/health` | 헬스체크 | None |
| OPTIONS | `/api/*` | CORS preflight | None |

### 3.2 POST /api/submit

**Request:**
```json
{
  "name": "홍길동",
  "phone": "010-1234-5678",
  "email": "test@example.com",
  "privacy": true,
  "timestamp": "2026-02-24T12:00:00.000Z"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "신청이 완료되었습니다."
}
```

**Error Response (400/500):**
```json
{
  "success": false,
  "error": "이름을 입력해주세요."
}
```

### 3.3 GET /api/health

**Response (200 OK):**
```json
{
  "status": "ok",
  "message": "Worker가 정상 작동 중입니다."
}
```

### 3.4 CORS Headers

모든 응답에 포함:
```
Access-Control-Allow-Origin: {ALLOWED_ORIGIN 환경변수 또는 "*"}
Access-Control-Allow-Methods: POST, GET, OPTIONS
Access-Control-Allow-Headers: Content-Type
```

OPTIONS 요청은 204 No Content로 즉시 응답.

---

## 4. Detailed Module Design

### 4.1 Worker Entry Point (src/index.js)

```
export default {
  async fetch(request, env) {
    - OPTIONS → CORS preflight 응답 (204)
    - GET /api/health → 헬스체크 응답
    - POST /api/submit → handleSubmit(request, env)
    - 그 외 → 404
  }
}
```

### 4.2 Google Auth Module (src/google-auth.js)

**역할**: 서비스 계정 credentials로 JWT 생성 → Google OAuth2 액세스 토큰 교환

```
async function getAccessToken(env)
  1. env.GOOGLE_SERVICE_ACCOUNT_EMAIL, env.GOOGLE_PRIVATE_KEY 읽기
  2. JWT 헤더: { alg: "RS256", typ: "JWT" }
  3. JWT 클레임: {
       iss: 서비스계정 이메일,
       scope: "https://www.googleapis.com/auth/spreadsheets",
       aud: "https://oauth2.googleapis.com/token",
       iat: 현재시각,
       exp: 현재시각 + 3600
     }
  4. Web Crypto API (crypto.subtle)로 RS256 서명
  5. POST https://oauth2.googleapis.com/token
     grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer
     assertion={서명된 JWT}
  6. 응답에서 access_token 추출 → 반환
```

**주의**: Cloudflare Workers는 Node.js `crypto` 모듈이 없으므로 Web Crypto API 사용 필수.
PEM → ArrayBuffer 변환 → `crypto.subtle.importKey` → `crypto.subtle.sign` 순서.

### 4.3 Sheets Client Module (src/sheets-client.js)

**역할**: Google Sheets API v4로 데이터 행 추가

```
async function appendToSheet(accessToken, env, rowData)
  - URL: https://sheets.googleapis.com/v4/spreadsheets/{SHEET_ID}/values/{SHEET_NAME}!A:F:append
  - 쿼리: valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS
  - 메서드: POST
  - 헤더: Authorization: Bearer {accessToken}
  - Body: {
      values: [[
        new Date().toISOString(),   // 제출일시
        rowData.name || "",         // 이름
        rowData.phone || "",        // 연락처
        rowData.email || "",        // 이메일
        rowData.privacy ? "Y" : "N", // 개인정보동의
        ""                          // 버즈빌응답
      ]]
    }
```

**구글시트 컬럼 매핑 (기존과 동일):**

| 컬럼 | 필드 | 기존 Code.gs | Worker |
|------|------|-------------|--------|
| A | 제출일시 | `new Date()` | `new Date().toISOString()` |
| B | 이름 | `data.name` | `data.name` |
| C | 연락처 | `data.phone` | `data.phone` |
| D | 이메일 | `data.email` | `data.email` |
| E | 개인정보동의 | `data.privacy ? 'Y' : 'N'` | `data.privacy ? "Y" : "N"` |
| F | 버즈빌응답 | `""` | `""` |

### 4.4 Buzzvil Client Module (src/buzzvil-client.js)

**역할**: 버즈빌 API 호출 (현재는 주석 처리, 향후 활성화)

```
async function callBuzzvilApi(env, data)
  - URL: env.BUZZVIL_API_URL
  - 메서드: POST
  - 헤더: Authorization: Bearer {env.BUZZVIL_API_KEY}
  - Body: {
      user_id: data.phone,
      mission_type: "form_submit"
    }
  - 반환: 응답 JSON
```

### 4.5 handleSubmit 흐름

```
async function handleSubmit(request, env)
  1. request.json()으로 body 파싱
  2. 입력 검증 (name 필수, phone 필수, privacy 필수)
  3. getAccessToken(env)로 구글 액세스 토큰 발급
  4. appendToSheet(token, env, data)로 시트 저장
  5. // callBuzzvilApi(env, data) — 향후 주석 해제
  6. return { success: true, message: "신청이 완료되었습니다." }

  catch → return { success: false, error: error.message }
```

---

## 5. Environment Variables

| Variable | Purpose | Type | Example |
|----------|---------|------|---------|
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | 서비스 계정 이메일 | secret | `landing@project.iam.gserviceaccount.com` |
| `GOOGLE_PRIVATE_KEY` | 서비스 계정 RSA 비밀키 | secret | `-----BEGIN PRIVATE KEY-----\n...` |
| `SHEET_ID` | 구글시트 ID | var | `13WjZvx0cEgGt0VEFcgyUFtdNe3j23OSY9pFO7-FPXBY` |
| `SHEET_NAME` | 시트 탭 이름 | var | `응답` |
| `ALLOWED_ORIGIN` | CORS 허용 도메인 | var | `https://landing.example.com` |
| `BUZZVIL_API_URL` | 버즈빌 API URL | secret | (향후 설정) |
| `BUZZVIL_API_KEY` | 버즈빌 API Key | secret | (향후 설정) |

**등록 방법:**
```bash
# secrets (암호화 저장)
wrangler secret put GOOGLE_SERVICE_ACCOUNT_EMAIL
wrangler secret put GOOGLE_PRIVATE_KEY
wrangler secret put BUZZVIL_API_KEY

# vars (wrangler.toml에 명시)
[vars]
SHEET_ID = "13WjZvx0cEgGt0VEFcgyUFtdNe3j23OSY9pFO7-FPXBY"
SHEET_NAME = "응답"
ALLOWED_ORIGIN = "https://landing.example.com"
```

---

## 6. Frontend Changes (script.js)

### 6.1 변경 전 (현재)

```javascript
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/.../exec';

const response = await fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(formData)
});

// no-cors라서 응답 파싱 불가 → 항상 성공으로 간주
showMessage('신청이 완료되었습니다. 감사합니다!', 'success');
```

### 6.2 변경 후

```javascript
const WORKER_URL = 'https://landing-api.{account}.workers.dev/api/submit';

const response = await fetch(WORKER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(formData)
});

const result = await response.json();

if (result.success) {
    showMessage('신청이 완료되었습니다. 감사합니다!', 'success');
    form.reset();
} else {
    showMessage(result.error || '오류가 발생했습니다.', 'error');
}
```

**변경 포인트 요약:**
1. URL: Apps Script → Worker URL
2. `mode: 'no-cors'` 제거
3. 응답 본문 JSON 파싱 추가
4. success/error 분기 처리

---

## 7. File Structure

```
landing-api/            ← 새 Worker 프로젝트 (별도 디렉토리)
├── src/
│   ├── index.js              # Worker entry point + router
│   ├── google-auth.js        # JWT 생성 + 토큰 교환
│   ├── sheets-client.js      # Sheets API v4 호출
│   └── buzzvil-client.js     # 버즈빌 API 호출
├── wrangler.toml             # Worker 설정 + vars
└── package.json

landing/                ← 기존 프론트엔드 (변경 파일)
├── script.js           # URL 교체 + 응답 파싱 로직 수정
└── (나머지 변경 없음)
```

---

## 8. Error Handling

| 상황 | HTTP Status | 응답 | 프론트엔드 표시 |
|------|-------------|------|----------------|
| 정상 제출 | 200 | `{ success: true, message: "..." }` | 성공 메시지 |
| 필수 필드 누락 | 400 | `{ success: false, error: "이름을 입력해주세요." }` | 에러 메시지 |
| JSON 파싱 실패 | 400 | `{ success: false, error: "잘못된 요청 형식입니다." }` | 에러 메시지 |
| Sheets API 실패 | 500 | `{ success: false, error: "저장 중 오류가 발생했습니다." }` | 일반 에러 |
| JWT 토큰 발급 실패 | 500 | `{ success: false, error: "인증 오류가 발생했습니다." }` | 일반 에러 |
| 잘못된 경로 | 404 | `{ error: "Not found" }` | - |

---

## 9. Security Considerations

- [x] 서비스 계정 키를 `wrangler secret`으로 암호화 저장
- [x] CORS origin을 특정 도메인으로 제한 (ALLOWED_ORIGIN)
- [x] 입력 검증 (XSS: JSON 응답이므로 HTML 인젝션 위험 없음)
- [x] HTTPS 강제 (Cloudflare Workers 기본)
- [ ] Rate Limiting (무료 티어에서 미지원 — 필요 시 유료 전환)

---

## 10. Google Cloud Setup Guide

### 10.1 서비스 계정 생성 절차

```
1. https://console.cloud.google.com 접속
2. 새 프로젝트 생성 (또는 기존 프로젝트 선택)
3. API 및 서비스 > 라이브러리 > "Google Sheets API" 검색 > 사용 설정
4. API 및 서비스 > 사용자 인증 정보 > 사용자 인증 정보 만들기 > 서비스 계정
5. 서비스 계정 이름: "landing-worker" (자유)
6. 생성 후 > 키 관리 > 키 추가 > JSON
7. 다운로드된 JSON에서 client_email, private_key 추출
```

### 10.2 구글시트 공유

```
1. 구글시트 열기
2. 공유 버튼 클릭
3. 서비스 계정 이메일 입력 (예: landing-worker@project.iam.gserviceaccount.com)
4. 권한: 편집자
5. 저장
```

---

## 11. Implementation Order

| # | Task | Files | Dependency |
|---|------|-------|-----------|
| 1 | Google Cloud 서비스 계정 생성 + Sheets API 활성화 | (콘솔 작업) | 없음 |
| 2 | 구글시트에 서비스 계정 공유 | (시트 설정) | #1 |
| 3 | Worker 프로젝트 초기화 | `wrangler.toml`, `package.json` | 없음 |
| 4 | google-auth 모듈 작성 | `src/google-auth.js` | #1 |
| 5 | sheets-client 모듈 작성 | `src/sheets-client.js` | #4 |
| 6 | buzzvil-client 모듈 작성 | `src/buzzvil-client.js` | 없음 |
| 7 | Worker entry point + router 작성 | `src/index.js` | #5, #6 |
| 8 | 환경변수 등록 | `wrangler secret put` | #1, #3 |
| 9 | Worker 배포 + 헬스체크 확인 | `wrangler deploy` | #7, #8 |
| 10 | script.js 수정 | `script.js` | #9 |
| 11 | 통합 테스트 | - | #10 |
| 12 | Apps Script 비활성화 | (Apps Script 콘솔) | #11 확인 후 |

---

## 12. Test Plan

### 12.1 Test Cases

- [ ] POST /api/submit — 정상 데이터 → 시트 저장 확인
- [ ] POST /api/submit — name 누락 → 400 에러 응답
- [ ] POST /api/submit — privacy false → 400 에러 응답
- [ ] POST /api/submit — JSON 아닌 body → 400 에러 응답
- [ ] GET /api/health → 200 OK
- [ ] OPTIONS /api/submit → 204 CORS preflight 응답
- [ ] 브라우저에서 폼 제출 → 성공 메시지 표시 + 시트 저장
- [ ] 브라우저에서 폼 제출 실패 → 에러 메시지 표시

### 12.2 Test Method

1. `wrangler dev`로 로컬 실행
2. curl로 각 엔드포인트 테스트
3. 브라우저에서 실제 폼 제출 테스트
4. 구글시트에서 데이터 저장 확인

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-02-24 | Initial draft | jeonghoseong |
