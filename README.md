# 랜딩페이지 프로젝트

폼 제출 → 구글시트 저장 + 버즈빌 API 호출을 처리하는 정적 랜딩페이지입니다.

## 파일 구조

```
/landing
├── index.html          # 메인 랜딩페이지
├── styles.css          # 스타일시트
├── script.js           # 폼 제출 로직
├── assets/
│   └── images/         # 정적 이미지
└── apps-script/
    └── Code.gs         # Google Apps Script 코드
```

## 설정 가이드

### 1. Google Apps Script 설정

1. [Google Sheets](https://sheets.google.com)에서 새 스프레드시트 생성
2. 시트 이름을 `응답`으로 변경
3. 확장 프로그램 > Apps Script 선택
4. `apps-script/Code.gs` 내용을 복사하여 붙여넣기
5. `SHEET_ID`를 실제 스프레드시트 ID로 교체
   - URL에서 확인: `https://docs.google.com/spreadsheets/d/{SHEET_ID}/edit`
6. 배포 > 새 배포 > 유형: 웹 앱
   - 실행할 사용자: 나
   - 액세스 권한: 모든 사용자
7. 배포 후 웹 앱 URL 복사

### 2. 프론트엔드 설정

1. `script.js` 파일 열기
2. `APPS_SCRIPT_URL`을 실제 Apps Script 웹 앱 URL로 교체

### 3. Cloudflare Pages 배포

1. [Cloudflare Dashboard](https://dash.cloudflare.com) 로그인
2. Pages > 프로젝트 만들기
3. 직접 업로드 또는 Git 연동
4. `index.html`, `styles.css`, `script.js`, `assets/` 폴더 업로드
5. 배포 완료 후 `*.pages.dev` URL 확인

## 테스트

### 로컬 테스트
브라우저에서 `index.html` 파일을 직접 열어 폼 동작 확인

### Apps Script 테스트
1. Apps Script 에디터에서 `testSaveToSheet` 함수 실행
2. 구글시트에 테스트 데이터 저장 확인

## 대기 중인 항목

- [ ] 디자인 시안 반영
- [ ] 폼 필드 확정
- [ ] 버즈빌 API 명세서 반영
- [ ] 클라이언트 계정으로 이관

## 버즈빌 API 연동

`apps-script/Code.gs`의 `callBuzzvilApi()` 함수에서:
1. `BUZZVIL_API_URL` 설정
2. `BUZZVIL_API_KEY` 설정
3. `payload` 객체를 API 명세에 맞게 수정
4. `doPost()`에서 주석 해제
