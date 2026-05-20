function joinClassNames(...parts) {
  return parts.filter(Boolean).join(' ')
}

const VARIANT_CLASSES = {
  primary: 'webmsh-brand-gradient shadow-[0_12px_30px_-18px_rgba(74,184,239,0.35)] focus-visible:ring-sky-400 dark:focus-visible:ring-cyan-300',
  secondary: 'border border-slate-200 dark:border-slate-600/80 bg-white/35 backdrop-blur-md dark:bg-slate-800/80 text-slate-800 dark:text-slate-100 hover:bg-[#eef2f6] dark:hover:bg-slate-700/85 focus-visible:ring-slate-400',
  ghost: 'border border-transparent bg-transparent text-slate-600 dark:text-slate-300 hover:border-sky-300/40 dark:hover:border-cyan-300/35 hover:bg-sky-50 dark:hover:bg-cyan-400/10 hover:text-sky-700 dark:hover:text-cyan-100 focus-visible:ring-sky-400 dark:focus-visible:ring-cyan-300',
  soft: 'border border-sky-500/18 bg-sky-500/10 text-slate-800 shadow-[0_8px_20px_-16px_rgba(2,132,199,0.18)] backdrop-blur-sm dark:border-[#3a4558] dark:bg-[rgba(36,42,52,0.92)] dark:text-slate-100 hover:border-sky-400/30 hover:bg-sky-500/16 dark:hover:border-cyan-300/22 dark:hover:bg-[rgba(44,52,64,0.96)] focus-visible:ring-sky-400 dark:focus-visible:ring-cyan-300',
  outline: 'border border-slate-300 dark:border-slate-500/75 bg-white/35 backdrop-blur-md/60 dark:bg-slate-900/35 text-slate-800 dark:text-slate-100 hover:border-sky-400/40 dark:hover:border-cyan-300/45 hover:bg-white/35 backdrop-blur-md dark:hover:bg-slate-800/80 focus-visible:ring-sky-400 dark:focus-visible:ring-cyan-300',
  danger: 'border border-rose-300/30 bg-rose-500/90 dark:bg-rose-500/85 text-white hover:bg-rose-500 focus-visible:ring-rose-300',
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
        'cursor-target inline-flex items-center justify-center gap-2 rounded-xl font-medium tracking-[0.01em] transition duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[#f5f8fa] dark:focus-visible:ring-offset-[#070b14]',
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
