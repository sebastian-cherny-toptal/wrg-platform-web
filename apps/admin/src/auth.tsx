import { LoaderCircle } from "lucide-react";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { WorkforceLogoWhite } from "@wrg/platform-ui";
import decorationImage from "@wrg/platform-ui/two-column-layout-decoration.png";
import heroImage from "@wrg/platform-ui/two-column-layout-default-img.png";
import {
  adminAuthChangedEvent,
  api,
  ApiError,
  persistAuth,
  readAuth,
  type AdminAuth,
} from "./api";

type AuthContextValue = {
  auth: AdminAuth | null;
  setAuth: (auth: AdminAuth | null) => void;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const pendingLoginKey = "wrg-admin-pending-login";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuthState] = useState<AdminAuth | null>(() => readAuth());
  useEffect(() => {
    const syncAuth = () => setAuthState(readAuth());
    window.addEventListener(adminAuthChangedEvent, syncAuth);
    return () => window.removeEventListener(adminAuthChangedEvent, syncAuth);
  }, []);
  const setAuth = (next: AdminAuth | null) => {
    persistAuth(next);
    setAuthState(next);
  };
  const value = useMemo<AuthContextValue>(
    () => ({
      auth,
      setAuth,
      logout: async () => {
        await api.logout();
        setAuthState(null);
      },
    }),
    [auth],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("AuthProvider is missing");
  return context;
}

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { auth } = useAuth();
  return auth ? children : <Navigate replace to="/admin-login" />;
}

function GuestLayout({ children }: { children: ReactNode }) {
  return (
    <main className="guest-layout">
      <section className="guest-panel">
        <img
          aria-hidden="true"
          className="guest-decoration"
          src={decorationImage}
        />
        <div className="guest-logo">
          <WorkforceLogoWhite />
        </div>
        <div className="guest-form-wrap">{children}</div>
      </section>
      <section className="guest-hero">
        <img
          alt="Workforce Research Group feedback dashboard"
          src={heroImage}
        />
      </section>
    </main>
  );
}

function AuthAlert({
  message,
  title = "Sign-in failed",
}: {
  message: string;
  title?: string;
}) {
  return (
    <div className="auth-alert" role="alert">
      <strong>{title}</strong>
      <span>{message}</span>
    </div>
  );
}

export function LoginPage() {
  const { auth, setAuth } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [errorTitle, setErrorTitle] = useState("");
  const [loading, setLoading] = useState(false);

  if (auth) return <Navigate replace to="/admin/projects" />;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!email.trim() || !password) return;
    setLoading(true);
    setError("");
    setErrorTitle("");
    try {
      const started = await api.startLogin(email.trim(), password);
      if (started.requiresOtp) {
        window.sessionStorage.setItem(
          pendingLoginKey,
          JSON.stringify({ email: email.trim(), userId: started.userId }),
        );
        await navigate("/admin/2FA");
      } else {
        const completed = await api.completeLogin(email.trim(), started.userId);
        setAuth(completed);
        await navigate("/admin/projects");
      }
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) {
        setErrorTitle("Invalid credentials");
        setError("The email or password is incorrect.");
      } else if (caught instanceof ApiError && caught.status === 403) {
        setErrorTitle("Access denied");
        setError(caught.message);
      } else {
        setErrorTitle("Unable to sign in");
        setError(
          caught instanceof Error ? caught.message : "Please try again.",
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <GuestLayout>
      <div className="auth-card">
        {error ? <AuthAlert title={errorTitle} message={error} /> : null}
        <h1>Sign in</h1>
        <form onSubmit={submit}>
          <label htmlFor="admin-email">Email</label>
          <input
            id="admin-email"
            type="email"
            placeholder="Enter your Email"
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <label htmlFor="admin-password">Password</label>
          <input
            id="admin-password"
            type="password"
            placeholder="Enter your Password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <div className="forgot-row">
            <Link to="/forgot-password">Forgot your password?</Link>
          </div>
          <button
            className="primary-button login-button"
            disabled={loading || !email.trim() || !password}
            type="submit"
          >
            {loading ? (
              <>
                <LoaderCircle className="spin" size={18} /> Authenticating
              </>
            ) : (
              "Log In"
            )}
          </button>
        </form>
      </div>
    </GuestLayout>
  );
}

export function TwoFactorPage() {
  const navigate = useNavigate();
  const { setAuth } = useAuth();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const pending = (() => {
    try {
      return JSON.parse(
        window.sessionStorage.getItem(pendingLoginKey) ?? "null",
      ) as { email: string; userId: string } | null;
    } catch {
      return null;
    }
  })();

  useEffect(() => {
    if (code.length !== 6 || !pending || loading) return;
    setLoading(true);
    api
      .completeLogin(pending.email, pending.userId, code)
      .then(async (completed) => {
        window.sessionStorage.removeItem(pendingLoginKey);
        setAuth(completed);
        await navigate("/admin/projects", { replace: true });
      })
      .catch((caught: unknown) => {
        setError(
          caught instanceof Error
            ? caught.message
            : "Invalid verification code",
        );
        setCode("");
      })
      .finally(() => setLoading(false));
  }, [code, loading, navigate, pending, setAuth]);

  if (!pending) return <Navigate replace to="/admin-login" />;

  return (
    <GuestLayout>
      <div className="auth-card two-factor">
        <h1>Enter Code</h1>
        <p>Enter the code sent to the specified phone number</p>
        {error ? <AuthAlert message={error} /> : null}
        <div className="code-inputs">
          {Array.from({ length: 6 }, (_, index) => (
            <input
              key={index}
              aria-label={`Digit ${index + 1}`}
              inputMode="numeric"
              maxLength={1}
              value={code[index] ?? ""}
              onChange={(event) => {
                const digit = event.target.value.replace(/\D/g, "").slice(-1);
                const digits = Array.from({ length: 6 }, (_, position) =>
                  position === index ? digit : (code[position] ?? ""),
                );
                setCode(digits.join(""));
                if (digit)
                  (
                    event.currentTarget
                      .nextElementSibling as HTMLInputElement | null
                  )?.focus();
              }}
            />
          ))}
        </div>
        {loading ? (
          <p className="auth-progress">
            <LoaderCircle className="spin" size={18} /> Verifying
          </p>
        ) : null}
      </div>
    </GuestLayout>
  );
}

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [recoveryKey, setRecoveryKey] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [completed, setCompleted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const requestCode = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const key = await api.requestForgotPassword(email.trim());
      if (!key)
        throw new Error("The recovery request did not return a secure key");
      setRecoveryKey(key);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Recovery instructions could not be sent",
      );
    } finally {
      setLoading(false);
    }
  };
  const resetPassword = async (event: FormEvent) => {
    event.preventDefault();
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await api.completeForgotPassword(recoveryKey, otp, password);
      setCompleted(true);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Password could not be changed",
      );
    } finally {
      setLoading(false);
    }
  };
  return (
    <GuestLayout>
      <div className="auth-card">
        <h1>Forgot Password</h1>
        {completed ? (
          <div className="recovery-copy">
            <p>Your password has been changed.</p>
            <Link to="/admin-login">Back to Sign in</Link>
          </div>
        ) : recoveryKey ? (
          <form onSubmit={resetPassword}>
            {error ? (
              <AuthAlert title="Recovery unavailable" message={error} />
            ) : null}
            <p className="recovery-copy">
              Enter the six-digit code sent to your email.
            </p>
            <label htmlFor="recovery-otp">Verification Code</label>
            <input
              id="recovery-otp"
              inputMode="numeric"
              maxLength={6}
              placeholder="Enter your Code"
              value={otp}
              onChange={(event) =>
                setOtp(event.target.value.replace(/\D/g, ""))
              }
            />
            <label htmlFor="recovery-password">New Password</label>
            <input
              id="recovery-password"
              type="password"
              minLength={8}
              placeholder="Enter your Password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <label htmlFor="recovery-password-confirm">Confirm Password</label>
            <input
              id="recovery-password-confirm"
              type="password"
              minLength={8}
              placeholder="Confirm your Password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
            <button
              className="primary-button login-button"
              type="submit"
              disabled={
                loading ||
                otp.length !== 6 ||
                password.length < 8 ||
                confirmPassword.length < 8
              }
            >
              {loading ? "Updating…" : "Reset Password"}
            </button>
          </form>
        ) : (
          <form onSubmit={requestCode}>
            {error ? (
              <AuthAlert title="Recovery unavailable" message={error} />
            ) : null}
            <label htmlFor="recovery-email">Email</label>
            <input
              id="recovery-email"
              type="email"
              placeholder="Enter your Email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            <button
              className="primary-button login-button"
              type="submit"
              disabled={loading || !email.trim()}
            >
              {loading ? "Sending…" : "Continue"}
            </button>
            <div className="forgot-row">
              <Link to="/admin-login">Back to Sign in</Link>
            </div>
          </form>
        )}
      </div>
    </GuestLayout>
  );
}

export function ResetPasswordPage() {
  const token = new URLSearchParams(window.location.search).get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState(
    token ? "" : "The password reset link is missing or invalid.",
  );
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await api.completeAdminReset(token, password);
      setCompleted(true);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Password could not be changed",
      );
    } finally {
      setLoading(false);
    }
  };
  return (
    <GuestLayout>
      <div className="auth-card">
        <h1>Reset Password</h1>
        {completed ? (
          <div className="recovery-copy">
            <p>Your password has been changed.</p>
            <Link to="/admin-login">Back to Sign in</Link>
          </div>
        ) : (
          <form onSubmit={submit}>
            {error ? (
              <AuthAlert title="Reset unavailable" message={error} />
            ) : null}
            <label htmlFor="admin-reset-password">New Password</label>
            <input
              id="admin-reset-password"
              type="password"
              minLength={8}
              placeholder="Enter your Password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <label htmlFor="admin-reset-confirm">Confirm Password</label>
            <input
              id="admin-reset-confirm"
              type="password"
              minLength={8}
              placeholder="Confirm your Password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
            <button
              className="primary-button login-button"
              disabled={
                loading ||
                !token ||
                password.length < 8 ||
                confirmPassword.length < 8
              }
            >
              {loading ? "Updating…" : "Reset Password"}
            </button>
          </form>
        )}
      </div>
    </GuestLayout>
  );
}
