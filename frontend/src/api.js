const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'

async function request(path, options = {}) {
  const isFormData = options.body instanceof FormData
  const headers = isFormData
    ? { ...(options.headers || {}) }
    : { 'Content-Type': 'application/json', ...(options.headers || {}) }

  const response = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers,
    ...options,
  })

  const text = await response.text()
  let data
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = text
  }

  if (!response.ok) {
    const error = new Error(`Request failed: ${response.status}`)
    error.status = response.status
    error.body = data
    throw error
  }

  return data
}

function buildProjectPath(projectId, suffix = '') {
  return `/projects/${projectId}${suffix}`
}

export const api = {
  signup: (body) => request('/auth/signup', { method: 'POST', body: JSON.stringify(body) }),
  verifySignupOTP: (body) => request('/auth/signup/verify', { method: 'POST', body: JSON.stringify(body) }),
  signIn: (body) => request('/auth/signin', { method: 'POST', body: JSON.stringify(body) }),
  verifySignInOTP: (body) => request('/auth/signin/otp', { method: 'POST', body: JSON.stringify(body) }),
  verifySignIn2FA: (body) => request('/auth/signin/2fa', { method: 'POST', body: JSON.stringify(body) }),
  resendOTP: (body) => request('/auth/otp/resend', { method: 'POST', body: JSON.stringify(body) }),
  authConfig: () => request('/auth/config'),
  me: () => request('/auth/me'),
  profile: () => request('/auth/profile'),
  logout: () => request('/auth/logout', { method: 'POST' }),
  requestPasswordChange: (body) => request('/auth/password/change/request', { method: 'POST', body: JSON.stringify(body) }),
  confirmPasswordChange: (body) => request('/auth/password/change/confirm', { method: 'POST', body: JSON.stringify(body) }),
  startGoogleLogin: (returnTo = '/profile') => {
    const query = new URLSearchParams({ return_to: returnTo }).toString()
    window.location.assign(`${API_BASE}/auth/google/start?${query}`)
  },
  start2FASetup: () => request('/auth/2fa/setup/start', { method: 'POST' }),
  confirm2FASetup: (body) => request('/auth/2fa/setup/confirm', { method: 'POST', body: JSON.stringify(body) }),
  disable2FA: (body) => request('/auth/2fa/disable', { method: 'POST', body: JSON.stringify(body) }),

  health: () => request('/health'),
  info: () => request('/info'),

  listProjects: () => request('/projects'),
  createProject: (body) => request('/projects', { method: 'POST', body: JSON.stringify(body) }),
  renameProject: (projectId, body) => request(buildProjectPath(projectId), { method: 'PATCH', body: JSON.stringify(body) }),
  getProject: (projectId) => request(buildProjectPath(projectId)),
  deleteProject: (projectId) => request(buildProjectPath(projectId), { method: 'DELETE' }),
  listProjectGeometry: (projectId) => request(buildProjectPath(projectId, '/geometry')),
  deleteGeometry: (projectId, geometryId) => request(buildProjectPath(projectId, `/geometry/${geometryId}`), { method: 'DELETE' }),
  createBox: (projectId, body) => request(buildProjectPath(projectId, '/geometry/box'), { method: 'POST', body: JSON.stringify(body) }),
  createSphere: (projectId, body) => request(buildProjectPath(projectId, '/geometry/sphere'), { method: 'POST', body: JSON.stringify(body) }),
  createCylinder: (projectId, body) => request(buildProjectPath(projectId, '/geometry/cylinder'), { method: 'POST', body: JSON.stringify(body) }),
  uploadCAD: (projectId, file) => {
    const form = new FormData()
    form.append('file', file)
    return request(buildProjectPath(projectId, '/geometry/upload'), { method: 'POST', body: form })
  },
}
