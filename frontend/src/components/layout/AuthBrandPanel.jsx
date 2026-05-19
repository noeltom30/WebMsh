import { Link } from 'react-router-dom'
import WebMshLogo from './WebMshLogo'

export default function AuthBrandPanel() {
  return (
    /* LIGHT MODE FIX: Softened white backgrounds with #f5f8fa to reduce eye strain */
    <aside className="hidden h-full flex-col justify-between rounded-[22px] border border-sky-500/15 bg-[radial-gradient(circle_at_78%_10%,rgba(56,189,248,0.1),transparent_35%),radial-gradient(circle_at_22%_80%,rgba(14,165,233,0.05),transparent_40%),linear-gradient(180deg,rgba(255,255,255,0.35),rgba(255,255,255,0.35))] backdrop-blur-xl p-8 lg:flex dark:border-white/10 dark:bg-[radial-gradient(circle_at_78%_10%,rgba(255,255,255,0.08),transparent_35%),radial-gradient(circle_at_22%_80%,rgba(255,255,255,0.04),transparent_40%),linear-gradient(180deg,rgba(6,7,9,0.97),rgba(10,10,12,0.9))] dark:backdrop-blur-none">
      <div>
        {/* Brand block — logo + name, links home */}
        <Link to="/" className="inline-flex items-center gap-2.5 rounded-full border border-sky-500/15 bg-white/35 px-3 py-1.5 dark:border-white/12 dark:bg-white/5" style={{ textDecoration: 'none' }}>
          <WebMshLogo size={22} className="text-[#070b14] dark:text-[#7ed4f7]" />
          <span
            className="text-[15px] font-extrabold tracking-[-0.03em] bg-clip-text text-transparent bg-gradient-to-br from-[#070b14] via-[#1e293b] to-[#0f172a] dark:from-[#fff] dark:via-[#7ed4f7] dark:to-[#4ab8ef]"
          >
            WebMsh
          </span>
        </Link>

        <h1 className="mt-6 text-4xl font-bold leading-tight tracking-[-0.02em] text-slate-900 dark:text-slate-100 animate-fade-in-up">
          Secure entry to your engineering mesh platform
        </h1>
        <p className="mt-4 max-w-md text-base leading-relaxed text-slate-600 dark:text-slate-300 animate-fade-in-up [animation-delay:150ms]">
          Premium authentication flow with email OTP, optional authenticator 2FA, and Google sign-in in one cohesive product surface.
        </p>
      </div>

      <ul className="space-y-3 text-sm text-slate-600 dark:text-slate-300 animate-fade-in-up [animation-delay:250ms]">
        <li className="flex items-center gap-3">
          <span className="h-1.5 w-1.5 rounded-full bg-sky-500 dark:bg-slate-300" />
          Password hashing and brute-force lockout protection
        </li>
        <li className="flex items-center gap-3">
          <span className="h-1.5 w-1.5 rounded-full bg-sky-500 dark:bg-slate-300" />
          OTP verification for sign-up and sign-in
        </li>
        <li className="flex items-center gap-3">
          <span className="h-1.5 w-1.5 rounded-full bg-sky-500 dark:bg-slate-300" />
          Session cookies with secure backend validation
        </li>
      </ul>
    </aside>
  )
}
