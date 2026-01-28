/**
 * 랜딩페이지 백엔드 - Google Apps Script
 *
 * 설정 방법:
 * 1. Google Sheets에서 새 스프레드시트 생성
 * 2. 확장 프로그램 > Apps Script 선택
 * 3. 이 코드를 붙여넣기
 * 4. SHEET_ID를 실제 스프레드시트 ID로 교체
 * 5. 배포 > 새 배포 > 웹 앱 선택
 * 6. 실행할 사용자: 나, 액세스 권한: 모든 사용자
 * 7. 배포 후 URL을 script.js의 APPS_SCRIPT_URL에 설정
 */

// 설정
const SHEET_ID = '13WjZvx0cEgGt0VEFcgyUFtdNe3j23OSY9pFO7-FPXBY'; // 실제 시트 ID로 교체
const SHEET_NAME = '응답'; // 시트 탭 이름

// 버즈빌 API 설정 (명세서 수령 후 업데이트)
const BUZZVIL_API_URL = 'YOUR_BUZZVIL_API_URL';
const BUZZVIL_API_KEY = 'YOUR_BUZZVIL_API_KEY';

/**
 * POST 요청 처리
 */
function doPost(e) {
  try {
    // 1. 폼 데이터 파싱
    const data = JSON.parse(e.postData.contents);

    // 2. 구글시트에 저장
    saveToSheet(data);

    // 3. 버즈빌 API 호출 (주석 해제 후 사용)
    // const buzzvilResult = callBuzzvilApi(data);

    // 4. 성공 응답
    return createResponse({
      success: true,
      message: '신청이 완료되었습니다.'
    });

  } catch (error) {
    Logger.log('오류 발생: ' + error.message);
    return createResponse({
      success: false,
      error: error.message
    });
  }
}

/**
 * GET 요청 처리 (테스트용)
 */
function doGet(e) {
  return createResponse({
    status: 'ok',
    message: 'Apps Script 백엔드가 정상 작동 중입니다.'
  });
}

/**
 * 구글시트에 데이터 저장
 */
function saveToSheet(data) {
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);

  if (!sheet) {
    throw new Error('시트를 찾을 수 없습니다: ' + SHEET_NAME);
  }

  // 첫 행이 비어있으면 헤더 추가
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['제출일시', '이름', '연락처', '이메일', '개인정보동의', '버즈빌응답']);
  }

  // 데이터 행 추가
  const row = [
    new Date(),                    // 제출일시
    data.name || '',               // 이름
    data.phone || '',              // 연락처
    data.email || '',              // 이메일
    data.privacy ? 'Y' : 'N',      // 개인정보동의
    ''                             // 버즈빌응답 (API 호출 후 업데이트)
  ];

  sheet.appendRow(row);
  Logger.log('시트에 저장 완료: ' + data.name);

  return sheet.getLastRow();
}

/**
 * 버즈빌 API 호출
 * (API 명세서 수령 후 구현 완료)
 */
function callBuzzvilApi(data) {
  // TODO: 버즈빌 API 명세서에 맞게 수정
  const payload = {
    // 버즈빌에서 요구하는 필드들
    user_id: data.phone,  // 예시: 연락처를 user_id로 사용
    mission_type: 'form_submit',
    // ... 추가 필드
  };

  const options = {
    method: 'POST',
    contentType: 'application/json',
    headers: {
      'Authorization': 'Bearer ' + BUZZVIL_API_KEY,
      // 추가 헤더
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  try {
    const response = UrlFetchApp.fetch(BUZZVIL_API_URL, options);
    const result = JSON.parse(response.getContentText());
    Logger.log('버즈빌 API 응답: ' + JSON.stringify(result));
    return result;
  } catch (error) {
    Logger.log('버즈빌 API 오류: ' + error.message);
    throw error;
  }
}

/**
 * JSON 응답 생성
 */
function createResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * 테스트 함수 - Apps Script 에디터에서 실행
 */
function testSaveToSheet() {
  const testData = {
    name: '테스트 사용자',
    phone: '010-1234-5678',
    email: 'test@example.com',
    privacy: true,
    timestamp: new Date().toISOString()
  };

  try {
    const rowNumber = saveToSheet(testData);
    Logger.log('테스트 성공! 행 번호: ' + rowNumber);
  } catch (error) {
    Logger.log('테스트 실패: ' + error.message);
  }
}
