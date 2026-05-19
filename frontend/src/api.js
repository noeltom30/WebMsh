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

function buildGeomPath(projectId, geometryId, suffix = '') {
  return `/projects/${projectId}/geometry/${geometryId}${suffix}`
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
  deleteGeometry: (projectId, geometryId) => request(buildGeomPath(projectId, geometryId), { method: 'DELETE' }),

  // Primitives
  createBox: (projectId, body) => request(buildProjectPath(projectId, '/geometry/box'), { method: 'POST', body: JSON.stringify(body) }),
  createSphere: (projectId, body) => request(buildProjectPath(projectId, '/geometry/sphere'), { method: 'POST', body: JSON.stringify(body) }),
  createCylinder: (projectId, body) => request(buildProjectPath(projectId, '/geometry/cylinder'), { method: 'POST', body: JSON.stringify(body) }),
  uploadCAD: (projectId, file) => {
    const form = new FormData()
    form.append('file', file)
    return request(buildProjectPath(projectId, '/geometry/upload'), { method: 'POST', body: form })
  },

  // 2D Sketches
  createSketchRect: (projectId, body) => request(buildProjectPath(projectId, '/geometry/sketch/rectangle'), { method: 'POST', body: JSON.stringify(body) }),
  createSketchCircle: (projectId, body) => request(buildProjectPath(projectId, '/geometry/sketch/circle'), { method: 'POST', body: JSON.stringify(body) }),
  createSketchPolygon: (projectId, body) => request(buildProjectPath(projectId, '/geometry/sketch/polygon'), { method: 'POST', body: JSON.stringify(body) }),

  // 3D Operations
  extrudeGeometry: (projectId, geometryId, body) => request(buildGeomPath(projectId, geometryId, '/extrude'), { method: 'POST', body: JSON.stringify(body) }),
  revolveGeometry: (projectId, geometryId, body) => request(buildGeomPath(projectId, geometryId, '/revolve'), { method: 'POST', body: JSON.stringify(body) }),

  // Labels
  updateGeometryLabels: (projectId, geometryId, body) => request(buildGeomPath(projectId, geometryId, '/labels'), { method: 'PATCH', body: JSON.stringify(body) }),

  // Export — triggers a file download via a blob URL
  exportGeometry: async (projectId, geometryId, format) => {
    const response = await fetch(`${API_BASE}${buildGeomPath(projectId, geometryId, `/export?format=${format}`)}`, {
      credentials: 'include',
    })
    if (!response.ok) {
      const text = await response.text()
      let body
      try { body = JSON.parse(text) } catch { body = text }
      const error = new Error(`Export failed: ${response.status}`)
      error.status = response.status
      error.body = body
      throw error
    }
    const blob = await response.blob()
    const disposition = response.headers.get('Content-Disposition') || ''
    const match = disposition.match(/filename="([^"]+)"/)
    const filename = match ? match[1] : `geometry_${geometryId}.${format}`
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filename
    anchor.click()
    setTimeout(() => URL.revokeObjectURL(url), 5000)
  },
}
