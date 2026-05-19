import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import AuthBrandPanel from '../components/layout/AuthBrandPanel'
import AuthSurface from '../components/layout/AuthSurface'
import AlertBanner from '../components/ui/AlertBanner'
import Button from '../components/ui/Button'
import InputField from '../components/ui/InputField'
import PasswordField from '../components/ui/PasswordField'
import { api } from '../api'
import { AUTH_ERROR_MESSAGES, getPasswordStrengthScore, strengthLabel } from '../utils/auth'
import ShapeGrid from '../components/ui/ShapeGrid'
import './AuthModern.css'

function safeReturnTarget(raw) {
  if (!raw || !raw.startsWith('/')) return '/workspace'
  if (raw.startsWith('//')) return '/workspace'
  return raw
}

export default function SignUpPage() {
  const navigate = useNavigate()
  const location = useLocation()

  const [authConfig, setAuthConfig] = useState(null)
  const [step, setStep] = useState('credentials')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [pendingEmail, setPendingEmail] = useState('')
  const [otpCode, setOtpCode] = useState('')

  const returnTo = useMemo(() => {
    const params = new URLSearchParams(location.search)
    return safeReturnTarget(params.get('returnTo'))
  }, [location.search])

  const passwordScore = useMemo(() => getPasswordStrengthScore(password), [password])

  useEffect(() => {
    api.authConfig()
      .then(setAuthConfig)
      .catch(() => setAuthConfig(null))
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const authError = params.get('auth_error')
    if (authError) {
      setError(AUTH_ERROR_MESSAGES[authError] || `Authentication error: ${authError.replaceAll('_', ' ')}`)
      params.delete('auth_error')
      const search = params.toString()
      navigate(
        {
          pathname: location.pathname,
          search: search ? `?${search}` : '',
        },
        { replace: true },
      )
    }
  }, [location.pathname, location.search, navigate])

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setNotice('')

    const normalizedEmail = email.trim().toLowerCase()
    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      setError('Enter a valid email address.')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    try {
      setBusy(true)
      const response = await api.signup({
        email: normalizedEmail,
        password,
        full_name: fullName.trim() || null,
      })
      setPendingEmail(normalizedEmail)
      setStep('verify_email')
      setNotice(response?.message || 'Account created. Verify your email to continue.')
    } catch (requestError) {
      const detail = requestError?.body?.detail
      if (detail?.issues?.length) {
        setError(detail.issues.join(' • '))
      } else {
        setError(detail || 'Sign-up failed.')
      }
    } finally {
      setBusy(false)
    }
  }

  const handleVerifyOtp = async (event) => {
    event.preventDefault()
    setError('')

    if (otpCode.trim().length !== 6) {
      setError('Enter the 6-digit verification code.')
      return
    }

    try {
      setBusy(true)
      const response = await api.verifySignupOTP({
        email: pendingEmail,
        code: otpCode.trim(),
      })
      navigate(`/signin?email=${encodeURIComponent(pendingEmail)}&verified=1&returnTo=${encodeURIComponent(returnTo)}`, {
        replace: true,
        state: { message: response?.message || 'Email verified. Sign in to continue.' },
      })
    } catch (requestError) {
      setError(requestError?.body?.detail || 'Verification failed.')
    } finally {
      setBusy(false)
    }
  }

  const handleResend = async () => {
    setError('')
    try {
      setBusy(true)
      const response = await api.resendOTP({
        email: pendingEmail || email.trim().toLowerCase(),
        purpose: 'signup',
      })
      setNotice(response?.message || 'A new verification code has been sent.')
    } catch (requestError) {
      setError(requestError?.body?.detail || 'Could not resend verification code.')
    } finally {
      setBusy(false)
    }
  }

  const handleGoogleSignUp = () => {
    setError('')
    if (authConfig && !authConfig.google_configured) {
      setError('Google sign-in is not configured on this server yet.')
      return
    }
    api.startGoogleLogin(returnTo)
  }

  return (
    <div className="auth-modern-page">
      <div style={{
        position: 'fixed',
        top: 0, left: 0,
        width: '100vw', height: '100vh',
        zIndex: 0,
        pointerEvents: 'none'
      }}>
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

      <div className="auth-modern-shell relative z-10">
        <AuthBrandPanel />

        <section className="auth-modern-stage">
          <AuthSurface
            className="auth-modern-surface"
            title="Create Account"
            subtitle="Start your secure WebMsh workflow in under a minute."
            badges={['Strong password policy', 'Email verification', 'Session security']}
            footer={(
              <>
                Already have an account?{' '}
                <Link className="auth-modern-link" to={`/signin?returnTo=${encodeURIComponent(returnTo)}`}>
                  Sign in
                </Link>
              </>
            )}
          >
            <div className="auth-modern-alerts space-y-3" aria-live="polite">
              <AlertBanner tone="error">{error}</AlertBanner>
              <AlertBanner tone="info">{notice}</AlertBanner>
            </div>

            {step === 'credentials' && (
              <form className="auth-modern-form space-y-4" onSubmit={handleSubmit}>
                <InputField
                  id="signup-name"
                  label="Full Name"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  placeholder="Optional"
                  autoComplete="name"
                />
                <InputField
                  id="signup-email"
                  label="Email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                />
                <PasswordField
                  id="signup-password"
                  label="Password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="new-password"
                  required
                  hint={`Strength: ${strengthLabel(passwordScore)} (${passwordScore}/5)`}
                />
                <div className="auth-modern-strength">
                  <div
                    className="auth-modern-strength-fill"
                    style={{ width: `${Math.max(10, passwordScore * 20)}%` }}
                  />
                </div>
                <PasswordField
                  id="signup-confirm-password"
                  label="Confirm Password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  autoComplete="new-password"
                  required
                />

                <Button type="submit" className="auth-modern-btn-primary w-full" disabled={busy}>
                  {busy ? 'Creating Account...' : 'Create Account'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="auth-modern-btn-muted w-full"
                  disabled={busy}
                  onClick={handleGoogleSignUp}
                >
                  Sign up with Google
                </Button>
              </form>
            )}

            {step === 'verify_email' && (
              <form className="auth-modern-form space-y-4" onSubmit={handleVerifyOtp}>
                <InputField
                  id="signup-otp"
                  label="Email Verification Code"
                  value={otpCode}
                  onChange={(event) => setOtpCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="6-digit code"
                  inputMode="numeric"
                  maxLength={6}
                  required
                />
                <Button type="submit" className="auth-modern-btn-primary w-full" disabled={busy}>
                  {busy ? 'Verifying...' : 'Verify Email'}
                </Button>
                <Button type="button" variant="ghost" className="auth-modern-btn-muted w-full" disabled={busy} onClick={handleResend}>
                  Resend verification code
                </Button>
              </form>
            )}
          </AuthSurface>
        </section>
      </div>
    </div>
  )
}
