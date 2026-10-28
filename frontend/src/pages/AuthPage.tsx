import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import Icon from "../components/Icon";
import Logo from "../components/Logo";
import { ErrorLine, Field, Pill, Segmented } from "../components/ui";
import { ApiError } from "../lib/api";

export default function AuthPage() {
  const { user, loading, notice, login, register } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [slow, setSlow] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The free server sleeps when idle: say so if the request takes a while.
  useEffect(() => {
    if (!busy) {
      setSlow(false);
      return;
    }
    const id = setTimeout(() => setSlow(true), 4000);
    return () => clearTimeout(id);
  }, [busy]);

  if (loading) return null;
  if (user) return <Navigate to="/" replace />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === "login") await login(email.trim(), password);
      else await register(email.trim(), username.trim(), password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="auth" onSubmit={submit}>
      <div className="hero">
        <Logo size={92} fg="var(--text)" />
        <div className="dot wm">studyquest</div>
        <div className="mono muted">Focus together</div>
      </div>
      <Segmented
        items={[
          { value: "login", label: "Log in" },
          { value: "register", label: "Create account" },
        ]}
        value={mode}
        onChange={(m) => {
          setMode(m);
          setError(null);
        }}
      />
      {notice && <p className="okline">{notice}</p>}
      {slow && (
        <div className="notice mono">
          <span className="spin"><i /><i /><i /></span>
          Waking the server · about a minute
        </div>
      )}
      <Field
        label="Email"
        type="email"
        autoComplete="email"
        required
        placeholder="you@college.edu"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      {mode === "register" && (
        <Field
          label="Username"
          autoComplete="username"
          required
          minLength={3}
          maxLength={30}
          pattern="[A-Za-z0-9_]+"
          placeholder="letters, numbers, _"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
      )}
      <label className="fieldwrap">
        <span className="fl mono">Password</span>
        <div className="fieldrow">
          <input
            className="field"
            type={show ? "text" : "password"}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            required
            minLength={mode === "register" ? 8 : 1}
            maxLength={128}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button
            type="button"
            className="eye"
            aria-label={show ? "Hide password" : "Show password"}
            onClick={() => setShow((s) => !s)}
          >
            <Icon name="eye" size={20} />
          </button>
        </div>
      </label>
      <ErrorLine text={error} />
      <div className="gap" />
      <Pill type="submit" disabled={busy}>
        {busy ? "Please wait…" : mode === "login" ? "Log in" : "Create account"}
      </Pill>
    </form>
  );
}
