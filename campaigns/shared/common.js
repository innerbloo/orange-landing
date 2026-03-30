/**
 * 공통 랜딩 스크립트
 * 각 랜딩의 script.js에서 initLanding(config) 호출
 *
 * config = {
 *   project: '펫보험-A',
 *   sheetId: '시트ID' (선택),
 *   buildFields: () => ({ ... }),     // 폼 필드 매핑 함수
 *   validateFields: (fields) => true, // 유효성 검사 함수
 *   onReset: () => {},                // 리셋 시 추가 동작 (선택)
 * }
 */

const API_BASE = 'https://planetdb.co.kr/api';

// ── DOM 요소 ──
let form, submitBtn, formMessage, phoneInput;
let sendCodeBtn, verifyCodeGroup, verifyCodeInput, verifyCodeBtn, verifyTimerEl;

// ── 상태 ──
let phoneVerified = false;
let verifyTimer = null;
let cooldownTimer = null;
let _config = null;

// ── 초기화 ──
function initLanding(config) {
    _config = config;

    form = document.getElementById('landing-form');
    submitBtn = document.getElementById('submit-btn');

    formMessage = document.getElementById('form-message');
    phoneInput = document.getElementById('phone');
    sendCodeBtn = document.getElementById('send-code-btn');
    verifyCodeGroup = document.getElementById('verify-code-group');
    verifyCodeInput = document.getElementById('verify-code');
    verifyCodeBtn = document.getElementById('verify-code-btn');
    verifyTimerEl = document.getElementById('verify-timer');

    initSmsVerification();
    initAgreement();
    initFormSubmit();
    initHelpTextClear();
    initAnimations();
    initStickyCta();
    initSmoothScroll();
    initModals();
    initSelectStyle();
    initPhoneFormat();
    initBirthFormat();
}

// ── SMS 인증 ──
function initSmsVerification() {
    phoneInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (!sendCodeBtn.disabled) sendCodeBtn.click();
        }
    });

    sendCodeBtn.addEventListener('click', async () => {
        const phone = phoneInput.value.replace(/-/g, '');
        if (!/^010[2-9]\d{7}$/.test(phone)) {
            showHelpText(phoneInput, '올바른 연락처를 입력해주세요.');
            phoneInput.focus();
            return;
        }

        sendCodeBtn.disabled = true;
        verifyCodeGroup.style.display = '';
        verifyCodeInput.focus();

        try {
            const res = await fetch(`${API_BASE}/send-code`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone }),
            });
            const result = await res.json();

            if (result.success) {
                startTimer(180);
                sendCodeBtn.textContent = '재전송';
                // 재전송 쿨타임 30초
                let cooldown = 30;
                sendCodeBtn.innerHTML = `재전송<span class="cooldown-text">(${cooldown}초)</span>`;
                cooldownTimer = setInterval(() => {
                    cooldown--;
                    sendCodeBtn.innerHTML = `재전송<span class="cooldown-text">(${cooldown}초)</span>`;
                    if (cooldown <= 0) {
                        clearInterval(cooldownTimer);
                        cooldownTimer = null;
                        sendCodeBtn.textContent = '재전송';
                        sendCodeBtn.disabled = false;
                    }
                }, 1000);
            } else {
                verifyCodeGroup.style.display = 'none';
                showHelpText(phoneInput, result.error || 'SMS 발송에 실패했습니다.');
                sendCodeBtn.disabled = false;
            }
        } catch {
            verifyCodeGroup.style.display = 'none';
            showHelpText(phoneInput, 'SMS 발송 중 오류가 발생했습니다.');
            sendCodeBtn.disabled = false;
        }
    });

    let verifying = false;

    async function submitVerifyCode() {
        if (verifying) return;

        const phone = phoneInput.value.replace(/-/g, '');
        const code = verifyCodeInput.value.trim();

        if (code.length !== 6) {
            showHelpText(verifyCodeInput, '6자리 인증번호를 입력해주세요.');
            return;
        }

        verifying = true;
        verifyCodeBtn.disabled = true;

        try {
            const res = await fetch(`${API_BASE}/verify-code`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone, code }),
            });
            const result = await res.json();

            if (result.success) {
                phoneVerified = true;
                clearInterval(verifyTimer);
                if (cooldownTimer) { clearInterval(cooldownTimer); cooldownTimer = null; }
                verifyTimerEl.textContent = '';
                verifyCodeGroup.style.display = 'none';
                sendCodeBtn.textContent = '인증완료';
                sendCodeBtn.disabled = true;
                sendCodeBtn.classList.add('verified');
                phoneInput.readOnly = true;
            } else {
                showHelpText(verifyCodeInput, result.error || '인증에 실패했습니다.');
                verifyCodeInput.value = '';
                verifyCodeInput.focus();
            }
        } catch {
            showHelpText(verifyCodeInput, '인증 확인 중 오류가 발생했습니다.');
            verifyCodeInput.value = '';
            verifyCodeInput.focus();
        } finally {
            verifying = false;
            if (!phoneVerified) verifyCodeBtn.disabled = false;
        }
    }

    verifyCodeBtn.addEventListener('click', submitVerifyCode);

    // 6자리 입력 완료 시 자동 검증
    verifyCodeInput.addEventListener('input', () => {
        if (verifyCodeInput.value.trim().length === 6) {
            submitVerifyCode();
        }
    });

    phoneInput.addEventListener('input', () => {
        if (phoneVerified) {
            phoneVerified = false;
            phoneInput.readOnly = false;
            sendCodeBtn.textContent = '인증요청';
            verifyCodeGroup.style.display = 'none';
            verifyCodeInput.value = '';
            clearInterval(verifyTimer);
            verifyTimerEl.textContent = '';
        }

    });
}

function startTimer(seconds) {
    clearInterval(verifyTimer);
    let remaining = seconds;
    updateTimerDisplay(remaining);
    verifyTimer = setInterval(() => {
        remaining--;
        updateTimerDisplay(remaining);
        if (remaining <= 0) {
            clearInterval(verifyTimer);
            verifyTimerEl.textContent = '인증시간이 만료되었습니다. 다시 요청해주세요.';
        }
    }, 1000);
}

function updateTimerDisplay(sec) {
    const m = String(Math.floor(sec / 60)).padStart(2, '0');
    const s = String(sec % 60).padStart(2, '0');
    verifyTimerEl.textContent = `${m}:${s}`;
}

// ── 동의 체크박스 ──
function initAgreement() {
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
}

// ── 폼 제출 ──
function initFormSubmit() {
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (submitBtn.disabled) return;

        const formData = {
            project: _config.project,
            fields: _config.buildFields(),
        };
        if (_config.sheetId) formData.sheetId = _config.sheetId;
        if (_config.tabId != null) formData.tabId = _config.tabId;

        // 랜딩별 검증 (이름 → 연락처+인증 → 나머지 필드)
        if (!_config.validateFields(formData.fields)) return;

        const phoneValue = phoneInput.value.replace(/-/g, '');
        if (localStorage.getItem(`submitted_${_config.project}_${phoneValue}`)) {
            alert('이미 신청하셨습니다.');
            return;
        }

        setLoadingState(true);

        try {
            const response = await fetch(`${API_BASE}/submit`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            if (!response.ok) {
                alert('서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
                return;
            }

            const result = await response.json();

            if (result.success) {
                localStorage.setItem(`submitted_${_config.project}_${phoneValue}`, 'true');
                alert('소중한 문의 감사합니다.\n빠른 시일 내에 연락드리겠습니다.');
                form.reset();
                resetVerification();
                document.querySelectorAll('.form-group select').forEach(s => s.classList.remove('selected'));
                submitBtn.disabled = true;
                if (_config.onReset) _config.onReset();
            } else {
                alert(result.error || '오류가 발생했습니다.');
            }
        } catch (error) {
            console.error('제출 오류:', error);
            alert('인터넷 연결을 확인해주세요.');
        } finally {
            setLoadingState(false);
        }
    });
}

function resetVerification() {
    phoneVerified = false;
    phoneInput.readOnly = false;
    sendCodeBtn.textContent = '인증요청';
    sendCodeBtn.disabled = false;
    sendCodeBtn.classList.remove('verified');
    verifyCodeGroup.style.display = 'none';
    verifyCodeInput.value = '';
    clearInterval(verifyTimer);
    if (cooldownTimer) { clearInterval(cooldownTimer); cooldownTimer = null; }
    verifyTimerEl.textContent = '';
}

// ── 공통 검증 (연락처 + SMS 인증) ──
function validatePhone(fields) {
    clearHelpTexts();

    if (!fields['연락처']) {
        showHelpText(phoneInput, '연락처를 입력해주세요.');
        phoneInput.focus();
        return false;
    }

    const phoneDigits = fields['연락처'].replace(/-/g, '');
    if (!/^010[2-9]\d{7}$/.test(phoneDigits)) {
        showHelpText(phoneInput, '올바른 연락처를 입력해주세요.');
        phoneInput.focus();
        return false;
    }

    const middle = phoneDigits.slice(3, 7);
    const last = phoneDigits.slice(7, 11);
    const allSameDigit = /^(\d)\1{3}$/.test(middle) && /^(\d)\1{3}$/.test(last) && middle === last;
    const testNumbers = ['01012345678', '01056781234', '01011112222', '01099998888'];
    if (allSameDigit || testNumbers.includes(phoneDigits)) {
        showHelpText(phoneInput, '유효하지 않은 연락처입니다.');
        phoneInput.focus();
        return false;
    }

    if (!phoneVerified) {
        showHelpText(phoneInput, '휴대폰 인증을 완료해주세요.');
        phoneInput.focus();
        return false;
    }

    return true;
}

// ── 헬프 텍스트 ──
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

function initHelpTextClear() {
    document.querySelectorAll('.form-group input, .form-group select').forEach((el) => {
        const event = el.tagName === 'SELECT' ? 'change' : 'input';
        el.addEventListener(event, () => {
            const help = el.closest('.form-group')?.querySelector('.form-help-text');
            if (help) help.remove();
        });
    });
}

// ── 로딩/메시지 ──
function setLoadingState(isLoading) {
    submitBtn.disabled = isLoading;
}

function showMessage(text, type) {
    formMessage.textContent = text;
    formMessage.className = `form-message ${type}`;
    formMessage.hidden = false;
    formMessage.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function hideMessage() {
    formMessage.hidden = true;
}

// ── 애니메이션 ──
function initAnimations() {
    // fade-up
    const fadeObserver = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) entry.target.classList.add('visible');
            });
        },
        { threshold: 0.2, rootMargin: '0px 0px -60px 0px' }
    );
    document.querySelectorAll('.fade-up').forEach((el) => fadeObserver.observe(el));

    // count-up
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
                const eased = 1 - Math.pow(1 - progress, 3);
                const current = Math.round(target * eased);
                el.textContent = current.toLocaleString() + suffix;
                if (progress < 1) requestAnimationFrame(update);
            }
            requestAnimationFrame(update);
            countObserver.unobserve(el);
        });
    }, { threshold: 0.5, rootMargin: '0px 0px -60px 0px' });
    document.querySelectorAll('.count-up').forEach((el) => countObserver.observe(el));

    // stagger (순차 애니메이션)
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
    }, { threshold: 0.25, rootMargin: '0px 0px -60px 0px' });

    document.querySelectorAll('.checkpoint-card').forEach((el) => el.dataset.stagger = '');
    const checkpointList = document.querySelector('.checkpoint-list');
    if (checkpointList) staggerObserver.observe(checkpointList);

    document.querySelectorAll('.cat-card').forEach((el) => el.dataset.stagger = '');
    const catCardList = document.querySelector('.cat-card-list');
    if (catCardList) staggerObserver.observe(catCardList);

    document.querySelectorAll('.benefit-card').forEach((el) => el.dataset.stagger = '');
    document.querySelectorAll('.benefit-column').forEach((col) => staggerObserver.observe(col));
}

// ── 플로팅 CTA ──
function initStickyCta() {
    const stickyCta = document.getElementById('sticky-cta');
    if (!stickyCta) return;
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
}

// ── 앵커 스크롤 ──
function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach((a) => {
        a.addEventListener('click', (e) => {
            const target = document.querySelector(a.getAttribute('href'));
            if (target) {
                e.preventDefault();
                target.scrollIntoView({ behavior: 'smooth' });
            }
        });
    });
}

// ── 모달 ──
function initModals() {
    let lastFocusedEl = null;
    let savedOverflow = '';

    function openModal(modal) {
        lastFocusedEl = document.activeElement;
        savedOverflow = document.body.style.overflow;
        modal.classList.add('active');
        modal.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
        const focusable = modal.querySelector('.modal-close');
        if (focusable) focusable.focus();
    }

    function closeModal(modal) {
        modal.classList.remove('active');
        modal.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = savedOverflow;
        if (lastFocusedEl) lastFocusedEl.focus();
    }

    document.querySelectorAll('.modal-overlay').forEach((modal) => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal(modal);
        });

        modal.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                closeModal(modal);
                return;
            }
            if (e.key !== 'Tab') return;
            const focusableEls = modal.querySelectorAll('button, [href], [tabindex]:not([tabindex="-1"])');
            if (!focusableEls.length) return;
            const first = focusableEls[0];
            const last = focusableEls[focusableEls.length - 1];
            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        });
    });

    document.querySelectorAll('.modal-close').forEach((btn) => {
        btn.addEventListener('click', () => closeModal(btn.closest('.modal-overlay')));
    });

    document.querySelectorAll('.more-link').forEach((link) => {
        link.addEventListener('click', () => {
            const modalId = link.closest('.agreement-item').querySelector('.agree-item').id;
            const modal = document.getElementById(modalId === 'privacy' ? 'modal-privacy' : 'modal-marketing');
            if (modal) openModal(modal);
        });
    });
}

// ── select 스타일 ──
function initSelectStyle() {
    document.querySelectorAll('.form-group select').forEach((select) => {
        select.addEventListener('change', (e) => {
            if (e.target.value) {
                e.target.classList.add('selected');
            } else {
                e.target.classList.remove('selected');
            }
        });
    });
}

// ── 연락처 자동 포맷 ──
function initPhoneFormat() {
    document.getElementById('phone').addEventListener('input', (e) => {
        let value = e.target.value.replace(/[^0-9]/g, '');
        if (value.length > 3 && value.length <= 7) {
            value = value.slice(0, 3) + '-' + value.slice(3);
        } else if (value.length > 7) {
            value = value.slice(0, 3) + '-' + value.slice(3, 7) + '-' + value.slice(7, 11);
        }
        e.target.value = value;
    });
}

// ── 생년월일 자동 포맷 ──
function initBirthFormat() {
    function formatBirthInput(e) {
        e.target.value = e.target.value.replace(/[^0-9]/g, '').slice(0, 8);
    }

    function formatBirthBlur(e) {
        let value = e.target.value.replace(/[^0-9]/g, '');
        if (!value) return;
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

    document.querySelectorAll('[data-format="birth"]').forEach((el) => {
        el.addEventListener('input', formatBirthInput);
        el.addEventListener('blur', formatBirthBlur);
    });
}
