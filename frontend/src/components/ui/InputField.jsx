function joinClassNames(...parts) {
  return parts.filter(Boolean).join(' ')
}

export default function InputField({
  id,
  label,
  type = 'text',
  value,
  onChange,
  placeholder = '',
  autoComplete,
  required = false,
  disabled = false,
  error = '',
  hint = '',
  inputMode,
  maxLength,
  className = '',
  ...rest
}) {
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined

  return (
    <div className={joinClassNames('space-y-1.5', className)}>
      {label && (
        <label className="text-sm font-medium text-slate-200" htmlFor={id}>
          {label}
        </label>
      )}
      <input
        id={id}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required={required}
        disabled={disabled}
        inputMode={inputMode}
        maxLength={maxLength}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy}
        className={joinClassNames(
          'h-10 w-full rounded-xl border bg-slate-950/65 px-3 text-sm text-slate-100 transition duration-150',
          'placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-950',
          error
            ? 'border-rose-400/65 focus-visible:ring-rose-400 focus-visible:border-rose-400'
            : 'border-slate-700/85 focus-visible:ring-cyan-300 focus-visible:border-cyan-300',
          disabled && 'cursor-not-allowed opacity-60',
        )}
        {...rest}
      />
      {error && <p id={`${id}-error`} className="text-xs text-rose-300">{error}</p>}
      {!error && hint && <p id={`${id}-hint`} className="text-xs text-slate-400">{hint}</p>}
    </div>
  )
}
