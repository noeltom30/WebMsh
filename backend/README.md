## WebMsh Backend

### Run

```powershell
cd backend
copy .env.example .env
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python .\app\main.py
```

### Auth Environment Variables

- `WEBMSH_AUTH_SECRET`: secret used to hash OTP/session tokens.
- `WEBMSH_DEBUG_OTP`: set `1` to include dev OTP in API responses (default `0`).
- `WEBMSH_SESSION_COOKIE_SECURE`: set `1` in HTTPS deployments.
- `WEBMSH_FRONTEND_URL`: frontend URL for OAuth redirects (default `http://localhost:5173`).
- `WEBMSH_OFFICIAL_EMAIL`: official sender identity.

### OTP Email Delivery (SMTP)

Set these to deliver OTP to inbox instead of console logs:

- `WEBMSH_SMTP_HOST` (example: `smtp.gmail.com`)
- `WEBMSH_SMTP_PORT` (example: `587`)
- `WEBMSH_SMTP_USERNAME`
- `WEBMSH_SMTP_PASSWORD` (for Gmail, use an App Password)
- `WEBMSH_SMTP_FROM_EMAIL`
- `WEBMSH_SMTP_USE_TLS` (`1` for STARTTLS on 587)
- `WEBMSH_SMTP_USE_SSL` (`1` for implicit SSL, usually port 465)

### Optional Google OAuth

Set these to enable "Continue with Google":

- `WEBMSH_GOOGLE_CLIENT_ID`
- `WEBMSH_GOOGLE_CLIENT_SECRET`
- `WEBMSH_GOOGLE_REDIRECT_URI` (default `http://localhost:8000/auth/google/callback`)

Google Cloud OAuth setup requirements:

1. In Google Cloud Console, create an OAuth 2.0 Client ID (Web Application).
2. Add Authorized redirect URI: `http://localhost:8000/auth/google/callback`.
3. Configure OAuth consent screen and add your Gmail account as a Test User (if app is in testing mode).
4. Put client ID and client secret into `backend/.env`.
