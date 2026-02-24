# Multi-Landing Support Planning Document

> **Summary**: Worker 1개로 여러 랜딩페이지의 폼 제출을 처리하는 공유 구조로 변경
>
> **Project**: landing
> **Author**: jeonghoseong
> **Date**: 2026-02-24
> **Status**: Draft

---

## 1. Overview

### 1.1 Purpose

현재 Worker가 단일 랜딩 + 단일 시트 구조로 되어 있어, 새 랜딩이 추가될 때마다 Worker를 별도로 만들어야 한다. `project` 파라미터를 추가하여 Worker 1개로 여러 랜딩의 폼 제출을 각각의 시트 탭에 저장할 수 있도록 한다.

### 1.2 Background

- 새 랜딩 추가 시: Pages만 생성 + script.js에 project명만 설정하면 완료
- Worker 추가 생성/배포 불필요
- 구글시트 1개 내에서 탭으로 랜딩별 데이터 분리

### 1.3 변경 범위 (최소 변경)

이 기능은 기존 cloudflare-migration 코드에 **3곳만 수정**하면 된다:

1. **script.js** — formData에 `project` 필드 추가 (1줄)
2. **sheets-client.js** — `SHEET_NAME`을 `project` 값으로 대체 (1줄)
3. **wrangler.toml** — `SHEET_NAME` 제거, `DEFAULT_SHEET_NAME` 추가 (fallback용)

---

## 2. Scope

### 2.1 In Scope

- [x] 프론트엔드에서 `project` 필드 전송
- [x] Worker에서 `project` 값으로 시트 탭 이름 결정
- [x] `project` 미전송 시 기본값 fallback

### 2.2 Out of Scope

- 프로젝트별 별도 구글시트 (시트 ID 분리) — 같은 시트 내 탭 분리만 지원
- 프로젝트 목록 관리 / 등록 API
- 관리 대시보드

---

## 3. Requirements

### 3.1 Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-01 | script.js에서 project 필드를 formData에 포함 | High |
| FR-02 | Worker가 project 값을 시트 탭 이름으로 사용 | High |
| FR-03 | project 미전송 시 기존 `SHEET_NAME` 환경변수를 fallback으로 사용 | High |
| FR-04 | 시트 탭이 존재하지 않으면 Sheets API 에러 → 사용자에게 안내 | Medium |

### 3.2 Data Flow

```
[현재]
랜딩 A → POST { name, phone, ... }
Worker → appendToSheet(env.SHEET_NAME = "응답")
시트: "응답" 탭에만 저장

[변경 후]
랜딩 A → POST { project: "campaign-a", name, phone, ... }
랜딩 B → POST { project: "campaign-b", name, phone, ... }
Worker → appendToSheet(sheetName = data.project || env.SHEET_NAME)
시트: "campaign-a" 탭, "campaign-b" 탭에 각각 저장
```

---

## 4. Implementation Plan

### 4.1 변경 파일

| # | File | Change | Lines |
|---|------|--------|-------|
| 1 | `script.js` | formData에 `project` 필드 추가 | 1줄 추가 |
| 2 | `landing-api/src/sheets-client.js` | `env.SHEET_NAME` → `data.project \|\| env.SHEET_NAME` | 1줄 수정 |
| 3 | `landing-api/src/index.js` | project 값을 appendToSheet에 전달 (이미 data 객체에 포함) | 변경 없음 |

### 4.2 새 랜딩 추가 시 작업

```
1. Cloudflare Pages 생성 (프론트엔드)
2. script.js에서 project 값만 변경 (예: "campaign-b")
3. 구글시트에 해당 이름의 탭 생성 (예: "campaign-b")
4. 끝 (Worker 변경/배포 불필요)
```

---

## 5. Risks

| Risk | Mitigation |
|------|------------|
| 시트 탭이 없으면 Sheets API 400 에러 | Worker에서 에러 메시지를 친절하게 반환 |
| project 값에 특수문자 포함 | encodeURIComponent 이미 적용되어 있음 |

---

## 6. Next Steps

1. [x] Plan 문서 승인
2. [ ] 구현 (3곳 수정)
3. [ ] Gap 분석

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-02-24 | Initial draft | jeonghoseong |
