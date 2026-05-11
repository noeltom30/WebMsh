function joinClassNames(...parts) {
  return parts.filter(Boolean).join(' ')
}

const TONE_CLASSES = {
  info: 'border-cyan-300/35 bg-cyan-400/10 text-cyan-100',
  success: 'border-emerald-300/35 bg-emerald-500/12 text-emerald-100',
  error: 'border-rose-300/40 bg-rose-500/12 text-rose-100',
}

export default function AlertBanner({ tone = 'info', children }) {
  if (!children) return null

  return (
    <div
      className={joinClassNames(
        'rounded-xl border px-3 py-2.5 text-sm',
        TONE_CLASSES[tone] || TONE_CLASSES.info,
      )}
      role={tone === 'error' ? 'alert' : 'status'}
    >
      {children}
    </div>
  )
}
