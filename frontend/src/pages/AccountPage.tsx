import { useState } from "react";
import type { FormEvent } from "react";
import { useAuth } from "../auth/useAuth";
import Icon from "../components/Icon";
import { Chip, ErrorLine, Field, Header, Pill, Sheet, Toggle } from "../components/ui";
import { ApiError, api } from "../lib/api";
import { WEEKDAY_LONG, WEEKDAY_SHORT } from "../lib/format";

export default function AccountPage() {
  const { user, updateProfile, logout, deleteAccount } = useAuth();
  const [pw, setPw] = useState(false);
  const [del, setDel] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  if (!user) return null;

  async function patch(p: Parameters<typeof updateProfile>[0]) {
    setError(null);
    try {
      await updateProfile(p);
    } catch {
      setError("Could not save. Try again.");
    }
  }

  async function changePassword(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/auth/change-password", {
        method: "POST",
        body: { current_password: current, new_password: next },
      });
      setPw(false);
      setCurrent("");
      setNext("");
      setMsg("Password changed.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function exportData() {
    setError(null);
    try {
      const csv = await api<string>("/auth/export", { text: true });
      const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = "studyquest.csv";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      setMsg("Export saved.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    }
  }

  async function removeAccount(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await deleteAccount(password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
      setBusy(false);
    }
  }

  return (
    <main className="screen noNav">
      <Header title="Account" back="/settings" />
      <div className="card2 list">
        <div className="row2">
          <div className="rt"><b>Hide my detailed stats</b><span className="mono muted">Rooms see totals only</span></div>
          <Toggle on={user.hide_details} label="Hide my detailed stats" onChange={(v) => patch({ hide_details: v })} />
        </div>
        <div className="row2">
          <div className="rt">
            <b>Rest day</b>
            <span className="mono muted">
              {user.rest_day === null ? "Never counts as missed when on" : `${WEEKDAY_LONG[user.rest_day]} doesn't break your week`}
            </span>
          </div>
          <Toggle
            on={user.rest_day !== null}
            label="Rest day"
            onChange={(v) => patch({ rest_day: v ? 6 : null })}
          />
        </div>
        {user.rest_day !== null && (
          <div className="chs" style={{ padding: "4px 10px 16px" }}>
            {WEEKDAY_SHORT.map((d, i) => (
              <Chip key={d} on={user.rest_day === i} onClick={() => patch({ rest_day: i })}>{d}</Chip>
            ))}
          </div>
        )}
      </div>
      <button className="card2 link" onClick={() => { setError(null); setPw(true); }}>
        <span>Change password</span><Icon name="chev" size={18} />
      </button>
      <button className="card2 link" onClick={exportData}>
        <span>Export my data (CSV)</span><Icon name="chev" size={18} />
      </button>
      <ErrorLine text={error} />
      {msg && <p className="okline">{msg}</p>}
      <div className="gap" />
      <Pill kind="ghost" icon="out" onClick={logout}>Log out</Pill>
      <div className="danger">
        <div className="mono">Danger zone</div>
        <span className="muted2">Permanently deletes your profile and history. Rooms you own pass to the next member.</span>
        <Pill kind="danger" icon="trash" onClick={() => { setError(null); setDel(true); }}>Delete account</Pill>
      </div>

      <Sheet open={pw} onClose={() => setPw(false)}>
        <form onSubmit={changePassword}>
          <h2 className="dot">Change password</h2>
          <Field label="Current password" type="password" autoComplete="current-password" required value={current} onChange={(e) => setCurrent(e.target.value)} />
          <Field label="New password" type="password" autoComplete="new-password" required minLength={8} maxLength={128} value={next} onChange={(e) => setNext(e.target.value)} />
          <ErrorLine text={error} />
          <div style={{ height: 28 }} />
          <Pill type="submit" disabled={busy}>Save</Pill>
        </form>
      </Sheet>
      <Sheet open={del} onClose={() => setDel(false)}>
        <form onSubmit={removeAccount}>
          <h2 className="dot">Delete account</h2>
          <p className="muted2">This cannot be undone. Enter your password to confirm.</p>
          <Field label="Password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          <ErrorLine text={error} />
          <div style={{ height: 28 }} />
          <Pill kind="danger" type="submit" disabled={busy}>Delete forever</Pill>
        </form>
      </Sheet>
    </main>
  );
}
