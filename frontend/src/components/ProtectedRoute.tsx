import { useEffect } from "react";
import { Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import { SessionProvider } from "../session/SessionProvider";
import KeepAwake from "./KeepAwake";

const SKIP_KEY = "sq_figure_skipped";

function FigurePrompt() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  useEffect(() => {
    if (!user || user.avatar_key !== null) return;
    let skipped = false;
    try {
      skipped = sessionStorage.getItem(SKIP_KEY) === "1";
    } catch {
      /* ignore */
    }
    if (!skipped && pathname !== "/settings/figure" && pathname !== "/dock") {
      navigate("/settings/figure?first=1", { replace: true });
    }
  }, [user, pathname, navigate]);
  return null;
}

export function skipFigurePrompt() {
  try {
    sessionStorage.setItem(SKIP_KEY, "1");
  } catch {
    /* ignore */
  }
}

export default function ProtectedRoute() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <main className="screen" style={{ color: "var(--muted)" }}>
        <p className="mono">Loading…</p>
      </main>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return (
    <SessionProvider>
      <KeepAwake />
      <FigurePrompt />
      <Outlet />
    </SessionProvider>
  );
}
