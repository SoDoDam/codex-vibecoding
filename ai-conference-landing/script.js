const registrationForm = document.querySelector('.registration-form');
const formStatus = document.querySelector('.form-status');

if (registrationForm && formStatus) {
  registrationForm.addEventListener('submit', (event) => {
    event.preventDefault();

    if (!registrationForm.checkValidity()) {
      registrationForm.reportValidity();
      return;
    }

    // 실제 등록 API 연동 전에는 성공 안내만 표시합니다.
    formStatus.textContent = '등록 정보가 준비되었습니다. 실제 접수 연동 후 안내 메일이 발송됩니다.';
  });
}
