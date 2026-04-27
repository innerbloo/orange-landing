// 반려동물 타입 토글 (펫보험 전용)
let petType = '';
document.querySelectorAll('.pet-type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.pet-type-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        petType = btn.dataset.type;
    });
});

// 몸무게 자동 kg 포맷팅 (펫보험 전용)
document.getElementById('pet-weight').addEventListener('input', (e) => {
    let value = e.target.value.replace(/[^0-9.]/g, '');
    const parts = value.split('.');
    if (parts.length > 2) value = parts[0] + '.' + parts[1];
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

// 공통 초기화
initLanding({
    project: '펫보험-B',
    sheetId: '11MKLOt1BwPG-cXKohjaCTZdgda3aw85Z6irEiFufxdw',
    tabId: 1399894241,  // 시트 gid

    buildFields() {
        return {
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
            '성함과 연락처 기재 동의': document.getElementById('mission-1').checked ? 'Y' : 'N',
            '24시간 내 상품 관련 통화 동의': document.getElementById('mission-2').checked ? 'Y' : 'N',
            '개인정보동의': document.getElementById('privacy').checked ? 'Y' : 'N',
            '광고수신동의': document.getElementById('marketing').checked ? 'Y' : 'N',
        };
    },

    validateFields(fields) {
        if (!fields['보호자이름']) {
            showHelpText(document.getElementById('guardian-name'), '보호자 이름을 입력해주세요.');
            document.getElementById('guardian-name').focus();
            return false;
        }

        if (!validatePhone(fields)) return false;

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

        if (fields['성함과 연락처 기재 동의'] !== 'Y' || fields['24시간 내 상품 관련 통화 동의'] !== 'Y') {
            alert('미션을 먼저 완료해주세요.');
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
    },

    onReset() {
        petType = '';
        document.querySelectorAll('.pet-type-btn').forEach(b => b.classList.remove('active'));
    },
});
