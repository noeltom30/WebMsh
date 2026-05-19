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
        'w-full rounded-[22px] border border-sky-500/15 bg-white/35 dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(11,15,23,0.92),rgba(11,15,23,0.78))] p-6 shadow-soft sm:p-8',
        className,
      )}
    >
      <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{title}</h2>
      {subtitle && <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{subtitle}</p>}

      {badges.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-700 dark:text-slate-300">
          {badges.map((badge) => (
            <span key={badge} className="rounded-full border border-sky-500/20 bg-white/50 dark:border-white/15 dark:bg-slate-950/60 px-2.5 py-1">
              {badge}
            </span>
          ))}
        </div>
      )}

      <div className="mt-6">{children}</div>

      {footer && <div className="mt-6 text-sm text-slate-600 dark:text-slate-300">{footer}</div>}
    </div>
  )
}
