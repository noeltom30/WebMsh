import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import PublicNavbar from '../components/layout/PublicNavbar'
import AlertBanner from '../components/ui/AlertBanner'
import Button from '../components/ui/Button'
import InputField from '../components/ui/InputField'
import { api } from '../api'
import { useAuth } from '../context/useAuth'

function formatDate(value) {
  if (!value) return 'Not available'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Not available'
  return date.toLocaleString()
}

function StatTile({ label, value }) {
  return (
    <div className="rounded-xl border border-white/10 bg-slate-950/60 p-4 transition hover:border-cyan-300/35">
      <dt className="text-xs uppercase tracking-[0.12em] text-slate-400">{label}</dt>
      <dd className="mt-2 text-sm font-medium text-slate-100">{value}</dd>
    </div>
  )
}

export default function ProfilePage() {
  const navigate = useNavigate()
  const { user, setUser, refreshUser, signOut } = useAuth()

  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const [setupData, setSetupData] = useState(null)
  const [setupCode, setSetupCode] = useState('')
  const [disableCode, setDisableCode] = useState('')

  const userSummary = useMemo(() => {
    const joinedHint = user?.id ? localStorage.getItem(`webmsh_joined_hint_${user.id}`) : null
    const lastLogin = user?.email ? localStorage.getItem(`webmsh_last_login_${user.email.toLowerCase()}`) : null

    return {
      joined: formatDate(joinedHint),
      lastLogin: formatDate(lastLogin),
    }
  }, [user?.email, user?.id])

  const handleRefresh = async () => {
    setError('')
    setNotice('')
    try {
      setBusy(true)
      await refreshUser()
      setNotice('Profile refreshed.')
    } catch {
      setError('Could not refresh profile. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const handleSignOut = async () => {
    setBusy(true)
    await signOut()
    navigate('/signin', { replace: true })
  }

  const handleStart2FA = async () => {
    setError('')
    setNotice('')
    try {
      setBusy(true)
      const data = await api.start2FASetup()
      setSetupData(data)
      setSetupCode('')
      setNotice(data?.message || '2FA setup started.')
    } catch (requestError) {
      setError(requestError?.body?.detail || 'Failed to start 2FA setup.')
    } finally {
      setBusy(false)
    }
  }

  const handleConfirm2FA = async () => {
    if (setupCode.trim().length !== 6) {
      setError('Enter the 6-digit authenticator code.')
      return
    }

    setError('')
    setNotice('')
    try {
      setBusy(true)
      const response = await api.confirm2FASetup({ code: setupCode.trim() })
      if (response?.user) setUser(response.user)
      setSetupData(null)
      setSetupCode('')
      setNotice(response?.message || '2FA enabled.')
    } catch (requestError) {
      setError(requestError?.body?.detail || 'Failed to confirm 2FA setup.')
    } finally {
      setBusy(false)
    }
  }

  const handleDisable2FA = async () => {
    if (disableCode.trim().length !== 6) {
      setError('Enter the 6-digit authenticator code to disable 2FA.')
      return
    }

    setError('')
    setNotice('')
    try {
      setBusy(true)
      const response = await api.disable2FA({ code: disableCode.trim() })
      if (response?.user) setUser(response.user)
      setDisableCode('')
      setNotice(response?.message || '2FA disabled.')
    } catch (requestError) {
      setError(requestError?.body?.detail || 'Failed to disable 2FA.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <PublicNavbar />

      <main className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-8">
        <div className="grid gap-6 lg:grid-cols-[1.25fr,0.75fr]">
          <section className="rounded-2xl border border-white/10 bg-[linear-gradient(160deg,rgba(15,23,42,0.9),rgba(15,23,42,0.8))] p-6 shadow-soft">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-cyan-200">Account</p>
                <h1 className="mt-2 text-3xl font-bold text-white">Profile & Security</h1>
              </div>
              <div className="flex w-full gap-2 sm:w-auto">
                <Button variant="outline" onClick={handleRefresh} disabled={busy}>Refresh</Button>
                <Button onClick={() => navigate('/workspace')}>Open Workspace</Button>
              </div>
            </div>

            <div className="mt-5 flex items-center gap-4 rounded-2xl border border-white/10 bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950/60 p-4">
              <div className="grid h-12 w-12 place-items-center rounded-xl bg-indigo-500/20 text-sm font-bold text-indigo-100">
                {(user?.email || 'U').slice(0, 1).toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-100">{user?.display_name || 'WebMsh Member'}</p>
                <p className="text-xs text-slate-300">{user?.email || 'Authenticated account'}</p>
              </div>
            </div>

            <div className="mt-6 space-y-3" aria-live="polite">
              <AlertBanner tone="error">{error}</AlertBanner>
              <AlertBanner tone="success">{notice}</AlertBanner>
            </div>

            <dl className="mt-6 grid gap-4 sm:grid-cols-2">
              <StatTile label="Email" value={user?.email || 'Not available'} />
              <StatTile label="Provider" value={user?.auth_provider || 'password'} />
              <StatTile label="Email Status" value={user?.is_email_verified ? 'Verified' : 'Pending verification'} />
              <StatTile label="2FA" value={user?.totp_enabled ? 'Enabled' : 'Disabled'} />
              <StatTile label="Joined" value={userSummary.joined} />
              <StatTile label="Last Login" value={userSummary.lastLogin} />
            </dl>
          </section>

          <aside className="space-y-6">
            <section className="rounded-2xl border border-white/10 bg-[linear-gradient(170deg,rgba(15,23,42,0.86),rgba(15,23,42,0.72))] p-5 shadow-soft">
              <h2 className="text-lg font-semibold text-white">Multi-Factor Authentication</h2>
              <p className="mt-2 text-sm text-slate-300">
                Protect your account with authenticator-app verification.
              </p>

              {!user?.totp_enabled && (
                <div className="mt-4 space-y-3">
                  <Button className="w-full" onClick={handleStart2FA} disabled={busy}>
                    {busy ? 'Preparing...' : 'Enable 2FA'}
                  </Button>

                  {setupData && (
                    <div className="space-y-3 rounded-xl border border-white/10 bg-slate-950/60 p-4">
                      <p className="text-xs text-slate-300">Authenticator Secret</p>
                      <code className="block overflow-x-auto rounded bg-slate-900 p-2 text-xs text-slate-200">
                        {setupData.secret}
                      </code>
                      <p className="text-xs text-slate-300">OTP URI</p>
                      <code className="block overflow-x-auto rounded bg-slate-900 p-2 text-xs text-slate-200">
                        {setupData.otpauth_uri}
                      </code>
                      <InputField
                        id="setup-2fa-code"
                        label="Confirm Code"
                        value={setupCode}
                        onChange={(event) => setSetupCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="6-digit code"
                        inputMode="numeric"
                        maxLength={6}
                      />
                      <Button className="w-full" onClick={handleConfirm2FA} disabled={busy}>
                        {busy ? 'Verifying...' : 'Confirm 2FA'}
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {user?.totp_enabled && (
                <div className="mt-4 space-y-3">
                  <InputField
                    id="disable-2fa-code"
                    label="Authenticator Code"
                    value={disableCode}
                    onChange={(event) => setDisableCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="6-digit code"
                    inputMode="numeric"
                    maxLength={6}
                  />
                  <Button variant="danger" className="w-full" onClick={handleDisable2FA} disabled={busy}>
                    {busy ? 'Disabling...' : 'Disable 2FA'}
                  </Button>
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-white/10 bg-[linear-gradient(170deg,rgba(15,23,42,0.86),rgba(15,23,42,0.72))] p-5 shadow-soft">
              <h2 className="text-lg font-semibold text-white">Session</h2>
              <p className="mt-2 text-sm text-slate-300">
                Manage your active session and continue to engineering tools.
              </p>
              <div className="mt-4 space-y-2">
                <Button variant="outline" className="w-full" onClick={() => navigate('/workspace')}>
                  Continue to Workspace
                </Button>
                <Button variant="ghost" className="w-full" onClick={handleSignOut} disabled={busy}>
                  Sign Out
                </Button>
                <Link to="/" className="block text-center text-sm text-cyan-200 hover:text-cyan-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300">
                  Back to Home
                </Link>
              </div>
            </section>
          </aside>
        </div>
      </main>
    </div>
  )
}
