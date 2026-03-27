const API_URL = 'https://planetdb.co.kr/api/submit';

// DOM 요소
const form = document.getElementById('landing-form');
const submitBtn = document.getElementById('submit-btn');
const btnText = submitBtn.querySelector('.btn-text');
const btnLoading = submitBtn.querySelector('.btn-loading');
const formMessage = document.getElementById('form-message');

// 프로젝트명
const PROJECT = '펫보험A';

// 반려동물 타입 토글
let petType = 'cat';
document.querySelectorAll('.pet-type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.pet-type-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        petType = btn.dataset.type;
    });
});

// 전체 동의 체크박스
document.getElementById('agree-all').addEventListener('change', (e) => {
    document.querySelectorAll('.agree-item').forEach(cb => {
        cb.checked = e.target.checked;
    });
});

document.querySelectorAll('.agree-item').forEach(cb => {
    cb.addEventListener('change', () => {
        const allChecked = [...document.querySelectorAll('.agree-item')].every(c => c.checked);
        document.getElementById('agree-all').checked = allChecked;
    });
});

// 폼 제출 처리
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (submitBtn.disabled) return;

    // 로컬스토리지 중복 체크 (1차 차단)
    const phoneValue = document.getElementById('phone').value.replace(/-/g, '');
    if (localStorage.getItem(`submitted_${PROJECT}_${phoneValue}`)) {
        showMessage('이미 신청하셨습니다.', 'error');
        return;
    }

    const formData = {
        project: PROJECT,
        fields: {
            '반려동물유형': petType === 'cat' ? '반려묘' : '반려견',
            '보호자이름': document.getElementById('guardian-name').value.trim(),
            '연락처': document.getElementById('phone').value.trim(),
            '보호자생년월일': document.getElementById('guardian-birth').value.trim(),
            '반려동물이름': document.getElementById('pet-name').value.trim(),
            '반려동물생년월일': document.getElementById('pet-birth').value.trim(),
            '품종': document.getElementById('pet-breed').value.trim(),
            '성별': document.getElementById('pet-gender').value.trim(),
            '몸무게': document.getElementById('pet-weight').value.trim(),
            '중성화여부': document.getElementById('pet-neutered').value.trim(),
            '개인정보동의': document.getElementById('privacy').checked ? 'Y' : 'N',
            '광고수신동의': document.getElementById('marketing').checked ? 'Y' : 'N',
        }
    };

    // 유효성 검사
    if (!validateForm(formData.fields)) return;

    setLoadingState(true);
    hideMessage();

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });

        const result = await response.json();

        if (result.success) {
            localStorage.setItem(`submitted_${PROJECT}_${phoneValue}`, 'true');
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
    if (!fields['보호자이름']) {
        showMessage('보호자 이름을 입력해주세요.', 'error');
        document.getElementById('guardian-name').focus();
        return false;
    }

    if (!fields['연락처']) {
        showMessage('연락처를 입력해주세요.', 'error');
        document.getElementById('phone').focus();
        return false;
    }

    // 연락처 형식 검사 (010-2XXX~9XXX만 허용)
    const phoneDigits = fields['연락처'].replace(/-/g, '');
    const phonePattern = /^010[2-9]\d{7}$/;
    if (!phonePattern.test(phoneDigits)) {
        showMessage('올바른 연락처를 입력해주세요.', 'error');
        document.getElementById('phone').focus();
        return false;
    }

    // 허위 번호 차단
    const middle = phoneDigits.slice(3, 7);
    const last = phoneDigits.slice(7, 11);
    const allSameDigit = /^(\d)\1{3}$/.test(middle) && /^(\d)\1{3}$/.test(last) && middle === last;
    const testNumbers = ['01012345678', '01056781234', '01011112222', '01099998888'];
    if (allSameDigit || testNumbers.includes(phoneDigits)) {
        showMessage('유효하지 않은 연락처입니다.', 'error');
        document.getElementById('phone').focus();
        return false;
    }

    if (!fields['보호자생년월일']) {
        showMessage('보호자 생년월일을 입력해주세요.', 'error');
        document.getElementById('guardian-birth').focus();
        return false;
    }

    if (!fields['반려동물이름']) {
        showMessage('반려동물 이름을 입력해주세요.', 'error');
        document.getElementById('pet-name').focus();
        return false;
    }

    if (fields['개인정보동의'] !== 'Y') {
        showMessage('개인정보 제3자 제공에 동의해주세요.', 'error');
        return false;
    }

    if (fields['광고수신동의'] !== 'Y') {
        showMessage('광고성 정보수신에 동의해주세요.', 'error');
        return false;
    }

    return true;
}

// 로딩 상태
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
    formMessage.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function hideMessage() {
    formMessage.hidden = true;
}

// 스크롤 fade-up 애니메이션
const fadeObserver = new IntersectionObserver(
    (entries) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
            }
        });
    },
    { threshold: 0.1 }
);
document.querySelectorAll('.fade-up').forEach((el) => fadeObserver.observe(el));

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
