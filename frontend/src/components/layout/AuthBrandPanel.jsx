export default function AuthBrandPanel() {
  return (
    <aside className="hidden h-full flex-col justify-between rounded-2xl border border-white/10 bg-[linear-gradient(165deg,rgba(14,116,144,0.28),rgba(15,23,42,0.9),rgba(2,6,23,0.95))] p-8 lg:flex">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-100/90">WebMsh</p>
        <h1 className="mt-6 text-4xl font-bold leading-tight text-slate-100 animate-fade-in-up">
          Secure access to your meshing workspace
        </h1>
        <p className="mt-4 max-w-md text-base leading-relaxed text-slate-300 animate-fade-in-up [animation-delay:150ms]">
          Professional authentication flow with email OTP, optional authenticator 2FA, and Google sign-in support.
        </p>
      </div>

      <ul className="space-y-3 text-sm text-slate-300 animate-fade-in-up [animation-delay:250ms]">
        <li className="flex items-center gap-3">
          <span className="h-1.5 w-1.5 rounded-full bg-cyan-300" />
          Password hashing and brute-force lockout protection
        </li>
        <li className="flex items-center gap-3">
          <span className="h-1.5 w-1.5 rounded-full bg-cyan-300" />
          OTP verification for sign-up and sign-in
        </li>
        <li className="flex items-center gap-3">
          <span className="h-1.5 w-1.5 rounded-full bg-cyan-300" />
          Session cookies with secure backend validation
        </li>
      </ul>
    </aside>
  )
}
