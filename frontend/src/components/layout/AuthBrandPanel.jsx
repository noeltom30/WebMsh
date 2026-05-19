import { Link } from 'react-router-dom'
import WebMshLogo from './WebMshLogo'

export default function AuthBrandPanel() {
  return (
    <aside className="hidden h-full flex-col justify-between rounded-[22px] border border-white/10 bg-[radial-gradient(circle_at_78%_10%,rgba(255,255,255,0.08),transparent_35%),radial-gradient(circle_at_22%_80%,rgba(255,255,255,0.04),transparent_40%),linear-gradient(180deg,rgba(6,7,9,0.97),rgba(10,10,12,0.9))] p-8 lg:flex">
      <div>
        {/* Brand block — logo + name, links home */}
        <Link to="/" className="inline-flex items-center gap-2.5 rounded-full border border-white/12 bg-white/5 px-3 py-1.5" style={{ textDecoration: 'none' }}>
          <WebMshLogo size={22} color="#7ed4f7" />
          <span
            style={{
              fontSize: '15px',
              fontWeight: 800,
              letterSpacing: '-0.03em',
              background: 'linear-gradient(135deg,#fff 10%,#7ed4f7 60%,#4ab8ef 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            WebMsh
          </span>
        </Link>

        <h1 className="mt-6 text-4xl font-bold leading-tight tracking-[-0.02em] text-slate-100 animate-fade-in-up">
          Secure entry to your engineering mesh platform
        </h1>
        <p className="mt-4 max-w-md text-base leading-relaxed text-slate-300 animate-fade-in-up [animation-delay:150ms]">
          Premium authentication flow with email OTP, optional authenticator 2FA, and Google sign-in in one cohesive product surface.
        </p>
      </div>

      <ul className="space-y-3 text-sm text-slate-300 animate-fade-in-up [animation-delay:250ms]">
        <li className="flex items-center gap-3">
          <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
          Password hashing and brute-force lockout protection
        </li>
        <li className="flex items-center gap-3">
          <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
          OTP verification for sign-up and sign-in
        </li>
        <li className="flex items-center gap-3">
          <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
          Session cookies with secure backend validation
        </li>
      </ul>
    </aside>
  )
}
