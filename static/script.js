document.addEventListener('DOMContentLoaded', () => {
  const stepEmail = document.getElementById('stepEmail');
  const stepOtp = document.getElementById('stepOtp');
  const stepDashboard = document.getElementById('stepDashboard');
  const tabLogin = document.getElementById('tabLogin');
  const tabRegister = document.getElementById('tabRegister');
  const tabRecover = document.getElementById('tabRecover');
  const formTitle = document.getElementById('formTitle');
  const formSubtitle = document.getElementById('formSubtitle');
  const groupFullname = document.getElementById('groupFullname');
  const groupEmail = document.getElementById('groupEmail');
  const inputFullname = document.getElementById('inputFullname');
  const inputEmail = document.getElementById('inputEmail');
  const emailTip = document.getElementById('emailTip');
  const btnSendText = document.getElementById('btnSendText');
  const btnToggleMode = document.getElementById('btnToggleMode');
  const toggleQuestion = document.getElementById('toggleQuestion');
  const formSendOtp = document.getElementById('formSendOtp');
  const btnSendOtp = document.getElementById('btnSendOtp');
  const btnDevLogin = document.getElementById('btnDevLogin');
  const passkeySeparator = document.getElementById('passkeySeparator');
  const spinnerSend = document.getElementById('spinnerSend');
  const emailAlert = document.getElementById('emailAlert');
  const btnPasskeyLogin = document.getElementById('btnPasskeyLogin');
  const passkeyLoginAlert = document.getElementById('passkeyLoginAlert');
  const formPasskeyRegistration = document.getElementById('formPasskeyRegistration');
  const btnRegisterPasskey = document.getElementById('btnRegisterPasskey');
  const passkeyRegistrationAlert = document.getElementById('passkeyRegistrationAlert');
  const otpActionBadge = document.getElementById('otpActionBadge');
  const formVerifyOtp = document.getElementById('formVerifyOtp');
  const otpEmailField = document.getElementById('otpEmailField');
  const otpValueField = document.getElementById('otpValueField');
  const displayEmail = document.getElementById('displayEmail');
  const btnChangeEmail = document.getElementById('btnChangeEmail');
  const otpInputs = document.querySelectorAll('.otp-digit');
  const otpInputsContainer = document.getElementById('otpInputsContainer');
  const btnVerifyOtp = document.getElementById('btnVerifyOtp');
  const spinnerVerify = document.getElementById('spinnerVerify');
  const otpAlert = document.getElementById('otpAlert');
  const otpInstructions = document.getElementById('otpInstructions');
  const timerCounter = document.getElementById('timerCounter');
  const btnResendOtp = document.getElementById('btnResendOtp');
  const resendCooldown = document.getElementById('resendCooldown');
  const checkMailboxHint = document.getElementById('checkMailboxHint');
  const linkOpenMailbox = document.getElementById('linkOpenMailbox');
  const dashGreetingTitle = document.getElementById('dashGreetingTitle');
  const dashGreetingSubtitle = document.getElementById('dashGreetingSubtitle');
  const dashUserName = document.getElementById('dashUserName');
  const dashUserEmail = document.getElementById('dashUserEmail');
  const dashUserCreated = document.getElementById('dashUserCreated');
  const dashLoginTime = document.getElementById('dashLoginTime');
  const avatarInitial = document.getElementById('avatarInitial');
  const btnLogout = document.getElementById('btnLogout');
  const usersList = document.getElementById('usersList');
  const countUsers = document.getElementById('countUsers');
  const btnRefreshUsers = document.getElementById('btnRefreshUsers');
  const navProviderBadge = document.getElementById('navProviderBadge');
  const savedAccountsSection = document.getElementById('savedAccountsSection');
  const appVersion = document.getElementById('appVersion');
  let currentMode = 'login';
  let currentProvider = 'gmail';
  let devLoginEnabled = false;
  let currentOtpIsDev = false;
  let currentEmail = '';
  let currentFullname = '';
  let expiryInterval = null;
  let cooldownInterval = null;
  setMode('login');
  checkSession();
  checkConfigStatus();
  function setMode(mode) {
    currentMode = mode;
    hideAlert(emailAlert);
    hideAlert(passkeyLoginAlert);
    [tabLogin, tabRegister, tabRecover].forEach(tab => tab.classList.remove('active'));
    tabLogin.classList.toggle('active', mode === 'login');
    tabRegister.classList.toggle('active', mode === 'register');
    tabRecover.classList.toggle('active', mode === 'recover');

    if (mode === 'login') {
      btnSendOtp.classList.add('hidden');
      btnDevLogin.classList.add('hidden');
      passkeySeparator.classList.add('hidden');
      btnPasskeyLogin.classList.remove('hidden');
      groupFullname.classList.add('hidden');
      groupEmail.classList.add('hidden');
      inputFullname.required = false;
      formTitle.textContent = 'Đăng nhập bằng Passkey';
      formSubtitle.textContent = 'Dùng passkey đã đăng ký trên thiết bị hoặc trình quản lý mật khẩu của bạn.';
      emailTip.textContent = 'Đăng nhập chỉ hoàn tất sau khi máy chủ xác minh chữ ký passkey và Origin.';
      toggleQuestion.textContent = 'Chưa có tài khoản?';
      btnToggleMode.textContent = 'Tạo tài khoản mới';
    } else if (mode === 'register') {
      btnSendOtp.classList.remove('hidden');
      btnDevLogin.classList.toggle('hidden', !devLoginEnabled);
      passkeySeparator.classList.add('hidden');
      btnPasskeyLogin.classList.add('hidden');
      groupFullname.classList.remove('hidden');
      groupEmail.classList.remove('hidden');
      inputFullname.required = true;
      formTitle.textContent = 'Tạo tài khoản mới';
      formSubtitle.textContent = 'Xác minh quyền truy cập email, sau đó tạo passkey để hoàn tất đăng ký.';
      btnSendText.textContent = 'Xác minh email';
      emailTip.textContent = 'OTP chỉ xác minh email. Nó không đăng nhập; chỉ passkey gắn với tên miền thật mới có thể hoàn tất.';
      toggleQuestion.textContent = 'Đã có tài khoản?';
      btnToggleMode.textContent = 'Đăng nhập bằng Passkey';
    } else {
      btnSendOtp.classList.remove('hidden');
      btnDevLogin.classList.toggle('hidden', !devLoginEnabled);
      passkeySeparator.classList.add('hidden');
      btnPasskeyLogin.classList.add('hidden');
      groupFullname.classList.add('hidden');
      groupEmail.classList.remove('hidden');
      inputFullname.required = false;
      formTitle.textContent = 'Khôi phục quyền truy cập';
      formSubtitle.textContent = 'Xác minh email rồi đăng ký passkey mới trên tên miền thật.';
      btnSendText.textContent = 'Xác minh email để khôi phục';
      emailTip.textContent = 'OTP không đăng nhập tài khoản. Một passkey mới phải được xác minh trên đúng tên miền.';
      toggleQuestion.textContent = 'Quay lại đăng nhập?';
      btnToggleMode.textContent = 'Đăng nhập bằng Passkey';
    }
  }

  tabLogin.addEventListener('click', () => setMode('login'));
  tabRegister.addEventListener('click', () => setMode('register'));
  tabRecover.addEventListener('click', () => setMode('recover'));
  btnToggleMode.addEventListener('click', () => {
    setMode(currentMode === 'login' ? 'register' : 'login');
  });

  async function checkSession() {
    try {
      const res = await fetch('/api/me');
      const data = await res.json();
      if (data.authenticated && data.user) {
        showDashboard(data.user, 'Đăng nhập bằng passkey thành công!');
      } else if (data.pending_passkey && data.user) {
        showDashboard(data.user, 'Hoàn tất bằng passkey', 'Email đã xác minh, nhưng bạn chưa đăng nhập.', true);
      }
    } catch (e) {
      console.log('Session check error:', e);
    }
  }

  async function checkConfigStatus() {
    try {
      const res = await fetch('/api/config');
      const data = await res.json();
      currentProvider = data.provider || 'gmail';
      devLoginEnabled = data.dev_login_enabled === true;
      if (appVersion && data.app_version) {
        appVersion.textContent = `v${data.app_version}`;
      }
      setMode(currentMode);
      const providerLabel = currentProvider === 'gmail' ? 'Gmail' : 'Mailtrap';
      navProviderBadge.textContent = data.is_configured
        ? `${providerLabel} email verification`
        : 'Email verification unavailable';
      if (currentProvider === 'gmail') {
        linkOpenMailbox.href = 'https://mail.google.com';
        linkOpenMailbox.textContent = 'Mở Gmail kiểm tra thư ↗';
      } else {
        linkOpenMailbox.href = 'https://mailtrap.io/inboxes';
        linkOpenMailbox.textContent = 'Mở Mailtrap kiểm tra thư ↗';
      }
    } catch (e) {
      console.error('Config status error:', e);
    }
  }

  function switchStep(stepName) {
    stepEmail.classList.remove('active');
    stepOtp.classList.remove('active');
    stepDashboard.classList.remove('active');

    if (stepName === 'email') stepEmail.classList.add('active');
    if (stepName === 'otp') stepOtp.classList.add('active');
    if (stepName === 'dashboard') stepDashboard.classList.add('active');
  }

  function showAlert(elem, msg, type = 'error') {
    elem.className = `alert-box ${type}`;
    elem.textContent = msg;
    elem.classList.remove('hidden');
  }

  function hideAlert(elem) {
    elem.classList.add('hidden');
    elem.textContent = '';
  }

  function base64urlToBuffer(value) {
    const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
    return Uint8Array.from(atob(padded), char => char.charCodeAt(0)).buffer;
  }

  function bufferToBase64url(buffer) {
    let binary = '';
    new Uint8Array(buffer).forEach(byte => { binary += String.fromCharCode(byte); });
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  }

  function preparePasskeyOptions(options) {
    options.challenge = base64urlToBuffer(options.challenge);
    if (options.user) options.user.id = base64urlToBuffer(options.user.id);
    for (const credential of options.allowCredentials || []) {
      credential.id = base64urlToBuffer(credential.id);
    }
    for (const credential of options.excludeCredentials || []) {
      credential.id = base64urlToBuffer(credential.id);
    }
    return options;
  }

  function serializePasskeyCredential(credential) {
    const response = {
      clientDataJSON: bufferToBase64url(credential.response.clientDataJSON)
    };
    if ('attestationObject' in credential.response) {
      response.attestationObject = bufferToBase64url(credential.response.attestationObject);
      response.transports = credential.response.getTransports?.() || [];
    }
    if ('authenticatorData' in credential.response) {
      response.authenticatorData = bufferToBase64url(credential.response.authenticatorData);
      response.signature = bufferToBase64url(credential.response.signature);
      response.userHandle = credential.response.userHandle
        ? bufferToBase64url(credential.response.userHandle)
        : null;
    }
    return {
      id: credential.id,
      rawId: bufferToBase64url(credential.rawId),
      type: credential.type,
      response,
      clientExtensionResults: credential.getClientExtensionResults(),
      authenticatorAttachment: credential.authenticatorAttachment
    };
  }

  async function postPasskey(endpoint, formElement, fields = {}) {
    const formData = new FormData(formElement);
    Object.entries(fields).forEach(([name, value]) => {
      const serialized = typeof value === 'string' ? value : JSON.stringify(value);
      if (name === 'credential') {
        formData.append(name, serialized);
      } else {
        formData.set(name, serialized);
      }
    });
    const response = await fetch(endpoint, {
      method: 'POST',
      credentials: 'same-origin',
      body: formData
    });
    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.message || 'Passkey operation failed.');
    }
    return data;
  }

  async function submitPasskeyLogin() {
    hideAlert(passkeyLoginAlert);
    if (!window.isSecureContext || !navigator.credentials?.get) {
      showAlert(passkeyLoginAlert, 'Passkeys require HTTPS (localhost is allowed) and a compatible browser.');
      return;
    }
    btnPasskeyLogin.disabled = true;
    try {
      const { ceremony_id, options } = await postPasskey(
        '/api/passkeys/authenticate/options',
        formSendOtp,
        { action: 'authenticate' }
      );
      const assertion = await navigator.credentials.get({
        publicKey: preparePasskeyOptions(options)
      });
      if (!assertion) throw new Error('Passkey authentication was cancelled.');
      const result = await postPasskey('/api/passkeys/authenticate/verify', formSendOtp, {
        action: 'authenticate',
        ceremony_id,
        credential: serializePasskeyCredential(assertion)
      });
      showDashboard(result.user, 'Passkey login successful!');
    } catch (error) {
      showAlert(passkeyLoginAlert, error.name === 'NotAllowedError'
        ? 'Passkey authentication was cancelled or timed out.'
        : error.message);
    } finally {
      btnPasskeyLogin.disabled = false;
    }
  }

  formPasskeyRegistration.addEventListener('submit', async (event) => {
    event.preventDefault();
    hideAlert(passkeyRegistrationAlert);
    if (!window.isSecureContext || !navigator.credentials?.create) {
      showAlert(passkeyRegistrationAlert, 'Passkeys require HTTPS (localhost is allowed) and a compatible browser.');
      return;
    }
    btnRegisterPasskey.disabled = true;
    try {
      const { ceremony_id, options } = await postPasskey(
        '/api/passkeys/register/options',
        formPasskeyRegistration
      );
      const attestation = await navigator.credentials.create({
        publicKey: preparePasskeyOptions(options)
      });
      if (!attestation) throw new Error('Passkey registration was cancelled.');
      const result = await postPasskey('/api/passkeys/register/verify', formPasskeyRegistration, {
        ceremony_id,
        credential: serializePasskeyCredential(attestation)
      });
      showDashboard(result.user, 'Passkey đã sẵn sàng', 'Xác thực bằng passkey đã hoàn tất.');
    } catch (error) {
      showAlert(passkeyRegistrationAlert, error.name === 'NotAllowedError'
        ? 'Passkey registration was cancelled or timed out.'
        : error.message);
    } finally {
      btnRegisterPasskey.disabled = false;
    }
  });
  formSendOtp.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (e.submitter === btnPasskeyLogin) {
      await submitPasskeyLogin();
      return;
    }
    await requestOtp(e.submitter === btnDevLogin);
  });

  async function requestOtp(useDevOtp) {
    hideAlert(emailAlert);

    const email = inputEmail.value.trim().toLowerCase();
    const fullname = inputFullname.value.trim();

    if (!email) {
      showAlert(emailAlert, 'Vui lòng nhập địa chỉ email!');
      return;
    }

    if (currentMode === 'register' && !fullname) {
      showAlert(emailAlert, 'Vui lòng nhập Họ và tên để tạo tài khoản!');
      inputFullname.focus();
      return;
    }

    if (useDevOtp) {
      btnDevLogin.disabled = true;
      btnDevLogin.textContent = 'Đang tạo OTP thử nghiệm...';
    } else {
      setLoading(btnSendOtp, spinnerSend, true);
    }

    try {
      const formData = new FormData(formSendOtp);
      formData.set('email', email);
      formData.set('action', currentMode);
      formData.set('fullname', fullname);
      const res = await fetch(useDevOtp ? '/api/dev/send-otp' : '/api/send-otp', {
        method: 'POST',
        body: formData
      });

      const data = await res.json();

      if (res.ok && data.success) {
        currentEmail = email;
        currentFullname = fullname;
        currentOtpIsDev = useDevOtp;
        displayEmail.textContent = email;

        otpActionBadge.textContent = currentMode === 'register'
          ? '✨ Xác minh email để tạo tài khoản'
          : '🔐 Xác minh email để đăng ký lại passkey';

        switchStep('otp');
        clearOtpInputs();
        if (useDevOtp && data.otp) {
          String(data.otp).split('').forEach((digit, index) => {
            if (otpInputs[index]) otpInputs[index].value = digit;
          });
          otpInstructions.textContent = 'OTP thử nghiệm đã được tạo và điền sẵn; không email nào được gửi. Nhấn xác thực để tiếp tục.';
          showAlert(otpAlert, data.message, 'success');
          btnVerifyOtp.focus();
        } else {
          otpInstructions.textContent = '💡 Kiểm tra Hộp thư đến (hoặc mục Spam/Quảng cáo) → Copy mã dán thẳng vào ô';
          otpInputs[0].focus();
        }
        startExpiryTimer(data.expires_in || 300);
        startCooldownTimer(data.cooldown || 45);
      } else {
        showAlert(emailAlert, data.message || 'Không thể gửi mã OTP.');

        if (data.already_exists) {
          setTimeout(() => setMode('login'), 2200);
        }
      }
    } catch (err) {
      showAlert(emailAlert, 'Lỗi kết nối máy chủ! Hãy kiểm tra server có đang chạy không.');
    } finally {
      if (useDevOtp) {
        btnDevLogin.disabled = false;
        btnDevLogin.textContent = 'Dev login · không gửi email';
      } else {
        setLoading(btnSendOtp, spinnerSend, false);
      }
    }
  }

  btnChangeEmail.addEventListener('click', () => {
    clearInterval(expiryInterval);
    clearInterval(cooldownInterval);
    currentOtpIsDev = false;
    switchStep('email');
    inputEmail.focus();
  });
  otpInputs.forEach((input, index) => {
    input.addEventListener('input', (e) => {
      const val = e.target.value.replace(/[^0-9]/g, '');
      e.target.value = val;

      if (val && index < otpInputs.length - 1) {
        otpInputs[index + 1].focus();
      }

      checkAutoSubmit();
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace') {
        if (!input.value && index > 0) {
          otpInputs[index - 1].focus();
        }
      }
    });

    input.addEventListener('paste', (e) => {
      e.preventDefault();
      const pasteData = (e.clipboardData || window.clipboardData).getData('text').trim();
      const digits = pasteData.replace(/[^0-9]/g, '').slice(0, 6);

      if (digits.length > 0) {
        digits.split('').forEach((digit, i) => {
          if (otpInputs[i]) {
            otpInputs[i].value = digit;
          }
        });

        const focusTarget = Math.min(digits.length, otpInputs.length - 1);
        otpInputs[focusTarget].focus();

        if (digits.length === 6) {
          checkAutoSubmit();
        }
      }
    });
  });

  function clearOtpInputs() {
    otpInputs.forEach(i => i.value = '');
    hideAlert(otpAlert);
  }

  function getEnteredOtp() {
    return Array.from(otpInputs).map(i => i.value.trim()).join('');
  }

  function checkAutoSubmit() {
    const code = getEnteredOtp();
    if (code.length === 6) {
      submitVerifyOtp();
    }
  }
  formVerifyOtp.addEventListener('submit', (e) => {
    e.preventDefault();
    submitVerifyOtp();
  });

  async function submitVerifyOtp() {
    hideAlert(otpAlert);
    const otp = getEnteredOtp();

    if (otp.length !== 6) {
      showAlert(otpAlert, 'Vui lòng nhập đủ 6 chữ số mã OTP!');
      return;
    }

    setLoading(btnVerifyOtp, spinnerVerify, true);

    try {
      otpEmailField.value = currentEmail;
      otpValueField.value = otp;
      const formData = new FormData(formVerifyOtp);
      const res = await fetch('/api/verify-otp', {
        method: 'POST',
        body: formData
      });

      const data = await res.json();

      if (res.ok && data.success) {
        clearInterval(expiryInterval);
        clearInterval(cooldownInterval);
        const title = data.action === 'register' ? 'Hoàn tất bằng passkey' : 'Đăng ký passkey mới';
        showDashboard(data.user, title, data.message, true);
      } else {
        otpInputsContainer.classList.add('shake');
        setTimeout(() => otpInputsContainer.classList.remove('shake'), 500);
        showAlert(otpAlert, data.message || 'Mã OTP không chính xác!');
      }
    } catch (err) {
      showAlert(otpAlert, 'Lỗi kết nối máy chủ khi xác thực OTP!');
    } finally {
      setLoading(btnVerifyOtp, spinnerVerify, false);
    }
  }
  btnResendOtp.addEventListener('click', async () => {
    if (btnResendOtp.disabled) return;
    hideAlert(otpAlert);

    btnResendOtp.disabled = true;
    btnResendOtp.textContent = 'Đang gửi...';

    try {
      const formData = new FormData(formSendOtp);
      formData.set('email', currentEmail);
      formData.set('action', currentMode);
      formData.set('fullname', currentFullname);
      const res = await fetch(currentOtpIsDev ? '/api/dev/send-otp' : '/api/send-otp', {
        method: 'POST',
        body: formData
      });

      const data = await res.json();

      if (res.ok && data.success) {
        clearOtpInputs();
        if (currentOtpIsDev && data.otp) {
          String(data.otp).split('').forEach((digit, index) => {
            if (otpInputs[index]) otpInputs[index].value = digit;
          });
          showAlert(otpAlert, 'OTP thử nghiệm mới đã được điền sẵn; không email nào được gửi.', 'success');
        } else {
          otpInputs[0].focus();
          showAlert(otpAlert, 'Mã OTP mới đã được gửi vào hòm thư!', 'success');
        }
        startExpiryTimer(data.expires_in || 300);
        startCooldownTimer(data.cooldown || 45);
      } else {
        showAlert(otpAlert, data.message || 'Chưa thể gửi lại mã OTP.');
      }
    } catch (err) {
      showAlert(otpAlert, 'Lỗi khi gửi lại mã OTP.');
      btnResendOtp.disabled = false;
      btnResendOtp.textContent = 'Gửi lại mã';
    }
  });

  function startExpiryTimer(seconds) {
    clearInterval(expiryInterval);
    let remaining = seconds;
    updateTimerDisplay(remaining);

    expiryInterval = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        clearInterval(expiryInterval);
        timerCounter.textContent = '00:00 (Hết hạn)';
        showAlert(otpAlert, 'Mã OTP đã hết hạn, vui lòng bấm Gửi lại mã!');
      } else {
        updateTimerDisplay(remaining);
      }
    }, 1000);
  }

  function updateTimerDisplay(sec) {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    timerCounter.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  function startCooldownTimer(seconds) {
    clearInterval(cooldownInterval);
    let cd = seconds;
    btnResendOtp.disabled = true;
    btnResendOtp.innerHTML = `Gửi lại (<span id="resendCooldown">${cd}</span>s)`;

    cooldownInterval = setInterval(() => {
      cd -= 1;
      if (cd <= 0) {
        clearInterval(cooldownInterval);
        btnResendOtp.disabled = false;
        btnResendOtp.textContent = 'Gửi lại mã';
      } else {
        const span = document.getElementById('resendCooldown');
        if (span) span.textContent = cd;
      }
    }, 1000);
  }
  function showDashboard(user, title = 'Đăng nhập bằng passkey thành công!', subtitle = '', pendingPasskey = false) {
    hideAlert(passkeyRegistrationAlert);
    dashGreetingTitle.textContent = title;
    dashGreetingSubtitle.textContent = subtitle || (pendingPasskey
      ? 'Email đã xác minh, nhưng bạn chưa đăng nhập. Tạo passkey để tiếp tục.'
      : 'Đã xác thực bằng passkey.');
    dashUserName.textContent = user.fullname || 'Người dùng';
    dashUserEmail.textContent = user.email || currentEmail;
    dashUserCreated.textContent = user.created_at || 'Mới tạo';
    dashLoginTime.textContent = pendingPasskey ? 'Chưa đăng nhập' : (user.last_login || new Date().toLocaleTimeString());
    avatarInitial.textContent = (user.fullname || user.email || 'U').charAt(0).toUpperCase();
    savedAccountsSection.classList.toggle('hidden', pendingPasskey);
    btnLogout.querySelector('span').textContent = pendingPasskey ? 'Hủy và quay lại đăng nhập' : 'Đăng xuất tài khoản';
    if (!pendingPasskey) loadUsersList();
    switchStep('dashboard');
  }

  async function loadUsersList() {
    try {
      const res = await fetch('/api/users');
      const data = await res.json();
      if (res.ok && data.success) {
        renderUsersList(data.users);
      }
    } catch (e) {
      console.error('Load users error:', e);
    }
  }

  function renderUsersList(users) {
    countUsers.textContent = users.length;
    usersList.innerHTML = '';

    if (!users || users.length === 0) {
      usersList.innerHTML = '<div style="text-align: center; color: #94a3b8; padding: 12px; font-size: 13px;">Chưa có tài khoản nào được lưu.</div>';
      return;
    }

    users.forEach(u => {
      const item = document.createElement('div');
      item.className = 'user-item';
      const initial = (u.fullname || u.email).charAt(0).toUpperCase();
      item.innerHTML = `
        <div class="user-item-left">
          <div class="user-mini-avatar">${escapeHtml(initial)}</div>
          <div>
            <div class="user-item-name">${escapeHtml(u.fullname || 'Chưa đặt tên')}</div>
            <div class="user-item-email">${escapeHtml(u.email)}</div>
          </div>
        </div>
        <div class="user-item-date">${escapeHtml(u.created_at || '')}</div>
      `;
      usersList.appendChild(item);
    });
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  btnRefreshUsers.addEventListener('click', loadUsersList);

  btnLogout.addEventListener('click', async () => {
    try {
      await fetch('/api/logout', { method: 'POST' });
    } catch (e) {
      console.error(e);
    }
    currentEmail = '';
    currentFullname = '';
    hideAlert(passkeyLoginAlert);
    hideAlert(passkeyRegistrationAlert);
    inputEmail.value = '';
    inputFullname.value = '';
    clearOtpInputs();
    setMode('login');
    switchStep('email');
  });
  function setLoading(btn, spinner, isLoading) {
    if (isLoading) {
      btn.disabled = true;
      spinner.classList.remove('hidden');
    } else {
      btn.disabled = false;
      spinner.classList.add('hidden');
    }
  }
});
