# CONTEXT_FOR_LLM: WebMsh

Last updated: 2026-04-27

## 1. Project Purpose
WebMsh is a web-based geometry + meshing workspace with secure authentication, persistent user projects, and an interactive 3D viewer.

Current implementation focus:
- Secure authentication with email/password, email OTP, optional TOTP 2FA, and Google OAuth.
- Profile-first user flow: login lands on a project dashboard, not directly in the workspace.
- Persistent project storage in SQLite.
- Primitive geometry creation: box, sphere, cylinder.
- CAD/mesh upload and surface-mesh extraction through Gmsh.
- Three.js rendering of project-scoped geometry/mesh data in the browser.

Primary spec document:
- `SRS.md`

Supplementary design artifacts:
- `docs/webmsh-high-level-workflow.png`
- `docs/webmsh-sequence-diagram.png`
- `docs/webmsh-class-diagram.png`
- `docs/webmsh-usecase-diagram.png`

## 2. High-Level Architecture
- Monorepo with `backend/` and `frontend/`.
- Frontend: React SPA (Vite) with `react-router-dom`.
- Backend: FastAPI app with auth, project, and mesh domains.
- Persistence: SQLite file at `backend/app/webmsh_auth.sqlite3`.
- Geometry persistence is now project-backed in SQLite, not in-memory.
- Mesh generation/extraction is handled with Gmsh and persisted as JSON snapshots on each geometry row.

Implication:
- Restarting the backend no longer clears user projects or saved geometry.
- Auth state, projects, and project geometries share one SQLite database.

## 3. Active Repository Structure
- `backend/app/main.py`: FastAPI app bootstrap, router mounting, system endpoints.
- `backend/app/auth.py`: auth/session/OTP/TOTP/Google OAuth endpoints and auth DB setup.
- `backend/app/db.py`: shared SQLite connection and timestamp helpers.
- `backend/app/project_models.py`: Pydantic request/response models for projects and geometries.
- `backend/app/project_service.py`: DB persistence layer for projects and project geometries.
- `backend/app/projects.py`: project APIs and project-scoped geometry APIs.
- `backend/app/mesh_service.py`: Gmsh helpers for primitive and upload meshing.
- `backend/README.md`: backend run and env docs.
- `backend/requirements.txt`: backend dependency source currently used in practice.
- `frontend/src/App.jsx`: active app routes and auth guards.
- `frontend/src/pages/HomePage.jsx`: active public landing page at `/`.
- `frontend/src/AuthPage.jsx`: active sign-in/sign-up/OTP/2FA/Google auth screen.
- `frontend/src/pages/ProfilePage.jsx`: active project dashboard and account UI.
- `frontend/src/ProfilePage.jsx`: thin re-export for the profile page entry point.
- `frontend/src/Workspace.jsx`: project-scoped 3D workspace.
- `frontend/src/api.js`: centralized cookie-based API client.
- `frontend/src/components/layout/PublicNavbar.jsx`: active top navigation.
- `frontend/vite.config.js`: Vite config, including vendor chunk splitting.
- `samplefiles/`: sample mesh/CAD assets and helper material.

Legacy note:
- `frontend/src/pages/SignInPage.jsx` and `SignUpPage.jsx` still exist in the repo, but the active app shell now routes through `HomePage.jsx`, `AuthPage.jsx`, and `ProfilePage.jsx`.

## 4. Backend Domain: Projects + Geometry + Meshing

### 4.1 Data Model
Project persistence is implemented in `backend/app/project_service.py`.

Tables:
- `projects`
  - `id`
  - `user_id`
  - `name`
  - `created_at`
  - `updated_at`
  - `last_opened_at`
- `project_geometries`
  - `id`
  - `project_id`
  - `type`
  - `params` JSON
  - `mesh` JSON nullable
  - `created_at`
  - `updated_at`

Pydantic models live in `backend/app/project_models.py`:
- `ProjectCreateRequest`
- `ProjectRenameRequest`
- `ProjectSummary`
- `ProjectDetail`
- `BoxRequest`
- `SphereRequest`
- `CylinderRequest`
- `GeometryRecord`
- `Mesh`
- `MeshNode`

### 4.2 Endpoints
System:
- `GET /`
- `GET /health`
- `GET /info`

Project APIs:
- `GET /projects`
- `POST /projects`
- `GET /projects/{project_id}`
- `PATCH /projects/{project_id}` for rename
- `DELETE /projects/{project_id}`

Project-scoped geometry APIs:
- `GET /projects/{project_id}/geometry`
- `DELETE /projects/{project_id}/geometry/{geometry_id}`
- `POST /projects/{project_id}/geometry/box`
- `POST /projects/{project_id}/geometry/sphere`
- `POST /projects/{project_id}/geometry/cylinder`
- `POST /projects/{project_id}/geometry/upload`

### 4.3 Project Loading Behavior
- `GET /projects/{project_id}` returns project metadata plus `geometries`.
- Reading a project updates `last_opened_at`.
- `GET /info` now reports:
  - `project_count`
  - `geometry_count`
  - `gmsh_available`

### 4.4 Geometry Persistence Strategy
- Each created geometry is stored as a row in `project_geometries`.
- `params` are stored as JSON text.
- `mesh` is stored as JSON text so the workspace can reload quickly without remeshing.
- Ownership checks are enforced via `projects.user_id`.

### 4.5 Meshing Strategy
Mesh utilities live in `backend/app/mesh_service.py`.

For primitives:
- Build OCC geometry in Gmsh.
- `occ.synchronize()`.
- Generate 2D surface mesh.
- Extract nodes and triangles into API-friendly JSON.

For uploads:
- Supported extensions:
  - `step`, `stp`, `iges`, `igs`, `brep`, `stl`, `vtk`, `msh`
- Uploaded file is written to a temporary file.
- Gmsh opens the file and generates surface mesh if required.
- Extracted surface mesh is returned and persisted on the geometry row.

### 4.6 Coordinate Mapping
Frontend maps Gmsh `(x, y, z)` into Three.js y-up space as:
- `x -> x`
- `z -> y`
- `y -> z`

## 5. Backend Domain: Auth + Session + OAuth
Main file: `backend/app/auth.py`

### 5.1 Env Loading
- `auth.py` loads `backend/.env` and `backend/.env.local` on import.
- This is custom parsing, not `python-dotenv`.

### 5.2 Auth Tables
Created via `init_auth_db()`:
- `users`
- `otp_challenges`
- `mfa_challenges`
- `sessions`
- `login_throttle`
- `oauth_states`

### 5.3 Password Security
- PBKDF2-HMAC-SHA256 with configurable iterations.
- Stored format: `iterations$salt_b64$hash_b64`.
- Password policy includes:
  - minimum length
  - lowercase/uppercase/digit/special character checks
  - block passwords containing the local-part of the email

### 5.4 OTP Security
- 6-digit OTP.
- Stored hashed, never plaintext in DB.
- TTL and attempt count are configurable.
- Resend invalidates previous active OTP for the same purpose.
- Password-change OTP challenges store the pending new password hash in challenge context until confirmed.
- SMTP failures fail closed unless debug mode is intentionally enabled.

### 5.5 Session Model
- Opaque random token stored in `webmsh_session` cookie.
- Cookie flags:
  - `HttpOnly`
  - `SameSite=Lax`
  - `Secure` controlled by env
- Server stores only the hashed session token.
- Frontend relies on `fetch(..., credentials: 'include')`.
- The active frontend no longer uses a bearer-token bootstrap endpoint.

### 5.6 TOTP 2FA
- TOTP SHA1, 6 digits, 30-second period.
- Setup flow:
  - `POST /auth/2fa/setup/start`
  - `POST /auth/2fa/setup/confirm`
  - `POST /auth/2fa/disable`
- Sign-in inserts an extra TOTP step if `totp_enabled` is true.

### 5.7 Google OAuth
- Endpoints:
  - `GET /auth/google/start`
  - `GET /auth/google/callback`
- Uses PKCE and expiring state rows.
- Email is treated as the canonical user identifier.
- Success behavior:
  - if user email exists, log into that account
  - else create the account
  - set session cookie server-side
  - redirect to `FRONTEND_URL/profile?auth=google_success`
- Error behavior:
  - redirect to `FRONTEND_URL/auth?auth_error=...`

### 5.8 Auth/Profile Endpoints
- `POST /auth/signup`
- `POST /auth/signup/verify`
- `POST /auth/signin`
- `POST /auth/signin/otp`
- `POST /auth/signin/2fa`
- `POST /auth/otp/resend`
- `GET /auth/config`
- `GET /auth/me`
- `GET /auth/profile`
- `POST /auth/password/change/request`
- `POST /auth/password/change/confirm`
- `POST /auth/logout`
- `POST /auth/2fa/setup/start`
- `POST /auth/2fa/setup/confirm`
- `POST /auth/2fa/disable`
- `GET /auth/google/start`
- `GET /auth/google/callback`

`GET /auth/profile` returns:
- `email`
- `created_at`
- `totp_enabled`

Password change flow:
- request step verifies the current password and password policy first
- sends an email OTP for `password_change`
- confirm step updates the password hash
- revokes the user's other active sessions
- sends a confirmation email after success

## 6. Frontend Design and Runtime Behavior

### 6.1 Routing
Active routes are defined in `frontend/src/App.jsx`:
- `/` -> public landing page for guests, redirect to `/profile` for authenticated users
- `/auth` -> `AuthPage`
- `/profile` -> `ProfilePage`
- `/workspace/:projectId` -> `Workspace`

Protected routes:
- `/profile`
- `/workspace/:projectId`

### 6.2 Auth UX
File: `frontend/src/AuthPage.jsx`

Capabilities:
- Public home page CTA path flows into `/auth`.
- Sign in and sign up on the same screen.
- Signup OTP verify step.
- Signin OTP step.
- Signin TOTP step.
- Resend OTP controls.
- Google sign-in button.
- Query-param handling for `auth` and `auth_error`.
- Successful auth always navigates to `/profile`.

### 6.3 Profile Dashboard
Files:
- `frontend/src/pages/ProfilePage.jsx`
- `frontend/src/ProfilePage.jsx`

Capabilities:
- Loads:
  - `api.profile()`
  - `api.listProjects()`
  - `refreshUser()`
- Displays:
  - email
  - joined date
  - 2FA status
  - project count
- Project actions:
  - create
  - open
  - delete
  - rename
- Password actions:
  - request password change with old-password verification
  - confirm password change with email OTP
  - success/error/loading states for the two-step flow
- Session actions:
  - sign out
  - refresh dashboard
- 2FA setup/disable is available directly from the profile page.

### 6.4 Landing Page
File: `frontend/src/pages/HomePage.jsx`

Capabilities:
- Public SaaS-style landing page at `/`.
- Hero section with product value proposition.
- CTA to `/auth`.
- Feature cards.
- Three-step "How It Works" section.
- Footer with repository link.

### 6.5 Workspace UX
File: `frontend/src/Workspace.jsx`

Capabilities:
- Reads `projectId` from route params.
- Loads:
  - `api.health()`
  - `api.info()`
  - `api.getProject(projectId)`
- Rebuilds the Three.js scene from `project.geometries`.
- Sends all geometry actions through project-scoped endpoints.
- Includes:
  - box/sphere/cylinder creation
  - CAD/mesh upload
  - geometry deletion
  - project header/status
  - Back to Profile button

### 6.6 API Client Contract
File: `frontend/src/api.js`

Single request wrapper:
- Parses JSON when possible.
- Throws structured errors with `status` and `body`.
- Always includes cookies.
- No session bootstrap token flow.

Exposed API groups:
- auth APIs
- profile APIs
- password change APIs
- project APIs
- project-scoped geometry APIs
- system APIs (`health`, `info`)

### 6.7 Build Behavior
File: `frontend/vite.config.js`

Current optimization:
- React/router dependencies are split into `react-vendor`.
- Three.js is split into `three-vendor`.

## 7. Active Configuration Surface
Backend `.env` keys in active use:
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

Frontend env:
- `VITE_API_BASE`

Important:
- If `WEBMSH_AUTH_SECRET` is missing, runtime uses an ephemeral secret and sessions reset on restart.
- Google OAuth needs an exact callback URI match in Google Cloud.
- `WEBMSH_FRONTEND_URL` should point at the frontend host that serves `/auth`, `/profile`, and `/workspace/:projectId`.
- Gmail SMTP usually requires an app password and 2-step verification.

## 8. Run / Dev Pipeline

### 8.1 Backend
Recommended:
1. `cd backend`
2. activate `backend/.venv`
3. `pip install -r requirements.txt`
4. `python .\app\main.py`

Backend binds `127.0.0.1:8000`.

Common issue:
- Port `8000` in use (`WinError 10048`) prevents startup and can make OAuth appear broken.

### 8.2 Frontend
1. `cd frontend`
2. `npm install`
3. `npm run dev`

Frontend expects backend at `http://localhost:8000` unless `VITE_API_BASE` is set.

### 8.3 Validation Commands
- Backend syntax:
  - `.\.venv\Scripts\python.exe -B -m py_compile app\auth.py app\db.py app\main.py app\mesh_service.py app\project_models.py app\project_service.py app\projects.py`
- Backend import smoke test:
  - `.\.venv\Scripts\python.exe -c "from app.main import app; print(app.title, app.version)"`
- Frontend lint:
  - `npm run lint`
- Frontend build:
  - `npm run build`

## 9. Security and Reliability Notes
Strengths:
- Password hashing with high iteration PBKDF2.
- OTP TTL and retry cap.
- Signin lockout throttling.
- Server-side hashed session tokens.
- Cookie-based auth with HttpOnly session cookie.
- PKCE and state for Google OAuth.
- Persistent project storage.
- Project ownership checks on every project/geometry endpoint.

Gaps / tradeoffs:
- No automated tests yet.
- SQLite is still a single-file store with no migration framework.
- Mesh JSON is duplicated in DB for convenience and can grow the database.
- No background job queue for email delivery or mesh processing.
- No central logging/observability layer.

## 10. Feature Coverage Snapshot
Implemented:
- Auth: sign up, sign in, email OTP, TOTP 2FA, Google OAuth, logout, profile fetch, session check, password change with OTP confirmation.
- Projects: create, list, open, rename, delete.
- Geometry: project-scoped create/delete for primitives plus CAD/mesh upload.
- Public marketing/landing page at `/`.
- Viewer: interactive Three.js workspace driven by persisted project geometry.

Not yet implemented:
- Boolean operations.
- Transform operations (translate/rotate/scale).
- Mesh export endpoints/workflow.
- Physical groups workflow.
- Undo/redo.
- Multi-user collaboration.
- Forgot-password/reset flow.

## 11. Known Friction Points for Future Work
- `pyproject.toml` and `requirements.txt` are still not fully aligned; actual runtime currently follows `requirements.txt`.
- `@app.on_event("startup")` is still used and should eventually move to FastAPI lifespan.
- Some legacy frontend pages remain in the repo but are no longer part of the active route tree.
- There is no DB migration/versioning system yet for schema evolution.
- Google OAuth should still be smoke-tested interactively with real credentials after env changes.

## 12. Suggested Next Engineering Steps
1. Add backend API tests for auth, profile, projects, and project geometry ownership.
2. Add frontend integration tests for `/auth`, `/profile`, and `/workspace/:projectId`.
3. Implement forgot-password/reset flow.
4. Add boolean and transform operations on project geometry.
5. Add mesh export endpoints and download actions.
6. Introduce a migration tool for SQLite schema changes.
7. Migrate startup logic to FastAPI lifespan.

## 13. Quick Start for Another LLM
Read in this order:
1. `backend/app/auth.py`
2. `backend/app/project_service.py`
3. `backend/app/projects.py`
4. `backend/app/mesh_service.py`
5. `backend/app/main.py`
6. `frontend/src/api.js`
7. `frontend/src/App.jsx`
8. `frontend/src/AuthPage.jsx`
9. `frontend/src/pages/ProfilePage.jsx`
10. `frontend/src/Workspace.jsx`
11. `backend/README.md`
12. `SRS.md`

Then run backend + frontend and verify:
- `GET /auth/config`
- `GET /auth/profile`
- `GET /projects`
- signup/signin flow
- Google login flow
- create project -> open workspace flow
- primitive create/delete + CAD upload flow inside a project
