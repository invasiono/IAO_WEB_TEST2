import os
import sys
import time
import secrets
import re
import json
import sqlite3
import hashlib
from urllib.parse import urlparse
from datetime import datetime
from pathlib import Path
from flask import Flask, request, jsonify, render_template, session
from dotenv import load_dotenv
from email_validator import EmailNotValidError, validate_email
from webauthn import (
    generate_authentication_options,
    generate_registration_options,
    options_to_json,
    verify_authentication_response,
    verify_registration_response,
)
from webauthn.helpers import base64url_to_bytes, bytes_to_base64url
from webauthn.helpers.exceptions import (
    WebAuthnException,
)
from webauthn.helpers.structs import (
    AuthenticatorSelectionCriteria,
    PublicKeyCredentialDescriptor,
    ResidentKeyRequirement,
    UserVerificationRequirement,
)
from mailer import send_otp_via_smtp, verify_email_real_existence
from database import (
    consume_webauthn_challenge,
    create_webauthn_challenge,
    get_credential,
    get_credentials_for_user,
    get_user_by_email,
    get_user_by_id,
    create_user_with_credential,
    update_credential_sign_count,
    update_last_login,
    get_all_users,
    save_credential,
)

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

env_path = Path(__file__).parent / ".env"
if not env_path.exists() or not env_path.read_text(encoding="utf-8").strip().strip("#"):
    example_path = Path(__file__).parent / ".env.example"
    if example_path.exists():
        env_path.write_text(example_path.read_text(encoding="utf-8"), encoding="utf-8")

load_dotenv(dotenv_path=env_path)

configured_secret = os.getenv("SECRET_KEY", "").strip()
insecure_secret_values = {
    "super-secret-key-otp-auth-demo-2026",
    "dev-secret-key-otp-auth-2026",
}
if os.getenv("WEBAUTHN_ORIGIN", "").strip().lower().startswith("https://") and (
    len(configured_secret) < 32 or configured_secret in insecure_secret_values
):
    raise RuntimeError("Production requires a private SECRET_KEY with at least 32 characters.")

app = Flask(__name__, static_folder="static", template_folder="templates")
app.secret_key = configured_secret or secrets.token_urlsafe(48)
app.config["APP_VERSION"] = os.getenv("APP_VERSION", "1.0.0").strip() or "1.0.0"
app.config["MAX_CONTENT_LENGTH"] = 1024 * 1024
app.config.update(
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE="Lax",
    SESSION_COOKIE_SECURE=os.getenv("WEBAUTHN_ORIGIN", "").strip().lower().startswith("https://"),
)

try:
    from werkzeug.middleware.proxy_fix import ProxyFix
    app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1, x_prefix=1)
except ImportError:
    pass

otp_storage = {}

OTP_EXPIRY_SECONDS = 300
RESEND_COOLDOWN_SECONDS = 45
MAX_ATTEMPTS = 5
WEBAUTHN_CHALLENGE_TTL_SECONDS = 300

def get_webauthn_config():
    """Load pinned WebAuthn identifiers; never derive them from request headers."""
    origin = os.getenv("WEBAUTHN_ORIGIN", "").strip()
    rp_id = os.getenv("WEBAUTHN_RP_ID", "").strip().lower()
    if not origin or not rp_id:
        raise ValueError("Set WEBAUTHN_ORIGIN and WEBAUTHN_RP_ID in the server environment.")

    parsed = urlparse(origin)
    try:
        hostname = parsed.hostname
        parsed.port
    except ValueError as error:
        raise ValueError("WEBAUTHN_ORIGIN must be a valid origin.") from error
    if (
        not hostname
        or parsed.path
        or parsed.query
        or parsed.fragment
        or parsed.username
        or parsed.password
        or origin.endswith("/")
        or (parsed.scheme != "https" and hostname not in {"localhost", "127.0.0.1", "::1"})
        or hostname.lower() != rp_id
    ):
        raise ValueError(
            "WEBAUTHN_ORIGIN must be an HTTPS origin (HTTP only on localhost), "
            "and WEBAUTHN_RP_ID must exactly equal its hostname."
        )
    return rp_id, origin

def passkey_origin_allowed(origin):
    try:
        rp_id, expected_origin = get_webauthn_config()
    except ValueError as error:
        return None, str(error), 503
    if origin != expected_origin:
        return None, "Request Origin does not match the configured WebAuthn origin.", 403
    return (rp_id, expected_origin), None, None

def get_client_ip():
    """Lấy địa chỉ IP thật của client, hỗ trợ chạy qua Proxy/Render/Cloudflare."""
    cf_ip = request.headers.get("CF-Connecting-IP")
    if cf_ip:
        return cf_ip.strip()
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.remote_addr or "127.0.0.1"

def get_client_user_agent():
    """Lấy User-Agent của client."""
    return request.headers.get("User-Agent", "").strip()

def get_client_fingerprint():
    """Tạo mã băm kết hợp IP và User-Agent để ràng buộc danh tính Session."""
    ip = get_client_ip()
    ua = get_client_user_agent()
    raw = f"{ip}|{ua}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()

def get_device_token():
    """Lấy Device Token từ header X-Device-Token (Lớp bảo mật số 7 - Anti-Cookie-Editor)."""
    return request.headers.get("X-Device-Token", "").strip()

def bind_session_to_client():
    """Ghi nhận fingerprint (IP + User-Agent) và Device Token vào session hiện tại."""
    session["_bound_ip"] = get_client_ip()
    session["_bound_ua"] = get_client_user_agent()[:256]
    session["_bound_fp"] = get_client_fingerprint()
    device_token = get_device_token()
    if device_token:
        session["_bound_device_token"] = device_token

@app.before_request
def validate_session_binding():
    """Ngăn chặn Session Hijacking / Replay Attack bằng cách xác thực IP, User-Agent và Device Token."""
    has_active_session = bool(
        session.get("user_email")
        or session.get("pending_passkey_expires_at")
        or session.get("pending_passkey_email")
        or session.get("pending_passkey_user_id")
    )
    if not has_active_session:
        return None

    expected_fp = session.get("_bound_fp")
    current_fp = get_client_fingerprint()

    expected_device_token = session.get("_bound_device_token")
    current_device_token = get_device_token()

    fp_mismatch = bool(not expected_fp or expected_fp != current_fp)
    device_mismatch = bool(expected_device_token and expected_device_token != current_device_token)

    # Nếu fingerprint bị lệch HOẶC Device Token bị lệch / thiếu (phát hiện copy cookie)
    if fp_mismatch or device_mismatch:
        reason = "Device Token không khớp hoặc bị thiếu (phát hiện Cookie Editor)" if device_mismatch else "IP hoặc User-Agent bị thay đổi"
        app.logger.warning(
            "Phát hiện dấu hiệu chiếm đoạt Session (%s)! Session IP=%s != Hiện tại=%s | "
            "Session UA=%s != Hiện tại=%s | Session DevToken=%s != Hiện tại=%s",
            reason,
            session.get("_bound_ip"),
            get_client_ip(),
            session.get("_bound_ua"),
            get_client_user_agent(),
            expected_device_token,
            current_device_token
        )
        session.clear()

        # Cho phép các endpoint công khai tiếp tục bình thường sau khi đã dọn sạch session cũ/lỗi
        public_endpoints = {
            "/",
            "/api/config",
            "/api/send-otp",
            "/api/dev/send-otp",
            "/api/passkeys/authenticate/options",
            "/api/passkeys/authenticate/verify",
            "/api/logout",
        }
        if request.path in public_endpoints or request.path.startswith("/static/"):
            return None

        if request.path.startswith("/api/"):
            return jsonify({
                "success": False,
                "authenticated": False,
                "message": "Phát hiện phiên truy cập từ thiết bị hoặc trình duyệt không hợp lệ. Phiên đã bị hủy để bảo vệ tài khoản!"
            }), 401

@app.before_request
def enforce_api_origin():
    if request.path.startswith("/api/") and request.method in {"POST", "PUT", "PATCH", "DELETE"}:
        _, error, status = passkey_origin_allowed(request.headers.get("Origin", ""))
        if error:
            return jsonify({"success": False, "message": error}), status

@app.after_request
def disable_passkey_response_caching(response):
    if request.path.startswith("/api/passkeys/"):
        response.headers["Cache-Control"] = "no-store"
    return response

def passkey_form_data(expected_action):
    if request.mimetype not in {"multipart/form-data", "application/x-www-form-urlencoded"}:
        return None
    if request.form.get("action") != expected_action:
        return None
    return request.form

def parse_passkey_credential(form):
    credential_json = form.get("credential", "")
    if not credential_json:
        return None
    try:
        credential = json.loads(credential_json)
    except json.JSONDecodeError:
        return None
    return credential if isinstance(credential, dict) else None

def get_smtp_config():
    provider = os.getenv("SMTP_PROVIDER", "gmail").strip().lower()
    return {
        "provider": provider,
        "gmail_user": os.getenv("GMAIL_USER", "").strip(),
        "ai_cho_soi_ma_soi_gmail_password": os.getenv("GMAIL_APP_PASSWORD", "").strip(),
        "mailtrap_host": os.getenv("MAILTRAP_HOST", "sandbox.smtp.mailtrap.io").strip(),
        "mailtrap_port": int(os.getenv("MAILTRAP_PORT", "2525")),
        "mailtrap_user": os.getenv("MAILTRAP_USERNAME", "").strip(),
        "ai_cho_soi_ma_soi_mailtrap_password": os.getenv("MAILTRAP_PASSWORD", "").strip()
    }

def is_provider_ready():
    cfg = get_smtp_config()
    if cfg["provider"] == "gmail":
        return bool(cfg["gmail_user"] and cfg["gmail_user"] != "your_email@gmail.com" and
                    cfg["ai_cho_soi_ma_soi_gmail_password"] and cfg["ai_cho_soi_ma_soi_gmail_password"] != "your_gmail_app_password")
    else:
        return bool(cfg["mailtrap_user"] and cfg["mailtrap_user"] != "your_mailtrap_username_here" and
                    cfg["ai_cho_soi_ma_soi_mailtrap_password"] and cfg["ai_cho_soi_ma_soi_mailtrap_password"] != "your_mailtrap_password_here")

def is_dev_login_enabled():
    if os.getenv("DEV_LOGIN_ENABLED", "").strip().lower() != "true":
        return False
    try:
        get_webauthn_config()
    except ValueError:
        return False
    return True

@app.route("/")
def index():
    return render_template("index.html", app_version=app.config["APP_VERSION"])

@app.route("/api/config", methods=["GET"])
def get_config_status():
    cfg = get_smtp_config()
    ready = is_provider_ready()
    return jsonify({
        "provider": cfg["provider"],
        "is_configured": ready,
        "dev_login_enabled": is_dev_login_enabled(),
        "app_version": app.config["APP_VERSION"],
    })

@app.route("/api/send-otp", methods=["POST"])
def send_otp():
    if request.mimetype not in {"multipart/form-data", "application/x-www-form-urlencoded"}:
        return jsonify({"success": False, "message": "Expected form data."}), 400
    email_raw = request.form.get("email", "").strip().lower()
    action = request.form.get("action", "").strip().lower()
    fullname = request.form.get("fullname", "").strip()

    if action not in {"register", "login"}:
        return jsonify({
            "success": False,
            "message": "Đăng nhập bằng OTP đã bị tắt. Hãy dùng passkey."
        }), 400
    if not email_raw:
        return jsonify({"success": False, "message": "Vui lòng nhập địa chỉ email!"}), 400

    is_real, reason, normalized_email = verify_email_real_existence(email_raw)
    if not is_real:
        return jsonify({
            "success": False,
            "email_not_real": True,
            "message": f"❌ Email không có thực: {reason}"
        }), 400

    email = normalized_email

    existing_user = get_user_by_email(email)

    if action == "register":
        if not fullname:
            return jsonify({"success": False, "message": "Vui lòng nhập đầy đủ Họ và tên để tạo tài khoản!"}), 400
        if existing_user:
            return jsonify({
                "success": False,
                "already_exists": True,
                "message": f"Tài khoản với email '{email}' đã tồn tại trong hệ thống! Những tài khoản đã tạo rồi thì không thể tạo lại. Vui lòng chuyển qua tab Đăng nhập."
            }), 400
    elif not existing_user:
        return jsonify({
            "success": False,
            "not_found": True,
            "message": "Không tìm thấy tài khoản với email này."
        }), 400

    now = time.time()
    existing_otp = otp_storage.get(email)

    if existing_otp:
        time_since_last_send = now - existing_otp.get("last_sent", 0)
        if time_since_last_send < RESEND_COOLDOWN_SECONDS:
            wait_time = int(RESEND_COOLDOWN_SECONDS - time_since_last_send)
            return jsonify({
                "success": False,
                "message": f"Vui lòng đợi {wait_time}s nữa trước khi yêu cầu mã OTP mới!",
                "cooldown": wait_time
            }), 429

    cfg = get_smtp_config()
    if not is_provider_ready():
        prov_name = "Gmail" if cfg["provider"] == "gmail" else "Mailtrap"
        return jsonify({
            "success": False,
            "needs_config": True,
            "provider": cfg["provider"],
            "message": f"Máy chủ chưa cấu hình tài khoản {prov_name}. Vui lòng liên hệ quản trị viên."
        }), 400

    otp_code = str(secrets.randbelow(900000) + 100000)

    success, mail_message = send_otp_via_smtp(
        provider=cfg["provider"],
        recipient_email=email,
        otp_code=otp_code,
        gmail_user=cfg["gmail_user"],
        ai_cho_soi_ma_soi_gmail_password=cfg["ai_cho_soi_ma_soi_gmail_password"],
        mailtrap_host=cfg["mailtrap_host"],
        mailtrap_port=cfg["mailtrap_port"],
        mailtrap_user=cfg["mailtrap_user"],
        ai_cho_soi_ma_soi_mailtrap_password=cfg["ai_cho_soi_ma_soi_mailtrap_password"],
        action=action,
        fullname=fullname
    )

    if not success:
        return jsonify({
            "success": False,
            "message": mail_message,
            "needs_config": "Chưa cấu hình" in mail_message or "Lỗi xác thực" in mail_message
        }), 400

    otp_storage[email] = {
        "otp": otp_code,
        "action": action,
        "fullname": fullname,
        "dev": False,
        "expires_at": now + OTP_EXPIRY_SECONDS,
        "attempts": 0,
        "last_sent": now
    }

    action_label = {
        "register": "tạo tài khoản",
        "login": "đăng nhập",
    }[action]
    dest_desc = "hòm thư Gmail" if cfg["provider"] == "gmail" else "Mailtrap Sandbox"
    return jsonify({
        "success": True,
        "action": action,
        "provider": cfg["provider"],
        "message": f"Mã OTP {action_label} đã được gửi thành công đến {dest_desc} ({email})!",
        "expires_in": OTP_EXPIRY_SECONDS,
        "cooldown": RESEND_COOLDOWN_SECONDS
    })

@app.route("/api/dev/send-otp", methods=["POST"])
def send_dev_otp():
    if not is_dev_login_enabled():
        return jsonify({"success": False, "message": "Dev OTP is unavailable."}), 404
    if request.mimetype not in {"multipart/form-data", "application/x-www-form-urlencoded"}:
        return jsonify({"success": False, "message": "Expected form data."}), 400

    email_raw = request.form.get("email", "").strip().lower()
    action = request.form.get("action", "").strip().lower()
    fullname = request.form.get("fullname", "").strip()
    if action not in {"register", "login"}:
        return jsonify({"success": False, "message": "Dev OTP only supports test account actions."}), 400
    if not email_raw:
        return jsonify({"success": False, "message": "Enter an email address."}), 400
    try:
        email = validate_email(email_raw, check_deliverability=False).normalized
    except EmailNotValidError:
        return jsonify({"success": False, "message": "Enter a valid email address."}), 400

    existing_user = get_user_by_email(email)
    if action == "register":
        if not fullname:
            return jsonify({"success": False, "message": "Enter a name to create an account."}), 400
        if existing_user:
            return jsonify({"success": False, "already_exists": True, "message": "This email already has an account."}), 400
    else:
        if action == "login" and not existing_user:
            return jsonify({"success": False, "not_found": True, "message": "No account was found for this email."}), 400
        if existing_user:
            fullname = existing_user["fullname"]

    now = time.time()
    existing_otp = otp_storage.get(email)
    if existing_otp and now - existing_otp.get("last_sent", 0) < RESEND_COOLDOWN_SECONDS:
        wait_time = int(RESEND_COOLDOWN_SECONDS - (now - existing_otp.get("last_sent", 0)))
        return jsonify({
            "success": False,
            "message": f"Wait {wait_time}s before requesting another OTP.",
            "cooldown": wait_time,
        }), 429

    otp_code = str(secrets.randbelow(900000) + 100000)
    otp_storage[email] = {
        "otp": otp_code,
        "action": action,
        "fullname": fullname,
        "dev": True,
        "expires_at": now + OTP_EXPIRY_SECONDS,
        "attempts": 0,
        "last_sent": now,
    }
    response = jsonify({
        "success": True,
        "action": action,
        "message": "Local development OTP generated; no email was sent.",
        "otp": otp_code,
        "expires_in": OTP_EXPIRY_SECONDS,
        "cooldown": RESEND_COOLDOWN_SECONDS,
    })
    response.headers["Cache-Control"] = "no-store"
    return response

@app.route("/api/verify-otp", methods=["POST"])
def verify_otp():
    if request.mimetype not in {"multipart/form-data", "application/x-www-form-urlencoded"}:
        return jsonify({"success": False, "message": "Expected form data."}), 400
    email = request.form.get("email", "").strip().lower()
    user_otp = request.form.get("otp", "").strip()

    if not email or not user_otp:
        return jsonify({"success": False, "message": "Vui lòng nhập đầy đủ Email và Mã OTP!"}), 400

    record = otp_storage.get(email)
    now = time.time()

    if not record:
        return jsonify({
            "success": False,
            "message": "Chưa có mã OTP nào được gửi đến email này hoặc mã đã bị hủy. Vui lòng gửi lại mã mới!"
        }), 400

    if now > record["expires_at"]:
        del otp_storage[email]
        return jsonify({
            "success": False,
            "message": "Mã OTP đã hết hạn (quá 5 phút). Vui lòng yêu cầu mã mới!"
        }), 400

    if record["attempts"] >= MAX_ATTEMPTS:
        del otp_storage[email]
        return jsonify({
            "success": False,
            "message": "Bạn đã nhập sai quá 5 lần. Mã OTP này đã bị hủy vì lý do an toàn. Vui lòng gửi lại mã mới!"
        }), 400

    if user_otp != record["otp"]:
        record["attempts"] += 1
        remaining = MAX_ATTEMPTS - record["attempts"]
        return jsonify({
            "success": False,
            "message": f"Mã OTP không chính xác! Bạn còn {remaining} lần thử.",
            "remaining_attempts": remaining
        }), 400

    action = record.get("action", "")
    fullname = record.get("fullname", "")

    del otp_storage[email]

    if action == "register":
        if get_user_by_email(email):
            return jsonify({
                "success": False,
                "message": "Tài khoản này đã tồn tại trong cơ sở dữ liệu, không thể tạo lại!"
            }), 400
        user = {
            "id": None,
            "fullname": fullname,
            "email": email,
            "created_at": "Chưa tạo",
            "last_login": "Chưa đăng nhập",
        }
    elif action == "login":
        user = get_user_by_email(email)
        if not user:
            return jsonify({"success": False, "message": "Tài khoản không tồn tại."}), 400
        update_last_login(email)
        user = get_user_by_email(email)
        session.clear()
        session["user_email"] = user["email"]
        session["user_fullname"] = user["fullname"]
        session["logged_in_at"] = user["last_login"]
        session["created_at"] = user["created_at"]
        bind_session_to_client()
        return jsonify({
            "success": True,
            "authenticated": True,
            "action": "login",
            "message": "Đăng nhập bằng OTP thành công.",
            "user": user,
        })
    else:
        return jsonify({"success": False, "message": "Đăng nhập bằng OTP đã bị tắt. Hãy dùng passkey."}), 400

    session.clear()
    session["pending_passkey_expires_at"] = int(time.time()) + WEBAUTHN_CHALLENGE_TTL_SECONDS
    if action == "register":
        session["pending_passkey_email"] = user["email"]
        session["pending_passkey_fullname"] = user["fullname"]
        session["pending_passkey_user_handle"] = secrets.token_urlsafe(32)
    else:
        session["pending_passkey_user_id"] = user["id"]
    bind_session_to_client()

    return jsonify({
        "success": True,
        "message": "Email đã được xác minh. Hoàn tất bằng cách tạo passkey; bạn chưa đăng nhập.",
        "action": action,
        "pending_passkey": True,
        "user": user
    })

@app.route("/api/me", methods=["GET"])
def get_current_user():
    user_email = session.get("user_email")
    if not user_email:
        pending_user_id = session.get("pending_passkey_user_id")
        pending_expires_at = session.get("pending_passkey_expires_at", 0)
        if pending_user_id and pending_expires_at > int(time.time()):
            pending_user = get_user_by_id(pending_user_id)
            if pending_user:
                return jsonify({
                    "authenticated": False,
                    "pending_passkey": True,
                    "user": pending_user
                })
        pending_email = session.get("pending_passkey_email")
        pending_fullname = session.get("pending_passkey_fullname")
        if pending_email and pending_fullname and pending_expires_at > int(time.time()):
            return jsonify({
                "authenticated": False,
                "pending_passkey": True,
                "user": {
                    "email": pending_email,
                    "fullname": pending_fullname,
                    "created_at": "Chưa tạo",
                    "last_login": "Chưa đăng nhập",
                }
            })
        session.clear()
        return jsonify({"authenticated": False}), 401

    user = get_user_by_email(user_email)
    if not user:
        session.clear()
        return jsonify({"authenticated": False}), 401

    return jsonify({
        "authenticated": True,
        "user": user,
        "client_ip": session.get("_bound_ip"),
        "client_ua": session.get("_bound_ua"),
    })

@app.route("/api/users", methods=["GET"])
def list_users():
    if not get_user_by_email(session.get("user_email", "")):
        session.clear()
        return jsonify({"success": False, "message": "Authentication required."}), 401
    users = get_all_users()
    return jsonify({
        "success": True,
        "total": len(users),
        "users": users
    })

@app.route("/api/logout", methods=["POST"])
def logout():
    session.clear()
    return jsonify({"success": True, "message": "Đã đăng xuất thành công!"})

@app.route("/api/passkeys/register/options", methods=["POST"])
def passkey_registration_options():
    form = passkey_form_data("register")
    if form is None:
        return jsonify({"success": False, "message": "Expected passkey registration form data."}), 400
    config, error, status = passkey_origin_allowed(request.headers.get("Origin", ""))
    if error:
        return jsonify({"success": False, "message": error}), status
    rp_id, _ = config

    user = get_user_by_email(session.get("user_email", ""))
    pending_passkey = False
    pending_new_account = False
    if not user:
        pending_user_id = session.get("pending_passkey_user_id")
        pending_expires_at = session.get("pending_passkey_expires_at", 0)
        if pending_user_id and pending_expires_at > int(time.time()):
            user = get_user_by_id(pending_user_id)
            pending_passkey = bool(user)
        if not user and session.get("pending_passkey_email") and pending_expires_at > int(time.time()):
            pending_email = session["pending_passkey_email"]
            if get_user_by_email(pending_email):
                session.clear()
                return jsonify({"success": False, "message": "An account with this email already exists."}), 409
            user = {
                "id": None,
                "email": pending_email,
                "fullname": session.get("pending_passkey_fullname", ""),
            }
            pending_new_account = True
        if not user:
            session.clear()
            return jsonify({"success": False, "message": "Verify your email before enrolling a passkey."}), 401

    existing_credentials = get_credentials_for_user(user["id"]) if user["id"] else []
    webauthn_user_id = (
        base64url_to_bytes(session["pending_passkey_user_handle"])
        if pending_new_account else f"passkey-user:{user['id']}".encode("utf-8")
    )
    options = generate_registration_options(
        rp_id=rp_id,
        rp_name="SecureOTP System",
        user_id=webauthn_user_id,
        user_name=user["email"],
        user_display_name=user["fullname"],
        authenticator_selection=AuthenticatorSelectionCriteria(
            resident_key=ResidentKeyRequirement.REQUIRED,
            user_verification=UserVerificationRequirement.REQUIRED,
        ),
        exclude_credentials=[
            PublicKeyCredentialDescriptor(id=base64url_to_bytes(item["credential_id"]))
            for item in existing_credentials
        ],
    )
    ceremony_id = secrets.token_urlsafe(32)
    challenge_expires_at = int(time.time()) + WEBAUTHN_CHALLENGE_TTL_SECONDS
    if pending_passkey or pending_new_account:
        challenge_expires_at = min(
            challenge_expires_at,
            session["pending_passkey_expires_at"],
        )
    create_webauthn_challenge(
        ceremony_id,
        "registration",
        bytes_to_base64url(options.challenge),
        None if pending_new_account else user["id"],
        challenge_expires_at,
    )
    if pending_new_account:
        session["pending_registration_ceremony_id"] = ceremony_id
    return jsonify({
        "success": True,
        "ceremony_id": ceremony_id,
        "options": json.loads(options_to_json(options)),
    })

@app.route("/api/passkeys/register/verify", methods=["POST"])
def verify_passkey_registration():
    form = passkey_form_data("register")
    if form is None:
        return jsonify({"success": False, "message": "Expected passkey registration form data."}), 400
    config, error, status = passkey_origin_allowed(request.headers.get("Origin", ""))
    if error:
        return jsonify({"success": False, "message": error}), status
    rp_id, expected_origin = config

    user = get_user_by_email(session.get("user_email", ""))
    pending_passkey = False
    pending_new_account = False
    if not user:
        pending_user_id = session.get("pending_passkey_user_id")
        pending_expires_at = session.get("pending_passkey_expires_at", 0)
        if pending_user_id and pending_expires_at > int(time.time()):
            user = get_user_by_id(pending_user_id)
            pending_passkey = bool(user)
        if not user and session.get("pending_passkey_email") and pending_expires_at > int(time.time()):
            pending_email = session["pending_passkey_email"]
            if get_user_by_email(pending_email):
                session.clear()
                return jsonify({"success": False, "message": "An account with this email already exists."}), 409
            user = {
                "id": None,
                "email": pending_email,
                "fullname": session.get("pending_passkey_fullname", ""),
            }
            pending_new_account = True
        if not user:
            session.clear()
            return jsonify({"success": False, "message": "Verify your email before enrolling a passkey."}), 401

    ceremony_id = form.get("ceremony_id")
    credential = parse_passkey_credential(form)
    device_name = form.get("device_name", "").strip()
    if not isinstance(ceremony_id, str) or not credential or len(device_name) > 80:
        return jsonify({"success": False, "message": "Invalid passkey registration response."}), 400

    if pending_new_account and ceremony_id != session.get("pending_registration_ceremony_id"):
        return jsonify({"success": False, "message": "Registration challenge is invalid or expired."}), 400
    challenge_record = consume_webauthn_challenge(ceremony_id, "registration")
    expected_challenge_user_id = None if pending_new_account else user["id"]
    if not challenge_record or challenge_record["user_id"] != expected_challenge_user_id:
        return jsonify({"success": False, "message": "Registration challenge is invalid, expired, or already used."}), 400
    try:
        verification = verify_registration_response(
            credential=credential,
            expected_challenge=base64url_to_bytes(challenge_record["challenge"]),
            expected_rp_id=rp_id,
            expected_origin=expected_origin,
            require_user_verification=True,
        )
    except (WebAuthnException, TypeError, ValueError) as verification_error:
        app.logger.info("WebAuthn registration rejected: %s", verification_error)
        return jsonify({"success": False, "message": "Passkey registration verification failed."}), 400

    try:
        transport_list = credential.get("response", {}).get("transports", [])
        transports = json.dumps(
            [item for item in transport_list if isinstance(item, str)]
            if isinstance(transport_list, list) else []
        )
        credential_id = bytes_to_base64url(verification.credential_id)
        if pending_new_account:
            user = create_user_with_credential(
                user["email"],
                user["fullname"],
                credential_id,
                verification.credential_public_key,
                verification.sign_count,
                transports,
                device_name or "Passkey",
            )
            if not user:
                return jsonify({"success": False, "message": "Could not create this account."}), 409
        else:
            save_credential(
                credential_id,
                user["id"],
                verification.credential_public_key,
                verification.sign_count,
                transports,
                device_name or "Passkey",
            )
    except sqlite3.IntegrityError:
        app.logger.exception("Could not store verified WebAuthn credential")
        return jsonify({"success": False, "message": "Could not store this passkey."}), 409

    if pending_passkey or pending_new_account:
        update_last_login(user["email"])
        user = get_user_by_email(user["email"])
        session.clear()
        session["user_email"] = user["email"]
        session["user_fullname"] = user["fullname"]
        session["logged_in_at"] = user["last_login"]
        session["created_at"] = user["created_at"]
        bind_session_to_client()

    return jsonify({
        "success": True,
        "authenticated": True,
        "message": "Passkey registered.",
        "user": user
    })

@app.route("/api/passkeys/authenticate/options", methods=["POST"])
def passkey_authentication_options():
    form = passkey_form_data("authenticate")
    if form is None:
        return jsonify({"success": False, "message": "Expected passkey authentication form data."}), 400
    config, error, status = passkey_origin_allowed(request.headers.get("Origin", ""))
    if error:
        return jsonify({"success": False, "message": error}), status
    rp_id, _ = config
    options = generate_authentication_options(
        rp_id=rp_id,
        user_verification=UserVerificationRequirement.REQUIRED,
    )
    ceremony_id = secrets.token_urlsafe(32)
    create_webauthn_challenge(
        ceremony_id,
        "authentication",
        bytes_to_base64url(options.challenge),
        None,
        int(datetime.now().timestamp()) + WEBAUTHN_CHALLENGE_TTL_SECONDS,
    )
    return jsonify({
        "success": True,
        "ceremony_id": ceremony_id,
        "options": json.loads(options_to_json(options)),
    })

@app.route("/api/passkeys/authenticate/verify", methods=["POST"])
def verify_passkey_authentication():
    form = passkey_form_data("authenticate")
    if form is None:
        return jsonify({"success": False, "message": "Expected passkey authentication form data."}), 400
    config, error, status = passkey_origin_allowed(request.headers.get("Origin", ""))
    if error:
        return jsonify({"success": False, "message": error}), status
    rp_id, expected_origin = config

    ceremony_id = form.get("ceremony_id")
    credential_response = parse_passkey_credential(form)
    if (
        not isinstance(ceremony_id, str)
        or not isinstance(credential_response, dict)
        or not isinstance(credential_response.get("id"), str)
    ):
        return jsonify({"success": False, "message": "Invalid passkey authentication response."}), 400

    try:
        credential_id = bytes_to_base64url(base64url_to_bytes(credential_response["id"]))
    except (TypeError, ValueError):
        return jsonify({"success": False, "message": "Invalid passkey credential ID."}), 400

    challenge_record = consume_webauthn_challenge(ceremony_id, "authentication")
    if not challenge_record:
        return jsonify({"success": False, "message": "Authentication challenge is invalid, expired, or already used."}), 400

    stored_credential = get_credential(credential_id)
    if not stored_credential:
        return jsonify({"success": False, "message": "Passkey was not recognized."}), 401

    try:
        verification = verify_authentication_response(
            credential=credential_response,
            expected_challenge=base64url_to_bytes(challenge_record["challenge"]),
            expected_rp_id=rp_id,
            expected_origin=expected_origin,
            credential_public_key=stored_credential["public_key"],
            credential_current_sign_count=stored_credential["sign_count"],
            require_user_verification=True,
        )
    except (WebAuthnException, TypeError, ValueError) as verification_error:
        app.logger.info("WebAuthn authentication rejected: %s", verification_error)
        return jsonify({"success": False, "message": "Passkey authentication verification failed."}), 401

    user = get_user_by_id(stored_credential["user_id"])
    if not user:
        return jsonify({"success": False, "message": "Passkey account is no longer available."}), 401

    update_credential_sign_count(credential_id, verification.new_sign_count)
    update_last_login(user["email"])
    user = get_user_by_email(user["email"])
    session.clear()
    session["user_email"] = user["email"]
    session["user_fullname"] = user["fullname"]
    session["logged_in_at"] = user["last_login"]
    session["created_at"] = user["created_at"]
    bind_session_to_client()
    return jsonify({"success": True, "user": user})

if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))
    print(f"[*] Server OTP Login dang chay tai: http://localhost:{port}")
    app.run(host="127.0.0.1", port=port, debug=False)
