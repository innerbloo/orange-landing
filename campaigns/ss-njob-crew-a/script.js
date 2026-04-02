// 설계사 경력 토글
let experience = '없음';
document.querySelectorAll('.experience-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.experience-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        experience = btn.dataset.value;
    });
});

// 공통 초기화
initLanding({
    project: 'N잡러-A',
    sheetId: '11MKLOt1BwPG-cXKohjaCTZdgda3aw85Z6irEiFufxdw',
    tabId: 732159719,

    buildFields() {
        return {
            '이름': document.getElementById('applicant-name').value.trim(),
            '연락처': document.getElementById('phone').value.trim(),
            '생년월일': document.getElementById('applicant-birth').value.trim(),
            '이메일': document.getElementById('applicant-email').value.trim(),
            '지역(시도)': document.getElementById('region-sido').value,
            '지역(구군)': document.getElementById('region-sigungu').value,
            '직업': document.getElementById('applicant-job').value.trim(),
            '추천인코드': document.getElementById('referral-code').value.trim(),
            '설계사경력': experience,
            '개인정보동의': document.getElementById('privacy').checked ? 'Y' : 'N',
            '광고수신동의': document.getElementById('marketing').checked ? 'Y' : 'N',
        };
    },

    validateFields(fields) {
        if (!fields['이름']) {
            showHelpText(document.getElementById('applicant-name'), '이름을 입력해주세요.');
            document.getElementById('applicant-name').focus();
            return false;
        }

        if (!validatePhone(fields)) return false;

        if (!fields['생년월일']) {
            showHelpText(document.getElementById('applicant-birth'), '생년월일을 입력해주세요.');
            document.getElementById('applicant-birth').focus();
            return false;
        }

        if (!fields['이메일']) {
            showHelpText(document.getElementById('applicant-email'), '이메일을 입력해주세요.');
            document.getElementById('applicant-email').focus();
            return false;
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields['이메일'])) {
            showHelpText(document.getElementById('applicant-email'), '올바른 이메일 형식을 입력해주세요.');
            document.getElementById('applicant-email').focus();
            return false;
        }

        if (!fields['지역(시도)']) {
            showHelpText(document.getElementById('region-sido'), '시/도를 선택해주세요.');
            document.getElementById('region-sido').focus();
            return false;
        }

        if (!fields['지역(구군)']) {
            showHelpText(document.getElementById('region-sigungu'), '구/군을 선택해주세요.');
            document.getElementById('region-sigungu').focus();
            return false;
        }

        if (!fields['직업']) {
            showHelpText(document.getElementById('applicant-job'), '직업을 입력해주세요.');
            document.getElementById('applicant-job').focus();
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
        experience = '없음';
        document.querySelectorAll('.experience-btn').forEach(b => b.classList.remove('active'));
        document.querySelector('.experience-btn[data-value="없음"]').classList.add('active');
    },
});