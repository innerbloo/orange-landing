# Landing Project

## 중요 규칙

- **프로젝트 구조가 변경되면 반드시 이 CLAUDE.md 파일을 업데이트할 것.** 파일/폴더 추가·삭제, 아키텍처 변경, 환경변수 변경, 새로운 서비스 연동 등 구조에 영향을 주는 변경 시 해당 섹션을 즉시 반영한다.

## 프로젝트 개요
마케팅 업체용 멀티랜딩페이지 시스템. 폼 제출 → Cloudflare Worker → D1(원본) + 구글시트(열람용) 이중 저장.

## 프로젝트 구조

```
landing/
├── campaigns/                  ← Cloudflare Pages 배포 루트 (planetdb.co.kr)
│   ├── 404.html                ← 루트 및 존재하지 않는 경로 → 404 페이지
│   ├── shared/                 ← 광고주 공통 리소스
│   │   ├── common.js           ← 전 랜딩 공통 JS (SMS 인증, 폼, 애니메이션 등)
│   │   └── samsung.css         ← 삼성화재 브랜드 색상 CSS 변수
│   ├── default/                ← 기본 랜딩 템플릿
│   ├── ss-pet-insurance-a/     ← 삼성화재 펫보험 A
│   └── ...
├── landing-api/                ← Cloudflare Worker (백엔드, planetdb.co.kr/api/*)
│   ├── src/
│   │   ├── index.js            ← Worker 메인 (라우팅, 폼 처리, SMS 인증)
│   │   ├── d1-client.js        ← D1 중복 체크 + 원본 저장
│   │   ├── google-auth.js      ← 서비스 계정 JWT → OAuth 토큰
│   │   ├── sheets-client.js    ← 구글시트 동적 필드 append + 자동 헤더
│   │   ├── sms-client.js       ← NHN Cloud SMS 인증번호 발송
│   │   └── buzzvil-client.js   ← 버즈빌 연동 (미사용)
│   ├── schema.sql              ← D1 테이블 스키마 (submissions + verification_codes)
│   └── wrangler.toml           ← Worker 설정 (D1, SHEET_ID, 라우트)
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

## 광고주별 네이밍 컨벤션

폴더명 접두사로 광고주를 구분한다. URL에 노출되지만 의미 파악이 어려운 약어 사용.

| 접두사 | 광고주 | 공통 CSS |
|--------|--------|----------|
| `ss-`  | 삼성화재 | `shared/samsung.css` |

- 공통 CSS: `campaigns/shared/{광고주}.css` — 브랜드 색상을 CSS 변수(`:root`)로 정의
- 각 랜딩의 `styles.css`에서 하드코딩 색상 대신 CSS 변수 사용
- 새 광고주 추가 시: 접두사 + 공통 CSS 파일 생성

## JS 공통/랜딩별 분리 구조

### 공통 (`shared/common.js`) — 모든 랜딩에서 로드
- SMS 인증 (발송, 확인, 타이머, 초기화)
- 폼 제출 (API 호출, 로딩, 메시지, 리셋)
- 공통 검증 (연락처 형식, 허위번호, SMS 인증 완료)
- 동의 체크박스 (전체동의 연동)
- 헬프텍스트 표시/제거
- 스크롤 애니메이션 (fade-up, count-up, stagger)
- 플로팅 CTA 표시/숨김
- 모달 (열기/닫기, 키보드 트랩)
- select 스타일, 연락처 자동 하이픈, 생년월일 포맷

### 랜딩별 (`script.js`) — `initLanding(config)` 호출
```js
initLanding({
    project: '프로젝트명',           // 시트 탭 이름 (D1 중복 체크 단위)
    sheetId: '시트ID',              // 선택. 없으면 Worker 기본값
    tabId: 1234567890,              // 구글시트 탭 gid (탭 이름 변경 시 폴백용)
    buildFields() { return { ... }; }, // 폼 필드 → fields 객체 매핑
    validateFields(fields) { ... },    // 랜딩별 유효성 검사
    onReset() { ... },                 // 리셋 시 추가 동작 (선택)
});
```

### HTML 규칙
- `<script src="../shared/common.js" defer>` 먼저, `<script src="script.js" defer>` 이후 로드
- 생년월일 input에 `data-format="birth"` 속성 필수 (common.js가 자동 포맷 바인딩)

## 새 랜딩 추가 방법

1. `campaigns/default/` 를 `campaigns/{접두사}-새이름/` 으로 복사
2. `index.html` 수정:
   - 공통 CSS 연결: `<link rel="stylesheet" href="../shared/{광고주}.css">`
   - 공통 JS 연결: `<script src="../shared/common.js" defer>`
   - 생년월일 input에 `data-format="birth"` 속성 추가
3. `script.js` 수정:
   - `initLanding()` 호출: project, sheetId, tabId, buildFields, validateFields, onReset
   - **tabId**: 반드시 사용자에게 구글시트 탭의 gid를 물어볼 것 (URL의 `#gid=숫자` 부분)
   - 해당 랜딩 전용 로직만 작성 (예: 펫타입 토글, 몸무게 포맷)
4. 구글시트에 해당 탭 생성 (헤더는 자동 생성됨)
5. git push → 자동 배포
6. `planetdb.co.kr/{접두사}-새이름/` 으로 접근

> **⚠️ 새 랜딩 생성 시 반드시 사용자에게 확인할 것:**
> - 접두사가 새로운 광고주(기존에 없는 접두사)면 → `project`, `sheetId`, `tabId` 모두 물어볼 것
> - 같은 광고주의 추가 랜딩이면 → `project`, `tabId`는 물어보고, `sheetId`는 기존 값 재사용
> - `tabId`(gid)는 순번이 아닌 구글이 자동 부여하는 고유 숫자 (시트 URL의 `#gid=` 값)

## SMS 인증 흐름

모든 랜딩 공통. Worker 1개로 처리.

1. 프론트 → `POST /api/send-code` `{ "phone": "01012345678" }`
2. Worker: 6자리 인증번호 생성 → D1 저장 (3분 만료) → NHN Cloud SMS 발송
3. 프론트 → `POST /api/verify-code` `{ "phone": "01012345678", "code": "123456" }`
4. Worker: D1에서 코드 확인 → 만료/불일치 체크 → 인증 완료 처리
5. 인증 완료 전까지 폼 제출 차단

- SMS 메시지 양식: `인증번호 [XXXXXX]를 입력해주세요.` (랜딩별 접두어 없음, 공통 고정)
- D1 테이블: `verification_codes` (phone, code, expires_at, verified)

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
- **SMS 인증**: NHN Cloud SMS (전 랜딩 공통, 건당 ~10원)
- **도메인 구매**: Cloudflare Registrar 추천 (원가 판매, .kr 제외)
- **커스텀 도메인 연결**: 업체 DNS에 CNAME 추가

## Worker 환경변수

### wrangler.toml (vars)
- `SHEET_ID` — 기본 구글시트 ID
- `SHEET_NAME` — 기본 시트 탭 이름
- `NHN_SENDER_NUMBER` — SMS 발신번호

### Secrets (wrangler secret)
- `GOOGLE_SERVICE_ACCOUNT_EMAIL` — 서비스 계정 이메일
- `GOOGLE_PRIVATE_KEY` — 서비스 계정 비공개 키
- `NHN_APP_KEY` — NHN Cloud SMS 앱키
- `NHN_SECRET_KEY` — NHN Cloud SMS 시크릿키

## 무료 티어 한도

- Cloudflare Workers: 일 100,000 요청
- Cloudflare D1: 일 100,000 읽기 + 100,000 쓰기, 5GB 저장
- Cloudflare Pages: 프로젝트 100개, 배포 500회/월, 대역폭 무제한
- Google Sheets API: 쓰기 분당 60회 (유저당)
