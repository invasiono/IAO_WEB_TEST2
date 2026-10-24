import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import os
from email_validator import validate_email, EmailNotValidError

def verify_email_real_existence(email: str) -> tuple[bool, str, str]:
    """
    Xác thực email có thực sự tồn tại không:
    - Kiểm tra cấu trúc cú pháp RFC
    - Kiểm tra bản ghi DNS MX (Mail Exchange) của tên miền có hoạt động và nhận thư không
    """
    try:
        validation = validate_email(email.strip(), check_deliverability=True)
        normalized_email = validation.normalized
        return True, "Email hợp lệ và máy chủ nhận thư tồn tại.", normalized_email
    except EmailNotValidError as e:
        error_str = str(e)
        if "does not exist" in error_str:
            msg = f"Tên miền '{email.split('@')[-1]}' không tồn tại trong thực tế! Vui lòng nhập đúng email thật."
        elif "does not accept email" in error_str:
            msg = f"Tên miền '{email.split('@')[-1]}' không có máy chủ nhận email (Bản ghi DNS MX không tồn tại)!"
        elif "The part after the @-sign" in error_str:
            msg = "Phần tên miền sau dấu '@' không hợp lệ!"
        else:
            msg = f"Email không hợp lệ: {error_str}"
        return False, msg, email

def render_email_html(otp_code: str, recipient_email: str, action: str = "login", fullname: str = "") -> str:
    action_text = "Đăng Ký Tài Khoản Mới" if action == "register" else "Xác Thực Đăng Nhập"
    greeting_name = fullname if fullname else recipient_email
    action_desc = "tạo tài khoản mới" if action == "register" else "đăng nhập vào tài khoản"

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
      <p>Hệ thống mã xác thực bảo mật gửi qua Gmail</p>
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
      Email được gửi tự động qua hệ thống máy chủ Gmail SMTP.<br>
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
    gmail_user: str,
    ai_cho_soi_ma_soi_gmail_password: str,
    mailtrap_host: str,
    mailtrap_port: int,
    mailtrap_user: str,
    ai_cho_soi_ma_soi_mailtrap_password: str,
    action: str = "login",
    fullname: str = ""
) -> tuple[bool, str]:
    """
    Gửi email OTP qua Gmail SMTP hoặc Mailtrap Sandbox
    """
    action_label = "Đăng ký" if action == "register" else "Đăng nhập"
    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"[{otp_code}] Mã xác thực OTP {action_label}"
    msg["To"] = recipient_email

    text_content = f"Mã xác thực OTP ({action_label}) của bạn là: {otp_code}. Mã có hiệu lực trong 5 phút. Vui lòng không chia sẻ mã này cho ai khác."
    html_content = render_email_html(otp_code, recipient_email, action=action, fullname=fullname)

    msg.attach(MIMEText(text_content, "plain", "utf-8"))
    msg.attach(MIMEText(html_content, "html", "utf-8"))

    if provider == "gmail":
        if not gmail_user or not ai_cho_soi_ma_soi_gmail_password or gmail_user == "your_email@gmail.com" or ai_cho_soi_ma_soi_gmail_password == "your_gmail_app_password":
            return False, "Chưa cấu hình tài khoản Gmail! Vui lòng bấm vào 'Cấu hình Email' để nhập địa chỉ Gmail và Mật khẩu ứng dụng (App Password)."

        msg["From"] = f"SecureOTP Service <{gmail_user}>"

        try:
            server = smtplib.SMTP("smtp.gmail.com", 587, timeout=20)
            server.ehlo()
            server.starttls()
            server.ehlo()
            ai_cho_soi_ma_soi_normalized_gmail_password = ai_cho_soi_ma_soi_gmail_password.replace(" ", "").strip()
            server.login(gmail_user.strip(), ai_cho_soi_ma_soi_normalized_gmail_password)
            server.sendmail(gmail_user.strip(), [recipient_email], msg.as_string())
            server.quit()
            return True, f"Mã OTP đã được gửi thật vào hòm thư Gmail của bạn ({recipient_email})!"
        except smtplib.SMTPAuthenticationError:
            return False, "Lỗi xác thực Gmail: Sai Email hoặc Mật khẩu ứng dụng (App Password). Lưu ý: Gmail bắt buộc dùng 'Mật khẩu ứng dụng 16 ký tự' chứ không phải mật khẩu đăng nhập thông thường."
        except Exception as e:
            return False, f"Lỗi khi gửi qua Gmail SMTP: {str(e)}"

    else:
        if not mailtrap_user or not ai_cho_soi_ma_soi_mailtrap_password or mailtrap_user == "your_mailtrap_username_here":
            return False, "Chưa cấu hình tài khoản Mailtrap! Vui lòng bấm vào 'Cấu hình Email' để nhập Mailtrap Credentials."

        msg["From"] = f"SecureOTP Service <noreply@mailtrap-demo.com>"

        try:
            server = smtplib.SMTP(mailtrap_host, int(mailtrap_port), timeout=15)
            server.ehlo()
            try:
                server.starttls()
                server.ehlo()
            except Exception:
                pass
            server.login(mailtrap_user, ai_cho_soi_ma_soi_mailtrap_password)
            server.sendmail("noreply@mailtrap-demo.com", [recipient_email], msg.as_string())
            server.quit()
            return True, f"Mã OTP đã được gửi vào hòm thư Mailtrap Sandbox!"
        except smtplib.SMTPAuthenticationError:
            return False, "Lỗi xác thực Mailtrap: Sai Username hoặc Password."
        except Exception as e:
            return False, f"Lỗi khi gửi email qua Mailtrap: {str(e)}"
