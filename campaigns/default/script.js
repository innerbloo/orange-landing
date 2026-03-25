// Cloudflare Worker API URL (배포 후 실제 URL로 교체)
const API_URL = 'https://planetdb.co.kr/api/submit';

// DOM 요소
const form = document.getElementById('landing-form');
const submitBtn = document.getElementById('submit-btn');
const btnText = submitBtn.querySelector('.btn-text');
const btnLoading = submitBtn.querySelector('.btn-loading');
const formMessage = document.getElementById('form-message');

// 프로젝트명 (로컬스토리지 키로도 사용)
const PROJECT = '오렌지플래닛';

// 로컬스토리지 중복 체크 (1차 차단)
if (localStorage.getItem(`submitted_${PROJECT}`)) {
    submitBtn.disabled = true;
    showMessage('이미 신청하셨습니다.', 'error');
}

// 폼 제출 처리
form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // 이미 제출 중이면 무시
    if (submitBtn.disabled) return;

    // 폼 데이터 수집
    const formData = {
        // sheetId: '',     // 다른 스프레드시트 사용 시 시트 ID 입력
        project: PROJECT,  // 탭 이름 (새 랜딩 추가 시 변경)
        fields: {
            '이름': document.getElementById('name').value.trim(),
            '연락처': document.getElementById('phone').value.trim(),
            '이메일': document.getElementById('email').value.trim(),
            '개인정보동의': document.getElementById('privacy').checked ? 'Y' : 'N',
        }
    };

    // 유효성 검사
    if (!validateForm(formData.fields)) return;

    // 로딩 상태 표시
    setLoadingState(true);
    hideMessage();

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(formData)
        });

        const result = await response.json();

        if (result.success) {
            localStorage.setItem(`submitted_${PROJECT}`, 'true');
            showMessage('신청이 완료되었습니다. 감사합니다!', 'success');
            form.reset();
            submitBtn.disabled = true;
        } else {
            showMessage(result.error || '오류가 발생했습니다.', 'error');
        }

    } catch (error) {
        console.error('제출 오류:', error);
        showMessage('오류가 발생했습니다. 잠시 후 다시 시도해주세요.', 'error');
    } finally {
        setLoadingState(false);
    }
});

// 유효성 검사
function validateForm(fields) {
    // 이름 검사
    if (!fields['이름']) {
        showMessage('이름을 입력해주세요.', 'error');
        document.getElementById('name').focus();
        return false;
    }

    // 연락처 검사
    if (!fields['연락처']) {
        showMessage('연락처를 입력해주세요.', 'error');
        document.getElementById('phone').focus();
        return false;
    }

    // 연락처 형식 검사 (간단한 패턴)
    const phonePattern = /^01[0-9]-?[0-9]{3,4}-?[0-9]{4}$/;
    if (!phonePattern.test(fields['연락처'].replace(/-/g, ''))) {
        showMessage('올바른 연락처 형식을 입력해주세요.', 'error');
        document.getElementById('phone').focus();
        return false;
    }

    // 이메일 형식 검사 (선택사항이지만 입력 시 검사)
    if (fields['이메일']) {
        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailPattern.test(fields['이메일'])) {
            showMessage('올바른 이메일 형식을 입력해주세요.', 'error');
            document.getElementById('email').focus();
            return false;
        }
    }

    // 개인정보 동의 검사
    if (fields['개인정보동의'] !== 'Y') {
        showMessage('개인정보 수집 및 이용에 동의해주세요.', 'error');
        return false;
    }

    return true;
}

// 로딩 상태 설정
function setLoadingState(isLoading) {
    submitBtn.disabled = isLoading;
    btnText.hidden = isLoading;
    btnLoading.hidden = !isLoading;
}

// 메시지 표시
function showMessage(text, type) {
    formMessage.textContent = text;
    formMessage.className = `form-message ${type}`;
    formMessage.hidden = false;

    // 메시지로 스크롤
    formMessage.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// 메시지 숨기기
function hideMessage() {
    formMessage.hidden = true;
}

// 연락처 자동 포맷팅
document.getElementById('phone').addEventListener('input', (e) => {
    let value = e.target.value.replace(/[^0-9]/g, '');

    if (value.length > 3 && value.length <= 7) {
        value = value.slice(0, 3) + '-' + value.slice(3);
    } else if (value.length > 7) {
        value = value.slice(0, 3) + '-' + value.slice(3, 7) + '-' + value.slice(7, 11);
    }

    e.target.value = value;
});
