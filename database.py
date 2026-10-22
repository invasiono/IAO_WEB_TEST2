import sqlite3
from pathlib import Path
from datetime import datetime

DB_PATH = Path(__file__).parent / "users.db"

def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    with get_connection() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                fullname TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL COLLATE NOCASE,
                created_at TEXT NOT NULL,
                last_login TEXT NOT NULL
            )
        """)
        conn.commit()

def get_user_by_email(email: str):
    email = email.strip().lower()
    with get_connection() as conn:
        cursor = conn.execute("SELECT * FROM users WHERE email = ?", (email,))
        row = cursor.fetchone()
        if row:
            return dict(row)
        return None

def create_user(email: str, fullname: str):
    email = email.strip().lower()
    fullname = fullname.strip()
    now_str = datetime.now().strftime("%d/%m/%Y %H:%M:%S")

    with get_connection() as conn:
        try:
            cursor = conn.execute(
                "INSERT INTO users (fullname, email, created_at, last_login) VALUES (?, ?, ?, ?)",
                (fullname, email, now_str, now_str)
            )
            conn.commit()
            return {
                "id": cursor.lastrowid,
                "fullname": fullname,
                "email": email,
                "created_at": now_str,
                "last_login": now_str
            }
        except sqlite3.IntegrityError:
            return None

def update_last_login(email: str):
    email = email.strip().lower()
    now_str = datetime.now().strftime("%d/%m/%Y %H:%M:%S")
    with get_connection() as conn:
        conn.execute("UPDATE users SET last_login = ? WHERE email = ?", (now_str, email))
        conn.commit()

def get_all_users():
    with get_connection() as conn:
        cursor = conn.execute("SELECT id, fullname, email, created_at, last_login FROM users ORDER BY id DESC")
        return [dict(row) for row in cursor.fetchall()]

# Khởi tạo bảng khi import
init_db()
