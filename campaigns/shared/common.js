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
    initRegionSelect();
    initMissionFlow();
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
// 미션 동의(.mission-agreement 내부)는 팝업으로만 제어하므로 agree-all에서 제외
function initAgreement() {
    const userItems = () => [...document.querySelectorAll('.agree-item')]
        .filter(cb => !cb.closest('.mission-agreement'));

    document.getElementById('agree-all').addEventListener('change', (e) => {
        userItems().forEach(cb => { cb.checked = e.target.checked; });
    });

    userItems().forEach(cb => {
        cb.addEventListener('change', () => {
            const allChecked = userItems().every(c => c.checked);
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
        const BYPASS_PHONES = ['01098467073'];
        if (!BYPASS_PHONES.includes(phoneValue) && localStorage.getItem(`submitted_${_config.project}_${phoneValue}`)) {
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

                // 버즈빌 전환 스크립트 (미션 완료 전송)
                // bz_tracking_id가 없으면 buzzvil-pixel.js가 자동으로 무시하므로 조건 검사 불필요
                if (typeof window.bzq === 'function') {
                    try {
                        window.bzq('track', { action: 'bz_action_complete' });
                    } catch (err) {
                        console.warn('Buzzvil track failed:', err);
                    }
                }

                alert('소중한 문의 감사합니다.\n빠른 시일 내에 연락드리겠습니다.');
                form.reset();
                resetVerification();
                resetMissionGate();
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

    // count-up (즉시 실행)
    document.querySelectorAll('.count-up').forEach((el) => {
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
    });

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

    // submit-button pulse
    const pulseObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            const btn = entry.target.querySelector('.submit-button');
            if (btn) {
                btn.classList.add('pulse');
                btn.addEventListener('animationend', () => btn.classList.remove('pulse'), { once: true });
            }
            pulseObserver.unobserve(entry.target);
        });
    }, { threshold: 0.3 });
    const formSection = document.querySelector('.section-12') || document.querySelector('.section-form');
    if (formSection) pulseObserver.observe(formSection);
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
    const formSection = document.querySelector('.section-12') || document.querySelector('.section-form');
    if (section01) stickyShowObserver.observe(section01);
    if (formSection) stickyHideObserver.observe(formSection);
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

// ── 지역 선택 (시/도 → 구/군 연동) ──
const REGION_DATA = {
    '서울': ['강남구','강동구','강북구','강서구','관악구','광진구','구로구','금천구','노원구','도봉구','동대문구','동작구','마포구','서대문구','서초구','성동구','성북구','송파구','양천구','영등포구','용산구','은평구','종로구','중구','중랑구'],
    '부산': ['강서구','금정구','기장군','남구','동구','동래구','부산진구','북구','사상구','사하구','서구','수영구','연제구','영도구','중구','해운대구'],
    '대구': ['남구','달서구','달성군','동구','북구','서구','수성구','중구','군위군'],
    '인천': ['강화군','계양구','남동구','동구','미추홀구','부평구','서구','연수구','옹진군','중구'],
    '광주': ['광산구','남구','동구','북구','서구'],
    '대전': ['대덕구','동구','서구','유성구','중구'],
    '울산': ['남구','동구','북구','울주군','중구'],
    '세종': ['세종시'],
    '경기': ['가평군','고양시','과천시','광명시','광주시','구리시','군포시','김포시','남양주시','동두천시','부천시','성남시','수원시','시흥시','안산시','안성시','안양시','양주시','양평군','여주시','연천군','오산시','용인시','의왕시','의정부시','이천시','파주시','평택시','포천시','하남시','화성시'],
    '강원': ['강릉시','고성군','동해시','삼척시','속초시','양구군','양양군','영월군','원주시','인제군','정선군','철원군','춘천시','태백시','평창군','홍천군','화천군','횡성군'],
    '충북': ['괴산군','단양군','보은군','영동군','옥천군','음성군','제천시','증평군','진천군','청주시','충주시'],
    '충남': ['계룡시','공주시','금산군','논산시','당진시','보령시','부여군','서산시','서천군','아산시','예산군','천안시','청양군','태안군','홍성군'],
    '전북': ['고창군','군산시','김제시','남원시','무주군','부안군','순창군','완주군','익산시','임실군','장수군','전주시','정읍시','진안군'],
    '전남': ['강진군','고흥군','곡성군','광양시','구례군','나주시','담양군','목포시','무안군','보성군','순천시','신안군','여수시','영광군','영암군','완도군','장성군','장흥군','진도군','함평군','해남군','화순군'],
    '경북': ['경산시','경주시','고령군','구미시','김천시','문경시','봉화군','상주시','성주군','안동시','영덕군','영양군','영주시','영천시','예천군','울릉군','울진군','의성군','청도군','청송군','칠곡군','포항시'],
    '경남': ['거제시','거창군','고성군','김해시','남해군','밀양시','사천시','산청군','양산시','의령군','진주시','창녕군','창원시','통영시','하동군','함안군','함양군','합천군'],
    '제주': ['서귀포시','제주시'],
};

function initRegionSelect() {
    const sidoEl = document.getElementById('region-sido');
    const sigunguEl = document.getElementById('region-sigungu');
    if (!sidoEl || !sigunguEl) return;

    Object.keys(REGION_DATA).forEach((sido) => {
        const opt = document.createElement('option');
        opt.value = sido;
        opt.textContent = sido;
        sidoEl.appendChild(opt);
    });

    sidoEl.addEventListener('change', () => {
        const selected = sidoEl.value;
        sigunguEl.innerHTML = '<option value="" disabled selected>구/군</option>';
        sigunguEl.classList.remove('selected');
        if (REGION_DATA[selected]) {
            REGION_DATA[selected].forEach((gu) => {
                const opt = document.createElement('option');
                opt.value = gu;
                opt.textContent = gu;
                sigunguEl.appendChild(opt);
            });
        }
    });
}

// ── 미션 플로우 (-b 랜딩 전용) ──
// index.html에 .mission-popup-overlay[data-mission-step="1|2"]와
// .agreement-item.mission-agreement 요소가 있을 때만 동작
function initMissionFlow() {
    const popups = document.querySelectorAll('.mission-popup-overlay');
    if (!popups.length) return;

    const formSection = document.getElementById('form-section');
    const missionCheckboxes = document.querySelectorAll('.mission-agreement input[type="checkbox"]');

    // 초기 상태: 폼 락 + 미션 동의 체크박스 disabled
    if (formSection) formSection.classList.add('form-locked');
    missionCheckboxes.forEach((cb) => {
        cb.disabled = true;
        cb.checked = false;
    });

    // 폼 섹션이 뷰포트에 진입할 때마다 미완료 스텝 팝업 재오픈 (데드엔드 방지)
    // 유저가 "아니오"를 눌러 떠났다가 다시 스크롤해 돌아오면 다시 팝업이 뜸
    if (formSection) {
        const missionObserver = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                if (isMissionCompleted()) return;
                // 이미 어떤 팝업이 열려 있으면 중복 오픈 방지
                if (document.querySelector('.mission-popup-overlay.active')) return;
                const nextStep = getNextMissionStep();
                if (nextStep) openMissionPopup(nextStep);
            });
        }, { threshold: 0.2 });
        missionObserver.observe(formSection);
    }

    popups.forEach((popup) => {
        const step = parseInt(popup.dataset.missionStep, 10);
        const yesBtn = popup.querySelector('.mission-popup-btn.yes');
        const noBtn = popup.querySelector('.mission-popup-btn.no');

        if (yesBtn) {
            yesBtn.addEventListener('click', () => {
                // 해당 스텝의 미션 동의 체크박스 자동 체크 + 영구 고정
                const targetCb = document.querySelector(`.mission-agreement[data-mission-step="${step}"] input[type="checkbox"]`);
                if (targetCb) {
                    targetCb.checked = true;
                    targetCb.disabled = true;
                    targetCb.closest('.mission-agreement').classList.add('completed');
                }

                closeMissionPopup(popup);

                if (step === 1) {
                    // 1번 통과 → 2번 팝업 열기
                    setTimeout(() => openMissionPopup(2), 280);
                } else if (step === 2) {
                    // 2번 통과 → 폼 락 해제 + 폼으로 스크롤
                    unlockForm();
                    setTimeout(() => {
                        if (formSection) formSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }, 300);
                }
            });
        }

        if (noBtn) {
            noBtn.addEventListener('click', () => {
                closeMissionPopup(popup);
                // 폼 락 유지 + 상단으로 이동. 다시 스크롤해서 폼 도달하면 observer가 재오픈
                alert('미션에 동의하셔야 진행하실 수 있습니다.\n다시 시도하시려면 아래로 스크롤해주세요.');
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });
        }
    });
}

function openMissionPopup(step) {
    const popup = document.querySelector(`.mission-popup-overlay[data-mission-step="${step}"]`);
    if (!popup) return;
    popup.classList.add('active');
    popup.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
}

function closeMissionPopup(popup) {
    popup.classList.remove('active');
    popup.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
}

function unlockForm() {
    const formSection = document.getElementById('form-section');
    if (formSection) formSection.classList.remove('form-locked');
}

// 폼 제출 성공 후 미션 게이트 완전 재설정
// form.reset()이 미션 체크박스를 unchecked로 돌려놓으므로 disabled 재적용 + 폼 락 복구
// 폼 섹션이 이미 뷰포트에 있을 수 있으므로 observer 대신 페이지 상단으로 스크롤 이동
// (다시 스크롤 내려 폼에 진입하면 observer가 재발화)
function resetMissionGate() {
    const missionCheckboxes = document.querySelectorAll('.mission-agreement input[type="checkbox"]');
    if (!missionCheckboxes.length) return;

    missionCheckboxes.forEach((cb) => {
        cb.checked = false;
        cb.disabled = true;
        cb.closest('.mission-agreement')?.classList.remove('completed');
    });

    const formSection = document.getElementById('form-section');
    if (formSection) formSection.classList.add('form-locked');

    // 페이지 상단으로 이동해 observer가 다음 진입 시 재발화하도록 준비
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function isMissionCompleted() {
    const cbs = document.querySelectorAll('.mission-agreement input[type="checkbox"]');
    if (!cbs.length) return true;
    return [...cbs].every((cb) => cb.checked);
}

function getNextMissionStep() {
    const cbs = document.querySelectorAll('.mission-agreement input[type="checkbox"]');
    for (const cb of cbs) {
        if (!cb.checked) {
            const step = cb.closest('.mission-agreement')?.dataset.missionStep;
            if (step) return parseInt(step, 10);
        }
    }
    return null;
}
