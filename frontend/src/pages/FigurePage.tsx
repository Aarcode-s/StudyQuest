import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import Figure, { FIGURE_KEYS } from "../components/Figure";
import Icon from "../components/Icon";
import { skipFigurePrompt } from "../components/ProtectedRoute";
import { ErrorLine, Header, Pill } from "../components/ui";

export default function FigurePage() {
  const { user, updateProfile } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const first = params.get("first") === "1";
  const [pick, setPick] = useState<string>(user?.avatar_key ?? "stand");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await updateProfile({ avatar_key: pick });
      navigate(first ? "/" : "/settings", { replace: true });
    } catch {
      setError("Could not save. Try again.");
      setBusy(false);
    }
  }

  return (
    <main className="screen noNav">
      <Header title="Your figure" back={first ? undefined : "/settings"} />
      <div className="mono muted sec" style={{ marginTop: 0 }}>Shown in rooms and on the race</div>
      <div className="fgrid">
        {FIGURE_KEYS.map((k) => (
          <button key={k} className={`fc ${pick === k ? "on" : ""}`} onClick={() => setPick(k)} aria-label={k} aria-pressed={pick === k}>
            <Figure name={k} size={62} color={pick === k ? "var(--red)" : "var(--text)"} />
            {pick === k && <i className="ck"><Icon name="check" size={14} stroke={3} /></i>}
          </button>
        ))}
      </div>
      <ErrorLine text={error} />
      <div className="gap" />
      <Pill onClick={save} disabled={busy}>Save</Pill>
      {first && (
        <button
          className="mono muted c"
          style={{ marginTop: 18 }}
          onClick={() => {
            skipFigurePrompt();
            navigate("/", { replace: true });
          }}
        >
          Skip for now
        </button>
      )}
    </main>
  );
}
