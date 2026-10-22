import os
import sys
import time
import secrets
import re
from datetime import datetime
from pathlib import Path
from flask import Flask, request, jsonify, render_template, session
from dotenv import load_dotenv, set_key
from mailer import send_otp_via_smtp, verify_email_real_existence
from database import get_user_by_email, create_user, update_last_login, get_all_users

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

# Load environment variables
env_path = Path(__file__).parent / ".env"
if not env_path.exists():
    example_path = Path(__file__).parent / ".env.example"
    if example_path.exists():
        env_path.write_text(example_path.read_text(encoding="utf-8"), encoding="utf-8")

load_dotenv(dotenv_path=env_path)

app = Flask(__name__, static_folder="static", template_folder="templates")
app.secret_key = os.getenv("SECRET_KEY", "super-secret-key-otp-auth-demo-2026")

# In-memory store for OTPs
otp_storage = {}

OTP_EXPIRY_SECONDS = 300  # 5 phút
RESEND_COOLDOWN_SECONDS = 45  # 45 giây trước khi được yêu cầu gửi lại
MAX_ATTEMPTS = 5

def get_smtp_config():
    provider = os.getenv("SMTP_PROVIDER", "gmail").strip().lower()
    return {
        "provider": provider,
        "gmail_user": os.getenv("GMAIL_USER", "").strip(),
        "gmail_password": os.getenv("GMAIL_APP_PASSWORD", "").strip(),
        "mailtrap_host": os.getenv("MAILTRAP_HOST", "sandbox.smtp.mailtrap.io").strip(),
        "mailtrap_port": int(os.getenv("MAILTRAP_PORT", "2525")),
        "mailtrap_user": os.getenv("MAILTRAP_USERNAME", "").strip(),
        "mailtrap_pass": os.getenv("MAILTRAP_PASSWORD", "").strip()
    }

def is_provider_ready():
    cfg = get_smtp_config()
    if cfg["provider"] == "gmail":
        return bool(cfg["gmail_user"] and cfg["gmail_user"] != "your_email@gmail.com" and
                    cfg["gmail_password"] and cfg["gmail_password"] != "your_gmail_app_password")
    else:
        return bool(cfg["mailtrap_user"] and cfg["mailtrap_user"] != "your_mailtrap_username_here" and
                    cfg["mailtrap_pass"] and cfg["mailtrap_pass"] != "your_mailtrap_password_here")

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/config", methods=["GET"])
def get_config_status():
    cfg = get_smtp_config()
    ready = is_provider_ready()

    masked_gmail = ""
    if cfg["gmail_user"] and "@" in cfg["gmail_user"]:
        parts = cfg["gmail_user"].split("@")
        user_part = parts[0]
        domain = parts[1]
        masked_user = user_part[:2] + "***" if len(user_part) > 2 else "***"
        masked_gmail = f"{masked_user}@{domain}"

    masked_mailtrap = ""
    if cfg["mailtrap_user"] and len(cfg["mailtrap_user"]) > 4:
        masked_mailtrap = cfg["mailtrap_user"][:3] + "***" + cfg["mailtrap_user"][-2:]

    return jsonify({
        "provider": cfg["provider"],
        "is_configured": ready,
        "gmail_user": cfg["gmail_user"] if cfg["gmail_user"] != "your_email@gmail.com" else "",
        "gmail_user_masked": masked_gmail,
        "mailtrap_user": cfg["mailtrap_user"] if cfg["mailtrap_user"] != "your_mailtrap_username_here" else "",
        "mailtrap_user_masked": masked_mailtrap,
        "mailtrap_host": cfg["mailtrap_host"],
        "mailtrap_port": cfg["mailtrap_port"]
    })

@app.route("/api/config", methods=["POST"])
def update_config():
    data = request.get_json() or {}
    provider = data.get("provider", "gmail").strip().lower()

    os.environ["SMTP_PROVIDER"] = provider
    try:
        set_key(str(env_path), "SMTP_PROVIDER", provider)
    except Exception:
        pass

    if provider == "gmail":
        gmail_user = data.get("gmail_user", "").strip()
        gmail_password = data.get("gmail_password", "").strip()

        if not gmail_user or not gmail_password:
            return jsonify({"success": False, "message": "Vui lòng nhập đầy đủ Email Gmail và Mật khẩu ứng dụng (App Password)!"}), 400

        os.environ["GMAIL_USER"] = gmail_user
        os.environ["GMAIL_APP_PASSWORD"] = gmail_password

        try:
            set_key(str(env_path), "GMAIL_USER", gmail_user)
            set_key(str(env_path), "GMAIL_APP_PASSWORD", gmail_password)
        except Exception as e:
            print("Không thể ghi file .env:", e)

        return jsonify({
            "success": True,
            "message": f"Đã lưu cấu hình Gmail ({gmail_user}) thành công! OTP sẽ được gửi thật qua Gmail."
        })
    else:
        mailtrap_user = data.get("mailtrap_user", "").strip()
        mailtrap_pass = data.get("mailtrap_pass", "").strip()
        host = data.get("mailtrap_host", "sandbox.smtp.mailtrap.io").strip()
        port = str(data.get("mailtrap_port", "2525")).strip()

        if not mailtrap_user or not mailtrap_pass:
            return jsonify({"success": False, "message": "Vui lòng nhập đầy đủ Username và Password của Mailtrap!"}), 400

        os.environ["MAILTRAP_USERNAME"] = mailtrap_user
        os.environ["MAILTRAP_PASSWORD"] = mailtrap_pass
        os.environ["MAILTRAP_HOST"] = host
        os.environ["MAILTRAP_PORT"] = port

        try:
            set_key(str(env_path), "MAILTRAP_USERNAME", mailtrap_user)
            set_key(str(env_path), "MAILTRAP_PASSWORD", mailtrap_pass)
            set_key(str(env_path), "MAILTRAP_HOST", host)
            set_key(str(env_path), "MAILTRAP_PORT", port)
        except Exception as e:
            print("Không thể ghi file .env:", e)

        return jsonify({
            "success": True,
            "message": "Đã lưu cấu hình Mailtrap thành công!"
        })

@app.route("/api/send-otp", methods=["POST"])
def send_otp():
    data = request.get_json() or {}
    email_raw = data.get("email", "").strip().lower()
    action = data.get("action", "login").strip().lower()
    fullname = data.get("fullname", "").strip()

    if not email_raw:
        return jsonify({"success": False, "message": "Vui lòng nhập địa chỉ email!"}), 400

    # 1. XÁC THỰC XEM EMAIL CÓ THỰC SỰ TỒN TẠI KHÔNG (DNS MX CHECK & RFC COMPLIANCE)
    is_real, reason, normalized_email = verify_email_real_existence(email_raw)
    if not is_real:
        return jsonify({
            "success": False,
            "email_not_real": True,
            "message": f"❌ Email không có thực: {reason}"
        }), 400

    email = normalized_email

    # 2. KIỂM TRA ĐIỀU KIỆN TÀI KHOẢN TRONG DATABASE
    existing_user = get_user_by_email(email)

    if action == "register":
        if not fullname:
            return jsonify({"success": False, "message": "Vui lòng nhập đầy đủ Họ và tên để tạo tài khoản!"}), 400

        # Nếu đã tồn tại tài khoản thì KHÔNG cho tạo lại
        if existing_user:
            return jsonify({
                "success": False,
                "already_exists": True,
                "message": f"Tài khoản với email '{email}' đã tồn tại trong hệ thống! Những tài khoản đã tạo rồi thì không thể tạo lại. Vui lòng chuyển qua tab Đăng nhập."
            }), 400
    else:
        # Nếu đăng nhập nhưng tài khoản chưa tồn tại
        if not existing_user:
            return jsonify({
                "success": False,
                "not_found": True,
                "message": f"Tài khoản '{email}' chưa tồn tại! Vui lòng chuyển qua tab 'Đăng ký tài khoản' để tạo mới."
            }), 400
        fullname = existing_user.get("fullname", "")

    now = time.time()
    existing_otp = otp_storage.get(email)

    # Kiểm tra cooldown gửi lại
    if existing_otp:
        time_since_last_send = now - existing_otp.get("last_sent", 0)
        if time_since_last_send < RESEND_COOLDOWN_SECONDS:
            wait_time = int(RESEND_COOLDOWN_SECONDS - time_since_last_send)
            return jsonify({
                "success": False,
                "message": f"Vui lòng đợi {wait_time}s nữa trước khi yêu cầu mã OTP mới!",
                "cooldown": wait_time
            }), 429

    # 3. KIỂM TRA CẤU HÌNH GỬI EMAIL (GMAIL HOẶC MAILTRAP)
    cfg = get_smtp_config()
    if not is_provider_ready():
        prov_name = "Gmail" if cfg["provider"] == "gmail" else "Mailtrap"
        return jsonify({
            "success": False,
            "needs_config": True,
            "provider": cfg["provider"],
            "message": f"Chưa cấu hình tài khoản {prov_name}! Vui lòng bấm vào nút 'Cấu hình Email' để điền thông tin gửi mail."
        }), 400

    # 4. TẠO MÃ OTP 6 SỐ NGẪU NHIÊN BẢO MẬT
    otp_code = str(secrets.randbelow(900000) + 100000)

    # 5. GỬI MÃ QUA SMTP
    success, mail_message = send_otp_via_smtp(
        provider=cfg["provider"],
        recipient_email=email,
        otp_code=otp_code,
        gmail_user=cfg["gmail_user"],
        gmail_password=cfg["gmail_password"],
        mailtrap_host=cfg["mailtrap_host"],
        mailtrap_port=cfg["mailtrap_port"],
        mailtrap_user=cfg["mailtrap_user"],
        mailtrap_pass=cfg["mailtrap_pass"],
        action=action,
        fullname=fullname
    )

    if not success:
        return jsonify({
            "success": False,
            "message": mail_message,
            "needs_config": "Chưa cấu hình" in mail_message or "Lỗi xác thực" in mail_message
        }), 400

    # Lưu OTP vào bộ nhớ
    otp_storage[email] = {
        "otp": otp_code,
        "action": action,
        "fullname": fullname,
        "expires_at": now + OTP_EXPIRY_SECONDS,
        "attempts": 0,
        "last_sent": now
    }

    action_label = "tạo tài khoản" if action == "register" else "đăng nhập"
    dest_desc = "hòm thư Gmail" if cfg["provider"] == "gmail" else "Mailtrap Sandbox"
    return jsonify({
        "success": True,
        "action": action,
        "provider": cfg["provider"],
        "message": f"Mã OTP {action_label} đã được gửi thành công đến {dest_desc} ({email})!",
        "expires_in": OTP_EXPIRY_SECONDS,
        "cooldown": RESEND_COOLDOWN_SECONDS
    })

@app.route("/api/verify-otp", methods=["POST"])
def verify_otp():
    data = request.get_json() or {}
    email = data.get("email", "").strip().lower()
    user_otp = data.get("otp", "").strip()

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

    action = record.get("action", "login")
    fullname = record.get("fullname", "")

    del otp_storage[email]

    if action == "register":
        user = create_user(email, fullname)
        if not user:
            return jsonify({
                "success": False,
                "message": "Tài khoản này đã tồn tại trong cơ sở dữ liệu, không thể tạo lại!"
            }), 400
        success_msg = f"Chúc mừng {fullname}! Bạn đã tạo tài khoản thành công và được lưu vào hệ thống."
    else:
        update_last_login(email)
        user = get_user_by_email(email)
        if not user:
            return jsonify({"success": False, "message": "Tài khoản không tồn tại!"}), 400
        success_msg = f"Đăng nhập thành công! Chào mừng {user['fullname']} quay trở lại."

    session["user_email"] = user["email"]
    session["user_fullname"] = user["fullname"]
    session["logged_in_at"] = user["last_login"]
    session["created_at"] = user["created_at"]

    return jsonify({
        "success": True,
        "message": success_msg,
        "action": action,
        "user": user
    })

@app.route("/api/me", methods=["GET"])
def get_current_user():
    user_email = session.get("user_email")
    if not user_email:
        return jsonify({"authenticated": False}), 401

    user = get_user_by_email(user_email)
    if not user:
        session.clear()
        return jsonify({"authenticated": False}), 401

    return jsonify({
        "authenticated": True,
        "user": user
    })

@app.route("/api/users", methods=["GET"])
def list_users():
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

if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))
    print(f"[*] Server OTP Login dang chay tai: http://localhost:{port}")
    app.run(host="0.0.0.0", port=port, debug=True)
