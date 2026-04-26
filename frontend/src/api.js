const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'

async function request(path, options = {}) {
  const isFormData = options.body instanceof FormData
  const headers = isFormData
    ? (options.headers || {})
    : { 'Content-Type': 'application/json', ...(options.headers || {}) }

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
  deleteGeometry: (id) => request(`/geometry/${id}`, { method: 'DELETE' }),
  uploadCAD: (file) => {
    const form = new FormData()
    form.append('file', file)
    return request('/geometry/upload', { method: 'POST', body: form })
  },
}
