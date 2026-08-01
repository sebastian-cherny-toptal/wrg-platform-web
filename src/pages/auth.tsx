import { useMutation } from '@tanstack/react-query'
import { Loader2, X } from 'lucide-react'
import {
  forwardRef,
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type FormEvent,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { ApiError, api } from '../api/client'
import type { LoginResult } from '../api/schemas'
import { routeMap } from '../app/metadata'
import { cn } from '../components/ui'
import { TwoColumnGuestLayout } from '../layouts/two-column-guest'
import { useAppStore } from '../store/app-store'

const emailSchema = z.email()

type AuthError = { title: string; message: string } | null

function mutationToAuthError(error: Error | null): AuthError {
  if (!error) return null
  if (error instanceof ApiError) {
    if (error.status === 403 || error.status === 400 || error.status === 404) {
      return { title: 'Invalid Credentials', message: error.message }
    }
    return { title: 'Unknown Error', message: error.message }
  }
  return {
    title: 'Unknown Error',
    message: 'An unknown error occured. Please refresh the page and try again.',
  }
}

function useLoginSuccess() {
  const setSession = useAppStore((state) => state.setSession)
  const navigate = useNavigate()
  return async (result: LoginResult) => {
    if (result.status === 'challenge_required') {
      await navigate(routeMap.twoFactor, { state: { challengeId: result.challengeId } })
      return
    }
    setSession(result.session)
    await navigate(result.session.user.role === 'admin' ? routeMap.adminProjects : routeMap.dashboard)
  }
}

function GuestShell({ children }: { children: ReactNode }) {
  return (
    <TwoColumnGuestLayout>
      <div className="h-[90vh] w-full">{children}</div>
    </TwoColumnGuestLayout>
  )
}

function ErrorAlert({ error }: { error: AuthError }) {
  if (!error) return null
  return (
    <div className="mb-10">
      <div className="rounded-lg border border-[#C52828] bg-white p-4" role="alert">
        <h5 className="mb-1 font-medium leading-none tracking-tight text-[#C52828]">{error.title}</h5>
        <div className="text-sm text-[#C52828]">{error.message}</div>
      </div>
    </div>
  )
}

function GrayField({
  id,
  label,
  error,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label?: string; error?: boolean }) {
  return (
    <div className="mb-1">
      {label ? (
        <label htmlFor={id} className="mb-[10px] block text-base text-white">
          {label}
        </label>
      ) : null}
      <input
        id={id}
        className={cn(
          'w-full rounded-[6px] border bg-white px-4 py-[11px] text-base outline-none placeholder:font-normal placeholder:text-[#71717B]',
          error ? 'border-[#C52828] text-[#C52828]' : 'border-[#E5E5E5] text-black',
          className,
        )}
        {...props}
      />
    </div>
  )
}

const PrimaryButton = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean }
>(function PrimaryButton({ loading, className, children, disabled, ...props }, ref) {
  return (
    <button
      ref={ref}
      className={cn(
        'inline-flex h-12 w-full items-center justify-center rounded-md bg-[#7C3AED] px-8 text-base font-medium text-white transition hover:opacity-90 disabled:pointer-events-none disabled:opacity-50',
        className,
      )}
      disabled={[disabled, loading].some(Boolean)}
      {...props}
    >
      {loading ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
      {children}
    </button>
  )
})

function SecondaryButton({ className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(
        'inline-flex h-10 flex-1 items-center justify-center rounded-md bg-[#F4F4F5] px-4 text-sm font-medium text-[#1e293b] transition hover:opacity-80 disabled:opacity-50',
        className,
      )}
      {...props}
    />
  )
}

function ModalShell({
  open,
  onClose,
  children,
  panelClassName,
}: {
  open: boolean
  onClose: () => void
  children: ReactNode
  panelClassName?: string
}) {
  const titleId = useId()
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="presentation" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn('relative w-[90%] max-w-[580px] rounded-xl bg-white p-6 shadow-2xl outline-none md:p-8', panelClassName)}
        onClick={(event) => event.stopPropagation()}
        data-title-id={titleId}
      >
        <button
          type="button"
          aria-label="Close"
          className="absolute right-4 top-4 rounded p-1 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
          onClick={onClose}
        >
          <X className="size-4" />
        </button>
        {children}
      </div>
    </div>
  )
}

function ForgotUsernameModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <ModalShell open={open} onClose={onClose} panelClassName="max-w-md">
      <h1 className="mb-1 pr-8 text-left font-sans text-lg font-semibold">Forgot Your Username?</h1>
      <p className="mt-2 text-sm font-normal text-gray-700">
        Please check your email for messages with subject lines starting with &quot;Your Reports are Ready!&quot; from{' '}
        <a href="mailto:surveys@workforcerg.com" className="text-[#7C3AED] no-underline">
          surveys@workforcerg.com
        </a>
        .
      </p>
      <p className="mt-2 text-sm text-gray-700">
        Look for the username needed to log in, which can be found in the red text, point number 2 within the email body,
        below the Feedback Data Dashboard link.
      </p>
      <p className="mt-2 text-sm text-gray-700">
        If you are unable to find the username, contact{' '}
        <a href="mailto:support@workforcerg.com" className="inline-block text-sm text-[#7C3AED]">
          support@workforcerg.com
        </a>{' '}
        for help.
      </p>
      <p className="mt-2 text-sm text-gray-700">Thank you!</p>
      <p className="mt-2 text-sm text-gray-700">Workforce Research Group</p>
      <div className="mt-6 flex justify-end">
        <SecondaryButton className="w-full flex-none" onClick={onClose}>
          Close
        </SecondaryButton>
      </div>
    </ModalShell>
  )
}

function OrganizationModal({
  open,
  onClose,
  onConfirm,
}: {
  open: boolean
  onClose: () => void
  onConfirm: () => void
}) {
  return (
    <ModalShell open={open} onClose={onClose}>
      <h2 className="mb-4 pr-8 text-left text-lg font-semibold text-black md:text-xl">
        Are you an employee or representative of this organization?
      </h2>
      <p className="mb-6 text-sm leading-relaxed text-gray-700 md:text-base">
        We care about your organization&apos;s security. Sharing credentials puts your organization&apos;s data at risk.
        WRG strongly recommends that you don&apos;t share credentials with anyone outside your organization.
      </p>
      <div className="flex flex-row justify-center gap-3 md:gap-4">
        <SecondaryButton onClick={() => {
          window.location.href = 'https://workforcerg.com/'
        }}>
          No
        </SecondaryButton>
        <PrimaryButton className="h-10 flex-1 px-4 text-sm" onClick={onConfirm}>
          Yes
        </PrimaryButton>
      </div>
    </ModalShell>
  )
}

function EmailModal({
  open,
  onClose,
  submitting,
  onSubmit,
}: {
  open: boolean
  onClose: () => void
  submitting: boolean
  onSubmit: (email: string) => void
}) {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (email.trim().length === 0) return
    if (!emailSchema.safeParse(email).success) {
      setError('Please double check your email address and enter a valid email')
      return
    }
    setError('')
    onSubmit(email.trim())
  }

  return (
    <ModalShell open={open} onClose={onClose} panelClassName="max-w-[500px] border-2 border-black p-4 md:p-6">
      <form onSubmit={submit}>
        <h6 className="relative pr-8 text-left text-base font-semibold md:text-lg">Enter your email</h6>
        <div className="mb-1">
          <label htmlFor="client-login-email" className="mt-4 block text-sm">
            Email
          </label>
          <input
            id="client-login-email"
            name="email"
            type="email"
            placeholder="Email"
            autoComplete="off"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="my-2 w-full rounded-[6px] border border-[#E5E5E5] bg-white px-4 py-[11px] text-base text-black outline-none"
          />
        </div>
        {error ? <p className="mb-4 text-left text-xs text-red-500 md:text-sm">{error}</p> : null}
        <div className="mt-2 flex flex-row gap-2">
          <SecondaryButton type="button" onClick={onClose}>
            Cancel
          </SecondaryButton>
          <PrimaryButton type="submit" className="h-10 flex-1 px-4 text-sm" loading={submitting}>
            {submitting ? 'Authenticating' : 'Continue Log In'}
          </PrimaryButton>
        </div>
      </form>
    </ModalShell>
  )
}

export function ClientLoginPage() {
  const session = useAppStore((state) => state.session)
  const onSuccess = useLoginSuccess()
  const [username, setUsername] = useState('')
  const [usernameError, setUsernameError] = useState(false)
  const [error, setError] = useState<AuthError>(null)
  const [forgotOpen, setForgotOpen] = useState(false)
  const [orgOpen, setOrgOpen] = useState(false)
  const [emailOpen, setEmailOpen] = useState(false)
  const login = useMutation({
    mutationFn: api.auth.clientLogin,
    onSuccess,
    onError: (err: Error) => {
      setEmailOpen(false)
      setUsernameError(true)
      setError(mutationToAuthError(err))
    },
  })

  if (session) {
    return <Navigate replace to={session.user.role === 'admin' ? routeMap.adminProjects : routeMap.dashboard} />
  }

  const openOrgStep = () => {
    if (username.trim().length === 0) return
    setError(null)
    setUsernameError(false)
    setOrgOpen(true)
  }

  return (
    <GuestShell>
      <div className="flex h-full flex-col px-4 md:px-0">
        <ErrorAlert error={error} />
        <div className="flex flex-1 flex-col justify-center">
          <div className="w-full max-w-md self-center">
            <h2 className="mb-[30px] text-[30px] font-medium text-white">Log In</h2>
            <GrayField
              id="client-username"
              label="Username"
              name="username"
              placeholder="Enter your Username"
              autoComplete="off"
              value={username}
              error={usernameError}
              onChange={(event) => setUsername(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  openOrgStep()
                }
              }}
            />
            <div className="mb-5 flex justify-end">
              <button
                type="button"
                className="h-auto p-0 text-sm text-[#A78BFA] underline hover:bg-transparent"
                onClick={() => setForgotOpen(true)}
              >
                Forgot Username?
              </button>
            </div>
            <div className="mb-5">
              <PrimaryButton
                type="button"
                loading={login.isPending}
                disabled={username.trim() === '' || (
                  import.meta.env.TEST_USERNAME_ENABLED === 'true' && username.trim().toLowerCase() != import.meta.env.TEST_USERNAME
                )}
                onClick={openOrgStep}
              >
                {login.isPending ? 'Authenticating' : 'Log In'}
              </PrimaryButton>
            </div>
          </div>
        </div>
        <div className="mb-10 mt-8 px-0">
          <div className="rounded-xl border-transparent bg-[#262626] p-4">
            <h5 className="mb-1 font-semibold text-white">Sharing credentials</h5>
            <p className="text-sm text-gray-300">
              We care about your organization&apos;s security. Sharing credentials puts your organization&apos;s data at
              risk. WRG strongly recommends that you don&apos;t share credentials with anyone outside your organization.
            </p>
          </div>
        </div>
      </div>
      <ForgotUsernameModal open={forgotOpen} onClose={() => setForgotOpen(false)} />
      <OrganizationModal
        open={orgOpen}
        onClose={() => setOrgOpen(false)}
        onConfirm={() => {
          setOrgOpen(false)
          setEmailOpen(true)
        }}
      />
      {emailOpen ? (
        <EmailModal
          open={emailOpen}
          onClose={() => setEmailOpen(false)}
          submitting={login.isPending}
          onSubmit={(email) => {
            setError(null)
            login.mutate({ username: username.trim(), email })
          }}
        />
      ) : null}
    </GuestShell>
  )
}

export function AdminLoginPage() {
  const session = useAppStore((state) => state.session)
  const onSuccess = useLoginSuccess()
  const formRef = useRef<HTMLButtonElement>(null)
  const [fields, setFields] = useState({ email: '', password: '' })
  const [fieldErrors, setFieldErrors] = useState({ email: false, password: false })
  const [error, setError] = useState<AuthError>(null)
  const login = useMutation({
    mutationFn: api.auth.adminLogin,
    onSuccess,
    onError: (err: Error) => {
      setFieldErrors({ email: true, password: true })
      setError(
        err instanceof ApiError && (err.status === 403 || err.status === 400 || err.status === 404)
          ? { title: 'Invalid Credentials', message: 'Username or Password Incorrect' }
          : mutationToAuthError(err),
      )
    },
  })

  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.key === 'Enter') {
        event.preventDefault()
        formRef.current?.click()
      }
    }
    document.addEventListener('keypress', handleKeyPress)
    return () => document.removeEventListener('keypress', handleKeyPress)
  }, [])

  if (session) {
    return <Navigate replace to={session.user.role === 'admin' ? routeMap.adminProjects : routeMap.dashboard} />
  }

  const submit = (event?: FormEvent) => {
    event?.preventDefault()
    const nextErrors = {
      email: fields.email.trim().length === 0,
      password: fields.password.trim().length === 0,
    }
    setFieldErrors(nextErrors)
    if (nextErrors.email || nextErrors.password) return
    setError(null)
    login.mutate({ email: fields.email.trim(), password: fields.password.trim() })
  }

  return (
    <GuestShell>
      <div className="flex h-full flex-col px-4 md:px-0">
        <ErrorAlert error={error} />
        <div className="flex flex-1 flex-col justify-center">
          <div className="w-full max-w-md self-center">
            <h2 className="mb-[30px] text-[30px] font-semibold text-white">Sign in</h2>
            <form
              onSubmit={(event) => {
                event.preventDefault()
                submit(event)
              }}
            >
              <GrayField
                id="admin-email"
                label="Email"
                name="email"
                placeholder="Enter your Email"
                autoComplete="off"
                value={fields.email}
                error={fieldErrors.email}
                onChange={(event) => setFields((prev) => ({ ...prev, email: event.target.value }))}
              />
              <div className="mt-3">
                <GrayField
                  id="admin-password"
                  label="Password"
                  name="password"
                  type="password"
                  placeholder="Enter your Password"
                  autoComplete="off"
                  value={fields.password}
                  error={fieldErrors.password}
                  onChange={(event) => setFields((prev) => ({ ...prev, password: event.target.value }))}
                />
              </div>
              <div className="mb-5 flex justify-end">
                <Link to={routeMap.recovery} className="h-auto p-0 text-sm text-[#A78BFA] underline">
                  Forgot your password?
                </Link>
              </div>
              <div className="mb-5">
                <PrimaryButton ref={formRef} type="submit" loading={login.isPending} onClick={() => submit()}>
                  {login.isPending ? 'Authenticating' : 'Log In'}
                </PrimaryButton>
              </div>
            </form>
          </div>
        </div>
      </div>
    </GuestShell>
  )
}

export function TwoFactorPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const setSession = useAppStore((state) => state.setSession)
  const state = z.object({ challengeId: z.string() }).safeParse(location.state)
  const [code, setCode] = useState('')
  const [error, setError] = useState<AuthError>(null)
  const inputsRef = useRef<(HTMLInputElement | null)[]>([])
  const verify = useMutation({
    mutationFn: api.auth.verifyChallenge,
    onSuccess: async (session) => {
      setSession(session)
      await navigate(session.user.role === 'admin' ? routeMap.adminProjects : routeMap.dashboard)
    },
    onError: (err: Error) => {
      setError(
        err instanceof ApiError && (err.status === 403 || err.status === 400)
          ? { title: 'Invalid Credentials', message: 'You have provided invalid credentials. Please try again.' }
          : mutationToAuthError(err),
      )
    },
  })

  useEffect(() => {
    if (code.length === 6 && state.success && !verify.isPending) {
      verify.mutate({ challengeId: state.data.challengeId, code })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- auto-submit when 6 digits entered
  }, [code])

  if (!state.success) return <Navigate replace to={routeMap.adminLogin} />

  const digits = Array.from({ length: 6 }, (_, index) => code[index] ?? '')

  return (
    <GuestShell>
      <div className="flex h-full flex-col justify-center px-4 md:px-0">
        <div className="w-full max-w-md self-center">
          <h2 className="mb-2 text-[30px] font-semibold text-white">Enter Code</h2>
          <p className="mb-5 text-white">Enter the code sent to the specified phone number</p>
          <form
            onSubmit={(event) => {
              event.preventDefault()
              if (code.length === 6) verify.mutate({ challengeId: state.data.challengeId, code })
            }}
          >
            <div className="flex gap-2">
              {digits.map((digit, index) => (
                <input
                  key={index}
                  ref={(node) => {
                    inputsRef.current[index] = node
                  }}
                  inputMode="numeric"
                  autoComplete={index === 0 ? 'one-time-code' : 'off'}
                  aria-label={`Digit ${index + 1}`}
                  value={digit}
                  className="h-[35px] w-[35px] border border-transparent bg-white text-center text-xs font-normal text-black caret-blue-600 outline-none focus:border-[#CFD3DB]"
                  onChange={(event) => {
                    const next = event.target.value.replaceAll(/\D/g, '').slice(-1)
                    const chars = digits.map((value, i) => (i === index ? next : value))
                    const joined = chars.join('').slice(0, 6)
                    setCode(joined)
                    setError(null)
                    if (next && index < 5) inputsRef.current[index + 1]?.focus()
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Backspace' && !digits[index] && index > 0) {
                      inputsRef.current[index - 1]?.focus()
                    }
                  }}
                />
              ))}
            </div>
            {error ? <p className="my-4 text-[#F3403C]">{error.title}</p> : null}
          </form>
        </div>
      </div>
    </GuestShell>
  )
}

export function RecoveryPage() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [usernameError, setUsernameError] = useState(false)
  const [error, setError] = useState<AuthError>(null)
  const recovery = useMutation({
    mutationFn: api.auth.requestRecovery,
    onError: (err: Error) => setError(mutationToAuthError(err)),
  })

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!username.trim()) {
      setUsernameError(true)
      return
    }
    setUsernameError(false)
    setError(null)
    recovery.mutate({ email: username.trim() })
  }

  return (
    <GuestShell>
      <div className="flex h-full flex-col px-4 md:px-0">
        <ErrorAlert error={error} />
        <div className="flex flex-1 flex-col justify-center">
          <div className="w-full max-w-md self-center">
            <h2 className="mb-[30px] text-[30px] font-semibold text-white">Forgot Password</h2>
            {recovery.isSuccess ? (
              <div className="grid gap-4">
                <p className="text-sm text-gray-300">
                  If an account exists for that address, recovery instructions have been sent.
                </p>
                <Link className="text-sm text-[#A78BFA] underline" to={routeMap.adminLogin}>
                  Return to login
                </Link>
              </div>
            ) : (
              <form onSubmit={submit}>
                <GrayField
                  id="recovery-username"
                  label="Email"
                  name="email"
                  placeholder="Enter your Email"
                  autoComplete="off"
                  value={username}
                  error={usernameError}
                  onChange={(event) => setUsername(event.target.value)}
                />
                <div className="mb-5 mt-5">
                  <PrimaryButton type="submit" loading={recovery.isPending}>
                    {recovery.isPending ? 'Submitting' : 'Continue'}
                  </PrimaryButton>
                </div>
                <button
                  type="button"
                  className="text-sm text-[#A78BFA] underline"
                  onClick={() => void navigate(routeMap.adminLogin)}
                >
                  Back to Sign in
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </GuestShell>
  )
}
