import sqlite3
from pathlib import Path
from datetime import datetime
from typing import Optional

DB_PATH = Path(__file__).parent / "users.db"

def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
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
        conn.execute("""
            CREATE TABLE IF NOT EXISTS webauthn_credentials (
                credential_id TEXT PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                public_key BLOB NOT NULL,
                sign_count INTEGER NOT NULL DEFAULT 0,
                transports TEXT NOT NULL DEFAULT '[]',
                device_name TEXT NOT NULL DEFAULT 'Passkey',
                created_at TEXT NOT NULL,
                last_used_at TEXT
            )
        """)
        credential_columns = {
            row["name"] for row in conn.execute("PRAGMA table_info(webauthn_credentials)")
        }
        if "device_name" not in credential_columns:
            conn.execute(
                "ALTER TABLE webauthn_credentials ADD COLUMN device_name TEXT NOT NULL DEFAULT 'Passkey'"
            )
        conn.execute("""
            CREATE TABLE IF NOT EXISTS webauthn_challenges (
                ceremony_id TEXT PRIMARY KEY,
                ceremony TEXT NOT NULL,
                challenge TEXT NOT NULL,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                expires_at INTEGER NOT NULL,
                consumed INTEGER NOT NULL DEFAULT 0
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

def get_user_by_id(user_id: int):
    with get_connection() as conn:
        row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        return dict(row) if row else None

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

def get_credentials_for_user(user_id: int):
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT credential_id, transports FROM webauthn_credentials WHERE user_id = ?",
            (user_id,)
        ).fetchall()
        return [dict(row) for row in rows]

def get_credential(credential_id: str):
    with get_connection() as conn:
        row = conn.execute(
            """SELECT credential_id, user_id, public_key, sign_count, device_name
               FROM webauthn_credentials WHERE credential_id = ?""",
            (credential_id,)
        ).fetchone()
        return dict(row) if row else None

def save_credential(credential_id: str, user_id: int, public_key: bytes, sign_count: int,
                    transports: str, device_name: str):
    with get_connection() as conn:
        conn.execute(
            """INSERT INTO webauthn_credentials
               (credential_id, user_id, public_key, sign_count, transports, device_name, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (credential_id, user_id, public_key, sign_count, transports, device_name,
             datetime.now().strftime("%d/%m/%Y %H:%M:%S"))
        )
        conn.commit()

def create_webauthn_challenge(ceremony_id: str, ceremony: str, challenge: str,
                              user_id: Optional[int], expires_at: int):
    with get_connection() as conn:
        conn.execute(
            "DELETE FROM webauthn_challenges WHERE expires_at <= ? OR consumed = 1",
            (int(datetime.now().timestamp()),)
        )
        conn.execute(
            """INSERT INTO webauthn_challenges
               (ceremony_id, ceremony, challenge, user_id, expires_at)
               VALUES (?, ?, ?, ?, ?)""",
            (ceremony_id, ceremony, challenge, user_id, expires_at)
        )
        conn.commit()

def consume_webauthn_challenge(ceremony_id: str, ceremony: str):
    with get_connection() as conn:
        conn.execute("BEGIN IMMEDIATE")
        row = conn.execute(
            """SELECT challenge, user_id, expires_at FROM webauthn_challenges
               WHERE ceremony_id = ? AND ceremony = ? AND consumed = 0""",
            (ceremony_id, ceremony)
        ).fetchone()
        if not row or row["expires_at"] <= int(datetime.now().timestamp()):
            conn.rollback()
            return None
        conn.execute(
            "UPDATE webauthn_challenges SET consumed = 1 WHERE ceremony_id = ? AND consumed = 0",
            (ceremony_id,)
        )
        conn.commit()
        return dict(row)

def update_credential_sign_count(credential_id: str, sign_count: int):
    with get_connection() as conn:
        conn.execute(
            """UPDATE webauthn_credentials
               SET sign_count = ?, last_used_at = ?
               WHERE credential_id = ?""",
            (sign_count, datetime.now().strftime("%d/%m/%Y %H:%M:%S"), credential_id)
        )
        conn.commit()

init_db()
