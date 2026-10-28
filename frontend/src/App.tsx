import { Navigate, Route, Routes } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import TabLayout from "./components/TabLayout";
import AccountPage from "./pages/AccountPage";
import AuthPage from "./pages/AuthPage";
import DashboardPage from "./pages/DashboardPage";
import DockPage from "./pages/DockPage";
import FigurePage from "./pages/FigurePage";
import FocusPage from "./pages/FocusPage";
import ReviewPage from "./pages/ReviewPage";
import RoomPage from "./pages/RoomPage";
import RoomsPage from "./pages/RoomsPage";
import SettingsPage from "./pages/SettingsPage";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<AuthPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<TabLayout />}>
          <Route path="/" element={<FocusPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/rooms" element={<RoomsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
        <Route path="/rooms/:roomId" element={<RoomPage />} />
        <Route path="/settings/account" element={<AccountPage />} />
        <Route path="/settings/figure" element={<FigurePage />} />
        <Route path="/review" element={<ReviewPage />} />
        <Route path="/dock" element={<DockPage />} />
        <Route path="/rooms/:roomId/dock" element={<Navigate to="/dock" replace />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
