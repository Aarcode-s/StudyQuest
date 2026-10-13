import { useState } from "react";
import type { FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import { ApiError } from "../lib/api";
import "./auth.css";

type Mode = "login" | "register";

export default function LoginPage() {
  const { user, login, register } = useAuth();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/rooms" replace />;

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "login") await login(email.trim(), password);
      else await register(email.trim(), username.trim(), password);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Something went wrong.",
      );
    } finally {
      setBusy(false);
    }
  }

  const isLogin = mode === "login";

  return (
    <main className="screen auth">
      <div className="auth__blob auth__blob--violet" />
      <div className="auth__blob auth__blob--cyan" />

      <header className="auth__brand">
        <div className="auth__logo">
          <svg
            width="34"
            height="34"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#0E0B1A"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="13" r="8" />
            <path d="M12 9v4l2.5 2" />
            <path d="M9 2h6" />
          </svg>
        </div>
        <h1 className="title auth__name">StudyQuest</h1>
        <p className="auth__tagline">
          Focus together. See who is in, and for how long.
        </p>
      </header>

      <div className="auth__tabs" role="tablist" aria-label="Account">
        <button
          type="button"
          role="tab"
          className="auth__tab"
          aria-selected={isLogin}
          onClick={() => switchMode("login")}
        >
          Log in
        </button>
        <button
          type="button"
          role="tab"
          className="auth__tab"
          aria-selected={!isLogin}
          onClick={() => switchMode("register")}
        >
          Register
        </button>
      </div>

      <form className="auth__form" onSubmit={onSubmit} noValidate>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        {!isLogin && (
          <div className="field">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              type="text"
              autoComplete="username"
              placeholder="3 to 30 letters, numbers or _"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>
        )}

        <div className="field">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            autoComplete={isLogin ? "current-password" : "new-password"}
            placeholder="At least 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        {error && (
          <div className="error-box" role="alert">
            {error}
          </div>
        )}

        <button className="btn-primary" type="submit" disabled={busy}>
          {busy ? "Please wait…" : isLogin ? "Log in" : "Create account"}
        </button>
      </form>

      <p className="auth__note">
        Focus time is recorded timer time. It shows when a timer ran, not what
        you were doing.
      </p>
    </main>
  );
}