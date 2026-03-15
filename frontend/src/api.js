const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'

async function request(path, options = {}) {
  const isFormData = options.body instanceof FormData
  const headers = isFormData
    ? (options.headers || {})
    : { 'Content-Type': 'application/json', ...(options.headers || {}) }

  const res = await fetch(`${API_BASE}${path}`, {
    headers,
    ...options,
  })
  const text = await res.text()
  let data
  try {
    data = text ? JSON.parse(text) : null
  } catch (e) {
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
