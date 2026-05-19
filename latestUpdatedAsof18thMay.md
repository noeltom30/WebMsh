Project: WebMsh
Summary: WebMsh is a full-stack application with a Python FastAPI backend and a React + Vite frontend (Three.js used client-side). The repo includes backend authentication, project/geometry APIs, and a frontend UI to interact with those APIs.

Top-level layout:
- backend/            : FastAPI backend (Python >= 3.11). Contains app/, README, pyproject.toml, requirements.txt, test helpers.
- frontend/           : React + Vite frontend. Uses React 19, Vite, Tailwind, Vitest, Playwright, and Three.js.
- BL.EN.U4CSE23035_Noel_Tom.pdf : Project report / documentation.
- package-lock.json   : Lockfile (top-level or from previous installs).

Backend (backend/):
- Tech: Python, FastAPI, Uvicorn, Pydantic, gmsh (and others).
- Key files:
  - backend/README.md  : Run instructions and environment variable explanations (OTP, SMTP, Google OAuth, session cookie settings).
  - backend/pyproject.toml : Project manifest (declares fastapi, uvicorn, pydantic, python-multipart).
  - backend/requirements.txt: Pinning used for pip installs (gmsh, fastapi, uvicorn, pytest, httpx, ...).
  - backend/app/main.py : (entrypoint for the FastAPI app) — start here to understand routes and middleware.
  - backend/test_route.py : Test helper that seeds DB and calls endpoints with TestClient.
- Runtime: Typical local start sequence in README: create .venv, install requirements, set .env (copy .env.example), then run `python .\\app\\main.py` or use `uvicorn app.main:app --reload`.
- DB: lightweight sqlite file (app/webmsh_auth.sqlite3) referenced in tests.
- Env vars: WEBMSH_AUTH_SECRET, WEBMSH_DEBUG_OTP, WEBMSH_OTP_ENABLED, SMTP settings, Google OAuth client ID/secret, WEBMSH_FRONTEND_URL, etc.

Frontend (frontend/):
- Tech: React (v19), Vite, Three.js, TailwindCSS, Vitest for unit/integration, Playwright for e2e.
- Key files:
  - frontend/package.json : scripts (dev/build/test) and dependencies list (react, three, react-router-dom).
  - frontend/index.html : App HTML; loads /src/main.jsx.
  - frontend/src/api.js : Central API wrapper used by the frontend for auth, projects, geometry, and admin endpoints. Uses VITE_API_BASE env var (defaults to http://localhost:8000) and credentials: 'include'.
  - frontend/src/* : React app source (entrypoint main.jsx, components, pages, etc.).
- Run: npm install (or pnpm/yarn) then `npm run dev` to start Vite dev server.

Tests and Tooling:
- Frontend uses Vitest and Playwright (scripts present in package.json).
- Backend includes pytest and httpx in requirements and has a TestClient usage example.

Notable behaviors and integration points:
- Auth flow: OTP-based flows with option to disable in env. Backend exposes endpoints under /auth (signup, signin, otp, 2fa). Frontend calls these via src/api.js.
- File uploads for geometry: frontend API supports uploadCAD which posts FormData to /projects/:id/geometry/upload.
- Google OAuth: optional; README documents required env and redirect URI.

Files of highest importance to read first for an LLM to understand the project:
1) backend/README.md  — run instructions and environment variables
2) backend/app/main.py (and backend/app/* routes) — API surface
3) frontend/src/api.js — client-side API contract
4) frontend/src/* — UI behavior and components
5) backend/pyproject.toml & backend/requirements.txt — dependencies and runtime constraints

Actionable notes:
- test_route.py references absolute local paths (d:/Projects/WebMsh/backend); update paths for new environments.
- Confirm presence of backend/.env.example and populate required env variables before running.
- Frontend expects VITE_API_BASE environment variable for API base URL (defaults to http://localhost:8000).

Suggested prompt to drop into an LLM along with this context:
"You are given the project context below. Summarize the API endpoints and data flows, list missing or risky configurations for production, and suggest first three development tasks to make this repo ready for local contributor onboarding. Answer concisely with file pointers."

End of context (generated 2026-05-18).