# 🔐 Hệ Thống Web Đăng Nhập Bằng Mã OTP Qua Email (Mailtrap)

Dự án web hoàn chỉnh hỗ trợ đăng nhập bảo mật bằng mã xác thực một lần (Passwordless Email OTP) được gửi trực tiếp thông qua máy chủ SMTP **Mailtrap**.

---

## 🌟 Tính Năng Nổi Bật

1. **Xác thực Email có thực sự tồn tại (Real Email & DNS MX Check)**:
   - Sử dụng thư viện `email-validator` và `dnspython` để truy vấn trực tiếp bản ghi DNS MX của máy chủ tên miền.
   - **Chặn đứng mọi email rác, email giả mạo**: Những email có tên miền không tồn tại (vd: `@fakedomain123.com`) hoặc tên miền không có máy chủ nhận thư (vd: `@example.com`) sẽ bị từ chối ngay lập tức kèm thông báo lỗi cụ thể.
2. **Gửi mã OTP qua Gmail SMTP (Gửi thư thật)**:
   - Hỗ trợ gửi mã OTP thực tế vào hòm thư Gmail của người dùng thông qua máy chủ `smtp.gmail.com` (TLS Port 587).
   - Tùy chọn linh hoạt: Có thể chọn **Gửi qua Gmail (Thực tế)** hoặc **Mailtrap (Sandbox thử nghiệm)** ngay trên giao diện web.
3. **Quản lý Tài khoản (Đăng Ký & Đăng Nhập Riêng Biệt)**:
   - **Tạo tài khoản mới**: Nhập Họ & Tên + Email &rarr; Nhận mã OTP &rarr; Xác thực thành công sẽ lưu vĩnh viễn vào SQLite (`users.db`).
   - **Chống tạo trùng**: Những email đã được đăng ký rồi thì **tuyệt đối không thể tạo lại**. Hệ thống sẽ báo lỗi và chuyển hướng người dùng sang tab Đăng nhập.
   - **Đăng nhập an toàn**: Chỉ những tài khoản đã đăng ký mới có thể yêu cầu gửi mã OTP đăng nhập.
4. **Lưu trữ dữ liệu bền vững (SQLite Database)**:
   - Toàn bộ tài khoản được lưu trong file `users.db` chuẩn SQLite (id, họ tên, email, ngày tạo, lần đăng nhập cuối).
   - Có danh sách hiển thị trực quan các tài khoản đã đăng ký trên giao diện Dashboard.

---

## 🔑 Hướng Dẫn Cấu Hình Gửi Mail Bằng Gmail (3 Phút)

Vì lý do bảo mật, Google không cho phép dùng mật khẩu Gmail thông thường để gửi qua ứng dụng. Bạn cần tạo **Mật khẩu ứng dụng 16 ký tự (App Password)** như sau:

1. **Bật Xác minh 2 bước (2-Step Verification)**:
   - Truy cập: [https://myaccount.google.com/security](https://myaccount.google.com/security)
   - Bật **Xác minh 2 bước** cho tài khoản Google của bạn (nếu chưa bật).
2. **Tạo Mật khẩu ứng dụng**:
   - Truy cập trực tiếp link: [https://myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
   - Nhập tên ứng dụng (ví dụ: `OTP Web`) rồi bấm **Tạo (Create)**.
   - Google sẽ hiển thị một mật khẩu gồm **16 chữ cái** (ví dụ: `abcd efgh ijkl mnop`).
3. **Dán vào ứng dụng Web**:
   - Mở web [http://localhost:5000](http://localhost:5000) &rarr; Bấm nút **"Cấu hình Email"** ở góc phải trên.
   - Nhập Email Gmail của bạn và dán chuỗi 16 chữ cái vào ô Mật khẩu ứng dụng &rarr; Bấm **"Lưu Cấu Hình Gmail"**.

   - Quản lý phiên làm việc (Session), hiển thị email đã xác thực, thời gian đăng nhập và nút Đăng xuất.

---

## 🚀 Hướng Dẫn Sử Dụng

### Bước 1: Lấy tài khoản Mailtrap miễn phí (Nếu chưa có)
1. Truy cập [mailtrap.io](https://mailtrap.io) và đăng ký tài khoản (miễn phí).
2. Vào mục **Email Testing** &rarr; **Inboxes** &rarr; Chọn hộp thư của bạn (thường có sẵn *My Inbox*).
3. Tại tab **SMTP Settings**, chọn **Show Credentials**.
4. Bạn sẽ thấy 2 thông tin quan trọng:
   - **Username** (ví dụ: `a1b2c3d4e5f6g7`)
   - **Password** (ví dụ: `8h9i0j1k2l3m4n`)

### Bước 2: Cấu hình thông tin Mailtrap
Có 2 cách đơn giản:
- **Cách 1 (Khuyên dùng)**: Mở file `.env` trong thư mục dự án và điền:
  ```env
  MAILTRAP_USERNAME=username_mailtrap_cua_ban
  MAILTRAP_PASSWORD=password_mailtrap_cua_ban
  ```
- **Cách 2**: Bật web lên, bấm nút **"Cấu hình Mailtrap"** ở góc phải trên cùng màn hình và dán Username, Password rồi bấm **Lưu cấu hình**.

### Bước 3: Khởi chạy ứng dụng
Mở terminal trong thư mục dự án và chạy:
```bash
python app.py
```
Ứng dụng sẽ chạy tại địa chỉ: **`http://localhost:5000`**

### Bước 4: Thử nghiệm đăng nhập
1. Mở trình duyệt vào `http://localhost:5000`.
2. Nhập một email bất kỳ (ví dụ: `test@example.com`) rồi bấm **"Gửi mã OTP qua Mailtrap"**.
3. Mở tab [Mailtrap Inboxes](https://mailtrap.io/inboxes), bạn sẽ thấy ngay email mới gửi đến chứa mã OTP 6 số.
4. Copy mã OTP dán vào web và bấm **"Xác nhận & Đăng nhập"** để vào Dashboard!

---

## Passwordless Passkeys (WebAuthn / FIDO2)

Passkeys are available alongside email OTP. Users first create an account or sign in with the existing OTP flow, then add a passkey from the dashboard. Later they can use **Đăng nhập bằng Passkey** without entering an email. The login ceremony uses discoverable credentials, so users may select the account on their device.

### Configure the relying party

Set both values in the server's `.env` (or deployment environment). They are server-side trust settings and must never come from a request `Host` header or client input:

```env
# Local development (WebAuthn permits insecure localhost origins)
WEBAUTHN_ORIGIN=http://localhost:5000
WEBAUTHN_RP_ID=localhost

# Production example (serve the site over HTTPS)
# WEBAUTHN_ORIGIN=https://example.com
# WEBAUTHN_RP_ID=example.com
```

`WEBAUTHN_ORIGIN` is the exact browser origin: scheme, host, and any non-default port, with no trailing slash or path. `WEBAUTHN_RP_ID` is set to exactly that origin's hostname in this implementation (not a parent domain). The app rejects missing or mismatched configuration, rejects a different HTTP `Origin` header, and asks the WebAuthn verifier to validate both this exact origin and RP ID against the signed client data and authenticator data. This combination prevents a lookalike/reverse-proxy domain from completing an assertion for this site. Do not expose the site behind an untrusted reverse proxy; configure the canonical public origin explicitly.

Generate a private session key and set it as `SECRET_KEY` (the app refuses to start with a short/default key when configured for production HTTPS):

```bash
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

### Run and use

```bash
python -m pip install -r requirements.txt
python app.py
```

Open the site using the same origin configured above. Production must use HTTPS. After an OTP login, select **Thêm passkey cho thiết bị này** and follow the browser/platform prompt. On a subsequent visit use **Đăng nhập bằng Passkey**. Passkey registration requires an authenticated OTP session; passkey sign-in requires user verification (for example, device PIN or biometrics). Keep another recovery method available before removing or replacing a device.

### Backend flow and stored data

The Flask implementation in `app.py` exposes:

1. `POST /api/passkeys/register/options` — requires an authenticated session, generates a fresh challenge and resident-key options, and excludes credentials already on the account.
2. `POST /api/passkeys/register/verify` — consumes the short-lived one-time challenge and verifies the response using the pinned `expected_origin`, exact `expected_rp_id`, and required user verification before storing the credential.
3. `POST /api/passkeys/authenticate/options` — creates an anonymous discoverable-credential challenge with user verification required.
4. `POST /api/passkeys/authenticate/verify` — consumes the challenge, looks up the credential, verifies the assertion signature, origin, RP ID hash, challenge, and user-presence/verification flags, then updates its signature counter and creates the login session.

The browser code in `static/script.js` converts WebAuthn's binary fields to/from base64url before sending JSON. Ceremony challenges are kept in SQLite, expire after five minutes, and are atomically consumed once. A challenge is invalidated even if verification fails.

SQLite initializes these tables in `database.py`:

```sql
CREATE TABLE webauthn_credentials (
  credential_id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  public_key BLOB NOT NULL,
  sign_count INTEGER NOT NULL DEFAULT 0,
  transports TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  last_used_at TEXT
);

CREATE TABLE webauthn_challenges (
  ceremony_id TEXT PRIMARY KEY,
  ceremony TEXT NOT NULL,
  challenge TEXT NOT NULL,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  consumed INTEGER NOT NULL DEFAULT 0
);
```

The credential ID is the lookup key; the public key is stored as bytes and is used by the server to verify each assertion signature. Never accept a public key supplied by the browser at login or mark a user authenticated before successful signature verification. Configure a strong, private `SECRET_KEY` for Flask sessions in production.
