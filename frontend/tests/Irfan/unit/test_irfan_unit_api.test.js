import { afterEach, describe, expect, it, vi } from 'vitest'
import { api } from '../../../src/api'

afterEach(() => vi.restoreAllMocks())

describe('Irfan Unit Tests', () => {
  it('IRF-UT-001 signup uses POST', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true, text: async () => '{}' })
    await api.signup({ email: 'irfan.ut1@example.com', password: 'Pass@123456' })
    expect(fetch.mock.calls[0][1].method).toBe('POST')
  })
  it('IRF-UT-002 me throws shaped error on 401', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: false, status: 401, text: async () => '{"detail":"Authentication required"}' })
    await expect(api.me()).rejects.toMatchObject({ status: 401 })
  })
  it('IRF-UT-003 createProject hits /projects endpoint', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true, text: async () => '{}' })
    await api.createProject({ name: 'Irfan Project' })
    expect(fetch.mock.calls[0][0]).toContain('/projects')
  })
  it('IRF-UT-004 listProjects uses GET default', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true, text: async () => '[]' })
    await api.listProjects()
    expect(fetch.mock.calls[0][1].method ?? 'GET').toBe('GET')
  })
})
