# Landing Project

## 프로젝트 개요
마케팅 업체용 멀티랜딩페이지 시스템. 폼 제출 → Cloudflare Worker → 구글시트 저장.

## 프로젝트 구조

```
landing/
├── campaigns/                  ← Cloudflare Pages 배포 루트
│   ├── index.html              ← 루트 접근 시 /default/ 로 리다이렉트
│   └── default/                ← 기본 랜딩 템플릿
│       ├── index.html
│       ├── script.js           ← project: '응답' (시트 탭 이름)
│       └── styles.css
├── landing-api/                ← Cloudflare Worker (백엔드, 전체 공유)
│   ├── src/
│   │   ├── index.js            ← Worker 메인 (라우팅, 폼 처리)
│   │   ├── google-auth.js      ← 서비스 계정 JWT → OAuth 토큰
│   │   ├── sheets-client.js    ← 구글시트 append
│   │   └── buzzvil-client.js   ← 버즈빌 연동 (미사용)
│   └── wrangler.toml           ← Worker 설정 (SHEET_ID, SHEET_NAME)
└── apps-script/
    └── Code.gs                 ← 이전 Apps Script (레거시)
```

## 아키텍처

- **프론트엔드**: Cloudflare Pages (campaigns/ 폴더 배포)
- **백엔드**: Cloudflare Worker 1개 (landing-api)
- **DB**: 구글시트 (Sheets API v4, 서비스 계정 인증)
- **구조**: Worker 1개로 모든 랜딩의 폼 제출을 처리. script.js의 `project` 값으로 시트 탭 분기.

## 새 랜딩 추가 방법

1. `campaigns/default/` 를 `campaigns/새이름/` 으로 복사
2. `campaigns/새이름/script.js` 에서 `project: '새이름'` 으로 변경
3. 구글시트에 `새이름` 탭 생성
4. git push → 자동 배포
5. `도메인/새이름/` 으로 접근

## 업체별 구글시트 연동

- 서비스 계정 1개(`landing-488402`)로 모든 업체 시트에 접근 가능
- 업체가 자기 구글시트에 서비스 계정 이메일을 **편집자로 초대**하면 됨
- 시트 ID는 해당 랜딩의 `script.js`에서 `sheetId` 값으로 전송 (방법 A)
- 업체 온보딩 절차:
  1. 업체가 구글시트 생성
  2. 서비스 계정 이메일을 편집자로 초대
  3. 시트 URL 전달받아 시트 ID 추출
  4. 해당 랜딩 `script.js`에 `sheetId` 설정

## 자체 도메인 클라이언트

자체 도메인을 쓰는 클라이언트는 별도 Pages 프로젝트로 분리 + 커스텀 도메인 연결.

## 인프라 구성

- 도메인 1개 + 슬러그 구조 (campaigns/ 경로 분기)
- Cloudflare Pages 무료 티어 (프론트엔드)
- Cloudflare Worker 1개 (백엔드, 전체 공유)
- 구글시트 DB — 총괄 계정은 실장님이 관리
- 서비스 계정: `landing-worker@landing-488402.iam.gserviceaccount.com`
- 번호인증: NHN Cloud SMS (별도 계약, 건당 ~10원)
- 도메인 구매: Cloudflare Registrar 추천 (원가 판매, .kr 제외)
- 커스텀 도메인 연결: 업체 DNS에 CNAME 추가만 하면 됨 (도메인 이전 불필요)

## 무료 티어 한도

- Cloudflare Workers: 일 100,000 요청 (번호인증+버즈빌 포함 시 ~12,000건/일)
- Cloudflare Pages: 프로젝트 100개 (소프트 리밋), 배포 500회/월, 파일 20,000개, 개별 25MB, 대역폭 무제한
- Google Sheets API: 쓰기 분당 60회 (유저당), 일일 무제한 (Cloud 콘솔에서 증가 요청 가능)
