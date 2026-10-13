import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth/useAuth";
import ProtectedRoute from "./components/ProtectedRoute";
import LoginPage from "./pages/LoginPage";
import RoomsPage from "./pages/RoomsPage";
import RoomDetailPage from "./pages/RoomDetailPage";

function Placeholder({ name }: { name: string }) {
  const { user, logout } = useAuth();
  return (
    <main className="screen">
      <h1 className="title" style={{ fontSize: 32 }}>
        {name}
      </h1>
      <p style={{ color: "var(--text-soft)" }}>
        Signed in as {user?.username}. This screen is coming soon.
      </p>
      <button
        onClick={logout}
        style={{
          height: 44,
          padding: "0 18px",
          border: 0,
          borderRadius: 12,
          background: "var(--surface-raised)",
          color: "var(--text)",
          fontWeight: 700,
        }}
      >
        Log out
      </button>
    </main>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/rooms" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/rooms" element={<RoomsPage />} />
        <Route path="/rooms/:roomId" element={<RoomDetailPage />} />
        <Route
          path="/rooms/:roomId/dock"
          element={<Placeholder name="Dock" />}
        />
      </Route>
      <Route path="*" element={<Navigate to="/rooms" replace />} />
    </Routes>
  );
}