# CONTEXT_FOR_LLM: WebMsh

Last updated: 2026-04-21

## 1. Project Purpose
WebMsh is a web-based geometry + meshing workspace.

Current implementation focus:
- Secure authentication (email/password + email OTP + optional TOTP 2FA + Google OAuth).
- Primitive geometry creation (box, sphere, cylinder).
- CAD/mesh upload and surface-mesh extraction through Gmsh.
- 3D visualization of returned mesh data in browser via Three.js.

Primary spec document:
- `SRS.md`

Supplementary design artifacts:
- `docs/webmsh-high-level-workflow.png`
- `docs/webmsh-sequence-diagram.png`
- `docs/webmsh-class-diagram.png`
- `docs/webmsh-usecase-diagram.png`

## 2. High-Level Architecture
- Monorepo with `backend/` and `frontend/`.
- Frontend: React SPA (Vite), no explicit client-side router.
- Backend: FastAPI monolith with:
- auth domain in `backend/app/auth.py` mounted as `/auth`
- geometry/mesh domain in `backend/app/main.py`
- Auth/session persistence: SQLite (`backend/app/webmsh_auth.sqlite3`).
- Geometry persistence: in-memory per-user store in backend process memory.

Implication:
- Restarting backend keeps auth DB data (users/sessions/challenges) but clears geometry list state.

## 3. Repository Structure
- `backend/app/main.py`: geometry APIs + gmsh meshing + system endpoints.
- `backend/app/auth.py`: auth APIs + session handling + OTP + TOTP 2FA + Google OAuth.
- `backend/README.md`: backend run + env setup docs.
- `backend/requirements.txt`: backend dependency source currently used in practice.
- `backend/.env`: active runtime secrets/config (local only).
- `backend/.gitignore`: ignores `.env`, `.env.local`, sqlite db, pycache.
- `frontend/src/App.jsx`: auth gate deciding AuthPage vs Workspace.
- `frontend/src/AuthPage.jsx`: sign-in/sign-up/OTP/2FA/Google UX.
- `frontend/src/Workspace.jsx`: 3D workspace + geometry tools + 2FA setup control.
- `frontend/src/api.js`: centralized API client with cookie-based credentials.
- `frontend/src/index.css`: full app styles (workspace + auth).
- `samplefiles/`: mesh/CAD samples + inspection helper script.

## 4. Backend Domain: Geometry + Meshing
Main file: `backend/app/main.py`

### 4.1 Data Models
- `BoxRequest`, `SphereRequest`, `CylinderRequest`: primitive creation inputs.
- `MeshNode`: node `(id, x, y, z)`.
- `Mesh`: `nodes` + `triangles` connectivity.
- `Geometry`: `(id, type, params, mesh?)`.

### 4.2 Endpoints
System:
- `GET /` basic status message.
- `GET /health` health probe.

Authenticated:
- `GET /info` includes `gmsh_available` and current user's geometry count.
- `GET /geometry` list current user geometries.
- `DELETE /geometry/{geom_id}` delete current user geometry.
- `POST /geometry/box`
- `POST /geometry/sphere`
- `POST /geometry/cylinder`
- `POST /geometry/upload` (multipart file)

### 4.3 Geometry Storage Strategy
- `_geometries_by_user: dict[int, list[Geometry]]`
- User-scoped list selected via `current_user.id`.
- IDs are generated from max existing ID + 1 per user list.

### 4.4 Meshing Strategy
- For primitives:
- Create OCC geometry in gmsh.
- `occ.synchronize()`.
- `mesh.generate(2)` for surface mesh.
- Extract nodes + triangle elements.

- For CAD upload:
- Accept ext: `step, stp, iges, igs, brep, stl, vtk, msh`.
- Load file into gmsh.
- If needed, generate surface mesh.
- Return normalized surface triangles.

### 4.5 Coordinate Mapping
Frontend maps gmsh `(x, y, z)` to Three.js y-up space as:
- x -> x
- z -> y
- y -> z

## 5. Backend Domain: Auth + Session + OAuth
Main file: `backend/app/auth.py`

### 5.1 Env Loading
- `auth.py` loads `backend/.env` and `backend/.env.local` on import.
- This is custom parsing, not python-dotenv.

### 5.2 Auth Tables (SQLite)
Created via `init_auth_db()`:
- `users`
- `otp_challenges`
- `mfa_challenges`
- `sessions`
- `login_throttle`
- `oauth_states`

### 5.3 Password Security
- PBKDF2-HMAC-SHA256 with configurable iterations.
- Salted hash format: `iterations$salt_b64$hash_b64`.
- Password policy includes:
- min length (default 12)
- lowercase/uppercase/digit/special char checks
- rejects password containing local-part of email

### 5.4 OTP Security
- 6-digit OTP.
- Stored hashed, never plaintext in DB.
- TTL configurable (default 300s).
- attempt limit configurable (default 5).
- resend invalidates previous challenge for same purpose.
- SMTP send failures now return errors (fail closed).

### 5.5 Signin Throttling
- Login throttle key is `email|ip`.
- Lockout after configurable failed attempts inside a time window.

### 5.6 Session Model
- Opaque random token in `webmsh_session` cookie.
- Cookie flags:
- `HttpOnly`
- `SameSite=Lax`
- `Secure` configurable via env
- Server stores hashed token in `sessions` table.
- Frontend sends cookies via `fetch(..., credentials: 'include')`.

### 5.7 TOTP 2FA
- TOTP (SHA1, 6 digits, 30-second period).
- Setup flow:
- start => returns secret + `otpauth://` URI
- confirm => validates code and enables 2FA
- disable => validates current TOTP before disabling
- Additional signin step when user has `totp_enabled`.

### 5.8 Google OAuth
- Endpoints:
- `GET /auth/google/start`
- `GET /auth/google/callback`
- Uses PKCE + one-time expiring state row.
- OAuth errors are redirected back to frontend with query params.
- Successful callback links existing user by email or creates new user.
- Session cookie is set server-side on successful callback.

### 5.9 Auth Endpoints
- `POST /auth/signup`
- `POST /auth/signup/verify`
- `POST /auth/signin`
- `POST /auth/signin/otp`
- `POST /auth/signin/2fa`
- `POST /auth/otp/resend`
- `GET /auth/config`
- `GET /auth/me`
- `POST /auth/logout`
- `POST /auth/2fa/setup/start`
- `POST /auth/2fa/setup/confirm`
- `POST /auth/2fa/disable`
- `GET /auth/google/start`
- `GET /auth/google/callback`

## 6. Frontend Design and Runtime Behavior
### 6.1 App Boot / Auth Gate
File: `frontend/src/App.jsx`

Behavior:
- Parses `auth` / `auth_error` query params.
- Shows readable OAuth notices.
- Calls `api.me()`:
- success => render `Workspace`
- failure => render `AuthPage`

### 6.2 Auth UX
File: `frontend/src/AuthPage.jsx`

Capabilities:
- Sign in, sign up.
- Password strength indicator.
- Show/hide password toggles.
- Signup OTP verify step.
- Signin OTP step.
- Signin TOTP step (if required).
- Resend OTP controls.
- Google sign-in button.
- Auth config awareness (`/auth/config`) to disable Google button when not configured.

### 6.3 Workspace UX
File: `frontend/src/Workspace.jsx`

Capabilities:
- Three.js scene setup with:
- perspective camera
- orbit controls
- directional + ambient lighting
- grid + axes helpers
- mesh group rebuilt from backend geometry list
- Primitive forms for box/sphere/cylinder creation
- CAD upload
- Geometry list and delete action
- Status panel (health/backend/gmsh/geometry count/user/2FA)
- Inline 2FA setup start/confirm
- Sign out button

### 6.4 API Client Contract
File: `frontend/src/api.js`

Single request wrapper:
- Parses JSON when possible.
- Throws structured errors with `status` + `body`.
- Always includes cookies.

Provides methods for:
- auth APIs
- geometry APIs
- health/info APIs

## 7. Active Configuration Surface
Configured in `backend/.env` keys:
- `WEBMSH_AUTH_SECRET`
- `WEBMSH_DEBUG_OTP`
- `WEBMSH_FRONTEND_URL`
- `WEBMSH_SESSION_COOKIE_SECURE`
- `WEBMSH_OFFICIAL_EMAIL`
- `WEBMSH_SMTP_HOST`
- `WEBMSH_SMTP_PORT`
- `WEBMSH_SMTP_USERNAME`
- `WEBMSH_SMTP_PASSWORD`
- `WEBMSH_SMTP_FROM_EMAIL`
- `WEBMSH_SMTP_USE_TLS`
- `WEBMSH_SMTP_USE_SSL`
- `WEBMSH_GOOGLE_CLIENT_ID`
- `WEBMSH_GOOGLE_CLIENT_SECRET`
- `WEBMSH_GOOGLE_REDIRECT_URI`

Important:
- If `WEBMSH_AUTH_SECRET` missing, runtime uses ephemeral secret; sessions reset on restart.
- Google OAuth needs exact redirect URI match in Google Console.
- Gmail SMTP typically requires App Password and 2-step verification.

## 8. Run / Dev Pipeline
### 8.1 Backend
Recommended:
1. `cd backend`
2. activate `backend/.venv`
3. `pip install -r requirements.txt`
4. `python .\\app\\main.py`

Backend binds `127.0.0.1:8000`.

Common issue:
- Port 8000 already in use (`WinError 10048`) prevents startup and makes OAuth look broken.

### 8.2 Frontend
1. `cd frontend`
2. `npm install`
3. `npm run dev`

Frontend expects backend at `http://localhost:8000` unless `VITE_API_BASE` is set.

### 8.3 Validation Commands Used Historically
- Backend syntax: `python -B -m py_compile app\\auth.py app\\main.py`
- Frontend lint: `npm run lint`
- Frontend build: `npm run build`

## 9. Security and Reliability Notes
Strengths:
- Password hashing with high iteration PBKDF2.
- Session token hashing server-side.
- OTP TTL + retry cap.
- Signin lockout throttling.
- PKCE and state for OAuth.
- Cookie HttpOnly and SameSite.

Gaps / tradeoffs:
- Geometry data is in-memory only.
- No automated tests currently.
- No project-level persistence/versioning yet.
- No robust background job/queue for email delivery.
- No central logging/observability layer.

## 10. Feature Coverage Snapshot
Implemented:
- Auth: sign up/sign in/email OTP/TOTP 2FA/Google OAuth/logout/session check.
- Geometry: list/create/delete for primitives + upload CAD/mesh.
- Viewer: interactive 3D rendering.

Not yet implemented (from broader SRS vision):
- Boolean operations.
- Transform operations (translate/rotate/scale).
- Project save/load persistence model.
- Export formats pipeline.
- Physical groups workflow.
- Undo/redo.
- Multi-user collaboration.

## 11. Known Friction Points for Future Work
- `pyproject.toml` and `requirements.txt` are not fully aligned; runtime currently effectively follows `requirements.txt`.
- `@app.on_event("startup")` deprecation warning in FastAPI suggests migration to lifespan events.
- Root-level `package-lock.json` exists but frontend lockfile is in `frontend/`.
- `frontend/src/App.css` appears legacy and mostly unused by current UI.

## 12. Suggested Next Engineering Steps
1. Persist geometry state to DB or project files per user.
2. Implement forgot-password/reset flow.
3. Add endpoint-level tests and auth flow integration tests.
4. Add boolean and transform operations.
5. Add mesh export endpoints and frontend actions.
6. Migrate startup hook to FastAPI lifespan API.

## 13. Quick Start for Another LLM
Read in this order:
1. `backend/app/auth.py`
2. `backend/app/main.py`
3. `frontend/src/api.js`
4. `frontend/src/App.jsx`
5. `frontend/src/AuthPage.jsx`
6. `frontend/src/Workspace.jsx`
7. `backend/README.md`
8. `SRS.md`

Then run backend + frontend and verify:
- `GET /auth/config`
- `GET /health`
- signup/signin flow
- Google login flow
- primitive create/delete + CAD upload flow
