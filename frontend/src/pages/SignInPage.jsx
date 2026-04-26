import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import AuthBrandPanel from '../components/layout/AuthBrandPanel'
import AuthSurface from '../components/layout/AuthSurface'
import AlertBanner from '../components/ui/AlertBanner'
import Button from '../components/ui/Button'
import InputField from '../components/ui/InputField'
import PasswordField from '../components/ui/PasswordField'
import { api } from '../api'
import { useAuth } from '../context/useAuth'
import { AUTH_ERROR_MESSAGES } from '../utils/auth'

const REMEMBER_EMAIL_KEY = 'webmsh_remember_email'

function safeReturnTarget(raw) {
  if (!raw || !raw.startsWith('/')) return '/workspace'
  if (raw.startsWith('//')) return '/workspace'
  return raw
}

export default function SignInPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { refreshUser, setUser } = useAuth()

  const [authConfig, setAuthConfig] = useState(null)
  const [step, setStep] = useState('credentials')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(true)

  const [pendingEmail, setPendingEmail] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [totpCode, setTotpCode] = useState('')
  const [mfaToken, setMfaToken] = useState('')

  const returnTo = useMemo(() => {
    const params = new URLSearchParams(location.search)
    return safeReturnTarget(params.get('returnTo'))
  }, [location.search])

  const stateMessage = location.state?.message || ''

  useEffect(() => {
    api.authConfig()
      .then(setAuthConfig)
      .catch(() => setAuthConfig(null))
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const remembered = localStorage.getItem(REMEMBER_EMAIL_KEY)

    if (stateMessage) setNotice(stateMessage)

    if (remembered) setEmail((current) => current || remembered)
    if (params.get('email')) setEmail(params.get('email') || '')
    if (params.get('verified') === '1') setNotice('Email verified. You can now sign in securely.')

    const auth = params.get('auth')
    const authError = params.get('auth_error')

    if (auth === 'google_success') {
      setNotice('Google sign-in completed successfully. Redirecting...')
      refreshUser()
        .then(() => navigate(returnTo, { replace: true }))
        .catch(() => setError('Google sign-in completed but session could not be loaded.'))
    } else if (authError) {
      setError(AUTH_ERROR_MESSAGES[authError] || `Authentication error: ${authError.replaceAll('_', ' ')}`)
    }

    if (auth || authError || params.has('email') || params.has('verified')) {
      params.delete('auth')
      params.delete('auth_error')
      params.delete('email')
      params.delete('verified')
      const search = params.toString()
      navigate(
        {
          pathname: location.pathname,
          search: search ? `?${search}` : '',
        },
        { replace: true },
      )
    }
  }, [location.pathname, location.search, navigate, refreshUser, returnTo, stateMessage])

  const finalizeSignIn = async (userFromResponse = null) => {
    const user = userFromResponse || await refreshUser()
    if (userFromResponse) {
      setUser(userFromResponse)
    }
    if (!user) throw new Error('Authenticated user unavailable')
    navigate(returnTo, { replace: true })
  }

  const handleCredentialsSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setNotice('')

    const normalizedEmail = email.trim().toLowerCase()
    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      setError('Enter a valid email address.')
      return
    }
    if (!password) {
      setError('Enter your password.')
      return
    }

    if (rememberMe) localStorage.setItem(REMEMBER_EMAIL_KEY, normalizedEmail)
    else localStorage.removeItem(REMEMBER_EMAIL_KEY)

    try {
      setBusy(true)
      const response = await api.signIn({
        email: normalizedEmail,
        password,
      })
      setPendingEmail(normalizedEmail)
      setNotice(response?.message || 'Credentials validated. Continue verification.')

      if (response?.next === 'verify_signup_otp') {
        setStep('verify_email')
        return
      }
      setStep('otp')
    } catch (requestError) {
      setError(requestError?.body?.detail || 'Sign-in failed.')
    } finally {
      setBusy(false)
    }
  }

  const handleVerifyEmailOtp = async (event) => {
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
      setNotice(response?.message || 'Email verified. Please sign in again.')
      setStep('credentials')
      setOtpCode('')
      setPassword('')
    } catch (requestError) {
      setError(requestError?.body?.detail || 'Verification failed.')
    } finally {
      setBusy(false)
    }
  }

  const handleVerifySigninOtp = async (event) => {
    event.preventDefault()
    setError('')

    if (otpCode.trim().length !== 6) {
      setError('Enter the 6-digit OTP from your email.')
      return
    }

    try {
      setBusy(true)
      const response = await api.verifySignInOTP({
        email: pendingEmail,
        code: otpCode.trim(),
      })

      if (response?.next === 'totp_required') {
        setMfaToken(response?.mfa_token || '')
        setStep('totp')
        setNotice(response?.message || 'Authenticator verification required.')
        return
      }

      await finalizeSignIn(response?.user || null)
    } catch (requestError) {
      setError(requestError?.body?.detail || 'OTP verification failed.')
    } finally {
      setBusy(false)
    }
  }

  const handleVerifyTotp = async (event) => {
    event.preventDefault()
    setError('')

    if (totpCode.trim().length !== 6) {
      setError('Enter the 6-digit authenticator code.')
      return
    }

    try {
      setBusy(true)
      const response = await api.verifySignIn2FA({
        email: pendingEmail,
        code: totpCode.trim(),
        mfa_token: mfaToken,
      })
      await finalizeSignIn(response?.user || null)
    } catch (requestError) {
      setError(requestError?.body?.detail || '2FA verification failed.')
    } finally {
      setBusy(false)
    }
  }

  const handleResend = async (purpose) => {
    setError('')
    try {
      setBusy(true)
      const response = await api.resendOTP({
        email: pendingEmail || email.trim().toLowerCase(),
        purpose,
      })
      setNotice(response?.message || 'A new OTP has been sent.')
    } catch (requestError) {
      setError(requestError?.body?.detail || 'Could not resend OTP.')
    } finally {
      setBusy(false)
    }
  }

  const handleGoogleSignIn = () => {
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
            title="Sign In"
            subtitle="Access your secure geometry and meshing workspace."
            badges={['Email OTP', 'Optional 2FA', 'Google OAuth']}
            footer={(
              <>
                Don&apos;t have an account?{' '}
                <Link className="font-semibold text-cyan-200 hover:text-cyan-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300" to="/signup">
                  Create one
                </Link>
              </>
            )}
          >
            <div className="space-y-3" aria-live="polite">
              <AlertBanner tone="error">{error}</AlertBanner>
              <AlertBanner tone="info">{notice}</AlertBanner>
            </div>

            {step === 'credentials' && (
              <form className="mt-6 space-y-4" onSubmit={handleCredentialsSubmit}>
                <InputField
                  id="signin-email"
                  label="Email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                />
                <PasswordField
                  id="signin-password"
                  label="Password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  required
                />

                <div className="flex items-center justify-between">
                  <label className="inline-flex items-center gap-2 text-sm text-slate-300">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(event) => setRememberMe(event.target.checked)}
                      className="h-4 w-4 rounded border border-white/20 bg-slate-900 focus-visible:ring-2 focus-visible:ring-cyan-300"
                    />
                    Remember me
                  </label>
                  <button
                    type="button"
                    onClick={() => setNotice('Password reset endpoint is not connected yet.')}
                    className="text-sm text-cyan-200 transition hover:text-cyan-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
                  >
                    Forgot password?
                  </button>
                </div>

                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? 'Signing In...' : 'Sign In'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  disabled={busy}
                  onClick={handleGoogleSignIn}
                >
                  Continue with Google
                </Button>
              </form>
            )}

            {step === 'verify_email' && (
              <form className="mt-6 space-y-4" onSubmit={handleVerifyEmailOtp}>
                <InputField
                  id="verify-email-otp"
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
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  disabled={busy}
                  onClick={() => handleResend('signup')}
                >
                  Resend verification code
                </Button>
              </form>
            )}

            {step === 'otp' && (
              <form className="mt-6 space-y-4" onSubmit={handleVerifySigninOtp}>
                <InputField
                  id="signin-otp"
                  label="One-Time Password"
                  value={otpCode}
                  onChange={(event) => setOtpCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="6-digit code"
                  inputMode="numeric"
                  maxLength={6}
                  required
                />
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? 'Checking...' : 'Continue'}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  disabled={busy}
                  onClick={() => handleResend('login')}
                >
                  Resend OTP
                </Button>
              </form>
            )}

            {step === 'totp' && (
              <form className="mt-6 space-y-4" onSubmit={handleVerifyTotp}>
                <InputField
                  id="signin-totp"
                  label="Authenticator Code"
                  value={totpCode}
                  onChange={(event) => setTotpCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="6-digit code"
                  inputMode="numeric"
                  maxLength={6}
                  required
                />
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? 'Verifying...' : 'Finish Sign In'}
                </Button>
              </form>
            )}
          </AuthSurface>
        </section>
      </div>
    </div>
  )
}
