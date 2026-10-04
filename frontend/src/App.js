import { useEffect } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import Landing from "@/pages/Landing";
import AuthPage from "@/pages/AuthPage";
import Terminal from "@/pages/Terminal";
import Dashboard from "@/pages/Dashboard";
import SettingsPage from "@/pages/SettingsPage";
import Admin from "@/pages/Admin";

const Loader = () => (
  <div className="h-screen flex items-center justify-center bg-void" data-testid="auth-loading">
    <div className="label flex items-center gap-3"><span className="h-2 w-2 bg-brand live-dot rounded-full" />Authenticating session</div>
  </div>
);

const Protected = ({ children, admin }) => {
  const { user } = useAuth();
  const loc = useLocation();
  if (user === null) return <Loader />;
  if (!user) return <Navigate to="/login" state={{ from: loc.pathname }} replace />;
  if (admin && user.role !== "admin") return <Navigate to="/dashboard" replace />;
  return children;
};

function App() {
  useEffect(() => { document.title = "FLOWX — Professional Order-Flow Analytics"; }, []);
  return (
    <div className="App">
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<AuthPage mode="login" />} />
            <Route path="/register" element={<AuthPage mode="register" />} />
            <Route path="/terminal" element={<Terminal />} />
            <Route path="/dashboard" element={<Protected><Dashboard /></Protected>} />
            <Route path="/settings" element={<Protected><SettingsPage /></Protected>} />
            <Route path="/admin" element={<Protected admin><Admin /></Protected>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
        <Toaster position="bottom-right" theme="dark" toastOptions={{ className: "!bg-[var(--elev)] !border-[var(--line2)] !text-[var(--t1)] !font-mono !text-xs !rounded-sm" }} />
      </AuthProvider>
    </div>
  );
}

export default App;
