const API_URL = 'https://planetdb.co.kr/api/submit';

// DOM 요소
const form = document.getElementById('landing-form');
const submitBtn = document.getElementById('submit-btn');
const btnText = submitBtn.querySelector('.btn-text');
const btnLoading = submitBtn.querySelector('.btn-loading');
const formMessage = document.getElementById('form-message');

// 프로젝트명
const PROJECT = '펫보험-A';

// 반려동물 타입 토글
let petType = '';
document.querySelectorAll('.pet-type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.pet-type-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.querySelector('.pet-type-toggle').classList.add('selected');
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
        sheetId: '11MKLOt1BwPG-cXKohjaCTZdgda3aw85Z6irEiFufxdw',
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
            '중성화여부': document.getElementById('pet-neutered').value === '중성화 완료' ? 'Y' : 'N',
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
function showHelpText(el, msg) {
    clearHelpTexts();
    const help = document.createElement('p');
    help.className = 'form-help-text';
    help.textContent = msg;
    el.closest('.form-group, .agreement-section, .pet-type-toggle')?.appendChild(help);
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function clearHelpTexts() {
    document.querySelectorAll('.form-help-text').forEach(el => el.remove());
}

// 입력 시 해당 헬프텍스트 제거
document.querySelectorAll('.form-group input, .form-group select').forEach((el) => {
    const event = el.tagName === 'SELECT' ? 'change' : 'input';
    el.addEventListener(event, () => {
        const help = el.closest('.form-group')?.querySelector('.form-help-text');
        if (help) help.remove();
    });
});

function validateForm(fields) {
    clearHelpTexts();

    if (!fields['보호자이름']) {
        showHelpText(document.getElementById('guardian-name'), '보호자 이름을 입력해주세요.');
        document.getElementById('guardian-name').focus();
        return false;
    }

    if (!fields['연락처']) {
        showHelpText(document.getElementById('phone'), '연락처를 입력해주세요.');
        document.getElementById('phone').focus();
        return false;
    }

    // 연락처 형식 검사 (010-2XXX~9XXX만 허용)
    const phoneDigits = fields['연락처'].replace(/-/g, '');
    const phonePattern = /^010[2-9]\d{7}$/;
    if (!phonePattern.test(phoneDigits)) {
        showHelpText(document.getElementById('phone'), '올바른 연락처를 입력해주세요.');
        document.getElementById('phone').focus();
        return false;
    }

    // 허위 번호 차단
    const middle = phoneDigits.slice(3, 7);
    const last = phoneDigits.slice(7, 11);
    const allSameDigit = /^(\d)\1{3}$/.test(middle) && /^(\d)\1{3}$/.test(last) && middle === last;
    const testNumbers = ['01012345678', '01056781234', '01011112222', '01099998888'];
    if (allSameDigit || testNumbers.includes(phoneDigits)) {
        showHelpText(document.getElementById('phone'), '유효하지 않은 연락처입니다.');
        document.getElementById('phone').focus();
        return false;
    }

    if (!fields['보호자생년월일']) {
        showHelpText(document.getElementById('guardian-birth'), '보호자 생년월일을 입력해주세요.');
        document.getElementById('guardian-birth').focus();
        return false;
    }

    if (!fields['반려동물이름']) {
        showHelpText(document.getElementById('pet-name'), '반려동물 이름을 입력해주세요.');
        document.getElementById('pet-name').focus();
        return false;
    }

    if (!fields['반려동물생년월일']) {
        showHelpText(document.getElementById('pet-birth'), '반려동물 생년월일을 입력해주세요.');
        document.getElementById('pet-birth').focus();
        return false;
    }

    if (!fields['품종']) {
        showHelpText(document.getElementById('pet-breed'), '품종을 입력해주세요.');
        document.getElementById('pet-breed').focus();
        return false;
    }

    if (!fields['성별']) {
        showHelpText(document.getElementById('pet-gender'), '성별을 선택해주세요.');
        document.getElementById('pet-gender').focus();
        return false;
    }

    if (!fields['몸무게']) {
        showHelpText(document.getElementById('pet-weight'), '몸무게를 입력해주세요.');
        document.getElementById('pet-weight').focus();
        return false;
    }

    if (!fields['중성화여부']) {
        showHelpText(document.getElementById('pet-neutered'), '중성화 여부를 선택해주세요.');
        document.getElementById('pet-neutered').focus();
        return false;
    }

    if (!petType) {
        showHelpText(document.querySelector('.pet-type-toggle'), '반려동물 유형을 선택해주세요.');
        return false;
    }

    if (fields['개인정보동의'] !== 'Y') {
        showHelpText(document.getElementById('privacy'), '개인정보 제3자 제공에 동의해주세요.');
        return false;
    }

    if (fields['광고수신동의'] !== 'Y') {
        showHelpText(document.getElementById('marketing'), '광고성 정보수신에 동의해주세요.');
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

// 숫자 카운트업 애니메이션
const countObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        const target = parseInt(el.dataset.target);
        const suffix = el.dataset.suffix;
        const duration = 1500;
        const start = performance.now();

        function update(now) {
            const elapsed = now - start;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
            const current = Math.round(target * eased);
            el.textContent = current.toLocaleString() + suffix;
            if (progress < 1) requestAnimationFrame(update);
        }
        requestAnimationFrame(update);
        countObserver.unobserve(el);
    });
}, { threshold: 0.5 });
document.querySelectorAll('.count-up').forEach((el) => countObserver.observe(el));

// 체크포인트 카드 + 가입조건 카드 + 테이블 행 순차 애니메이션
const staggerObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const parent = entry.target;
        const items = parent.querySelectorAll('[data-stagger]');
        items.forEach((item, i) => {
            item.style.transitionDelay = `${i * 0.1}s`;
            setTimeout(() => item.classList.add('visible'), 10);
        });
        staggerObserver.unobserve(parent);
    });
}, { threshold: 0.15 });

// 체크포인트 카드에 data-stagger 추가
document.querySelectorAll('.checkpoint-card').forEach((el) => el.dataset.stagger = '');
const checkpointList = document.querySelector('.checkpoint-list');
if (checkpointList) staggerObserver.observe(checkpointList);

// 반려묘 카드에 data-stagger 추가
document.querySelectorAll('.cat-card').forEach((el) => el.dataset.stagger = '');
const catCardList = document.querySelector('.cat-card-list');
if (catCardList) staggerObserver.observe(catCardList);

// 가입조건 카드에 data-stagger 추가
document.querySelectorAll('.benefit-card').forEach((el) => el.dataset.stagger = '');
document.querySelectorAll('.benefit-column').forEach((col) => staggerObserver.observe(col));


// 플로팅 CTA 표시/숨김
const stickyCta = document.getElementById('sticky-cta');
let passedSection01 = false;

const stickyShowObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
        if (entry.boundingClientRect.bottom < 0) {
            passedSection01 = true;
            stickyCta.classList.add('show');
        } else if (entry.isIntersecting) {
            passedSection01 = false;
            stickyCta.classList.remove('show');
        }
    });
}, { threshold: 0 });

const stickyHideObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
        if (entry.isIntersecting) {
            stickyCta.classList.remove('show');
        } else if (passedSection01) {
            stickyCta.classList.add('show');
        }
    });
}, { threshold: 0.1 });

const section01 = document.querySelector('.section-01');
const section12 = document.querySelector('.section-12');
if (section01) stickyShowObserver.observe(section01);
if (section12) stickyHideObserver.observe(section12);

// 앵커 링크 smooth scroll
document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
        const target = document.querySelector(a.getAttribute('href'));
        if (target) {
            e.preventDefault();
            target.scrollIntoView({ behavior: 'smooth' });
        }
    });
});

// 모달 백그라운드 클릭으로 닫기 + 스크롤 방지
document.querySelectorAll('.modal-overlay').forEach((modal) => {
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('active');
            document.body.style.overflow = '';
        }
    });
});

document.querySelectorAll('.modal-close').forEach((btn) => {
    btn.addEventListener('click', () => {
        btn.closest('.modal-overlay').classList.remove('active');
        document.body.style.overflow = '';
    });
});

document.querySelectorAll('.more-link').forEach((link) => {
    link.addEventListener('click', () => {
        document.body.style.overflow = 'hidden';
    });
});

// select 선택 시 스타일 변경
document.querySelectorAll('.form-group select').forEach((select) => {
    select.addEventListener('change', (e) => {
        if (e.target.value) {
            e.target.classList.add('selected');
        } else {
            e.target.classList.remove('selected');
        }
    });
});

// 몸무게 자동 kg 포맷팅
document.getElementById('pet-weight').addEventListener('input', (e) => {
    let value = e.target.value.replace(/[^0-9.]/g, '');
    // 소수점 하나만 허용
    const parts = value.split('.');
    if (parts.length > 2) value = parts[0] + '.' + parts[1];
    // 정수 2자리, 소수 1자리 제한 (xx.x)
    if (parts[0].length > 2) parts[0] = parts[0].slice(0, 2);
    if (parts.length === 2 && parts[1].length > 1) parts[1] = parts[1].slice(0, 1);
    value = parts.length === 2 ? parts[0] + '.' + parts[1] : parts[0];
    if (value) {
        e.target.value = value + 'kg';
    } else {
        e.target.value = '';
    }
    const pos = e.target.value.length - 2;
    e.target.setSelectionRange(pos, pos);
});

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

// 생년월일 자동 포맷팅 (yyyy.mm.dd)
function formatBirthInput(e) {
    e.target.value = e.target.value.replace(/[^0-9]/g, '').slice(0, 8);
}

function formatBirthBlur(e) {
    let value = e.target.value.replace(/[^0-9]/g, '');
    if (!value) return;
    // 6자리 → yymmdd → yyyymmdd
    if (value.length === 6) {
        const yy = parseInt(value.slice(0, 2));
        const currentYY = new Date().getFullYear() % 100;
        const prefix = yy > currentYY ? '19' : '20';
        value = prefix + value;
    }
    if (value.length === 8) {
        e.target.value = value.slice(0, 4) + '.' + value.slice(4, 6) + '.' + value.slice(6);
    }
}

document.getElementById('guardian-birth').addEventListener('input', formatBirthInput);
document.getElementById('guardian-birth').addEventListener('blur', formatBirthBlur);
document.getElementById('pet-birth').addEventListener('input', formatBirthInput);
document.getElementById('pet-birth').addEventListener('blur', formatBirthBlur);
