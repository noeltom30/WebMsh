function joinClassNames(...parts) {
  return parts.filter(Boolean).join(' ')
}

const VARIANT_CLASSES = {
  primary: 'border border-cyan-300/35 bg-gradient-to-r from-sky-500/80 to-indigo-500/85 text-white shadow-[0_12px_30px_-18px_rgba(56,189,248,0.95)] hover:from-sky-500 hover:to-indigo-500 focus-visible:ring-cyan-300',
  secondary: 'border border-slate-600/80 bg-slate-800/80 text-slate-100 hover:bg-slate-700/85 focus-visible:ring-slate-400',
  ghost: 'border border-transparent bg-transparent text-slate-300 hover:border-cyan-300/35 hover:bg-cyan-400/10 hover:text-cyan-100 focus-visible:ring-cyan-300',
  outline: 'border border-slate-500/75 bg-slate-900/35 text-slate-100 hover:border-cyan-300/45 hover:bg-slate-800/80 focus-visible:ring-cyan-300',
  danger: 'border border-rose-300/30 bg-rose-500/85 text-white hover:bg-rose-500 focus-visible:ring-rose-300',
}

const SIZE_CLASSES = {
  sm: 'h-9 px-3.5 text-xs',
  md: 'h-10 px-4 text-sm',
  lg: 'h-11 px-5 text-base',
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
        'inline-flex items-center justify-center gap-2 rounded-xl font-medium tracking-[0.01em] transition duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[#070b14]',
        'disabled:cursor-not-allowed disabled:opacity-50',
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
