// 모달 열기/닫기 헬퍼
function setupModal(btnId, modalId) {
    const btn = document.getElementById(btnId);
    const modal = document.getElementById(modalId);
    if (!btn || !modal) return;

    btn.addEventListener('click', () => {
        modal.classList.add('active');
        modal.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
    });

    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('active');
            modal.setAttribute('aria-hidden', 'true');
            document.body.style.overflow = '';
        }
    });

    modal.querySelector('.modal-close').addEventListener('click', () => {
        modal.classList.remove('active');
        modal.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
    });
}

setupModal('coverage-detail-btn', 'modal-coverage');
setupModal('premium-detail-btn', 'modal-premium');
setupModal('refund-detail-btn', 'modal-refund');

// 공통 초기화
initLanding({
    project: '암보험-A',
    sheetId: '11MKLOt1BwPG-cXKohjaCTZdgda3aw85Z6irEiFufxdw',
    tabId: 1427695074,

    buildFields() {
        return {
            '이름': document.getElementById('applicant-name').value.trim(),
            '연락처': document.getElementById('phone').value.trim(),
            '상담시간': document.getElementById('consult-time').value,
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

        if (!fields['상담시간']) {
            showHelpText(document.getElementById('consult-time'), '상담시간을 선택해주세요.');
            document.getElementById('consult-time').focus();
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
});