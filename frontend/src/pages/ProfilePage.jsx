import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import PublicNavbar from '../components/layout/PublicNavbar'
import AlertBanner from '../components/ui/AlertBanner'
import Button from '../components/ui/Button'
import InputField from '../components/ui/InputField'
import PasswordField from '../components/ui/PasswordField'
import { api } from '../api'
import { useAuth } from '../context/useAuth'
import ShapeGrid from '../components/ui/ShapeGrid';
import './HomePage.css';
import { getPasswordStrengthScore, strengthLabel } from '../utils/auth'

const DASHBOARD_PANEL_CLASS = 'rounded-3xl border border-sky-500/15 bg-white/35 p-5 shadow-[0_28px_60px_-34px_rgba(2,132,199,0.22)] backdrop-blur-md dark:border-[#2b3444] dark:bg-[radial-gradient(circle_at_18%_0%,rgba(56,189,248,0.07),transparent_26%),radial-gradient(circle_at_82%_12%,rgba(99,102,241,0.1),transparent_30%),linear-gradient(180deg,rgba(27,30,38,0.96),rgba(31,34,42,0.92))] dark:shadow-[0_30px_70px_-40px_rgba(0,0,0,0.82)]'
const DASHBOARD_INSET_CLASS = 'rounded-2xl border border-sky-500/18 bg-white/40 shadow-[0_18px_45px_-30px_rgba(2,132,199,0.18)] backdrop-blur-md dark:border-[#30394a] dark:bg-[linear-gradient(180deg,rgba(45,48,56,0.92),rgba(52,56,64,0.86))] dark:shadow-[0_22px_42px_-30px_rgba(0,0,0,0.72)]'

function formatDate(value) {
  if (!value) return 'Not available'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Not available'
  return date.toLocaleString()
}

function StatTile({ label, value }) {
  return (
    <div className={`${DASHBOARD_INSET_CLASS} rounded-xl p-4 transition duration-200 hover:-translate-y-0.5 hover:border-sky-400/35 dark:hover:border-cyan-300/22`}>
      <dt className="text-xs uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="mt-2 break-all text-sm font-medium leading-relaxed text-slate-800 dark:text-slate-100">{value}</dd>
    </div>
  )
}

function passwordStrengthClass(score) {
  if (score <= 1) return 'bg-rose-400'
  if (score === 2) return 'bg-amber-400'
  if (score === 3) return 'bg-yellow-300'
  if (score === 4) return 'bg-emerald-400'
  return 'bg-cyan-300'
}

function ProjectCard({
  project,
  busy,
  renameValue,
  renameActive,
  onRenameValueChange,
  onOpen,
  onDelete,
  onStartRename,
  onCancelRename,
  onSaveRename,
}) {
  return (
    <article className={`${DASHBOARD_INSET_CLASS} p-5 transition duration-200 hover:border-sky-400/35 dark:hover:border-cyan-300/18`}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-lg font-semibold text-slate-900 dark:text-white">{project.name}</p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-600 dark:text-slate-300">
            <span className="rounded-full border border-sky-500/15 bg-white/45 px-2 py-1 backdrop-blur-sm dark:border-[#323b4b] dark:bg-[#20242c]">
              Created {formatDate(project.created_at)}
            </span>
            <span className="rounded-full border border-sky-500/15 bg-white/45 px-2 py-1 backdrop-blur-sm dark:border-[#323b4b] dark:bg-[#20242c]">
              Updated {formatDate(project.updated_at)}
            </span>
            <span className="rounded-full border border-sky-500/15 bg-white/45 px-2 py-1 backdrop-blur-sm dark:border-[#323b4b] dark:bg-[#20242c]">
              Last opened {formatDate(project.last_opened_at)}
            </span>
            <span className="rounded-full border border-cyan-300/30 bg-sky-500/12 px-2 py-1 text-sky-700 dark:border-cyan-400/18 dark:bg-cyan-400/10 dark:text-cyan-100">
              {project.geometry_count} geometries
            </span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => onOpen(project.id)} disabled={busy}>
            Open
          </Button>
          {!renameActive && (
            <Button variant="ghost" onClick={() => onStartRename(project)} disabled={busy}>
              Rename
            </Button>
          )}
          <Button variant="danger" onClick={() => onDelete(project.id)} disabled={busy}>
            Delete
          </Button>
        </div>
      </div>

      {renameActive && (
          <div className="mt-4 grid gap-3 rounded-xl border border-sky-500/20 bg-white/55 p-4 backdrop-blur-md dark:border-[#30394a] dark:bg-[linear-gradient(180deg,rgba(32,36,44,0.92),rgba(38,42,50,0.84))] sm:grid-cols-[1fr_auto_auto] sm:items-end">
          <InputField
            id={`rename-project-${project.id}`}
            label="Project Name"
            value={renameValue}
            onChange={(event) => onRenameValueChange(event.target.value)}
            placeholder="Rename project"
          />
          <Button onClick={() => onSaveRename(project.id)} disabled={busy}>
            Save
          </Button>
          <Button variant="ghost" onClick={onCancelRename} disabled={busy}>
            Cancel
          </Button>
        </div>
      )}
    </article>
  )
}

export default function ProfilePage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, setUser, refreshUser, signOut } = useAuth()

  const [profile, setProfile] = useState(null)
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [busyProjectId, setBusyProjectId] = useState(null)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  const [showCreateProject, setShowCreateProject] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [renameProjectId, setRenameProjectId] = useState(null)
  const [renameValue, setRenameValue] = useState('')

  const [setupData, setSetupData] = useState(null)
  const [setupCode, setSetupCode] = useState('')
  const [disableCode, setDisableCode] = useState('')
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')
  const [passwordOtp, setPasswordOtp] = useState('')
  const [passwordBusy, setPasswordBusy] = useState(false)
  const [passwordOtpPending, setPasswordOtpPending] = useState(false)
  const [passwordNotice, setPasswordNotice] = useState('')
  const [passwordError, setPasswordError] = useState('')

  const passwordStrengthScore = getPasswordStrengthScore(newPassword)
  const passwordStrength = newPassword ? strengthLabel(passwordStrengthScore) : 'Not scored'
  const confirmPasswordError =
    confirmNewPassword && confirmNewPassword !== newPassword ? 'Passwords do not match.' : ''

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const auth = params.get('auth')
    if (auth === 'google_success') {
      setNotice('Google sign-in completed successfully.')
      params.delete('auth')
      const cleaned = params.toString()
      navigate({ pathname: location.pathname, search: cleaned ? `?${cleaned}` : '' }, { replace: true })
    }
  }, [location.pathname, location.search, navigate])

  useEffect(() => {
    loadDashboard()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSessionExpired = async () => {
    await signOut()
    navigate('/auth', { replace: true })
  }

  const resetPasswordChangeForm = () => {
    setOldPassword('')
    setNewPassword('')
    setConfirmNewPassword('')
    setPasswordOtp('')
    setPasswordOtpPending(false)
  }

  const loadDashboard = async () => {
    try {
      setLoading(true)
      const [refreshedUser, profileData, projectList] = await Promise.all([
        refreshUser(),
        api.profile(),
        api.listProjects(),
      ])
      setUser(refreshedUser)
      setProfile(profileData)
      setProjects(projectList)
      setError('')
    } catch (requestError) {
      if (requestError?.status === 401) {
        await handleSessionExpired()
        return
      }
      setError(requestError?.body?.detail || 'Could not load your profile dashboard.')
    } finally {
      setLoading(false)
    }
  }

  const refreshProjects = async () => {
    try {
      const projectList = await api.listProjects()
      setProjects(projectList)
    } catch (requestError) {
      if (requestError?.status === 401) {
        await handleSessionExpired()
        return
      }
      setError(requestError?.body?.detail || 'Could not refresh projects.')
    }
  }

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) {
      setError('Enter a project name.')
      return
    }

    try {
      setBusy(true)
      setError('')
      const project = await api.createProject({ name: newProjectName.trim() })
      setNotice(`Created project "${project.name}".`)
      setNewProjectName('')
      setShowCreateProject(false)
      navigate(`/workspace/${project.id}`)
    } catch (requestError) {
      setError(requestError?.body?.detail || 'Could not create project.')
    } finally {
      setBusy(false)
    }
  }

  const handleDeleteProject = async (projectId) => {
    const target = projects.find((project) => project.id === projectId)
    if (!target) return
    if (!window.confirm(`Delete project "${target.name}"?`)) return

    try {
      setBusyProjectId(projectId)
      setError('')
      await api.deleteProject(projectId)
      setNotice(`Deleted project "${target.name}".`)
      if (renameProjectId === projectId) {
        setRenameProjectId(null)
        setRenameValue('')
      }
      await refreshProjects()
    } catch (requestError) {
      setError(requestError?.body?.detail || 'Could not delete project.')
    } finally {
      setBusyProjectId(null)
    }
  }

  const handleRenameProject = async (projectId) => {
    if (!renameValue.trim()) {
      setError('Project name cannot be blank.')
      return
    }

    try {
      setBusyProjectId(projectId)
      setError('')
      const updated = await api.renameProject(projectId, { name: renameValue.trim() })
      setNotice(`Renamed project to "${updated.name}".`)
      setRenameProjectId(null)
      setRenameValue('')
      await refreshProjects()
    } catch (requestError) {
      setError(requestError?.body?.detail || 'Could not rename project.')
    } finally {
      setBusyProjectId(null)
    }
  }

  const handleOpenProject = (projectId) => {
    navigate(`/workspace/${projectId}`)
  }

  const handleRefresh = async () => {
    setNotice('')
    setError('')
    await loadDashboard()
    setNotice('Profile refreshed.')
  }

  const handleSignOut = async () => {
    setBusy(true)
    await signOut()
    navigate('/auth', { replace: true })
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
      await loadDashboard()
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
      await loadDashboard()
    } catch (requestError) {
      setError(requestError?.body?.detail || 'Failed to disable 2FA.')
    } finally {
      setBusy(false)
    }
  }

  const handleRequestPasswordChange = async () => {
    if (!oldPassword) {
      setPasswordError('Enter your current password.')
      return
    }
    if (!newPassword) {
      setPasswordError('Enter a new password.')
      return
    }
    if (confirmPasswordError) {
      setPasswordError(confirmPasswordError)
      return
    }

    setPasswordError('')
    setPasswordNotice('')
    try {
      setPasswordBusy(true)
      const response = await api.requestPasswordChange({
        old_password: oldPassword,
        new_password: newPassword,
      })
      if (response?.next === 'password_change_otp') {
        setPasswordOtpPending(true)
        setPasswordOtp('')
      } else {
        resetPasswordChangeForm()
      }
      setPasswordNotice(response?.message || 'A verification code was sent to your email.')
    } catch (requestError) {
      if (requestError?.status === 401) {
        await handleSessionExpired()
        return
      }
      setPasswordError(requestError?.body?.detail || 'Could not request a password change.')
    } finally {
      setPasswordBusy(false)
    }
  }

  const handleConfirmPasswordChange = async () => {
    if (passwordOtp.trim().length !== 6) {
      setPasswordError('Enter the 6-digit verification code from your email.')
      return
    }

    setPasswordError('')
    setPasswordNotice('')
    try {
      setPasswordBusy(true)
      const response = await api.confirmPasswordChange({ otp_code: passwordOtp.trim() })
      resetPasswordChangeForm()
      setPasswordNotice(response?.message || 'Password updated successfully.')
    } catch (requestError) {
      if (requestError?.status === 401) {
        await handleSessionExpired()
        return
      }
      setPasswordError(requestError?.body?.detail || 'Could not confirm the password change.')
    } finally {
      setPasswordBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="landing-root relative min-h-screen">
        <div style={{position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", zIndex: 0, pointerEvents: "none"}}>
          <ShapeGrid
            speed={0.03}
            squareSize={40}
            direction="diagonal"
            borderColor="#1b2b44"
            hoverFillColor="#4b559e"
            shape="triangle"
            hoverTrailAmount={8}
            hoverColor="#4b559e"
          />
        </div>
        <div className="relative z-10">
          <PublicNavbar />
          <main className="mx-auto flex min-h-[calc(100vh-80px)] max-w-6xl items-center justify-center px-5 py-10 sm:px-8">
            <div className={`${DASHBOARD_INSET_CLASS} px-6 py-5 text-sm text-slate-700 dark:text-slate-200`}>
              Loading your profile and projects...
            </div>
          </main>
        </div>
      </div>
    )
  }

  return (
    <div className="landing-root relative min-h-screen">
      <div style={{position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", zIndex: 0, pointerEvents: "none"}}>
        <ShapeGrid
          speed={0.03}
          squareSize={40}
          direction="diagonal"
          borderColor="#1b2b44"
          hoverFillColor="#4b559e"
          shape="triangle"
          hoverTrailAmount={8}
          hoverColor="#4b559e"
        />
      </div>
      <div className="relative z-10">
        <PublicNavbar />

      <main className="mx-auto w-full max-w-7xl px-5 py-10 sm:px-8">
        <div className="grid gap-6 xl:grid-cols-[1.35fr,0.65fr]">
          <section className="space-y-6">
            <section className={`${DASHBOARD_PANEL_CLASS} p-6`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-sky-600 dark:text-cyan-200">User Profile</p>
                  <h1 className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">Project Dashboard</h1>
                  <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                    Manage your account, review saved projects, and jump straight into the 3D workspace with persistent geometry data.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={handleRefresh} disabled={busy}>
                    Refresh
                  </Button>
                  <Button onClick={() => setShowCreateProject((value) => !value)} disabled={busy}>
                    {showCreateProject ? 'Close' : 'Create Project'}
                  </Button>
                </div>
              </div>

              <div className="mt-6 space-y-3" aria-live="polite">
                <AlertBanner tone="error">{error}</AlertBanner>
                <AlertBanner tone="success">{notice}</AlertBanner>
              </div>

              <dl className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatTile label="Email" value={profile?.email || user?.email || 'Not available'} />
                <StatTile label="2FA" value={profile?.totp_enabled ? 'Enabled' : 'Disabled'} />
                <StatTile label="Joined" value={formatDate(profile?.created_at)} />
                <StatTile label="Projects" value={String(projects.length)} />
              </dl>

              {showCreateProject && (
                <div className="mt-6 rounded-2xl border border-sky-500/24 bg-sky-500/10 p-4 backdrop-blur-md dark:border-cyan-300/18 dark:bg-[linear-gradient(135deg,rgba(56,189,248,0.16),rgba(99,102,241,0.18))]">
                  <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
                    <InputField
                      id="new-project-name"
                      label="New Project Name"
                      value={newProjectName}
                      onChange={(event) => setNewProjectName(event.target.value)}
                      placeholder="Wing mesh study"
                    />
                    <Button onClick={handleCreateProject} disabled={busy}>
                      {busy ? 'Creating...' : 'Create & Open'}
                    </Button>
                    <Button variant="ghost" onClick={() => setShowCreateProject(false)} disabled={busy}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </section>

            <section className={`${DASHBOARD_PANEL_CLASS} p-6`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-sky-600 dark:text-cyan-200">Projects</p>
                  <h2 className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">Saved Projects</h2>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-300">Open an existing project or create a new empty workspace.</p>
              </div>

              <div className="mt-6 space-y-4">
                {projects.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-sky-500/24 bg-white/40 p-6 text-sm text-slate-600 backdrop-blur-md dark:border-[#30394a] dark:bg-[linear-gradient(180deg,rgba(36,40,48,0.9),rgba(41,45,53,0.84))] dark:text-slate-300">
                    No projects yet. Create your first project to start storing geometry persistently.
                  </div>
                )}

                {projects.map((project) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    busy={busyProjectId === project.id}
                    renameValue={renameValue}
                    renameActive={renameProjectId === project.id}
                    onRenameValueChange={setRenameValue}
                    onOpen={handleOpenProject}
                    onDelete={handleDeleteProject}
                    onStartRename={(selectedProject) => {
                      setRenameProjectId(selectedProject.id)
                      setRenameValue(selectedProject.name)
                    }}
                    onCancelRename={() => {
                      setRenameProjectId(null)
                      setRenameValue('')
                    }}
                    onSaveRename={handleRenameProject}
                  />
                ))}
              </div>
            </section>
          </section>

          <aside className="space-y-6">
            <section className={`${DASHBOARD_PANEL_CLASS}`}>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Account Security</h2>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                Protect this workspace with authenticator-based verification.
              </p>

              {!user?.totp_enabled && (
                <div className="mt-4 space-y-3">
                  <Button className="w-full" onClick={handleStart2FA} disabled={busy}>
                    {busy ? 'Preparing...' : 'Enable 2FA'}
                  </Button>

                  {setupData && (
                    <div className={`${DASHBOARD_INSET_CLASS} space-y-3 p-4`}>
                      <p className="text-xs text-slate-600 dark:text-slate-300">Authenticator Secret</p>
                      <code className="block overflow-x-auto rounded bg-white/70 p-2 text-xs text-slate-700 dark:bg-[#151922] dark:text-slate-200">
                        {setupData.secret}
                      </code>
                      <p className="text-xs text-slate-600 dark:text-slate-300">OTP URI</p>
                      <code className="block overflow-x-auto rounded bg-white/70 p-2 text-xs text-slate-700 dark:bg-[#151922] dark:text-slate-200">
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

              <section className={`${DASHBOARD_PANEL_CLASS}`}>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Change Password</h2>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                Confirm your current password, verify the email OTP, and we will revoke your other active sessions for safety.
              </p>

              <div className="mt-4 space-y-3" aria-live="polite">
                <AlertBanner tone="error">{passwordError}</AlertBanner>
                <AlertBanner tone="success">{passwordNotice}</AlertBanner>
              </div>

              {!user?.has_password && (
                <div className={`${DASHBOARD_INSET_CLASS} mt-4 p-4 text-sm text-slate-600 dark:text-slate-300`}>
                  This account currently signs in with Google only, so there is no local password to rotate yet.
                </div>
              )}

              {user?.has_password && (
                <div className="mt-4 space-y-4">
                  <PasswordField
                    id="current-password"
                    label="Current Password"
                    value={oldPassword}
                    onChange={(event) => setOldPassword(event.target.value)}
                    autoComplete="current-password"
                    placeholder="Enter your current password"
                    disabled={passwordBusy}
                  />

                  <PasswordField
                    id="new-password"
                    label="New Password"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    autoComplete="new-password"
                    placeholder="Create a stronger password"
                    disabled={passwordBusy}
                    hint="Use a long password with uppercase, lowercase, a number, and a symbol."
                  />

                  {newPassword && (
                    <div className={`${DASHBOARD_INSET_CLASS} p-3`}>
                      <div className="flex items-center justify-between gap-3 text-xs uppercase tracking-[0.14em] text-slate-600 dark:text-slate-300">
                        <span>Password Strength</span>
                        <span>{passwordStrength}</span>
                      </div>
                      <div className="mt-3 h-2 rounded-full bg-slate-200 dark:bg-slate-800">
                        <div
                          className={`h-2 rounded-full transition-all ${passwordStrengthClass(passwordStrengthScore)}`}
                          style={{ width: `${Math.max(18, (passwordStrengthScore / 5) * 100)}%` }}
                        />
                      </div>
                    </div>
                  )}

                  <PasswordField
                    id="confirm-password"
                    label="Confirm New Password"
                    value={confirmNewPassword}
                    onChange={(event) => setConfirmNewPassword(event.target.value)}
                    autoComplete="new-password"
                    placeholder="Re-enter your new password"
                    disabled={passwordBusy}
                    error={confirmPasswordError}
                  />

                  <Button className="w-full" onClick={handleRequestPasswordChange} disabled={passwordBusy}>
                    {passwordBusy ? 'Requesting OTP...' : 'Request Change'}
                  </Button>

                  {passwordOtpPending && (
                    <div className="space-y-3 rounded-2xl border border-sky-500/24 bg-sky-500/10 p-4 backdrop-blur-md dark:border-cyan-300/18 dark:bg-[linear-gradient(135deg,rgba(56,189,248,0.16),rgba(99,102,241,0.18))]">
                      <InputField
                        id="password-change-otp"
                        label="Email Verification Code"
                        value={passwordOtp}
                        onChange={(event) => setPasswordOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="6-digit OTP"
                        inputMode="numeric"
                        maxLength={6}
                      />
                      <div className="grid gap-2 sm:grid-cols-2">
                        <Button className="w-full" onClick={handleConfirmPasswordChange} disabled={passwordBusy}>
                          {passwordBusy ? 'Confirming...' : 'Confirm Password Change'}
                        </Button>
                        <Button
                          variant="ghost"
                          className="w-full"
                          onClick={() => {
                            setPasswordError('')
                            setPasswordNotice('')
                            resetPasswordChangeForm()
                          }}
                          disabled={passwordBusy}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </section>

            <section className={`${DASHBOARD_PANEL_CLASS}`}>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Session</h2>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                Stay in control of your authenticated session and project access.
              </p>
              <div className="mt-4 space-y-2">
                <Button variant="outline" className="w-full" onClick={() => setShowCreateProject(true)}>
                  New Project
                </Button>
                <Button variant="ghost" className="w-full" onClick={handleSignOut} disabled={busy}>
                  Sign Out
                </Button>
                <Link to="/" className="block text-center text-sm text-sky-600 transition hover:text-sky-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 dark:text-cyan-200 dark:hover:text-cyan-100">
                  View Home Page
                </Link>
              </div>
            </section>
          </aside>
        </div>
      </main>
    </div>
    </div>
  )
}
