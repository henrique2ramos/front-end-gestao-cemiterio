import { useState, useEffect } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import ScrollToTop from "./components/ScrollToTop"; 
import MainLayout from "./layout/MainLayout";
import HomePage from "../src/pages/HomePage";
import AllFalecidosPage from "../src/pages/AllFalecidosPage";
import FalecidoPage from "../src/pages/FalecidoPage";
import LotePage from "../src/pages/LotePage";
import QuadraPage from "../src/pages/QuadraPage";
import MapPage from "../src/pages/MapPage";
import AdminDashboard from "../src/pages/Adm/AdminDashboard";
import AdminFalecidos from "../src/pages/Adm/AdminFalecidos";
import AdminQuadrasLotes from "../src/pages/Adm/AdminQuadrasLotes";
import LoginPage from "./pages/LoginPage";
import HelpPage from './pages/HelpPage';

function AdminRoute({ isAuthenticated, children }) {
  const location = useLocation();

  if (isAuthenticated) {
    return children;
  }

  return (
    <Navigate
      to="/login"
      replace
      state={{ from: location.pathname }}
    />
  );
}

function App() {
  const [token, setToken] = useState(() => {
    if (typeof window === "undefined") {
      return "";
    }

    return localStorage.getItem("memorialAdminToken") || "";
  });

  const isAuthenticated = Boolean(token);

  const handleLogin = (newToken) => {
    setToken(newToken);
    localStorage.setItem("memorialAdminToken", newToken);
  };

  const handleLogout = () => {
    setToken("");
    localStorage.removeItem("memorialAdminToken");
  };

  useEffect(() => {
    if (!token) {
      localStorage.removeItem("memorialAdminToken");
      return;
    }

    localStorage.setItem("memorialAdminToken", token);
  }, [token]);

  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<MainLayout isAuthenticated={isAuthenticated} onLogout={handleLogout} />}>
          <Route index element={<HomePage />} />
          <Route path="falecidos/:id" element={<FalecidoPage />} />
          <Route path="falecidos" element={<AllFalecidosPage />} />
          <Route path="lote/:id" element={<LotePage />} />
          <Route path="quadra/:id" element={<QuadraPage />} />
          <Route path="/mapa" element={<MapPage />} />
          <Route path="/login" element={<LoginPage onLogin={handleLogin} />} />
          <Route path="/ajuda" element={<HelpPage />} />
        </Route>
        <Route
          path="admin"
          element={(
            <AdminRoute isAuthenticated={isAuthenticated}>
              <AdminDashboard onLogout={handleLogout} />
            </AdminRoute>
          )}
        />
        <Route
          path="admin/falecidos"
          element={(
            <AdminRoute isAuthenticated={isAuthenticated}>
              <AdminFalecidos onLogout={handleLogout} />
            </AdminRoute>
          )}
        />
        <Route
          path="admin/quadraslotes"
          element={(
            <AdminRoute isAuthenticated={isAuthenticated}>
              <AdminQuadrasLotes onLogout={handleLogout} />
            </AdminRoute>
          )}
        />
      </Routes>
    </>
  );
}

export default App;
