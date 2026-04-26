import { useState } from 'react'

function joinClassNames(...parts) {
  return parts.filter(Boolean).join(' ')
}

export default function PasswordField({
  id,
  label,
  value,
  onChange,
  placeholder = 'Enter password',
  autoComplete,
  required = false,
  disabled = false,
  error = '',
  hint = '',
  className = '',
}) {
  const [visible, setVisible] = useState(false)
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined

  return (
    <div className={joinClassNames('space-y-1.5', className)}>
      <label className="text-sm font-medium text-slate-300" htmlFor={id}>
        {label}
      </label>
      <div className="flex gap-2">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete={autoComplete}
          required={required}
          disabled={disabled}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          className={joinClassNames(
            'h-11 w-full rounded-xl border bg-slate-950/70 px-3 text-sm text-slate-100 transition duration-200',
            'placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950',
            error
              ? 'border-rose-400/60 focus-visible:ring-rose-300'
              : 'border-white/15 focus-visible:ring-cyan-300',
            disabled && 'cursor-not-allowed opacity-70',
          )}
        />
        <button
          type="button"
          onClick={() => setVisible((state) => !state)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          className="h-11 rounded-xl border border-white/15 bg-slate-900 px-3 text-sm text-slate-200 transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
        >
          {visible ? 'Hide' : 'Show'}
        </button>
      </div>
      {error && <p id={`${id}-error`} className="text-xs text-rose-300">{error}</p>}
      {!error && hint && <p id={`${id}-hint`} className="text-xs text-slate-400">{hint}</p>}
    </div>
  )
}
