import base64
import hashlib
import hmac
import json
import os
import re
import secrets
import smtplib
import sqlite3
import time
from email.message import EmailMessage
from pathlib import Path
from typing import Literal
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request as URLRequest, urlopen

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, Field


def _load_env_files() -> None:
    base_dir = Path(__file__).resolve().parent.parent
    candidates = [base_dir / ".env", base_dir / ".env.local"]
    for env_path in candidates:
        if not env_path.exists():
            continue
        for raw_line in env_path.read_text(encoding="utf-8").splitlines():
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            if key and key not in os.environ:
                os.environ[key] = value


_load_env_files()


DB_PATH = Path(__file__).resolve().parent / "webmsh_auth.sqlite3"

SESSION_COOKIE_NAME = "webmsh_session"
SESSION_TTL_SECONDS = int(os.getenv("WEBMSH_SESSION_TTL_SECONDS", "43200"))
SESSION_COOKIE_SECURE = os.getenv("WEBMSH_SESSION_COOKIE_SECURE", "0") == "1"

OTP_TTL_SECONDS = int(os.getenv("WEBMSH_OTP_TTL_SECONDS", "300"))
OTP_MAX_ATTEMPTS = int(os.getenv("WEBMSH_OTP_MAX_ATTEMPTS", "5"))

SIGNIN_LOCKOUT_AFTER = int(os.getenv("WEBMSH_SIGNIN_LOCKOUT_AFTER", "5"))
SIGNIN_LOCKOUT_SECONDS = int(os.getenv("WEBMSH_SIGNIN_LOCKOUT_SECONDS", "600"))
SIGNIN_WINDOW_SECONDS = int(os.getenv("WEBMSH_SIGNIN_WINDOW_SECONDS", "900"))

PASSWORD_MIN_LENGTH = int(os.getenv("WEBMSH_PASSWORD_MIN_LENGTH", "12"))
PBKDF2_ITERATIONS = int(os.getenv("WEBMSH_PBKDF2_ITERATIONS", "390000"))

AUTH_DEBUG_OTP = os.getenv("WEBMSH_DEBUG_OTP", "0") == "1"

OFFICIAL_EMAIL = os.getenv("WEBMSH_OFFICIAL_EMAIL", "decentmomo.000@gmail.com")
SMTP_HOST = os.getenv("WEBMSH_SMTP_HOST", "")
SMTP_PORT = int(os.getenv("WEBMSH_SMTP_PORT", "587"))
SMTP_USERNAME = os.getenv("WEBMSH_SMTP_USERNAME", OFFICIAL_EMAIL)
SMTP_PASSWORD = os.getenv("WEBMSH_SMTP_PASSWORD", "")
SMTP_FROM_EMAIL = os.getenv("WEBMSH_SMTP_FROM_EMAIL", OFFICIAL_EMAIL)
SMTP_USE_TLS = os.getenv("WEBMSH_SMTP_USE_TLS", "1") == "1"
SMTP_USE_SSL = os.getenv("WEBMSH_SMTP_USE_SSL", "0") == "1"

FRONTEND_BASE_URL = os.getenv("WEBMSH_FRONTEND_URL", "http://localhost:5173")
GOOGLE_CLIENT_ID = os.getenv("WEBMSH_GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.getenv("WEBMSH_GOOGLE_CLIENT_SECRET", "")
GOOGLE_REDIRECT_URI = os.getenv(
    "WEBMSH_GOOGLE_REDIRECT_URI", "http://localhost:8000/auth/google/callback"
)
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo"
GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
OAUTH_STATE_TTL_SECONDS = 600

TOTP_ISSUER = "WebMsh"
TOTP_PERIOD = 30
TOTP_DIGITS = 6

EMAIL_PATTERN = re.compile(r"^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$")
OTP_PATTERN = re.compile(r"^\d{6}$")

AUTH_SECRET = os.getenv("WEBMSH_AUTH_SECRET")
if not AUTH_SECRET:
    AUTH_SECRET = secrets.token_urlsafe(32)
    print(
        "[auth] WEBMSH_AUTH_SECRET is not set; using an ephemeral runtime secret."
        " Sessions/OTP state will reset on restart."
    )


router = APIRouter(prefix="/auth", tags=["auth"])


class AuthUser(BaseModel):
    id: int
    email: str
    display_name: str | None = None
    is_email_verified: bool
    totp_enabled: bool
    has_password: bool
    auth_provider: str


class SignUpRequest(BaseModel):
    email: str
    password: str = Field(min_length=8, max_length=256)
    full_name: str | None = Field(default=None, max_length=120)


class SignInRequest(BaseModel):
    email: str
    password: str = Field(min_length=1, max_length=256)


class OTPVerifyRequest(BaseModel):
    email: str
    code: str = Field(min_length=6, max_length=6)


class SignIn2FARequest(BaseModel):
    email: str
    code: str = Field(min_length=6, max_length=6)
    mfa_token: str = Field(min_length=20, max_length=256)


class OTPResendRequest(BaseModel):
    email: str
    purpose: Literal["signup", "login"]


class TwoFAConfirmRequest(BaseModel):
    code: str = Field(min_length=6, max_length=6)


class TwoFADisableRequest(BaseModel):
    code: str = Field(min_length=6, max_length=6)


def _now_ts() -> int:
    return int(time.time())


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH, timeout=30, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_auth_db() -> None:
    with _connect() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT NOT NULL UNIQUE,
                display_name TEXT,
                password_hash TEXT,
                is_email_verified INTEGER NOT NULL DEFAULT 0,
                google_sub TEXT UNIQUE,
                totp_enabled INTEGER NOT NULL DEFAULT 0,
                totp_secret TEXT,
                pending_totp_secret TEXT,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL,
                last_login_at INTEGER
            );

            CREATE TABLE IF NOT EXISTS otp_challenges (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                purpose TEXT NOT NULL,
                code_hash TEXT NOT NULL,
                expires_at INTEGER NOT NULL,
                attempts_left INTEGER NOT NULL,
                consumed INTEGER NOT NULL DEFAULT 0,
                created_at INTEGER NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS idx_otp_user_purpose ON otp_challenges(user_id, purpose, consumed, expires_at);

            CREATE TABLE IF NOT EXISTS mfa_challenges (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                token_hash TEXT NOT NULL UNIQUE,
                expires_at INTEGER NOT NULL,
                used INTEGER NOT NULL DEFAULT 0,
                created_at INTEGER NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS idx_mfa_user ON mfa_challenges(user_id, used, expires_at);

            CREATE TABLE IF NOT EXISTS sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                token_hash TEXT NOT NULL UNIQUE,
                created_at INTEGER NOT NULL,
                expires_at INTEGER NOT NULL,
                revoked INTEGER NOT NULL DEFAULT 0,
                last_seen_at INTEGER NOT NULL,
                user_agent TEXT,
                ip_address TEXT,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS idx_sessions_active ON sessions(token_hash, revoked, expires_at);

            CREATE TABLE IF NOT EXISTS login_throttle (
                identity_key TEXT PRIMARY KEY,
                fail_count INTEGER NOT NULL,
                first_failed_at INTEGER NOT NULL,
                locked_until INTEGER NOT NULL DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS oauth_states (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                state_hash TEXT NOT NULL UNIQUE,
                code_verifier TEXT NOT NULL,
                return_to TEXT,
                expires_at INTEGER NOT NULL,
                consumed INTEGER NOT NULL DEFAULT 0,
                created_at INTEGER NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_oauth_states ON oauth_states(state_hash, consumed, expires_at);
            """
        )


def _normalize_email(email: str) -> str:
    return email.strip().lower()


def _validate_email(email: str) -> None:
    if not EMAIL_PATTERN.match(email):
        raise HTTPException(status_code=422, detail="Enter a valid email address")


def _password_policy_issues(password: str, email: str) -> list[str]:
    issues: list[str] = []
    if len(password) < PASSWORD_MIN_LENGTH:
        issues.append(f"Use at least {PASSWORD_MIN_LENGTH} characters")
    if not any(c.islower() for c in password):
        issues.append("Include a lowercase letter")
    if not any(c.isupper() for c in password):
        issues.append("Include an uppercase letter")
    if not any(c.isdigit() for c in password):
        issues.append("Include a number")
    if not any(not c.isalnum() for c in password):
        issues.append("Include a special character")
    local = email.split("@", 1)[0]
    if local and local in password.lower():
        issues.append("Do not include your email name in the password")
    return issues


def _hash_secret_value(value: str) -> str:
    return hashlib.sha256(f"{AUTH_SECRET}|{value}".encode("utf-8")).hexdigest()


def _hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    derived = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), salt, PBKDF2_ITERATIONS
    )
    salt_b64 = base64.urlsafe_b64encode(salt).decode("ascii")
    hash_b64 = base64.urlsafe_b64encode(derived).decode("ascii")
    return f"{PBKDF2_ITERATIONS}${salt_b64}${hash_b64}"


def _verify_password(password: str, stored: str) -> bool:
    try:
        iter_str, salt_b64, hash_b64 = stored.split("$", 2)
        iterations = int(iter_str)
        salt = base64.urlsafe_b64decode(salt_b64.encode("ascii"))
        expected = base64.urlsafe_b64decode(hash_b64.encode("ascii"))
    except Exception:
        return False

    candidate = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), salt, iterations
    )
    return hmac.compare_digest(candidate, expected)


def _dummy_password_verify() -> None:
    # Constant work to make invalid-user and invalid-password timing closer.
    hashlib.pbkdf2_hmac("sha256", b"dummy", b"0123456789abcdef", PBKDF2_ITERATIONS)


def _row_to_auth_user(row: sqlite3.Row) -> AuthUser:
    provider = "password"
    if row["google_sub"] and row["password_hash"]:
        provider = "password+google"
    elif row["google_sub"]:
        provider = "google"
    return AuthUser(
        id=int(row["id"]),
        email=str(row["email"]),
        display_name=row["display_name"],
        is_email_verified=bool(row["is_email_verified"]),
        totp_enabled=bool(row["totp_enabled"]),
        has_password=bool(row["password_hash"]),
        auth_provider=provider,
    )


def _get_user_by_email(conn: sqlite3.Connection, email: str) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()


def _get_user_by_id(conn: sqlite3.Connection, user_id: int) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()


def _get_user_by_google_sub(conn: sqlite3.Connection, google_sub: str) -> sqlite3.Row | None:
    return conn.execute(
        "SELECT * FROM users WHERE google_sub = ?", (google_sub,)
    ).fetchone()


def _dispatch_otp(email: str, purpose: str, code: str) -> None:
    smtp_ready = bool(SMTP_HOST and SMTP_USERNAME and SMTP_PASSWORD)
    if SMTP_HOST and SMTP_USERNAME and SMTP_PASSWORD:
        action = "sign in" if purpose == "login" else "verify your account"
        minutes = max(1, int(OTP_TTL_SECONDS / 60))
        subject = f"WebMsh OTP Code ({purpose})"
        body = (
            f"Hello,\n\n"
            f"Use this one-time code to {action} on WebMsh:\n\n"
            f"    {code}\n\n"
            f"This code expires in {minutes} minute(s).\n"
            f"If you did not request this code, you can ignore this email.\n\n"
            f"Regards,\nWebMsh Security"
        )

        msg = EmailMessage()
        msg["Subject"] = subject
        msg["From"] = SMTP_FROM_EMAIL
        msg["To"] = email
        msg.set_content(body)

        try:
            if SMTP_USE_SSL:
                with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, timeout=20) as server:
                    server.login(SMTP_USERNAME, SMTP_PASSWORD)
                    server.send_message(msg)
            else:
                with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=20) as server:
                    if SMTP_USE_TLS:
                        server.starttls()
                    server.login(SMTP_USERNAME, SMTP_PASSWORD)
                    server.send_message(msg)
            return
        except Exception as exc:
            print(f"[auth][otp] smtp send failed ({email}, {purpose}): {exc}")
            raise HTTPException(
                status_code=502,
                detail="OTP delivery failed. Check SMTP credentials and try again.",
            )

    # Fallback mode for local development when SMTP is not configured.
    if not AUTH_DEBUG_OTP and not smtp_ready:
        raise HTTPException(
            status_code=503,
            detail="OTP email delivery is not configured on the server.",
        )
    print(f"[auth][otp] purpose={purpose} email={email} code={code}")


def _otp_debug_payload(code: str) -> dict:
    if AUTH_DEBUG_OTP:
        return {"dev_otp": code}
    return {}


def _create_otp(
    conn: sqlite3.Connection, user_id: int, purpose: Literal["signup", "login"], email: str
) -> str:
    conn.execute(
        "UPDATE otp_challenges SET consumed = 1 WHERE user_id = ? AND purpose = ? AND consumed = 0",
        (user_id, purpose),
    )
    code = f"{secrets.randbelow(1_000_000):06d}"
    now = _now_ts()
    conn.execute(
        """
        INSERT INTO otp_challenges (user_id, purpose, code_hash, expires_at, attempts_left, consumed, created_at)
        VALUES (?, ?, ?, ?, ?, 0, ?)
        """,
        (
            user_id,
            purpose,
            _hash_secret_value(f"otp:{code}"),
            now + OTP_TTL_SECONDS,
            OTP_MAX_ATTEMPTS,
            now,
        ),
    )
    _dispatch_otp(email, purpose, code)
    return code


def _consume_otp(
    conn: sqlite3.Connection, user_id: int, purpose: Literal["signup", "login"], code: str
) -> tuple[bool, str | None]:
    now = _now_ts()
    row = conn.execute(
        """
        SELECT * FROM otp_challenges
        WHERE user_id = ? AND purpose = ? AND consumed = 0
        ORDER BY id DESC
        LIMIT 1
        """,
        (user_id, purpose),
    ).fetchone()

    if row is None:
        return False, "No active code found. Request a new OTP."

    if int(row["expires_at"]) < now:
        conn.execute("UPDATE otp_challenges SET consumed = 1 WHERE id = ?", (row["id"],))
        return False, "Code expired. Request a new OTP."

    if int(row["attempts_left"]) <= 0:
        conn.execute("UPDATE otp_challenges SET consumed = 1 WHERE id = ?", (row["id"],))
        return False, "Too many invalid attempts. Request a new OTP."

    if not OTP_PATTERN.match(code):
        return False, "Enter a valid 6-digit code."

    expected = row["code_hash"]
    candidate = _hash_secret_value(f"otp:{code}")
    if hmac.compare_digest(expected, candidate):
        conn.execute("UPDATE otp_challenges SET consumed = 1 WHERE id = ?", (row["id"],))
        return True, None

    remaining = int(row["attempts_left"]) - 1
    conn.execute(
        "UPDATE otp_challenges SET attempts_left = ?, consumed = ? WHERE id = ?",
        (max(remaining, 0), 1 if remaining <= 0 else 0, row["id"]),
    )
    return False, "Invalid one-time code."


def _signin_identity(email: str, request: Request) -> str:
    ip = request.client.host if request.client else "unknown"
    return f"{email}|{ip}"


def _assert_signin_not_locked(conn: sqlite3.Connection, identity: str) -> None:
    row = conn.execute(
        "SELECT fail_count, first_failed_at, locked_until FROM login_throttle WHERE identity_key = ?",
        (identity,),
    ).fetchone()
    if row is None:
        return
    now = _now_ts()
    locked_until = int(row["locked_until"])
    if locked_until > now:
        retry_seconds = locked_until - now
        raise HTTPException(
            status_code=429,
            detail=f"Too many attempts. Try again in {retry_seconds} seconds.",
        )


def _register_signin_failure(conn: sqlite3.Connection, identity: str) -> None:
    now = _now_ts()
    row = conn.execute(
        "SELECT fail_count, first_failed_at, locked_until FROM login_throttle WHERE identity_key = ?",
        (identity,),
    ).fetchone()
    if row is None:
        conn.execute(
            """
            INSERT INTO login_throttle (identity_key, fail_count, first_failed_at, locked_until)
            VALUES (?, 1, ?, 0)
            """,
            (identity, now),
        )
        return

    fail_count = int(row["fail_count"])
    first_failed = int(row["first_failed_at"])
    if now - first_failed > SIGNIN_WINDOW_SECONDS:
        fail_count = 1
        first_failed = now
    else:
        fail_count += 1

    locked_until = 0
    if fail_count >= SIGNIN_LOCKOUT_AFTER:
        locked_until = now + SIGNIN_LOCKOUT_SECONDS

    conn.execute(
        """
        UPDATE login_throttle
        SET fail_count = ?, first_failed_at = ?, locked_until = ?
        WHERE identity_key = ?
        """,
        (fail_count, first_failed, locked_until, identity),
    )


def _clear_signin_failures(conn: sqlite3.Connection, identity: str) -> None:
    conn.execute("DELETE FROM login_throttle WHERE identity_key = ?", (identity,))


def _create_session(conn: sqlite3.Connection, user_id: int, request: Request) -> str:
    raw_token = secrets.token_urlsafe(48)
    token_hash = _hash_secret_value(f"session:{raw_token}")
    now = _now_ts()
    expires_at = now + SESSION_TTL_SECONDS
    user_agent = request.headers.get("user-agent", "")[:512]
    ip = request.client.host if request.client else "unknown"
    conn.execute(
        """
        INSERT INTO sessions (user_id, token_hash, created_at, expires_at, revoked, last_seen_at, user_agent, ip_address)
        VALUES (?, ?, ?, ?, 0, ?, ?, ?)
        """,
        (user_id, token_hash, now, expires_at, now, user_agent, ip),
    )
    conn.execute(
        "UPDATE users SET last_login_at = ?, updated_at = ? WHERE id = ?",
        (now, now, user_id),
    )
    return raw_token


def _set_session_cookie(response: Response, raw_token: str) -> None:
    response.set_cookie(
        SESSION_COOKIE_NAME,
        raw_token,
        httponly=True,
        secure=SESSION_COOKIE_SECURE,
        samesite="lax",
        max_age=SESSION_TTL_SECONDS,
        path="/",
    )


def _clear_session_cookie(response: Response) -> None:
    response.delete_cookie(SESSION_COOKIE_NAME, path="/")


def _revoke_session(conn: sqlite3.Connection, raw_token: str) -> None:
    token_hash = _hash_secret_value(f"session:{raw_token}")
    conn.execute("UPDATE sessions SET revoked = 1 WHERE token_hash = ?", (token_hash,))


def _get_user_from_session(conn: sqlite3.Connection, raw_token: str) -> sqlite3.Row | None:
    token_hash = _hash_secret_value(f"session:{raw_token}")
    now = _now_ts()
    row = conn.execute(
        """
        SELECT u.*
        FROM sessions s
        JOIN users u ON u.id = s.user_id
        WHERE s.token_hash = ? AND s.revoked = 0 AND s.expires_at > ?
        """,
        (token_hash, now),
    ).fetchone()
    if row:
        conn.execute(
            "UPDATE sessions SET last_seen_at = ? WHERE token_hash = ?",
            (now, token_hash),
        )
    return row


def _base32_secret(num_bytes: int = 20) -> str:
    return base64.b32encode(secrets.token_bytes(num_bytes)).decode("ascii").rstrip("=")


def _b32decode(secret: str) -> bytes:
    padding = "=" * ((8 - len(secret) % 8) % 8)
    return base64.b32decode(f"{secret}{padding}".upper(), casefold=True)


def _totp_code_at(secret: str, timestamp: int) -> str:
    counter = int(timestamp / TOTP_PERIOD)
    key = _b32decode(secret)
    msg = counter.to_bytes(8, "big")
    digest = hmac.new(key, msg, hashlib.sha1).digest()
    offset = digest[-1] & 0x0F
    binary = int.from_bytes(digest[offset : offset + 4], "big") & 0x7FFFFFFF
    code = binary % (10**TOTP_DIGITS)
    return f"{code:0{TOTP_DIGITS}d}"


def _verify_totp(secret: str, code: str, window: int = 1) -> bool:
    if not OTP_PATTERN.match(code):
        return False
    now = _now_ts()
    for step in range(-window, window + 1):
        candidate = _totp_code_at(secret, now + (step * TOTP_PERIOD))
        if hmac.compare_digest(candidate, code):
            return True
    return False


def _totp_uri(email: str, secret: str) -> str:
    label = f"{TOTP_ISSUER}:{email}"
    query = urlencode(
        {
            "secret": secret,
            "issuer": TOTP_ISSUER,
            "algorithm": "SHA1",
            "digits": TOTP_DIGITS,
            "period": TOTP_PERIOD,
        }
    )
    return f"otpauth://totp/{label}?{query}"


def _create_mfa_challenge(conn: sqlite3.Connection, user_id: int) -> str:
    conn.execute("DELETE FROM mfa_challenges WHERE user_id = ?", (user_id,))
    raw_token = secrets.token_urlsafe(48)
    token_hash = _hash_secret_value(f"mfa:{raw_token}")
    now = _now_ts()
    conn.execute(
        """
        INSERT INTO mfa_challenges (user_id, token_hash, expires_at, used, created_at)
        VALUES (?, ?, ?, 0, ?)
        """,
        (user_id, token_hash, now + 300, now),
    )
    return raw_token


def _consume_mfa_challenge(conn: sqlite3.Connection, user_id: int, raw_token: str) -> bool:
    token_hash = _hash_secret_value(f"mfa:{raw_token}")
    now = _now_ts()
    row = conn.execute(
        """
        SELECT id FROM mfa_challenges
        WHERE user_id = ? AND token_hash = ? AND used = 0 AND expires_at > ?
        """,
        (user_id, token_hash, now),
    ).fetchone()
    if row is None:
        return False
    conn.execute("UPDATE mfa_challenges SET used = 1 WHERE id = ?", (row["id"],))
    return True


def _require_google_configured() -> None:
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        raise HTTPException(
            status_code=503,
            detail="Google sign-in is not configured on this server.",
        )


def _b64url_no_pad(raw_bytes: bytes) -> str:
    return base64.urlsafe_b64encode(raw_bytes).decode("ascii").rstrip("=")


def _create_oauth_state(conn: sqlite3.Connection, return_to: str | None) -> tuple[str, str]:
    state = secrets.token_urlsafe(32)
    code_verifier = _b64url_no_pad(secrets.token_bytes(64))
    now = _now_ts()
    safe_return_to = return_to or "/"
    if not safe_return_to.startswith("/") or safe_return_to.startswith("//"):
        safe_return_to = "/"

    conn.execute(
        """
        INSERT INTO oauth_states (state_hash, code_verifier, return_to, expires_at, consumed, created_at)
        VALUES (?, ?, ?, ?, 0, ?)
        """,
        (
            _hash_secret_value(f"oauth_state:{state}"),
            code_verifier,
            safe_return_to,
            now + OAUTH_STATE_TTL_SECONDS,
            now,
        ),
    )
    return state, code_verifier


def _consume_oauth_state(conn: sqlite3.Connection, state: str) -> sqlite3.Row | None:
    now = _now_ts()
    state_hash = _hash_secret_value(f"oauth_state:{state}")
    row = conn.execute(
        """
        SELECT * FROM oauth_states
        WHERE state_hash = ? AND consumed = 0 AND expires_at > ?
        ORDER BY id DESC
        LIMIT 1
        """,
        (state_hash, now),
    ).fetchone()
    if row is None:
        return None
    conn.execute("UPDATE oauth_states SET consumed = 1 WHERE id = ?", (row["id"],))
    return row


def _google_auth_url(state: str, code_verifier: str) -> str:
    code_challenge = _b64url_no_pad(hashlib.sha256(code_verifier.encode("utf-8")).digest())
    params = urlencode(
        {
            "client_id": GOOGLE_CLIENT_ID,
            "redirect_uri": GOOGLE_REDIRECT_URI,
            "response_type": "code",
            "scope": "openid email profile",
            "access_type": "online",
            "prompt": "select_account",
            "state": state,
            "code_challenge": code_challenge,
            "code_challenge_method": "S256",
        }
    )
    return f"{GOOGLE_AUTH_URL}?{params}"


def _http_post_form(url: str, data: dict[str, str]) -> dict:
    payload = urlencode(data).encode("utf-8")
    request = URLRequest(
        url,
        data=payload,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        method="POST",
    )
    try:
        with urlopen(request, timeout=10) as response:
            raw = response.read().decode("utf-8")
            return json.loads(raw)
    except HTTPError as exc:
        body = exc.read().decode("utf-8", errors="ignore")
        raise HTTPException(
            status_code=502, detail=f"OAuth token exchange failed: {exc.code} {body}"
        )
    except (URLError, TimeoutError) as exc:
        raise HTTPException(status_code=502, detail=f"OAuth network error: {exc}")


def _http_get_json(url: str, headers: dict[str, str]) -> dict:
    request = URLRequest(url, headers=headers, method="GET")
    try:
        with urlopen(request, timeout=10) as response:
            raw = response.read().decode("utf-8")
            return json.loads(raw)
    except HTTPError as exc:
        body = exc.read().decode("utf-8", errors="ignore")
        raise HTTPException(
            status_code=502, detail=f"OAuth userinfo failed: {exc.code} {body}"
        )
    except (URLError, TimeoutError) as exc:
        raise HTTPException(status_code=502, detail=f"OAuth network error: {exc}")


def _exchange_google_code(code: str, code_verifier: str) -> dict:
    return _http_post_form(
        GOOGLE_TOKEN_URL,
        {
            "code": code,
            "client_id": GOOGLE_CLIENT_ID,
            "client_secret": GOOGLE_CLIENT_SECRET,
            "redirect_uri": GOOGLE_REDIRECT_URI,
            "grant_type": "authorization_code",
            "code_verifier": code_verifier,
        },
    )


def _google_userinfo(access_token: str) -> dict:
    return _http_get_json(
        GOOGLE_USERINFO_URL,
        headers={
            "Authorization": f"Bearer {access_token}",
            "Accept": "application/json",
        },
    )


def _frontend_redirect_url(
    return_to: str | None, auth: str | None = None, auth_error: str | None = None
) -> str:
    base = FRONTEND_BASE_URL.rstrip("/")
    path = return_to or "/"
    if not path.startswith("/") or path.startswith("//"):
        path = "/"
    params = {}
    if auth:
        params["auth"] = auth
    if auth_error:
        params["auth_error"] = auth_error
    query = urlencode(params)
    if query:
        return f"{base}{path}?{query}"
    return f"{base}{path}"


def get_current_user(request: Request) -> AuthUser:
    raw_token = request.cookies.get(SESSION_COOKIE_NAME)
    if not raw_token:
        raise HTTPException(status_code=401, detail="Authentication required")

    with _connect() as conn:
        row = _get_user_from_session(conn, raw_token)
        if row is None:
            raise HTTPException(status_code=401, detail="Session expired or invalid")
        return _row_to_auth_user(row)


@router.post("/signup")
def signup(body: SignUpRequest):
    email = _normalize_email(body.email)
    _validate_email(email)
    issues = _password_policy_issues(body.password, email)
    if issues:
        raise HTTPException(
            status_code=422,
            detail={"message": "Password does not meet policy", "issues": issues},
        )

    with _connect() as conn:
        existing = _get_user_by_email(conn, email)
        if existing:
            raise HTTPException(status_code=409, detail="An account with this email already exists")

        now = _now_ts()
        conn.execute(
            """
            INSERT INTO users (
                email, display_name, password_hash, is_email_verified, google_sub,
                totp_enabled, totp_secret, pending_totp_secret, created_at, updated_at
            )
            VALUES (?, ?, ?, 0, NULL, 0, NULL, NULL, ?, ?)
            """,
            (email, body.full_name, _hash_password(body.password), now, now),
        )
        user_id = int(conn.execute("SELECT last_insert_rowid() AS id").fetchone()["id"])
        code = _create_otp(conn, user_id, "signup", email)

    payload = {
        "message": "Account created. Enter the OTP sent to your email to verify and continue.",
        "next": "verify_signup_otp",
    }
    payload.update(_otp_debug_payload(code))
    return payload


@router.post("/signup/verify")
def verify_signup_otp(body: OTPVerifyRequest):
    email = _normalize_email(body.email)
    _validate_email(email)

    with _connect() as conn:
        user = _get_user_by_email(conn, email)
        if user is None:
            raise HTTPException(status_code=404, detail="Account not found")

        if bool(user["is_email_verified"]):
            return {"message": "Email is already verified."}

        ok, error = _consume_otp(conn, int(user["id"]), "signup", body.code.strip())
        if not ok:
            raise HTTPException(status_code=400, detail=error)

        now = _now_ts()
        conn.execute(
            "UPDATE users SET is_email_verified = 1, updated_at = ? WHERE id = ?",
            (now, user["id"]),
        )

    return {"message": "Email verified. You can now sign in securely."}


@router.post("/signin")
def signin(body: SignInRequest, request: Request):
    email = _normalize_email(body.email)
    identity = _signin_identity(email, request)

    with _connect() as conn:
        _assert_signin_not_locked(conn, identity)
        user = _get_user_by_email(conn, email)

        if user is None or not user["password_hash"]:
            _dummy_password_verify()
            _register_signin_failure(conn, identity)
            raise HTTPException(status_code=401, detail="Invalid email or password")

        if not _verify_password(body.password, str(user["password_hash"])):
            _register_signin_failure(conn, identity)
            raise HTTPException(status_code=401, detail="Invalid email or password")

        _clear_signin_failures(conn, identity)

        if not bool(user["is_email_verified"]):
            code = _create_otp(conn, int(user["id"]), "signup", str(user["email"]))
            payload = {
                "next": "verify_signup_otp",
                "message": "Email verification is required before sign-in.",
            }
            payload.update(_otp_debug_payload(code))
            return payload

        code = _create_otp(conn, int(user["id"]), "login", str(user["email"]))

    payload = {
        "next": "otp_required",
        "message": "Enter the one-time code sent to your email.",
    }
    payload.update(_otp_debug_payload(code))
    return payload


@router.post("/signin/otp")
def verify_signin_otp(body: OTPVerifyRequest, request: Request, response: Response):
    email = _normalize_email(body.email)
    _validate_email(email)

    with _connect() as conn:
        user = _get_user_by_email(conn, email)
        if user is None:
            raise HTTPException(status_code=401, detail="Invalid credentials")

        ok, error = _consume_otp(conn, int(user["id"]), "login", body.code.strip())
        if not ok:
            raise HTTPException(status_code=401, detail=error)

        if bool(user["totp_enabled"]) and user["totp_secret"]:
            challenge = _create_mfa_challenge(conn, int(user["id"]))
            return {
                "next": "totp_required",
                "message": "Enter your authenticator app code to finish sign-in.",
                "mfa_token": challenge,
            }

        raw_token = _create_session(conn, int(user["id"]), request)
        _set_session_cookie(response, raw_token)
        return {"next": "authenticated", "user": _row_to_auth_user(user)}


@router.post("/signin/2fa")
def verify_signin_2fa(body: SignIn2FARequest, request: Request, response: Response):
    email = _normalize_email(body.email)
    _validate_email(email)

    with _connect() as conn:
        user = _get_user_by_email(conn, email)
        if user is None:
            raise HTTPException(status_code=401, detail="Invalid credentials")
        if not bool(user["totp_enabled"]) or not user["totp_secret"]:
            raise HTTPException(status_code=400, detail="2FA is not enabled for this account")

        if not _consume_mfa_challenge(conn, int(user["id"]), body.mfa_token):
            raise HTTPException(status_code=401, detail="2FA challenge expired. Sign in again.")

        if not _verify_totp(str(user["totp_secret"]), body.code.strip()):
            raise HTTPException(status_code=401, detail="Invalid authenticator code")

        raw_token = _create_session(conn, int(user["id"]), request)
        _set_session_cookie(response, raw_token)
        return {"next": "authenticated", "user": _row_to_auth_user(user)}


@router.post("/otp/resend")
def resend_otp(body: OTPResendRequest):
    email = _normalize_email(body.email)
    _validate_email(email)

    with _connect() as conn:
        user = _get_user_by_email(conn, email)
        if user is None:
            return {"message": "If this account exists, a new OTP has been sent."}

        if body.purpose == "signup" and bool(user["is_email_verified"]):
            return {"message": "Account is already verified."}

        code = _create_otp(conn, int(user["id"]), body.purpose, str(user["email"]))

    payload = {"message": "A new OTP has been sent."}
    payload.update(_otp_debug_payload(code))
    return payload


@router.get("/config")
def auth_config():
    return {
        "google_configured": bool(GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET),
        "otp_email_configured": bool(SMTP_HOST and SMTP_USERNAME and SMTP_PASSWORD),
        "official_email": SMTP_FROM_EMAIL,
        "debug_otp_enabled": AUTH_DEBUG_OTP,
    }


@router.get("/me", response_model=AuthUser)
def me(current_user: AuthUser = Depends(get_current_user)):
    return current_user


@router.post("/logout")
def logout(request: Request, response: Response):
    raw_token = request.cookies.get(SESSION_COOKIE_NAME)
    if raw_token:
        with _connect() as conn:
            _revoke_session(conn, raw_token)
    _clear_session_cookie(response)
    return {"message": "Signed out"}


@router.post("/2fa/setup/start")
def start_two_factor_setup(current_user: AuthUser = Depends(get_current_user)):
    with _connect() as conn:
        user = _get_user_by_id(conn, current_user.id)
        if user is None:
            raise HTTPException(status_code=404, detail="Account not found")
        if bool(user["totp_enabled"]):
            raise HTTPException(status_code=400, detail="2FA is already enabled")

        secret = _base32_secret()
        conn.execute(
            "UPDATE users SET pending_totp_secret = ?, updated_at = ? WHERE id = ?",
            (secret, _now_ts(), user["id"]),
        )

    return {
        "message": "Use your authenticator app to add this secret, then confirm with a 6-digit code.",
        "secret": secret,
        "otpauth_uri": _totp_uri(current_user.email, secret),
        "issuer": TOTP_ISSUER,
    }


@router.post("/2fa/setup/confirm")
def confirm_two_factor_setup(
    body: TwoFAConfirmRequest, current_user: AuthUser = Depends(get_current_user)
):
    with _connect() as conn:
        user = _get_user_by_id(conn, current_user.id)
        if user is None:
            raise HTTPException(status_code=404, detail="Account not found")

        pending = user["pending_totp_secret"]
        if not pending:
            raise HTTPException(
                status_code=400, detail="No pending 2FA setup. Start setup first."
            )

        if not _verify_totp(str(pending), body.code.strip()):
            raise HTTPException(status_code=400, detail="Invalid authenticator code")

        now = _now_ts()
        conn.execute(
            """
            UPDATE users
            SET totp_enabled = 1, totp_secret = ?, pending_totp_secret = NULL, updated_at = ?
            WHERE id = ?
            """,
            (pending, now, user["id"]),
        )
        updated = _get_user_by_id(conn, current_user.id)

    if updated is None:
        raise HTTPException(status_code=500, detail="Failed to update account")

    return {"message": "2FA enabled successfully.", "user": _row_to_auth_user(updated)}


@router.post("/2fa/disable")
def disable_two_factor(
    body: TwoFADisableRequest, current_user: AuthUser = Depends(get_current_user)
):
    with _connect() as conn:
        user = _get_user_by_id(conn, current_user.id)
        if user is None:
            raise HTTPException(status_code=404, detail="Account not found")

        secret = user["totp_secret"]
        if not bool(user["totp_enabled"]) or not secret:
            raise HTTPException(status_code=400, detail="2FA is already disabled")

        if not _verify_totp(str(secret), body.code.strip()):
            raise HTTPException(status_code=400, detail="Invalid authenticator code")

        now = _now_ts()
        conn.execute(
            """
            UPDATE users
            SET totp_enabled = 0, totp_secret = NULL, pending_totp_secret = NULL, updated_at = ?
            WHERE id = ?
            """,
            (now, user["id"]),
        )
        updated = _get_user_by_id(conn, current_user.id)

    if updated is None:
        raise HTTPException(status_code=500, detail="Failed to update account")

    return {"message": "2FA disabled.", "user": _row_to_auth_user(updated)}


@router.get("/google/start")
def google_start(return_to: str | None = None):
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        return RedirectResponse(
            _frontend_redirect_url(return_to, auth_error="google_not_configured"),
            status_code=302,
        )
    with _connect() as conn:
        state, verifier = _create_oauth_state(conn, return_to)
    return RedirectResponse(_google_auth_url(state, verifier), status_code=302)


@router.get("/google/callback")
def google_callback(
    request: Request,
    state: str | None = None,
    code: str | None = None,
    error: str | None = None,
):
    if error:
        return RedirectResponse(
            _frontend_redirect_url("/", auth_error=f"google_{error}"), status_code=302
        )
    if not state or not code:
        return RedirectResponse(
            _frontend_redirect_url("/", auth_error="google_missing_code"), status_code=302
        )

    with _connect() as conn:
        state_row = _consume_oauth_state(conn, state)

    if state_row is None:
        return RedirectResponse(
            _frontend_redirect_url("/", auth_error="google_invalid_state"), status_code=302
        )

    try:
        token_payload = _exchange_google_code(code, str(state_row["code_verifier"]))
        access_token = token_payload.get("access_token")
        if not access_token:
            raise HTTPException(status_code=502, detail="Google did not return an access token")
        profile = _google_userinfo(str(access_token))
    except HTTPException:
        return RedirectResponse(
            _frontend_redirect_url(
                str(state_row["return_to"]), auth_error="google_exchange_failed"
            ),
            status_code=302,
        )

    email = _normalize_email(str(profile.get("email", "")))
    google_sub = str(profile.get("sub", "")).strip()
    name = str(profile.get("name", "")).strip() or None
    is_verified = bool(profile.get("email_verified"))

    if not email or not google_sub or not EMAIL_PATTERN.match(email):
        return RedirectResponse(
            _frontend_redirect_url(
                str(state_row["return_to"]), auth_error="google_profile_incomplete"
            ),
            status_code=302,
        )

    with _connect() as conn:
        now = _now_ts()
        user = _get_user_by_google_sub(conn, google_sub)
        if user is None:
            existing = _get_user_by_email(conn, email)
            if existing:
                conn.execute(
                    """
                    UPDATE users
                    SET google_sub = ?, is_email_verified = CASE WHEN ? THEN 1 ELSE is_email_verified END,
                        display_name = COALESCE(display_name, ?), updated_at = ?
                    WHERE id = ?
                    """,
                    (google_sub, 1 if is_verified else 0, name, now, existing["id"]),
                )
                user_id = int(existing["id"])
            else:
                conn.execute(
                    """
                    INSERT INTO users (
                        email, display_name, password_hash, is_email_verified, google_sub,
                        totp_enabled, totp_secret, pending_totp_secret, created_at, updated_at
                    )
                    VALUES (?, ?, NULL, ?, ?, 0, NULL, NULL, ?, ?)
                    """,
                    (email, name, 1 if is_verified else 0, google_sub, now, now),
                )
                user_id = int(conn.execute("SELECT last_insert_rowid() AS id").fetchone()["id"])
            user = _get_user_by_id(conn, user_id)
        else:
            conn.execute(
                """
                UPDATE users
                SET display_name = COALESCE(display_name, ?),
                    is_email_verified = CASE WHEN ? THEN 1 ELSE is_email_verified END,
                    updated_at = ?
                WHERE id = ?
                """,
                (name, 1 if is_verified else 0, now, user["id"]),
            )
            user = _get_user_by_id(conn, int(user["id"]))

        if user is None:
            return RedirectResponse(
                _frontend_redirect_url(
                    str(state_row["return_to"]), auth_error="google_account_creation_failed"
                ),
                status_code=302,
            )

        response = RedirectResponse(
            _frontend_redirect_url(str(state_row["return_to"]), auth="google_success"),
            status_code=302,
        )
        raw_token = _create_session(conn, int(user["id"]), request)
        _set_session_cookie(response, raw_token)
        return response
