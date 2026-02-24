# Cloudflare Migration Planning Document

> **Summary**: Google Apps Script 백엔드를 Cloudflare Workers로 이관 (구글시트 유지)
>
> **Project**: landing
> **Author**: jeonghoseong
> **Date**: 2026-02-24
> **Status**: Draft

---

## 1. Overview

### 1.1 Purpose

현재 Google Apps Script 기반 폼 백엔드의 무료 티어 제한(일 실행시간 90분, 동시 실행 30개)을 해소하고, 일 10,000건 제출을 안정적으로 처리할 수 있는 인프라로 전환한다.

### 1.2 Background

- 현재 구조: `브라우저 → Apps Script (doPost) → 구글시트 (appendRow) → (향후) 버즈빌 API`
- Apps Script 무료 티어 일 실행시간 90분 제한으로, 버즈빌 API 연동 후 일 ~700건이 한계
- Cloudflare Workers 무료 티어는 일 100,000건 요청 가능 → 일 10,000건 목표 대비 10배 여유
- 프론트엔드가 이미 Cloudflare Pages에 배포되어 있어 인프라 통합 가능

### 1.3 Related Documents

- `apps-script/Code.gs` — 현재 Apps Script 백엔드
- `script.js` — 프론트엔드 폼 제출 로직
- `이관가이드.md` — 기존 클라이언트 이관 절차

---

## 2. Infrastructure Free Tier Comparison

### 2.1 Google Apps Script (현재)

| 항목 | 무료 한도 | 일 10,000건 사용량 | 소진율 |
|------|----------|-------------------|--------|
| 일일 실행 시간 | 90분/일 | ~50분 (시트만) / ~133분 (버즈빌 포함) | 55% / **148% (초과!)** |
| 동시 실행 | 30개 | 순간 몰림 시 초과 가능 | 위험 |
| URL Fetch (외부 API 호출) | 20,000회/일 | 10,000회 (버즈빌) | 50% |
| 스크립트 실행 시간 | 건당 6분 | 건당 ~3~8초 | 여유 |

**월 환산**: 일 10,000건 x 30일 = 월 300,000건
**안전 처리량**: 시트 저장만 시 일 ~1,800건 / 버즈빌 포함 시 **일 ~700건 (한계)**

> 버즈빌 API 연동 시 90분 한도를 초과하여 **현재 인프라로는 일 10,000건 불가능**

### 2.2 Cloudflare Workers (이관 대상)

| 항목 | 무료 한도 | 일 10,000건 사용량 | 소진율 |
|------|----------|-------------------|--------|
| 요청 수 | **100,000회/일** | 10,000회 | **10%** |
| CPU 시간 | 요청당 10ms | 요청당 ~2~5ms (JSON 파싱 + fetch) | 여유 |
| subrequest (외부 API 호출) | 50회/요청 | 요청당 2회 (시트 + 버즈빌) | 여유 |
| Worker 스크립트 수 | 100개 | 1개 | 여유 |
| Worker 크기 | 3MB (압축) | ~수십KB | 여유 |
| Cron Triggers | 5개 | 0개 (필요 없음) | 여유 |
| 환경변수 | 64개/Worker | ~5개 | 여유 |
| 메모리 | 128MB/isolate | ~수MB | 여유 |

**월 환산**: 일 10,000건 x 30일 = 월 300,000건 (무료 한도: 월 ~3,000,000건)
**안전 처리량**: **일 ~100,000건 / 월 ~3,000,000건** (10배 여유)

### 2.3 Google Sheets API v4 (Workers에서 시트 연동 시 적용)

| 항목 | 무료 한도 | 일 10,000건 사용량 | 소진율 |
|------|----------|-------------------|--------|
| 쓰기 요청 | **300회/분/프로젝트** | 평균 7회/분 | **2.3%** |
| 쓰기 요청 (사용자당) | 60회/분/사용자 | 서비스 계정 1개 사용 → 7회/분 | **11.6%** |
| 일일 한도 | **없음** (분당 제한만) | - | - |

**순간 트래픽 시나리오**: 1분간 300건 몰림 → 300회/분 한도 도달 → 429 에러 발생 가능
**안전 처리량**: 분당 ~60건 (사용자당 한도 기준) = **시간당 ~3,600건 / 일 ~86,400건**

> 분당 한도만 지키면 일일 제한은 없으므로, 순간 집중만 아니면 일 10,000건은 충분

### 2.4 종합 안전 처리량 비교

| 인프라 조합 | 일 안전 처리량 | 월 안전 처리량 | 병목 |
|------------|--------------|--------------|------|
| Apps Script (시트만) | ~1,800건 | ~54,000건 | 실행 시간 90분 |
| Apps Script (시트+버즈빌) | **~700건** | **~21,000건** | 실행 시간 90분 |
| **Workers + Sheets API + 버즈빌** | **~86,400건** | **~2,592,000건** | Sheets API 분당 60회 |
| Workers + D1 (참고) | ~100,000건 | ~3,000,000건 | Workers 일 요청 한도 |

---

## 3. Scope

### 3.1 In Scope

- [x] Cloudflare Worker 생성 (폼 제출 POST 엔드포인트)
- [x] Google Sheets API 연동 (서비스 계정 인증)
- [x] 버즈빌 API 호출 로직 이식
- [x] CORS 헤더 정상 설정 (no-cors 제거)
- [x] 프론트엔드(script.js) URL 교체 및 응답 처리 개선
- [x] 환경변수(시크릿) 관리 (API Key, 서비스 계정 credentials)

### 3.2 Out of Scope

- D1 전환 (구글시트 유지 결정)
- 관리 대시보드 / 어드민 페이지
- 기존 데이터 마이그레이션 (저장소 변경 없음)
- 모니터링/알림 시스템

---

## 4. Requirements

### 4.1 Functional Requirements

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-01 | POST /api/submit 엔드포인트 — 폼 데이터 수신 | High | Pending |
| FR-02 | Google Sheets API로 구글시트에 데이터 저장 | High | Pending |
| FR-03 | 버즈빌 API 호출 (기존 로직 이식) | High | Pending |
| FR-04 | CORS 헤더 설정 (랜딩페이지 도메인 허용) | High | Pending |
| FR-05 | 에러 응답을 프론트엔드에서 정상 파싱 가능 | Medium | Pending |
| FR-06 | GET /api/health 헬스체크 엔드포인트 | Low | Pending |

### 4.2 Non-Functional Requirements

| Category | Criteria | Measurement |
|----------|----------|-------------|
| Performance | 응답 시간 < 3초 (구글시트 API 포함) | Worker 로그 |
| Availability | 일 10,000건 안정 처리 | Cloudflare 대시보드 |
| Security | API Key, 서비스 계정 키를 환경변수로 관리 | wrangler secret |
| Cost | 무료 티어 내 운영 | 월 비용 $0 |

---

## 5. Architecture

### 5.1 이관 전후 흐름

```
[이관 전]
브라우저 → Apps Script (doPost)
             ├→ SpreadsheetApp.appendRow() → 구글시트
             └→ UrlFetchApp.fetch() → 버즈빌 API

[이관 후]
브라우저 → Cloudflare Worker (POST /api/submit)
             ├→ Google Sheets API v4 (REST) → 구글시트
             └→ fetch() → 버즈빌 API
```

### 5.2 Google Sheets API 인증 흐름

```
1. Google Cloud Console에서 서비스 계정 생성
2. Sheets API 활성화
3. 서비스 계정 이메일을 구글시트에 편집자로 공유
4. 서비스 계정 JSON 키 → Worker 환경변수에 저장
5. Worker에서 JWT 생성 → 액세스 토큰 발급 → Sheets API 호출
```

### 5.3 Key Decisions

| Decision | Selected | Rationale |
|----------|----------|-----------|
| 저장소 | 구글시트 유지 | 클라이언트가 시트에서 직접 확인 필요 |
| 인증 | 서비스 계정 + JWT | OAuth 불필요, 서버간 통신에 적합 |
| Worker 프레임워크 | 순수 Worker (프레임워크 없음) | 엔드포인트 2개뿐, 경량 유지 |
| 시크릿 관리 | wrangler secret | Cloudflare 네이티브, 코드에 노출 안 됨 |

---

## 6. Risks and Mitigation

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Google Sheets API 분당 한도 초과 (순간 트래픽) | Medium | Low | 지수 백오프 재시도 로직 구현 |
| 서비스 계정 키 유출 | High | Low | wrangler secret 사용, 코드에 하드코딩 금지 |
| JWT 토큰 만료 처리 | Medium | Medium | 토큰 캐싱 + 만료 전 갱신 로직 |
| 구글시트 구조 변경 (컬럼 추가 등) | Low | Medium | 시트 헤더를 코드에서 자동 생성 유지 |
| Cloudflare 무료 티어 정책 변경 | Medium | Low | D1 전환 백업 플랜 보유 |

---

## 7. Implementation Steps

| # | Task | Description | Estimated Effort |
|---|------|-------------|-----------------|
| 1 | Google Cloud 서비스 계정 생성 | 콘솔에서 프로젝트 생성, Sheets API 활성화, 키 발급 | 10분 |
| 2 | 구글시트에 서비스 계정 공유 | 서비스 계정 이메일을 시트 편집자로 추가 | 2분 |
| 3 | Worker 프로젝트 생성 | `wrangler init landing-api` | 5분 |
| 4 | Worker 코드 작성 | POST /api/submit, JWT 인증, Sheets API 호출, 버즈빌 API 호출 | 30분 |
| 5 | 환경변수 등록 | `wrangler secret put` (서비스 계정 키, 버즈빌 API 키) | 5분 |
| 6 | Worker 배포 | `wrangler deploy` | 2분 |
| 7 | script.js 수정 | URL 교체, no-cors 제거, 응답 파싱 로직 추가 | 10분 |
| 8 | 통합 테스트 | 폼 제출 → 시트 저장 확인 | 10분 |
| 9 | 기존 Apps Script 비활성화 | 정상 동작 확인 후 | 2분 |

---

## 8. Success Criteria

### 8.1 Definition of Done

- [ ] Worker 배포 완료 및 헬스체크 정상 응답
- [ ] 폼 제출 → 구글시트 저장 정상 동작
- [ ] CORS 정상 처리 (응답 본문 파싱 가능)
- [ ] 버즈빌 API 호출 준비 완료 (주석 해제만 하면 동작)
- [ ] 환경변수로 시크릿 관리 확인
- [ ] 기존 Apps Script와 동일한 시트 포맷 유지

### 8.2 Quality Criteria

- [ ] 응답 시간 3초 이내
- [ ] 에러 시 프론트엔드에 명확한 메시지 표시
- [ ] 무료 티어 한도 10% 이내 사용

---

## 9. Next Steps

1. [ ] Plan 문서 승인
2. [ ] Design 문서 작성 (`/pdca design cloudflare-migration`)
3. [ ] 구현 시작

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-02-24 | Initial draft | jeonghoseong |
