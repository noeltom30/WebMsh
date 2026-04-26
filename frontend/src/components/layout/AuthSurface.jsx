function joinClassNames(...parts) {
  return parts.filter(Boolean).join(' ')
}

export default function AuthSurface({
  title,
  subtitle,
  badges = [],
  children,
  footer,
  className = '',
}) {
  return (
    <div
      className={joinClassNames(
        'w-full rounded-2xl border border-white/10 bg-[linear-gradient(165deg,rgba(15,23,42,0.9),rgba(15,23,42,0.8))] p-6 shadow-soft sm:p-8',
        className,
      )}
    >
      <h2 className="text-2xl font-bold text-white">{title}</h2>
      {subtitle && <p className="mt-2 text-sm leading-relaxed text-slate-300">{subtitle}</p>}

      {badges.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-300">
          {badges.map((badge) => (
            <span key={badge} className="rounded-full border border-white/15 bg-slate-950/60 px-2.5 py-1">
              {badge}
            </span>
          ))}
        </div>
      )}

      <div className="mt-6">{children}</div>

      {footer && <div className="mt-6 text-sm text-slate-300">{footer}</div>}
    </div>
  )
}
