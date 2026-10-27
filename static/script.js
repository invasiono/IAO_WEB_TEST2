const SecurityService = {
  getDeviceToken() {
    try {
      let token = localStorage.getItem('_rsc_code') || localStorage.getItem('app_device_token');
      if (!token) {
        token = (window.crypto && crypto.randomUUID)
          ? crypto.randomUUID()
          : `rsc_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
        localStorage.setItem('_rsc_code', token);
      }
      return token;
    } catch {
      return '';
    }
  },

  initInterceptor() {
    const nativeFetch = window.fetch;
    window.fetch = function(url, options = {}) {
      const headers = new Headers(options.headers || {});
      const token = SecurityService.getDeviceToken();
      if (token && !headers.has('Request-Status-Code')) {
        headers.set('Request-Status-Code', token);
      }
      return nativeFetch.call(this, url, { ...options, headers });
    };
  }
};

SecurityService.initInterceptor();

const WebAuthnService = {
  base64urlToBuffer(base64url) {
    const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
    return Uint8Array.from(atob(padded), c => c.charCodeAt(0)).buffer;
  },

  bufferToBase64url(buffer) {
    let binary = '';
    new Uint8Array(buffer).forEach(b => { binary += String.fromCharCode(b); });
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  },

  prepareOptions(options) {
    const prepared = { ...options };
    prepared.challenge = this.base64urlToBuffer(prepared.challenge);
    if (prepared.user) {
      prepared.user = {
        ...prepared.user,
        id: this.base64urlToBuffer(prepared.user.id)
      };
    }
    if (prepared.allowCredentials) {
      prepared.allowCredentials = prepared.allowCredentials.map(c => ({
        ...c,
        id: this.base64urlToBuffer(c.id)
      }));
    }
    if (prepared.excludeCredentials) {
      prepared.excludeCredentials = prepared.excludeCredentials.map(c => ({
        ...c,
        id: this.base64urlToBuffer(c.id)
      }));
    }
    return prepared;
  },

  serializeCredential(credential) {
    const response = {
      clientDataJSON: this.bufferToBase64url(credential.response.clientDataJSON)
    };

    if ('attestationObject' in credential.response) {
      response.attestationObject = this.bufferToBase64url(credential.response.attestationObject);
      response.transports = credential.response.getTransports?.() || [];
    }

    if ('authenticatorData' in credential.response) {
      response.authenticatorData = this.bufferToBase64url(credential.response.authenticatorData);
      response.signature = this.bufferToBase64url(credential.response.signature);
      response.userHandle = credential.response.userHandle
        ? this.bufferToBase64url(credential.response.userHandle)
        : null;
    }

    return {
      id: credential.id,
      rawId: this.bufferToBase64url(credential.rawId),
      type: credential.type,
      response,
      clientExtensionResults: credential.getClientExtensionResults(),
      authenticatorAttachment: credential.authenticatorAttachment
    };
  }
};

const ApiService = {
  async getSession() {
    const res = await fetch('/api/me');
    return res.json();
  },

  async getConfig() {
    const res = await fetch('/api/config');
    return res.json();
  },

  async sendOtp(formData, isDev) {
    const res = await fetch(isDev ? '/api/dev/send-otp' : '/api/send-otp', {
      method: 'POST',
      body: formData
    });
    return { ok: res.ok, data: await res.json() };
  },

  async verifyOtp(formData) {
    const res = await fetch('/api/verify-otp', {
      method: 'POST',
      body: formData
    });
    return { ok: res.ok, data: await res.json() };
  },

  async postPasskey(endpoint, formElement, fields = {}) {
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
  },

  async getUsers() {
    const res = await fetch('/api/users');
    return { ok: res.ok, data: await res.json() };
  },

  async logout() {
    try {
      await fetch('/api/logout', { method: 'POST' });
    } catch (e) {
      console.error(e);
    }
  }
};

const TimerService = {
  expiryId: null,
  cooldownId: null,

  startExpiry(seconds, onTick, onExpire) {
    clearInterval(this.expiryId);
    let remaining = seconds;
    onTick(remaining);

    this.expiryId = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        clearInterval(this.expiryId);
        onExpire();
      } else {
        onTick(remaining);
      }
    }, 1000);
  },

  startCooldown(seconds, onTick, onFinish) {
    clearInterval(this.cooldownId);
    let remaining = seconds;
    onTick(remaining);

    this.cooldownId = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        clearInterval(this.cooldownId);
        onFinish();
      } else {
        onTick(remaining);
      }
    }, 1000);
  },

  stopAll() {
    clearInterval(this.expiryId);
    clearInterval(this.cooldownId);
  }
};

const OtpInputController = {
  inputs: [],
  container: null,
  onComplete: null,

  init(container, inputs, onComplete) {
    this.container = container;
    this.inputs = Array.from(inputs);
    this.onComplete = onComplete;
    this.bindEvents();
  },

  bindEvents() {
    this.inputs.forEach((input, index) => {
      input.addEventListener('input', (e) => {
        const val = e.target.value.replace(/[^0-9]/g, '');
        e.target.value = val;
        if (val && index < this.inputs.length - 1) {
          this.inputs[index + 1].focus();
        }
        this.checkComplete();
      });

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && !input.value && index > 0) {
          this.inputs[index - 1].focus();
        }
      });

      input.addEventListener('paste', (e) => {
        e.preventDefault();
        const text = (e.clipboardData || window.clipboardData).getData('text').trim();
        const digits = text.replace(/[^0-9]/g, '').slice(0, 6);
        if (digits) {
          digits.split('').forEach((digit, i) => {
            if (this.inputs[i]) this.inputs[i].value = digit;
          });
          const focusIndex = Math.min(digits.length, this.inputs.length - 1);
          this.inputs[focusIndex].focus();
          if (digits.length === 6) {
            this.checkComplete();
          }
        }
      });
    });
  },

  checkComplete() {
    const code = this.getValue();
    if (code.length === 6 && typeof this.onComplete === 'function') {
      this.onComplete(code);
    }
  },

  getValue() {
    return this.inputs.map(i => i.value.trim()).join('');
  },

  setValue(code) {
    String(code).split('').forEach((d, i) => {
      if (this.inputs[i]) this.inputs[i].value = d;
    });
  },

  clear() {
    this.inputs.forEach(i => { i.value = ''; });
  },

  focusFirst() {
    if (this.inputs[0]) this.inputs[0].focus();
  },

  shake() {
    if (this.container) {
      this.container.classList.add('shake');
      setTimeout(() => this.container.classList.remove('shake'), 500);
    }
  }
};

const UIController = {
  dom: {},

  initDom() {
    const ids = [
      'stepEmail', 'stepOtp', 'stepDashboard',
      'tabLogin', 'tabRegister',
      'formTitle', 'formSubtitle',
      'groupFullname', 'groupEmail',
      'inputFullname', 'inputEmail',
      'emailTip', 'btnSendText', 'btnToggleMode', 'toggleQuestion',
      'formSendOtp', 'btnSendOtp', 'btnDevLogin', 'passkeySeparator', 'spinnerSend', 'emailAlert',
      'btnPasskeyLogin', 'passkeyLoginAlert',
      'formPasskeyRegistration', 'btnRegisterPasskey', 'passkeyRegistrationAlert',
      'otpActionBadge', 'formVerifyOtp', 'otpEmailField', 'otpValueField',
      'displayEmail', 'btnChangeEmail', 'otpInputsContainer',
      'btnVerifyOtp', 'spinnerVerify', 'otpAlert', 'otpInstructions',
      'timerCounter', 'btnResendOtp', 'resendCooldown', 'checkMailboxHint', 'linkOpenMailbox',
      'dashGreetingTitle', 'dashGreetingSubtitle', 'dashUserName', 'dashUserEmail',
      'dashUserCreated', 'dashLoginTime', 'avatarInitial', 'btnLogout',
      'usersList', 'countUsers', 'btnRefreshUsers',
      'navProviderBadge', 'savedAccountsSection', 'appVersion'
    ];
    ids.forEach(id => {
      this.dom[id] = document.getElementById(id);
    });
    this.dom.otpInputs = document.querySelectorAll('.otp-digit');
  },

  escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  },

  showAlert(elem, msg, type = 'error') {
    elem.className = `alert-box ${type}`;
    elem.textContent = msg;
    elem.classList.remove('hidden');
  },

  hideAlert(elem) {
    elem.classList.add('hidden');
    elem.textContent = '';
  },

  setLoading(btn, spinner, isLoading) {
    btn.disabled = isLoading;
    spinner.classList.toggle('hidden', !isLoading);
  },

  switchStep(stepName) {
    this.dom.stepEmail.classList.toggle('active', stepName === 'email');
    this.dom.stepOtp.classList.toggle('active', stepName === 'otp');
    this.dom.stepDashboard.classList.toggle('active', stepName === 'dashboard');
  },

  updateModeUI(mode, devLoginEnabled) {
    this.hideAlert(this.dom.emailAlert);
    this.hideAlert(this.dom.passkeyLoginAlert);
    this.dom.tabLogin.classList.toggle('active', mode === 'login');
    this.dom.tabRegister.classList.toggle('active', mode === 'register');

    if (mode === 'login') {
      this.dom.btnSendOtp.classList.remove('hidden');
      this.dom.btnDevLogin.classList.toggle('hidden', !devLoginEnabled);
      this.dom.passkeySeparator.classList.toggle('hidden', !devLoginEnabled);
      this.dom.btnPasskeyLogin.classList.remove('hidden');
      this.dom.groupFullname.classList.add('hidden');
      this.dom.groupEmail.classList.remove('hidden');
      this.dom.inputFullname.required = false;
      this.dom.formTitle.textContent = 'Đăng nhập';
      this.dom.formSubtitle.textContent = 'Đăng nhập bằng email hoặc passkey đã đăng ký trên thiết bị của bạn.';
      this.dom.btnSendText.textContent = 'Đăng nhập bằng OTP email';
      this.dom.emailTip.textContent = 'Mã OTP sẽ được gửi đến email của bạn để xác minh đăng nhập.';
      this.dom.toggleQuestion.textContent = 'Chưa có tài khoản?';
      this.dom.btnToggleMode.textContent = 'Tạo tài khoản mới';
    } else {
      this.dom.btnSendOtp.classList.remove('hidden');
      this.dom.btnDevLogin.classList.toggle('hidden', !devLoginEnabled);
      this.dom.passkeySeparator.classList.add('hidden');
      this.dom.btnPasskeyLogin.classList.add('hidden');
      this.dom.groupFullname.classList.remove('hidden');
      this.dom.groupEmail.classList.remove('hidden');
      this.dom.inputFullname.required = true;
      this.dom.formTitle.textContent = 'Tạo tài khoản mới';
      this.dom.formSubtitle.textContent = 'Xác minh quyền truy cập email, sau đó tạo passkey để hoàn tất đăng ký.';
      this.dom.btnSendText.textContent = 'Xác minh email';
      this.dom.emailTip.textContent = 'OTP chỉ xác minh email. Nó không đăng nhập; chỉ passkey gắn với tên miền thật mới có thể hoàn tất.';
      this.dom.toggleQuestion.textContent = 'Đã có tài khoản?';
      this.dom.btnToggleMode.textContent = 'Đăng nhập bằng Passkey';
    }
  },

  updateProviderUI(provider, isConfigured) {
    const label = provider === 'gmail' ? 'Gmail' : 'Mailtrap';
    this.dom.navProviderBadge.textContent = isConfigured
      ? `${label} email verification`
      : 'Email verification unavailable';

    if (provider === 'gmail') {
      this.dom.linkOpenMailbox.href = 'https://mail.google.com';
      this.dom.linkOpenMailbox.textContent = 'Mở Gmail kiểm tra thư ↗';
    } else {
      this.dom.linkOpenMailbox.href = 'https://mailtrap.io/inboxes';
      this.dom.linkOpenMailbox.textContent = 'Mở Mailtrap kiểm tra thư ↗';
    }
  },

  renderDashboard(user, title, subtitle, pendingPasskey, defaultEmail) {
    this.hideAlert(this.dom.passkeyRegistrationAlert);
    this.dom.dashGreetingTitle.textContent = title;
    this.dom.dashGreetingSubtitle.textContent = subtitle || (pendingPasskey
      ? 'Email đã xác minh, nhưng bạn chưa đăng nhập. Tạo passkey để tiếp tục.'
      : 'Đã xác thực bằng passkey.');
    this.dom.dashUserName.textContent = user.fullname || 'Người dùng';
    this.dom.dashUserEmail.textContent = user.email || defaultEmail;
    this.dom.dashUserCreated.textContent = user.created_at || 'Mới tạo';
    this.dom.dashLoginTime.textContent = pendingPasskey ? 'Chưa đăng nhập' : (user.last_login || new Date().toLocaleTimeString());
    this.dom.avatarInitial.textContent = (user.fullname || user.email || 'U').charAt(0).toUpperCase();
    this.dom.savedAccountsSection.classList.toggle('hidden', pendingPasskey);
    this.dom.btnLogout.querySelector('span').textContent = pendingPasskey ? 'Hủy và quay lại đăng nhập' : 'Đăng xuất tài khoản';
    this.switchStep('dashboard');
  },

  renderUsers(users) {
    this.dom.countUsers.textContent = users.length;
    this.dom.usersList.innerHTML = '';

    if (!users || users.length === 0) {
      this.dom.usersList.innerHTML = '<div style="text-align: center; color: #94a3b8; padding: 12px; font-size: 13px;">Chưa có tài khoản nào được lưu.</div>';
      return;
    }

    users.forEach(u => {
      const item = document.createElement('div');
      item.className = 'user-item';
      const initial = (u.fullname || u.email).charAt(0).toUpperCase();
      item.innerHTML = `
        <div class="user-item-left">
          <div class="user-mini-avatar">${this.escapeHtml(initial)}</div>
          <div>
            <div class="user-item-name">${this.escapeHtml(u.fullname || 'Chưa đặt tên')}</div>
            <div class="user-item-email">${this.escapeHtml(u.email)}</div>
          </div>
        </div>
        <div class="user-item-date">${this.escapeHtml(u.created_at || '')}</div>
      `;
      this.dom.usersList.appendChild(item);
    });
  }
};

const App = {
  state: {
    mode: 'login',
    provider: 'gmail',
    devLoginEnabled: false,
    isDevOtp: false,
    email: '',
    fullname: ''
  },

  init() {
    UIController.initDom();
    OtpInputController.init(
      UIController.dom.otpInputsContainer,
      UIController.dom.otpInputs,
      () => this.verifyOtp()
    );

    this.bindEvents();
    this.setMode('login');
    this.checkSession();
    this.loadConfig();
  },

  setMode(mode) {
    this.state.mode = mode;
    UIController.updateModeUI(mode, this.state.devLoginEnabled);
  },

  async checkSession() {
    try {
      const data = await ApiService.getSession();
      if (data.authenticated && data.user) {
        this.openDashboard(data.user, 'Đăng nhập bằng passkey thành công!');
      } else if (data.pending_passkey && data.user) {
        this.openDashboard(data.user, 'Hoàn tất bằng passkey', 'Email đã xác minh, nhưng bạn chưa đăng nhập.', true);
      }
    } catch (e) {
      console.log('Session check error:', e);
    }
  },

  async loadConfig() {
    try {
      const data = await ApiService.getConfig();
      this.state.provider = data.provider || 'gmail';
      this.state.devLoginEnabled = data.dev_login_enabled === true;

      if (UIController.dom.appVersion && data.app_version) {
        UIController.dom.appVersion.textContent = `v${data.app_version}`;
      }

      UIController.updateModeUI(this.state.mode, this.state.devLoginEnabled);
      UIController.updateProviderUI(this.state.provider, data.is_configured);
    } catch (e) {
      console.error('Config status error:', e);
    }
  },

  openDashboard(user, title, subtitle = '', pendingPasskey = false) {
    UIController.renderDashboard(user, title, subtitle, pendingPasskey, this.state.email);
    if (!pendingPasskey) {
      this.loadUsers();
    }
  },

  async loadUsers() {
    try {
      const { ok, data } = await ApiService.getUsers();
      if (ok && data.success) {
        UIController.renderUsers(data.users);
      }
    } catch (e) {
      console.error('Load users error:', e);
    }
  },

  async requestOtp(isDev) {
    const { dom } = UIController;
    UIController.hideAlert(dom.emailAlert);

    const email = dom.inputEmail.value.trim().toLowerCase();
    const fullname = dom.inputFullname.value.trim();

    if (!email) {
      UIController.showAlert(dom.emailAlert, 'Vui lòng nhập địa chỉ email!');
      return;
    }

    if (this.state.mode === 'register' && !fullname) {
      UIController.showAlert(dom.emailAlert, 'Vui lòng nhập Họ và tên để tạo tài khoản!');
      dom.inputFullname.focus();
      return;
    }

    if (isDev) {
      dom.btnDevLogin.disabled = true;
      dom.btnDevLogin.textContent = 'Đang tạo OTP thử nghiệm...';
    } else {
      UIController.setLoading(dom.btnSendOtp, dom.spinnerSend, true);
    }

    try {
      const formData = new FormData(dom.formSendOtp);
      formData.set('email', email);
      formData.set('action', this.state.mode);
      formData.set('fullname', fullname);

      const { ok, data } = await ApiService.sendOtp(formData, isDev);

      if (ok && data.success) {
        this.state.email = email;
        this.state.fullname = fullname;
        this.state.isDevOtp = isDev;
        dom.displayEmail.textContent = email;

        dom.otpActionBadge.textContent = this.state.mode === 'register'
          ? '✨ Xác minh email để tạo tài khoản'
          : '🔑 Xác minh OTP đăng nhập thử nghiệm';

        UIController.switchStep('otp');
        OtpInputController.clear();
        UIController.hideAlert(dom.otpAlert);

        if (isDev && data.otp) {
          OtpInputController.setValue(data.otp);
          dom.otpInstructions.textContent = 'OTP thử nghiệm đã được tạo và điền sẵn; không email nào được gửi. Nhấn xác thực để tiếp tục.';
          UIController.showAlert(dom.otpAlert, data.message, 'success');
          dom.btnVerifyOtp.focus();
        } else {
          dom.otpInstructions.textContent = '💡 Kiểm tra Hộp thư đến (hoặc mục Spam/Quảng cáo) → Copy mã dán thẳng vào ô';
          OtpInputController.focusFirst();
        }

        this.startTimers(data.expires_in || 300, data.cooldown || 45);
      } else {
        UIController.showAlert(dom.emailAlert, data.message || 'Không thể gửi mã OTP.');
        if (data.already_exists) {
          setTimeout(() => this.setMode('login'), 2200);
        }
      }
    } catch {
      UIController.showAlert(dom.emailAlert, 'Lỗi kết nối máy chủ! Hãy kiểm tra server có đang chạy không.');
    } finally {
      if (isDev) {
        dom.btnDevLogin.disabled = false;
        dom.btnDevLogin.textContent = 'Dev OTP · không gửi email';
      } else {
        UIController.setLoading(dom.btnSendOtp, dom.spinnerSend, false);
      }
    }
  },

  async verifyOtp() {
    const { dom } = UIController;
    UIController.hideAlert(dom.otpAlert);
    const otp = OtpInputController.getValue();

    if (otp.length !== 6) {
      UIController.showAlert(dom.otpAlert, 'Vui lòng nhập đủ 6 chữ số mã OTP!');
      return;
    }

    UIController.setLoading(dom.btnVerifyOtp, dom.spinnerVerify, true);

    try {
      dom.otpEmailField.value = this.state.email;
      dom.otpValueField.value = otp;
      const formData = new FormData(dom.formVerifyOtp);

      const { ok, data } = await ApiService.verifyOtp(formData);

      if (ok && data.success) {
        TimerService.stopAll();
        if (data.action === 'login' && data.authenticated) {
          this.openDashboard(data.user, 'Đăng nhập thử nghiệm thành công', data.message);
        } else {
          const title = data.action === 'register' ? 'Hoàn tất bằng passkey' : 'Đăng ký passkey mới';
          this.openDashboard(data.user, title, data.message, true);
        }
      } else {
        OtpInputController.shake();
        UIController.showAlert(dom.otpAlert, data.message || 'Mã OTP không chính xác!');
      }
    } catch {
      UIController.showAlert(dom.otpAlert, 'Lỗi kết nối máy chủ khi xác thực OTP!');
    } finally {
      UIController.setLoading(dom.btnVerifyOtp, dom.spinnerVerify, false);
    }
  },

  async resendOtp() {
    const { dom } = UIController;
    if (dom.btnResendOtp.disabled) return;
    UIController.hideAlert(dom.otpAlert);

    dom.btnResendOtp.disabled = true;
    dom.btnResendOtp.textContent = 'Đang gửi...';

    try {
      const formData = new FormData(dom.formSendOtp);
      formData.set('email', this.state.email);
      formData.set('action', this.state.mode);
      formData.set('fullname', this.state.fullname);

      const { ok, data } = await ApiService.sendOtp(formData, this.state.isDevOtp);

      if (ok && data.success) {
        OtpInputController.clear();
        if (this.state.isDevOtp && data.otp) {
          OtpInputController.setValue(data.otp);
          UIController.showAlert(dom.otpAlert, 'OTP thử nghiệm mới đã được điền sẵn; không email nào được gửi.', 'success');
        } else {
          OtpInputController.focusFirst();
          UIController.showAlert(dom.otpAlert, 'Mã OTP mới đã được gửi vào hòm thư!', 'success');
        }
        this.startTimers(data.expires_in || 300, data.cooldown || 45);
      } else {
        UIController.showAlert(dom.otpAlert, data.message || 'Chưa thể gửi lại mã OTP.');
      }
    } catch {
      UIController.showAlert(dom.otpAlert, 'Lỗi khi gửi lại mã OTP.');
      dom.btnResendOtp.disabled = false;
      dom.btnResendOtp.textContent = 'Gửi lại mã';
    }
  },

  startTimers(expirySeconds, cooldownSeconds) {
    const { dom } = UIController;

    TimerService.startExpiry(
      expirySeconds,
      (sec) => {
        const mins = Math.floor(sec / 60);
        const secs = sec % 60;
        dom.timerCounter.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
      },
      () => {
        dom.timerCounter.textContent = '00:00 (Hết hạn)';
        UIController.showAlert(dom.otpAlert, 'Mã OTP đã hết hạn, vui lòng bấm Gửi lại mã!');
      }
    );

    dom.btnResendOtp.disabled = true;
    dom.btnResendOtp.innerHTML = `Gửi lại (<span id="resendCooldown">${cooldownSeconds}</span>s)`;

    TimerService.startCooldown(
      cooldownSeconds,
      (cd) => {
        const span = document.getElementById('resendCooldown');
        if (span) span.textContent = cd;
      },
      () => {
        dom.btnResendOtp.disabled = false;
        dom.btnResendOtp.textContent = 'Gửi lại mã';
      }
    );
  },

  async submitPasskeyLogin() {
    const { dom } = UIController;
    UIController.hideAlert(dom.passkeyLoginAlert);

    if (!window.isSecureContext || !navigator.credentials?.get) {
      UIController.showAlert(dom.passkeyLoginAlert, 'Passkeys require HTTPS (localhost is allowed) and a compatible browser.');
      return;
    }

    dom.btnPasskeyLogin.disabled = true;
    try {
      const { ceremony_id, options } = await ApiService.postPasskey(
        '/api/passkeys/authenticate/options',
        dom.formSendOtp,
        { action: 'authenticate' }
      );

      const assertion = await navigator.credentials.get({
        publicKey: WebAuthnService.prepareOptions(options)
      });

      if (!assertion) {
        throw new Error('Passkey authentication was cancelled.');
      }

      const result = await ApiService.postPasskey('/api/passkeys/authenticate/verify', dom.formSendOtp, {
        action: 'authenticate',
        ceremony_id,
        credential: WebAuthnService.serializeCredential(assertion)
      });

      this.openDashboard(result.user, 'Passkey login successful!');
    } catch (error) {
      UIController.showAlert(
        dom.passkeyLoginAlert,
        error.name === 'NotAllowedError'
          ? 'Passkey authentication was cancelled or timed out.'
          : error.message
      );
    } finally {
      dom.btnPasskeyLogin.disabled = false;
    }
  },

  async submitPasskeyRegistration(event) {
    event.preventDefault();
    const { dom } = UIController;
    UIController.hideAlert(dom.passkeyRegistrationAlert);

    if (!window.isSecureContext || !navigator.credentials?.create) {
      UIController.showAlert(dom.passkeyRegistrationAlert, 'Passkeys require HTTPS (localhost is allowed) and a compatible browser.');
      return;
    }

    dom.btnRegisterPasskey.disabled = true;
    try {
      const { ceremony_id, options } = await ApiService.postPasskey(
        '/api/passkeys/register/options',
        dom.formPasskeyRegistration
      );

      const attestation = await navigator.credentials.create({
        publicKey: WebAuthnService.prepareOptions(options)
      });

      if (!attestation) {
        throw new Error('Passkey registration was cancelled.');
      }

      const result = await ApiService.postPasskey('/api/passkeys/register/verify', dom.formPasskeyRegistration, {
        ceremony_id,
        credential: WebAuthnService.serializeCredential(attestation)
      });

      this.openDashboard(result.user, 'Passkey đã sẵn sàng', 'Xác thực bằng passkey đã hoàn tất.');
    } catch (error) {
      UIController.showAlert(
        dom.passkeyRegistrationAlert,
        error.name === 'NotAllowedError'
          ? 'Passkey registration was cancelled or timed out.'
          : error.message
      );
    } finally {
      dom.btnRegisterPasskey.disabled = false;
    }
  },

  bindEvents() {
    const { dom } = UIController;

    dom.tabLogin.addEventListener('click', () => this.setMode('login'));
    dom.tabRegister.addEventListener('click', () => this.setMode('register'));

    dom.btnToggleMode.addEventListener('click', () => {
      this.setMode(this.state.mode === 'login' ? 'register' : 'login');
    });

    dom.btnChangeEmail.addEventListener('click', () => {
      TimerService.stopAll();
      this.state.isDevOtp = false;
      UIController.switchStep('email');
      dom.inputEmail.focus();
    });

    dom.formSendOtp.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (e.submitter === dom.btnPasskeyLogin) {
        await this.submitPasskeyLogin();
        return;
      }
      await this.requestOtp(e.submitter === dom.btnDevLogin);
    });

    dom.formPasskeyRegistration.addEventListener('submit', (e) => {
      this.submitPasskeyRegistration(e);
    });

    dom.formVerifyOtp.addEventListener('submit', (e) => {
      e.preventDefault();
      this.verifyOtp();
    });

    dom.btnResendOtp.addEventListener('click', () => this.resendOtp());
    dom.btnRefreshUsers.addEventListener('click', () => this.loadUsers());

    dom.btnLogout.addEventListener('click', async () => {
      await ApiService.logout();
      this.state.email = '';
      this.state.fullname = '';
      UIController.hideAlert(dom.passkeyLoginAlert);
      UIController.hideAlert(dom.passkeyRegistrationAlert);
      dom.inputEmail.value = '';
      dom.inputFullname.value = '';
      OtpInputController.clear();
      this.setMode('login');
      UIController.switchStep('email');
    });
  }
};

document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
