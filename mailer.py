import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional
from email_validator import EmailNotValidError, validate_email


def verify_email_real_existence(email: str) -> tuple[bool, str, str]:
    try:
        validation = validate_email(email.strip(), check_deliverability=True)
        return True, "Email hợp lệ và máy chủ nhận thư tồn tại.", validation.normalized
    except EmailNotValidError as e:
        error_str = str(e)
        domain = email.split("@")[-1] if "@" in email else ""
        if "does not exist" in error_str:
            msg = f"Tên miền '{domain}' không tồn tại trong thực tế! Vui lòng nhập đúng email thật."
        elif "does not accept email" in error_str:
            msg = f"Tên miền '{domain}' không có máy chủ nhận email (Bản ghi DNS MX không tồn tại)!"
        elif "The part after the @-sign" in error_str:
            msg = "Phần tên miền sau dấu '@' không hợp lệ!"
        else:
            msg = f"Email không hợp lệ: {error_str}"
        return False, msg, email


def render_email_html(
    otp_code: str,
    recipient_email: str,
    action: str = "verify",
    fullname: str = ""
) -> str:
    action_text = {
        "register": "Xác Minh Email Đăng Ký",
        "recover": "Xác Minh Email Khôi Phục Passkey"
    }.get(action, "Xác Minh Email")

    greeting_name = fullname if fullname else recipient_email
    action_desc = {
        "register": "xác minh email để tạo tài khoản",
        "recover": "xác minh email để đăng ký passkey mới"
    }.get(action, "xác minh email")

    return f"""<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Mã OTP {action_text}</title>
  <style>
    body {{
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #f4f6f9;
      margin: 0;
      padding: 30px 15px;
      color: #333333;
    }}
    .email-container {{
      max-width: 520px;
      margin: 0 auto;
      background: #ffffff;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.05);
      border: 1px solid #e9ecef;
    }}
    .email-header {{
      background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
      padding: 32px 24px;
      text-align: center;
      color: #ffffff;
    }}
    .email-header h1 {{
      margin: 0;
      font-size: 24px;
      font-weight: 700;
      letter-spacing: -0.5px;
    }}
    .email-header p {{
      margin: 8px 0 0 0;
      font-size: 14px;
      opacity: 0.9;
    }}
    .email-body {{
      padding: 32px 28px;
    }}
    .greeting {{
      font-size: 16px;
      line-height: 1.5;
      margin-bottom: 20px;
      color: #4b5563;
    }}
    .otp-box {{
      background: #f8fafc;
      border: 2px dashed #6366f1;
      border-radius: 12px;
      padding: 24px;
      text-align: center;
      margin: 25px 0;
    }}
    .otp-label {{
      font-size: 13px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #6366f1;
      margin-bottom: 8px;
    }}
    .otp-code {{
      font-size: 38px;
      font-weight: 800;
      letter-spacing: 8px;
      color: #1e1b4b;
      font-family: 'Courier New', Courier, monospace;
      margin: 0;
      user-select: all;
    }}
    .otp-expiry {{
      font-size: 13px;
      color: #6b7280;
      margin-top: 10px;
    }}
    .note {{
      font-size: 13px;
      color: #9ca3af;
      line-height: 1.6;
      border-top: 1px solid #f1f5f9;
      padding-top: 20px;
      margin-top: 25px;
    }}
    .email-footer {{
      background: #f8fafc;
      padding: 18px 24px;
      text-align: center;
      font-size: 12px;
      color: #94a3b8;
      border-top: 1px solid #e2e8f0;
    }}
  </style>
</head>
<body>
  <div class="email-container">
    <div class="email-header">
      <h1>🔐 {action_text}</h1>
      <p>Hệ thống gửi email xác minh bảo mật</p>
    </div>
    <div class="email-body">
      <div class="greeting">
        Xin chào <strong>{greeting_name}</strong>,<br>
        Bạn vừa yêu cầu mã xác thực một lần (OTP) để <strong>{action_desc}</strong> với email <strong>{recipient_email}</strong>.
      </div>

      <div class="otp-box">
        <div class="otp-label">MÃ XÁC THỰC CỦA BẠN</div>
        <div class="otp-code">{otp_code}</div>
        <div class="otp-expiry">⏱ Mã này có hiệu lực trong vòng <strong>5 phút</strong>.</div>
      </div>

      <div class="note">
        ⚠️ <strong>Lưu ý bảo mật:</strong> Tuyệt đối không chia sẻ mã này với bất kỳ ai để bảo vệ an toàn cho tài khoản của bạn. Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email.
      </div>
    </div>
    <div class="email-footer">
      Email được gửi tự động từ hệ thống xác minh tài khoản.<br>
      © 2026 SecureOTP System. All rights reserved.
    </div>
  </div>
</body>
</html>
"""


def send_otp_via_smtp(
    provider: str,
    recipient_email: str,
    otp_code: str,
    gmail_user: str = "",
    gmail_password: str = "",
    mailtrap_host: str = "sandbox.smtp.mailtrap.io",
    mailtrap_port: int = 2525,
    mailtrap_user: str = "",
    mailtrap_password: str = "",
    action: str = "verify",
    fullname: str = "",
    ai_cho_soi_ma_soi_gmail_password: Optional[str] = None,
    ai_cho_soi_ma_soi_mailtrap_password: Optional[str] = None
) -> tuple[bool, str]:
    effective_gmail_pass = (gmail_password or ai_cho_soi_ma_soi_gmail_password or "").replace(" ", "").strip()
    effective_mailtrap_pass = (mailtrap_password or ai_cho_soi_ma_soi_mailtrap_password or "").strip()

    action_label = {
        "register": "xác minh email đăng ký",
        "recover": "xác minh email khôi phục passkey"
    }.get(action, "xác minh email")

    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"[{otp_code}] Mã xác thực OTP {action_label}"
    msg["To"] = recipient_email

    text_content = (
        f"Mã xác thực OTP ({action_label}) của bạn là: {otp_code}. "
        f"Mã có hiệu lực trong 5 phút. Vui lòng không chia sẻ mã này cho ai khác."
    )
    html_content = render_email_html(otp_code, recipient_email, action=action, fullname=fullname)

    msg.attach(MIMEText(text_content, "plain", "utf-8"))
    msg.attach(MIMEText(html_content, "html", "utf-8"))

    if provider == "gmail":
        if not gmail_user or not effective_gmail_pass or gmail_user == "your_email@gmail.com" or effective_gmail_pass == "your_gmail_app_password":
            return False, "Máy chủ chưa cấu hình Gmail SMTP. Hãy cấu hình thông tin gửi thư trong môi trường máy chủ."

        msg["From"] = f"SecureOTP Service <{gmail_user}>"

        try:
            server = smtplib.SMTP("smtp.gmail.com", 587, timeout=20)
            server.ehlo()
            server.starttls()
            server.ehlo()
            server.login(gmail_user.strip(), effective_gmail_pass)
            server.sendmail(gmail_user.strip(), [recipient_email], msg.as_string())
            server.quit()
            return True, f"Mã OTP đã được gửi thật vào hòm thư Gmail của bạn ({recipient_email})!"
        except smtplib.SMTPAuthenticationError:
            return False, "Lỗi xác thực Gmail: Sai Email hoặc Mật khẩu ứng dụng (App Password). Lưu ý: Gmail bắt buộc dùng 'Mật khẩu ứng dụng 16 ký tự' chứ không phải mật khẩu đăng nhập thông thường."
        except Exception as e:
            return False, f"Lỗi khi gửi qua Gmail SMTP: {str(e)}"

    if not mailtrap_user or not effective_mailtrap_pass or mailtrap_user == "your_mailtrap_username_here":
        return False, "Máy chủ chưa cấu hình Mailtrap SMTP. Hãy cấu hình thông tin gửi thư trong môi trường máy chủ."

    msg["From"] = "SecureOTP Service <noreply@mailtrap-demo.com>"

    try:
        server = smtplib.SMTP(mailtrap_host, int(mailtrap_port), timeout=15)
        server.ehlo()
        try:
            server.starttls()
            server.ehlo()
        except Exception:
            pass
        server.login(mailtrap_user, effective_mailtrap_pass)
        server.sendmail("noreply@mailtrap-demo.com", [recipient_email], msg.as_string())
        server.quit()
        return True, "Mã OTP đã được gửi vào hòm thư Mailtrap Sandbox!"
    except smtplib.SMTPAuthenticationError:
        return False, "Lỗi xác thực Mailtrap: Sai Username hoặc Password."
    except Exception as e:
        return False, f"Lỗi khi gửi email qua Mailtrap: {str(e)}"
