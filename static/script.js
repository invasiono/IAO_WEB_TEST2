document.addEventListener('DOMContentLoaded', () => {
  // Elements - Steps
  const stepEmail = document.getElementById('stepEmail');
  const stepOtp = document.getElementById('stepOtp');
  const stepDashboard = document.getElementById('stepDashboard');

  // Elements - Tabs & Mode
  const tabLogin = document.getElementById('tabLogin');
  const tabRegister = document.getElementById('tabRegister');
  const formTitle = document.getElementById('formTitle');
  const formSubtitle = document.getElementById('formSubtitle');
  const groupFullname = document.getElementById('groupFullname');
  const inputFullname = document.getElementById('inputFullname');
  const inputEmail = document.getElementById('inputEmail');
  const emailTip = document.getElementById('emailTip');
  const btnSendText = document.getElementById('btnSendText');
  const btnToggleMode = document.getElementById('btnToggleMode');
  const toggleQuestion = document.getElementById('toggleQuestion');

  // Form 1: Send OTP
  const formSendOtp = document.getElementById('formSendOtp');
  const btnSendOtp = document.getElementById('btnSendOtp');
  const spinnerSend = document.getElementById('spinnerSend');
  const emailAlert = document.getElementById('emailAlert');
  const btnPasskeyLogin = document.getElementById('btnPasskeyLogin');
  const passkeyLoginAlert = document.getElementById('passkeyLoginAlert');
  const formPasskeyRegistration = document.getElementById('formPasskeyRegistration');
  const btnRegisterPasskey = document.getElementById('btnRegisterPasskey');
  const passkeyRegistrationAlert = document.getElementById('passkeyRegistrationAlert');

  // Form 2: OTP
  const otpActionBadge = document.getElementById('otpActionBadge');
  const formVerifyOtp = document.getElementById('formVerifyOtp');
  const displayEmail = document.getElementById('displayEmail');
  const btnChangeEmail = document.getElementById('btnChangeEmail');
  const otpInputs = document.querySelectorAll('.otp-digit');
  const otpInputsContainer = document.getElementById('otpInputsContainer');
  const btnVerifyOtp = document.getElementById('btnVerifyOtp');
  const spinnerVerify = document.getElementById('spinnerVerify');
  const otpAlert = document.getElementById('otpAlert');
  const timerCounter = document.getElementById('timerCounter');
  const btnResendOtp = document.getElementById('btnResendOtp');
  const resendCooldown = document.getElementById('resendCooldown');
  const checkMailboxHint = document.getElementById('checkMailboxHint');
  const linkOpenMailbox = document.getElementById('linkOpenMailbox');

  // Dashboard
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

  // Config Modal & Top Nav
  const btnConfigModal = document.getElementById('btnConfigModal');
  const modalConfig = document.getElementById('modalConfig');
  const btnCloseModal = document.getElementById('btnCloseModal');
  const btnCloseModalTriggers = document.querySelectorAll('.btn-close-modal-trigger');
  const statusDot = document.getElementById('statusDot');
  const configBtnText = document.getElementById('configBtnText');
  const navProviderBadge = document.getElementById('navProviderBadge');
  const openWebmailText = document.getElementById('openWebmailText');
  const btnOpenWebmail = document.getElementById('btnOpenWebmail');

  // Modal Provider Tabs
  const tabProviderGmail = document.getElementById('tabProviderGmail');
  const tabProviderMailtrap = document.getElementById('tabProviderMailtrap');
  const panelGmail = document.getElementById('panelGmail');
  const panelMailtrap = document.getElementById('panelMailtrap');

  // Gmail form elements
  const formConfigGmail = document.getElementById('formConfigGmail');
  const cfgGmailUser = document.getElementById('cfgGmailUser');
  const cfgGmailPassword = document.getElementById('cfgGmailPassword');
  const btnSaveGmail = document.getElementById('btnSaveGmail');
  const spinnerGmail = document.getElementById('spinnerGmail');
  const modalAlertGmail = document.getElementById('modalAlertGmail');

  // Mailtrap form elements
  const formConfigMailtrap = document.getElementById('formConfigMailtrap');
  const cfgMailtrapHost = document.getElementById('cfgMailtrapHost');
  const cfgMailtrapPort = document.getElementById('cfgMailtrapPort');
  const cfgMailtrapUser = document.getElementById('cfgMailtrapUser');
  const cfgMailtrapPass = document.getElementById('cfgMailtrapPass');
  const btnSaveMailtrap = document.getElementById('btnSaveMailtrap');
  const spinnerMailtrap = document.getElementById('spinnerMailtrap');
  const modalAlertMailtrap = document.getElementById('modalAlertMailtrap');

  // State
  let currentMode = 'login'; // 'login' or 'register'
  let currentProvider = 'gmail';
  let currentEmail = '';
  let currentFullname = '';
  let expiryInterval = null;
  let cooldownInterval = null;

  // 1. Initialize
  checkSession();
  checkConfigStatus();

  // Mode Switching (Login vs Register)
  function setMode(mode) {
    currentMode = mode;
    hideAlert(emailAlert);
    hideAlert(passkeyLoginAlert);

    if (mode === 'register') {
      btnPasskeyLogin.classList.add('hidden');
      tabRegister.classList.add('active');
      tabLogin.classList.remove('active');
      groupFullname.classList.remove('hidden');
      inputFullname.required = true;
      formTitle.textContent = 'Tạo tài khoản mới';
      formSubtitle.textContent = 'Đăng ký tài khoản và nhận mã OTP xác thực email gửi qua ' + (currentProvider === 'gmail' ? 'Gmail' : 'Mailtrap');
      btnSendText.textContent = 'Đăng ký & Gửi OTP';
      emailTip.textContent = '🔍 Hệ thống kiểm tra tên miền và máy chủ nhận thư (DNS MX) thực tế. Email đã tạo rồi sẽ không thể đăng ký lại.';
      toggleQuestion.textContent = 'Đã có tài khoản?';
      btnToggleMode.textContent = 'Đăng nhập ngay';
    } else {
      btnPasskeyLogin.classList.remove('hidden');
      tabLogin.classList.add('active');
      tabRegister.classList.remove('active');
      groupFullname.classList.add('hidden');
      inputFullname.required = false;
      formTitle.textContent = 'Đăng nhập bằng OTP';
      formSubtitle.textContent = 'Nhập email tài khoản đã có để nhận mã OTP gửi qua ' + (currentProvider === 'gmail' ? 'Gmail' : 'Mailtrap');
      btnSendText.textContent = 'Gửi mã OTP đăng nhập';
      emailTip.textContent = '🔍 Nhập đúng email thật đã đăng ký để nhận mã OTP an toàn.';
      toggleQuestion.textContent = 'Chưa có tài khoản?';
      btnToggleMode.textContent = 'Tạo tài khoản mới ngay';
    }
  }

  tabLogin.addEventListener('click', () => setMode('login'));
  tabRegister.addEventListener('click', () => setMode('register'));
  btnToggleMode.addEventListener('click', () => {
    setMode(currentMode === 'login' ? 'register' : 'login');
  });

  // Provider Tab Switching in Modal
  function setModalProvider(provider) {
    if (provider === 'gmail') {
      tabProviderGmail.classList.add('active');
      tabProviderMailtrap.classList.remove('active');
      panelGmail.classList.add('active');
      panelMailtrap.classList.remove('active');
    } else {
      tabProviderMailtrap.classList.add('active');
      tabProviderGmail.classList.remove('active');
      panelMailtrap.classList.add('active');
      panelGmail.classList.remove('active');
    }
  }

  tabProviderGmail.addEventListener('click', () => setModalProvider('gmail'));
  tabProviderMailtrap.addEventListener('click', () => setModalProvider('mailtrap'));

  async function checkSession() {
    try {
      const res = await fetch('/api/me');
      if (res.ok) {
        const data = await res.json();
        if (data.authenticated && data.user) {
          showDashboard(data.user, 'Đăng nhập thành công!');
        }
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

      if (data.is_configured) {
        statusDot.classList.add('connected');
        if (currentProvider === 'gmail') {
          configBtnText.textContent = `Gmail: ${data.gmail_user_masked || 'Đã kết nối'}`;
          navProviderBadge.textContent = 'Gmail SMTP (Gửi mail thật)';
          openWebmailText.textContent = 'Mở Gmail';
          btnOpenWebmail.onclick = () => window.open('https://mail.google.com', '_blank');
          linkOpenMailbox.href = 'https://mail.google.com';
          linkOpenMailbox.textContent = 'Mở Gmail kiểm tra thư ↗';
        } else {
          configBtnText.textContent = `Mailtrap: ${data.mailtrap_user_masked || 'Đã kết nối'}`;
          navProviderBadge.textContent = 'Mailtrap Sandbox';
          openWebmailText.textContent = 'Mở Mailtrap';
          btnOpenWebmail.onclick = () => window.open('https://mailtrap.io/sandboxes', '_blank');
          linkOpenMailbox.href = 'https://mailtrap.io/sandboxes';
          linkOpenMailbox.textContent = 'Mở Mailtrap Sandbox ↗';
        }
      } else {
        statusDot.classList.remove('connected');
        configBtnText.textContent = `Chưa cài đặt ${currentProvider === 'gmail' ? 'Gmail' : 'Mailtrap'}`;
      }

      if (data.gmail_user) cfgGmailUser.value = data.gmail_user;
      if (data.mailtrap_user) cfgMailtrapUser.value = data.mailtrap_user;
      if (data.mailtrap_host) cfgMailtrapHost.value = data.mailtrap_host;
      if (data.mailtrap_port) cfgMailtrapPort.value = data.mailtrap_port;

      setModalProvider(currentProvider);
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
      await postPasskey('/api/passkeys/register/verify', formPasskeyRegistration, {
        ceremony_id,
        credential: serializePasskeyCredential(attestation)
      });
      showAlert(passkeyRegistrationAlert, 'Passkey registered successfully on this device.', 'success');
    } catch (error) {
      showAlert(passkeyRegistrationAlert, error.name === 'NotAllowedError'
        ? 'Passkey registration was cancelled or timed out.'
        : error.message);
    } finally {
      btnRegisterPasskey.disabled = false;
    }
  });

  // 2. Handle Send OTP with Email Real Existence Check
  formSendOtp.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (e.submitter === btnPasskeyLogin) {
      await submitPasskeyLogin();
      return;
    }
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

    setLoading(btnSendOtp, spinnerSend, true);

    try {
      const res = await fetch('/api/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          action: currentMode,
          fullname
        })
      });

      const data = await res.json();

      if (res.ok && data.success) {
        currentEmail = email;
        currentFullname = fullname;
        displayEmail.textContent = email;

        if (currentMode === 'register') {
          otpActionBadge.textContent = '✨ Đang xác thực: Tạo tài khoản mới';
        } else {
          otpActionBadge.textContent = '🔐 Đang xác thực: Đăng nhập';
        }

        switchStep('otp');
        clearOtpInputs();
        otpInputs[0].focus();
        startExpiryTimer(data.expires_in || 300);
        startCooldownTimer(data.cooldown || 45);
      } else {
        // Hiển thị lỗi rõ ràng
        showAlert(emailAlert, data.message || 'Không thể gửi mã OTP.');

        if (data.already_exists) {
          setTimeout(() => setMode('login'), 2200);
        } else if (data.not_found) {
          setTimeout(() => setMode('register'), 2200);
        } else if (data.needs_config) {
          setTimeout(() => openConfigModal(), 700);
        }
      }
    } catch (err) {
      showAlert(emailAlert, 'Lỗi kết nối máy chủ! Hãy kiểm tra server có đang chạy không.');
    } finally {
      setLoading(btnSendOtp, spinnerSend, false);
    }
  });

  btnChangeEmail.addEventListener('click', () => {
    clearInterval(expiryInterval);
    clearInterval(cooldownInterval);
    switchStep('email');
    inputEmail.focus();
  });

  // 3. Handle OTP inputs behavior
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

  // 4. Handle Verify OTP
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
      const res = await fetch('/api/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: currentEmail, otp })
      });

      const data = await res.json();

      if (res.ok && data.success) {
        clearInterval(expiryInterval);
        clearInterval(cooldownInterval);
        const title = data.action === 'register' ? 'Tạo tài khoản thành công!' : 'Đăng nhập thành công!';
        showDashboard(data.user, title, data.message);
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

  // 5. Resend OTP Button
  btnResendOtp.addEventListener('click', async () => {
    if (btnResendOtp.disabled) return;
    hideAlert(otpAlert);

    btnResendOtp.disabled = true;
    btnResendOtp.textContent = 'Đang gửi...';

    try {
      const res = await fetch('/api/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: currentEmail,
          action: currentMode,
          fullname: currentFullname
        })
      });

      const data = await res.json();

      if (res.ok && data.success) {
        clearOtpInputs();
        otpInputs[0].focus();
        showAlert(otpAlert, 'Mã OTP mới đã được gửi vào hòm thư!', 'success');
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

  // 6. Dashboard & User Accounts List
  function showDashboard(user, title = 'Đăng nhập thành công!', subtitle = '') {
    hideAlert(passkeyRegistrationAlert);
    dashGreetingTitle.textContent = title;
    if (subtitle) {
      dashGreetingSubtitle.textContent = subtitle;
    }
    dashUserName.textContent = user.fullname || 'Người dùng';
    dashUserEmail.textContent = user.email || currentEmail;
    dashUserCreated.textContent = user.created_at || 'Mới tạo';
    dashLoginTime.textContent = user.last_login || new Date().toLocaleTimeString();
    avatarInitial.textContent = (user.fullname || user.email || 'U').charAt(0).toUpperCase();

    loadUsersList();
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

  // 7. Modal Handlers
  function openConfigModal() {
    hideAlert(modalAlertGmail);
    hideAlert(modalAlertMailtrap);
    modalConfig.classList.remove('hidden');
  }

  function closeConfigModal() {
    modalConfig.classList.add('hidden');
  }

  btnConfigModal.addEventListener('click', openConfigModal);
  btnCloseModal.addEventListener('click', closeConfigModal);
  btnCloseModalTriggers.forEach(btn => btn.addEventListener('click', closeConfigModal));

  modalConfig.addEventListener('click', (e) => {
    if (e.target === modalConfig) closeConfigModal();
  });

  // Save Gmail Config
  formConfigGmail.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAlert(modalAlertGmail);

    const payload = {
      provider: 'gmail',
      gmail_user: cfgGmailUser.value.trim(),
      gmail_password: cfgGmailPassword.value.trim()
    };

    if (!payload.gmail_user || !payload.gmail_password) {
      showAlert(modalAlertGmail, 'Vui lòng nhập Email Gmail và Mật khẩu ứng dụng 16 ký tự!');
      return;
    }

    setLoading(btnSaveGmail, spinnerGmail, true);

    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (res.ok && data.success) {
        showAlert(modalAlertGmail, data.message, 'success');
        checkConfigStatus();
        setTimeout(() => closeConfigModal(), 1200);
      } else {
        showAlert(modalAlertGmail, data.message || 'Lỗi khi lưu cấu hình Gmail.');
      }
    } catch (err) {
      showAlert(modalAlertGmail, 'Lỗi kết nối khi lưu cấu hình!');
    } finally {
      setLoading(btnSaveGmail, spinnerGmail, false);
    }
  });

  // Save Mailtrap Config
  formConfigMailtrap.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAlert(modalAlertMailtrap);

    const payload = {
      provider: 'mailtrap',
      mailtrap_host: cfgMailtrapHost.value.trim(),
      mailtrap_port: cfgMailtrapPort.value.trim(),
      mailtrap_user: cfgMailtrapUser.value.trim(),
      mailtrap_pass: cfgMailtrapPass.value.trim()
    };

    if (!payload.mailtrap_user || !payload.mailtrap_pass) {
      showAlert(modalAlertMailtrap, 'Vui lòng nhập Username và Password của Mailtrap!');
      return;
    }

    setLoading(btnSaveMailtrap, spinnerMailtrap, true);

    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (res.ok && data.success) {
        showAlert(modalAlertMailtrap, data.message, 'success');
        checkConfigStatus();
        setTimeout(() => closeConfigModal(), 1200);
      } else {
        showAlert(modalAlertMailtrap, data.message || 'Lỗi khi lưu cấu hình Mailtrap.');
      }
    } catch (err) {
      showAlert(modalAlertMailtrap, 'Lỗi kết nối khi lưu cấu hình!');
    } finally {
      setLoading(btnSaveMailtrap, spinnerMailtrap, false);
    }
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
