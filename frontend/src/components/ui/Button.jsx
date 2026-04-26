function joinClassNames(...parts) {
  return parts.filter(Boolean).join(' ')
}

const VARIANT_CLASSES = {
  primary: 'bg-[linear-gradient(135deg,#0ea5e9,#6366f1)] text-white shadow-[0_14px_30px_-18px_rgba(14,165,233,0.8)] hover:brightness-110 focus-visible:ring-cyan-300',
  secondary: 'bg-slate-800 text-slate-100 hover:bg-slate-700 focus-visible:ring-slate-300',
  ghost: 'bg-transparent text-slate-200 hover:bg-white/5 focus-visible:ring-cyan-300',
  outline: 'border border-white/15 bg-transparent text-slate-100 hover:border-cyan-300/40 hover:bg-cyan-400/10 focus-visible:ring-cyan-300',
  danger: 'bg-rose-500 text-white hover:bg-rose-400 focus-visible:ring-rose-300',
}

const SIZE_CLASSES = {
  sm: 'h-9 px-3 text-sm',
  md: 'h-11 px-4 text-sm',
  lg: 'h-12 px-5 text-base',
}

export default function Button({
  type = 'button',
  variant = 'primary',
  size = 'md',
  className = '',
  disabled = false,
  children,
  ...rest
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      className={joinClassNames(
        'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition duration-200',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950',
        'disabled:cursor-not-allowed disabled:opacity-60',
        VARIANT_CLASSES[variant] || VARIANT_CLASSES.primary,
        SIZE_CLASSES[size] || SIZE_CLASSES.md,
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  )
}
