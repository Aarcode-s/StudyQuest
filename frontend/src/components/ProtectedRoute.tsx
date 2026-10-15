import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import { SessionProvider } from "../session/SessionProvider";
import KeepAwake from "./KeepAwake";

export default function ProtectedRoute() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <main className="screen" style={{ color: "var(--text-soft)" }}>
        Loading...
      </main>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return (
    <SessionProvider>
      <KeepAwake />
      <Outlet />
    </SessionProvider>
  );
}
