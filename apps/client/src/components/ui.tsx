import { LoaderCircle, type LucideIcon } from 'lucide-react'
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { twMerge } from 'tailwind-merge'
import clsx, { type ClassValue } from 'clsx'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function Button({
  className,
  variant = 'primary',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' }) {
  return (
    <button
      className={cn(
        'inline-flex h-10 items-center justify-center rounded-lg px-4 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
        variant === 'primary' && 'bg-violet-600 text-white hover:bg-violet-700 focus-visible:outline-violet-600',
        variant === 'secondary' && 'border border-zinc-300 bg-white text-zinc-900 hover:bg-zinc-50',
        variant === 'ghost' && 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950',
        className,
      )}
      {...props}
    />
  )
}

export function Input({
  label,
  error,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string | undefined }) {
  const id = props.id ?? props.name ?? label.toLowerCase().replaceAll(/\s+/g, '-')
  return (
    <label className="grid gap-1.5 text-sm font-medium text-zinc-800" htmlFor={id}>
      {label}
      <input
        id={id}
        className={cn(
          'h-11 rounded-lg border border-zinc-300 bg-white px-3 text-zinc-950 outline-none placeholder:text-zinc-400 focus:border-violet-500 focus:ring-3 focus:ring-violet-100',
          error && 'border-red-500 focus:border-red-500 focus:ring-red-100',
          className,
        )}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        {...props}
      />
      {error ? (
        <span id={`${id}-error`} className="text-xs text-red-600">
          {error}
        </span>
      ) : null}
    </label>
  )
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={cn('rounded-2xl border border-zinc-200 bg-white shadow-sm', className)}>{children}</section>
}

export function Badge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode
  tone?: 'neutral' | 'success' | 'warning' | 'danger'
}) {
  return (
    <span
      className={cn(
        'inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize',
        tone === 'neutral' && 'bg-zinc-100 text-zinc-700',
        tone === 'success' && 'bg-emerald-100 text-emerald-800',
        tone === 'warning' && 'bg-amber-100 text-amber-800',
        tone === 'danger' && 'bg-red-100 text-red-800',
      )}
    >
      {children}
    </span>
  )
}

export function PageHeader({
  title,
  description,
  actions,
  breadcrumbs,
}: {
  title: string
  description?: string
  actions?: ReactNode
  breadcrumbs?: { label: string; path?: string }[]
}) {
  return (
    <header className="flex flex-col gap-4 border-b border-zinc-200 bg-white px-5 py-6 sm:flex-row sm:items-center sm:justify-between lg:px-6">
      <div>
        {breadcrumbs?.length ? (
          <nav className="mb-2 flex flex-wrap items-center gap-1.5 text-xs text-zinc-500" aria-label="Breadcrumb">
            {breadcrumbs.map((breadcrumb, index) => (
              <span className="inline-flex items-center gap-1.5" key={`${breadcrumb.label}-${index}`}>
                {index ? <span aria-hidden="true">/</span> : null}
                {breadcrumb.path ? (
                  <Link className="hover:text-violet-600" to={breadcrumb.path}>{breadcrumb.label}</Link>
                ) : (
                  <span>{breadcrumb.label}</span>
                )}
              </span>
            ))}
          </nav>
        ) : null}
        <h1 className="text-[28px] font-bold leading-tight tracking-tight text-zinc-950">{title}</h1>
        {description ? <p className="mt-1 max-w-3xl text-sm leading-5 text-zinc-500">{description}</p> : null}
      </div>
      {actions}
    </header>
  )
}

export function StatePanel({
  kind,
  title,
  message,
  action,
  icon: Icon,
}: {
  kind: 'loading' | 'error' | 'empty'
  title: string
  message: string
  action?: ReactNode
  icon?: LucideIcon
}) {
  return (
    <div
      className={cn(
        'grid min-h-52 place-items-center rounded-2xl border px-6 py-10 text-center',
        kind === 'error' ? 'border-red-200 bg-red-50' : 'border-zinc-200 bg-white',
      )}
      role={kind === 'error' ? 'alert' : 'status'}
    >
      <div className="grid max-w-md justify-items-center gap-3">
        {kind === 'loading' ? <LoaderCircle className="animate-spin text-violet-600" /> : Icon ? <Icon /> : null}
        <h2 className="font-semibold text-zinc-950">{title}</h2>
        <p className="text-sm text-zinc-600">{message}</p>
        {action}
      </div>
    </div>
  )
}
