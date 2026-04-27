import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { api } from './api'
import { useAuth } from './context/useAuth'
import { AUTH_ERROR_MESSAGES } from './utils/auth'

function passwordScore(password) {
  let score = 0
  if (password.length >= 12) score += 1
  if (/[a-z]/.test(password)) score += 1
  if (/[A-Z]/.test(password)) score += 1
  if (/\d/.test(password)) score += 1
  if (/[^A-Za-z0-9]/.test(password)) score += 1
  return score
}

function cleanAuthSearch(search) {
  const params = new URLSearchParams(search)
  const hasAuthState = params.has('auth') || params.has('auth_error')
  if (!hasAuthState) return null
  params.delete('auth')
  params.delete('auth_error')
  const cleaned = params.toString()
  return cleaned ? `?${cleaned}` : ''
}

function AuthPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { refreshUser, setUser } = useAuth()

  const [mode, setMode] = useState('signin')
  const [step, setStep] = useState('credentials')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [authConfig, setAuthConfig] = useState(null)

  const [signinEmail, setSigninEmail] = useState('')
  const [signinPassword, setSigninPassword] = useState('')
  const [showSigninPassword, setShowSigninPassword] = useState(false)

  const [fullName, setFullName] = useState('')
  const [signupEmail, setSignupEmail] = useState('')
  const [signupPassword, setSignupPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showSignupPassword, setShowSignupPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const [pendingEmail, setPendingEmail] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [totpCode, setTotpCode] = useState('')
  const [mfaToken, setMfaToken] = useState('')

  const strength = useMemo(() => passwordScore(signupPassword), [signupPassword])

  useEffect(() => {
    api.authConfig()
      .then(setAuthConfig)
      .catch(() => setAuthConfig(null))
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const auth = params.get('auth')
    const authError = params.get('auth_error')

    if (auth === 'google_success') {
      refreshUser()
        .then(() => navigate('/profile', { replace: true }))
        .catch(() => setError('Google sign-in succeeded but the session could not be loaded.'))
    } else if (authError) {
      setError(AUTH_ERROR_MESSAGES[authError] || `Authentication error: ${authError.replaceAll('_', ' ')}`)
    }

    const cleanedSearch = cleanAuthSearch(location.search)
    if (cleanedSearch !== null) {
      navigate({ pathname: location.pathname, search: cleanedSearch }, { replace: true })
    }
  }, [location.pathname, location.search, navigate, refreshUser])

  const finalizeAuthentication = async (userFromResponse = null) => {
    if (userFromResponse) {
      setUser(userFromResponse)
    } else {
      await refreshUser()
    }
    navigate('/profile', { replace: true })
  }

  const applyResponseNotice = (response) => {
    setNotice(response?.message || '')
  }

  const switchMode = (nextMode) => {
    setMode(nextMode)
    setStep('credentials')
    setError('')
    setNotice('')
    setOtpCode('')
    setTotpCode('')
    setMfaToken('')
  }

  const handleGoogle = () => {
    setError('')
    if (authConfig && !authConfig.google_configured) {
      setError('Google sign-in is not configured yet. Add Google OAuth credentials in backend .env.')
      return
    }
    api.startGoogleLogin('/profile')
  }

  const handleSignup = async (event) => {
    event.preventDefault()
    setError('')
    setNotice('')

    if (signupPassword !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    try {
      setBusy(true)
      const response = await api.signup({
        email: signupEmail.trim().toLowerCase(),
        password: signupPassword,
        full_name: fullName.trim() || null,
      })
      setPendingEmail(signupEmail.trim().toLowerCase())
      setStep('signup_otp')
      applyResponseNotice(response)
    } catch (requestError) {
      const detail = requestError?.body?.detail
      if (detail?.issues?.length) {
        setError(detail.issues.join(' | '))
      } else {
        setError(detail || 'Sign-up failed')
      }
    } finally {
      setBusy(false)
    }
  }

  const handleSignupOtp = async (event) => {
    event.preventDefault()
    setError('')
    try {
      setBusy(true)
      const response = await api.verifySignupOTP({
        email: pendingEmail,
        code: otpCode.trim(),
      })
      setNotice(response?.message || 'Email verified. Sign in to continue.')
      switchMode('signin')
      setSigninEmail(pendingEmail)
    } catch (requestError) {
      setError(requestError?.body?.detail || 'OTP verification failed')
    } finally {
      setBusy(false)
    }
  }

  const handleSignin = async (event) => {
    event.preventDefault()
    setError('')
    setNotice('')
    try {
      setBusy(true)
      const response = await api.signIn({
        email: signinEmail.trim().toLowerCase(),
        password: signinPassword,
      })
      setPendingEmail(signinEmail.trim().toLowerCase())
      if (response?.next === 'verify_signup_otp') {
        setMode('signup')
        setStep('signup_otp')
      } else {
        setStep('signin_otp')
      }
      applyResponseNotice(response)
    } catch (requestError) {
      setError(requestError?.body?.detail || 'Sign-in failed')
    } finally {
      setBusy(false)
    }
  }

  const handleSigninOtp = async (event) => {
    event.preventDefault()
    setError('')
    try {
      setBusy(true)
      const response = await api.verifySignInOTP({
        email: pendingEmail,
        code: otpCode.trim(),
      })
      if (response?.next === 'totp_required') {
        setMfaToken(response?.mfa_token || '')
        setStep('signin_totp')
        setNotice(response?.message || 'Authenticator verification required.')
        return
      }
      await finalizeAuthentication(response?.user || null)
    } catch (requestError) {
      setError(requestError?.body?.detail || 'OTP verification failed')
    } finally {
      setBusy(false)
    }
  }

  const handleSigninTotp = async (event) => {
    event.preventDefault()
    setError('')
    try {
      setBusy(true)
      const response = await api.verifySignIn2FA({
        email: pendingEmail,
        code: totpCode.trim(),
        mfa_token: mfaToken,
      })
      await finalizeAuthentication(response?.user || null)
    } catch (requestError) {
      setError(requestError?.body?.detail || '2FA verification failed')
    } finally {
      setBusy(false)
    }
  }

  const resendOtp = async (purpose) => {
    setError('')
    try {
      setBusy(true)
      const response = await api.resendOTP({ email: pendingEmail, purpose })
      applyResponseNotice(response)
    } catch (requestError) {
      setError(requestError?.body?.detail || 'Could not resend OTP')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <section className="auth-brand">
          <div className="auth-brand-badge">WebMsh</div>
          <h1>Secure access to your meshing workspace</h1>
          <p>Sign in with email verification or Google OAuth, then manage projects from a persistent profile dashboard.</p>
          <ul>
            <li>Persistent project storage per account</li>
            <li>Short-lived OTP verification codes</li>
            <li>TOTP authenticator-based 2FA</li>
            <li>Secure HttpOnly session cookies</li>
            {authConfig?.official_email && <li>Official OTP sender: {authConfig.official_email}</li>}
          </ul>
        </section>

        <section className="auth-panel">
          <div className="auth-tabs">
            <button className={`auth-tab${mode === 'signin' ? ' active' : ''}`} onClick={() => switchMode('signin')}>Sign In</button>
            <button className={`auth-tab${mode === 'signup' ? ' active' : ''}`} onClick={() => switchMode('signup')}>Sign Up</button>
          </div>

          {error && <div className="auth-error">{error}</div>}
          {notice && <div className="auth-note">{notice}</div>}

          {step === 'signup_otp' && (
            <form className="auth-form" onSubmit={handleSignupOtp}>
              <label>Verification Code</label>
              <input className="auth-input" type="text" inputMode="numeric" maxLength={6} value={otpCode} onChange={(event) => setOtpCode(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="6-digit code" required />
              <button className="auth-btn" type="submit" disabled={busy}>{busy ? 'Verifying...' : 'Verify Email'}</button>
              <button className="auth-link-btn" type="button" disabled={busy} onClick={() => resendOtp('signup')}>Resend code</button>
            </form>
          )}

          {step === 'signin_otp' && (
            <form className="auth-form" onSubmit={handleSigninOtp}>
              <label>One-Time Password</label>
              <input className="auth-input" type="text" inputMode="numeric" maxLength={6} value={otpCode} onChange={(event) => setOtpCode(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="6-digit code" required />
              <button className="auth-btn" type="submit" disabled={busy}>{busy ? 'Checking...' : 'Continue'}</button>
              <button className="auth-link-btn" type="button" disabled={busy} onClick={() => resendOtp('login')}>Resend code</button>
            </form>
          )}

          {step === 'signin_totp' && (
            <form className="auth-form" onSubmit={handleSigninTotp}>
              <label>Authenticator Code</label>
              <input className="auth-input" type="text" inputMode="numeric" maxLength={6} value={totpCode} onChange={(event) => setTotpCode(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="6-digit authenticator code" required />
              <button className="auth-btn" type="submit" disabled={busy}>{busy ? 'Verifying...' : 'Finish Sign In'}</button>
            </form>
          )}

          {step === 'credentials' && mode === 'signin' && (
            <form className="auth-form" onSubmit={handleSignin}>
              <label>Email</label>
              <input className="auth-input" type="email" value={signinEmail} onChange={(event) => setSigninEmail(event.target.value)} placeholder="you@example.com" required />
              <label>Password</label>
              <div className="auth-password-row">
                <input className="auth-input" type={showSigninPassword ? 'text' : 'password'} value={signinPassword} onChange={(event) => setSigninPassword(event.target.value)} placeholder="Your password" required />
                <button className="auth-ghost-btn" type="button" onClick={() => setShowSigninPassword((value) => !value)}>{showSigninPassword ? 'Hide' : 'Show'}</button>
              </div>
              <button className="auth-btn" type="submit" disabled={busy}>{busy ? 'Signing in...' : 'Sign In Securely'}</button>
              <button className="auth-google-btn" type="button" onClick={handleGoogle} disabled={authConfig && !authConfig.google_configured}>Continue with Google</button>
            </form>
          )}

          {step === 'credentials' && mode === 'signup' && (
            <form className="auth-form" onSubmit={handleSignup}>
              <label>Full Name</label>
              <input className="auth-input" type="text" value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Optional" />
              <label>Email</label>
              <input className="auth-input" type="email" value={signupEmail} onChange={(event) => setSignupEmail(event.target.value)} placeholder="you@example.com" required />
              <label>Password</label>
              <div className="auth-password-row">
                <input className="auth-input" type={showSignupPassword ? 'text' : 'password'} value={signupPassword} onChange={(event) => setSignupPassword(event.target.value)} placeholder="Create a strong password" required />
                <button className="auth-ghost-btn" type="button" onClick={() => setShowSignupPassword((value) => !value)}>{showSignupPassword ? 'Hide' : 'Show'}</button>
              </div>
              <label>Confirm Password</label>
              <div className="auth-password-row">
                <input className="auth-input" type={showConfirmPassword ? 'text' : 'password'} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Repeat password" required />
                <button className="auth-ghost-btn" type="button" onClick={() => setShowConfirmPassword((value) => !value)}>{showConfirmPassword ? 'Hide' : 'Show'}</button>
              </div>
              <div className="auth-strength">
                <span>Password strength</span>
                <div className="auth-strength-bar"><div className={`auth-strength-fill s${strength}`} /></div>
              </div>
              <button className="auth-btn" type="submit" disabled={busy}>{busy ? 'Creating account...' : 'Create Account'}</button>
              <button className="auth-google-btn" type="button" onClick={handleGoogle} disabled={authConfig && !authConfig.google_configured}>Sign up with Google</button>
            </form>
          )}
        </section>
      </div>
    </div>
  )
}

export default AuthPage
