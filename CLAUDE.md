# Landing Project

## 프로젝트 개요
마케팅 업체용 멀티랜딩페이지 시스템. 폼 제출 → Cloudflare Worker → D1(원본) + 구글시트(열람용) 이중 저장.

## 프로젝트 구조

```
landing/
├── campaigns/                  ← Cloudflare Pages 배포 루트 (planetdb.co.kr)
│   ├── 404.html                ← 루트 및 존재하지 않는 경로 → 404 페이지
│   └── default/                ← 기본 랜딩 템플릿
│       ├── index.html
│       ├── script.js           ← project, fields, sheetId 설정
│       └── styles.css
├── landing-api/                ← Cloudflare Worker (백엔드, planetdb.co.kr/api/*)
│   ├── src/
│   │   ├── index.js            ← Worker 메인 (라우팅, 폼 처리)
│   │   ├── d1-client.js        ← D1 중복 체크 + 원본 저장
│   │   ├── google-auth.js      ← 서비스 계정 JWT → OAuth 토큰
│   │   ├── sheets-client.js    ← 구글시트 동적 필드 append + 자동 헤더
│   │   └── buzzvil-client.js   ← 버즈빌 연동 (미사용)
│   ├── schema.sql              ← D1 테이블 스키마
│   └── wrangler.toml           ← Worker 설정 (D1, SHEET_ID, 라우트)
└── apps-script/
    └── Code.gs                 ← 이전 Apps Script (레거시, 미사용)
```

## 아키텍처

- **프론트엔드**: Cloudflare Pages (`campaigns/` 폴더 배포)
- **백엔드**: Cloudflare Worker 1개 (`landing-api`, `planetdb.co.kr/api/*`)
- **원본 DB**: Cloudflare D1 (`landing-db`) — 중복 체크 + 원본 저장
- **열람용 DB**: 구글시트 (Sheets API v4, 서비스 계정 인증) — 광고주 열람용
- **구조**: Worker 1개로 모든 랜딩의 폼 제출 처리

## 폼 제출 흐름

1. 프론트 → `POST /api/submit` (fields 동적 구조)
2. Worker: D1에서 `project + 연락처` 중복 체크 (랜딩별)
3. 중복 아니면 → D1 저장 + 구글시트 append
4. 중복이면 → "이미 신청하셨습니다" 응답

## 데이터 구조

### 프론트 → Worker 요청 (script.js)
```json
{
  "sheetId": "시트ID",         // 선택. 없으면 Worker 기본값
  "project": "탭이름",         // 선택. 없으면 env.SHEET_NAME
  "fields": {                  // 필수. 한글 키 = 시트 헤더
    "이름": "홍길동",
    "연락처": "010-1234-5678",
    "이메일": "test@test.com",
    "개인정보동의": "Y"
  }
}
```

### D1 테이블 (submissions)
```sql
CREATE TABLE submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project TEXT NOT NULL,        -- 랜딩 구분 (탭 이름)
  phone TEXT NOT NULL,          -- 중복 체크 키
  fields TEXT NOT NULL,         -- JSON (동적 필드 전체)
  created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX idx_project_phone ON submissions (project, phone);
```

### 구글시트 동적 헤더
- 시트가 비어있으면 fields 키로 헤더 자동 생성 (`제출일시` + fields 키들)
- 기존 헤더가 있으면 헤더 순서에 맞춰 값 매핑
- 탭을 못 찾으면 첫 번째 시트에 폴백 저장

## 새 랜딩 추가 방법

1. `campaigns/default/` 를 `campaigns/새이름/` 으로 복사
2. `campaigns/새이름/script.js` 수정:
   - `project`: 시트 탭 이름 (D1 중복 체크 단위)
   - `fields`: 해당 랜딩의 폼 필드 (한글 키)
   - `sheetId`: 다른 스프레드시트 사용 시 (선택)
3. 구글시트에 해당 탭 생성 (헤더는 자동 생성됨)
4. git push → 자동 배포
5. `planetdb.co.kr/새이름/` 으로 접근

## 업체별 구글시트 연동

- 서비스 계정 1개로 모든 업체 시트 접근
- 업체가 자기 구글시트에 서비스 계정 이메일을 **편집자로 초대**
- 시트 ID는 `script.js`의 `sheetId` 값으로 전송
- 업체 온보딩 절차:
  1. 업체가 구글시트 생성
  2. 서비스 계정 이메일을 편집자로 초대
  3. 시트 URL 전달받아 시트 ID 추출
  4. 해당 랜딩 `script.js`에 `sheetId` 설정

## 자체 도메인 클라이언트

자체 도메인을 쓰는 클라이언트는 별도 Pages 프로젝트로 분리 + 커스텀 도메인 연결.

## 인프라 구성

- **도메인**: `planetdb.co.kr` (비아웹 구매, Cloudflare 네임서버)
- **Cloudflare 계정**: Orangeplanet1017@naver.com
- **Pages**: campaigns/ 폴더 배포 (프론트엔드)
- **Worker**: landing-api (`planetdb.co.kr/api/*` 경로 라우트)
- **D1**: landing-db (원본 DB, 중복 체크)
- **구글시트**: 광고주 열람용
- **서비스 계정**: `landing-worker@landing-488402.iam.gserviceaccount.com`
- **번호인증**: NHN Cloud SMS (별도 계약, 건당 ~10원)
- **도메인 구매**: Cloudflare Registrar 추천 (원가 판매, .kr 제외)
- **커스텀 도메인 연결**: 업체 DNS에 CNAME 추가

## Worker 환경변수

### wrangler.toml (vars)
- `SHEET_ID` — 기본 구글시트 ID
- `SHEET_NAME` — 기본 시트 탭 이름
- `ALLOWED_ORIGIN` — CORS 허용 도메인 (`*`)

### Secrets (wrangler secret)
- `GOOGLE_SERVICE_ACCOUNT_EMAIL` — 서비스 계정 이메일
- `GOOGLE_PRIVATE_KEY` — 서비스 계정 비공개 키

## 무료 티어 한도

- Cloudflare Workers: 일 100,000 요청
- Cloudflare D1: 일 100,000 읽기 + 100,000 쓰기, 5GB 저장
- Cloudflare Pages: 프로젝트 100개, 배포 500회/월, 대역폭 무제한
- Google Sheets API: 쓰기 분당 60회 (유저당)
