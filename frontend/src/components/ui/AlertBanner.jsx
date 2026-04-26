function joinClassNames(...parts) {
  return parts.filter(Boolean).join(' ')
}

const TONE_CLASSES = {
  info: 'border-indigo-300/30 bg-indigo-500/10 text-indigo-100',
  success: 'border-emerald-300/30 bg-emerald-500/10 text-emerald-100',
  error: 'border-rose-300/35 bg-rose-500/10 text-rose-100',
}

export default function AlertBanner({ tone = 'info', children }) {
  if (!children) return null

  return (
    <div
      className={joinClassNames(
        'rounded-xl border px-3 py-2 text-sm',
        TONE_CLASSES[tone] || TONE_CLASSES.info,
      )}
      role={tone === 'error' ? 'alert' : 'status'}
    >
      {children}
    </div>
  )
}
