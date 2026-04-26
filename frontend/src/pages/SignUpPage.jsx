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
    <div className="min-h-screen bg-slate-950 px-4 py-6 text-slate-100 sm:px-6">
      <div className="mx-auto grid min-h-[calc(100vh-3rem)] max-w-6xl gap-6 lg:grid-cols-[1.05fr,0.95fr]">
        <AuthBrandPanel />

        <section className="flex items-center">
          <AuthSurface
            title="Create Account"
            subtitle="Start your secure WebMsh workflow in under a minute."
            badges={['Strong password policy', 'Email verification', 'Session security']}
            footer={(
              <>
                Already have an account?{' '}
                <Link className="font-semibold text-cyan-200 hover:text-cyan-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300" to={`/signin?returnTo=${encodeURIComponent(returnTo)}`}>
                  Sign in
                </Link>
              </>
            )}
          >
            <div className="space-y-3" aria-live="polite">
              <AlertBanner tone="error">{error}</AlertBanner>
              <AlertBanner tone="info">{notice}</AlertBanner>
            </div>

            {step === 'credentials' && (
              <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
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
                <div className="h-2 w-full rounded-full bg-slate-800">
                  <div
                    className="h-2 rounded-full bg-cyan-400 transition-all"
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

                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? 'Creating Account...' : 'Create Account'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  disabled={busy}
                  onClick={handleGoogleSignUp}
                >
                  Sign up with Google
                </Button>
              </form>
            )}

            {step === 'verify_email' && (
              <form className="mt-6 space-y-4" onSubmit={handleVerifyOtp}>
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
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? 'Verifying...' : 'Verify Email'}
                </Button>
                <Button type="button" variant="ghost" className="w-full" disabled={busy} onClick={handleResend}>
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
