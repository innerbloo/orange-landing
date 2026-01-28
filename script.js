// Google Apps Script 웹앱 URL (배포 후 실제 URL로 교체)
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxpoEk_WXzKvrc1cVsqIRckqY-zKF7PZipHhsvhmVvCqabWksQqsePJ-ebwEG6K1ZpS/exec';

// DOM 요소
const form = document.getElementById('landing-form');
const submitBtn = document.getElementById('submit-btn');
const btnText = submitBtn.querySelector('.btn-text');
const btnLoading = submitBtn.querySelector('.btn-loading');
const formMessage = document.getElementById('form-message');

// 폼 제출 처리
form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // 이미 제출 중이면 무시
    if (submitBtn.disabled) return;

    // 폼 데이터 수집
    const formData = {
        name: document.getElementById('name').value.trim(),
        phone: document.getElementById('phone').value.trim(),
        email: document.getElementById('email').value.trim(),
        privacy: document.getElementById('privacy').checked,
        timestamp: new Date().toISOString()
    };

    // 유효성 검사
    if (!validateForm(formData)) return;

    // 로딩 상태 표시
    setLoadingState(true);
    hideMessage();

    try {
        const response = await fetch(APPS_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors', // Apps Script CORS 우회
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(formData)
        });

        // no-cors 모드에서는 응답 본문을 읽을 수 없음
        // 성공으로 간주하고 처리
        showMessage('신청이 완료되었습니다. 감사합니다!', 'success');
        form.reset();

    } catch (error) {
        console.error('제출 오류:', error);
        showMessage('오류가 발생했습니다. 잠시 후 다시 시도해주세요.', 'error');
    } finally {
        setLoadingState(false);
    }
});

// 유효성 검사
function validateForm(data) {
    // 이름 검사
    if (!data.name) {
        showMessage('이름을 입력해주세요.', 'error');
        document.getElementById('name').focus();
        return false;
    }

    // 연락처 검사
    if (!data.phone) {
        showMessage('연락처를 입력해주세요.', 'error');
        document.getElementById('phone').focus();
        return false;
    }

    // 연락처 형식 검사 (간단한 패턴)
    const phonePattern = /^01[0-9]-?[0-9]{3,4}-?[0-9]{4}$/;
    if (!phonePattern.test(data.phone.replace(/-/g, ''))) {
        showMessage('올바른 연락처 형식을 입력해주세요.', 'error');
        document.getElementById('phone').focus();
        return false;
    }

    // 이메일 형식 검사 (선택사항이지만 입력 시 검사)
    if (data.email) {
        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailPattern.test(data.email)) {
            showMessage('올바른 이메일 형식을 입력해주세요.', 'error');
            document.getElementById('email').focus();
            return false;
        }
    }

    // 개인정보 동의 검사
    if (!data.privacy) {
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
