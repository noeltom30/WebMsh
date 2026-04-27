const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'
const SESSION_TOKEN_KEY = 'webmsh.sessionToken'

let cachedToken = null
let tokenRequest = null

function readStoredToken() {
  try {
    return window.localStorage.getItem(SESSION_TOKEN_KEY)
  } catch {
    return null
  }
}

function writeStoredToken(token) {
  try {
    window.localStorage.setItem(SESSION_TOKEN_KEY, token)
  } catch {
    // Ignore storage failures in private-mode/restricted contexts.
  }
}

async function createSessionToken() {
  const res = await fetch(`${API_BASE}/auth/session`, { method: 'POST' })
  const text = await res.text()
  let data
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = text
  }

  if (!res.ok || !data?.access_token) {
    const error = new Error(`Session creation failed: ${res.status}`)
    error.status = res.status
    error.body = data
    throw error
  }

  return data.access_token
}

async function ensureSessionToken(forceRefresh = false) {
  if (forceRefresh) {
    cachedToken = null
  }

  if (!cachedToken) {
    cachedToken = readStoredToken()
  }
  if (cachedToken && !forceRefresh) {
    return cachedToken
  }

  if (!tokenRequest) {
    tokenRequest = createSessionToken()
      .then((token) => {
        cachedToken = token
        writeStoredToken(token)
        return token
      })
      .finally(() => {
        tokenRequest = null
      })
  }

  return tokenRequest
}

async function request(path, options = {}, retriedAfterAuth = false) {
  const isFormData = options.body instanceof FormData
  const headers = isFormData
    ? { ...(options.headers || {}) }
    : { 'Content-Type': 'application/json', ...(options.headers || {}) }

  if (path !== '/auth/session') {
    const token = await ensureSessionToken(false)
    headers.Authorization = `Bearer ${token}`
  }

  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers,
    ...options,
  })
  const text = await res.text()
  let data
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = text
  }

  if (res.status === 401 && path !== '/auth/session' && !retriedAfterAuth) {
    await ensureSessionToken(true)
    return request(path, options, true)
  }

  if (!res.ok) {
    const error = new Error(`Request failed: ${res.status}`)
    error.status = res.status
    error.body = data
    throw error
  }

  return data
}

export const api = {
  // Auth
  signup: (body) => request('/auth/signup', { method: 'POST', body: JSON.stringify(body) }),
  verifySignupOTP: (body) => request('/auth/signup/verify', { method: 'POST', body: JSON.stringify(body) }),
  signIn: (body) => request('/auth/signin', { method: 'POST', body: JSON.stringify(body) }),
  verifySignInOTP: (body) => request('/auth/signin/otp', { method: 'POST', body: JSON.stringify(body) }),
  verifySignIn2FA: (body) => request('/auth/signin/2fa', { method: 'POST', body: JSON.stringify(body) }),
  resendOTP: (body) => request('/auth/otp/resend', { method: 'POST', body: JSON.stringify(body) }),
  authConfig: () => request('/auth/config'),
  me: () => request('/auth/me'),
  logout: () => request('/auth/logout', { method: 'POST' }),
  startGoogleLogin: (returnTo = '/') => {
    const query = new URLSearchParams({ return_to: returnTo }).toString()
    window.location.assign(`${API_BASE}/auth/google/start?${query}`)
  },
  start2FASetup: () => request('/auth/2fa/setup/start', { method: 'POST' }),
  confirm2FASetup: (body) => request('/auth/2fa/setup/confirm', { method: 'POST', body: JSON.stringify(body) }),
  disable2FA: (body) => request('/auth/2fa/disable', { method: 'POST', body: JSON.stringify(body) }),

  // Mesh workspace
  health: () => request('/health'),
  info: () => request('/info'),
  listGeometry: () => request('/geometry'),
  createBox: (body) => request('/geometry/box', { method: 'POST', body: JSON.stringify(body) }),
  createSphere: (body) => request('/geometry/sphere', { method: 'POST', body: JSON.stringify(body) }),
  createCylinder: (body) => request('/geometry/cylinder', { method: 'POST', body: JSON.stringify(body) }),
  createBoolean: (body) => request('/geometry/boolean', { method: 'POST', body: JSON.stringify(body) }),
  generateMesh: (body) => request('/mesh/generate', { method: 'POST', body: JSON.stringify(body) }),
  deleteGeometry: (id) => request(`/geometry/${id}`, { method: 'DELETE' }),
  uploadCAD: (file) => {
    const form = new FormData()
    form.append('file', file)
    return request('/geometry/upload', { method: 'POST', body: form })
  },
}
