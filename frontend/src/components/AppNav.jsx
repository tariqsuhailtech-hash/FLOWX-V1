import { Link, NavLink, useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Logo } from "@/components/terminal/ui";

export const AppNav = () => {
  const { user, logout } = useAuth(); const nav = useNavigate();
  const cls = ({ isActive }) => `px-3 h-8 inline-flex items-center text-[11px] font-mono tracking-widest uppercase border-b-2 transition-colors duration-150 ${isActive ? "text-brand border-brand" : "text-t2 border-transparent hover:text-t1"}`;
  return (
    <header className="h-12 border-b border-line bg-panel flex items-center gap-6 px-5 sticky top-0 z-20" data-testid="app-nav">
      <Link to="/"><Logo /></Link>
      <nav className="flex items-center gap-1 h-full">
        <NavLink to="/terminal" className={cls} data-testid="nav-terminal">Terminal</NavLink>
        <NavLink to="/dashboard" className={cls} data-testid="nav-dashboard">Dashboard</NavLink>
        <NavLink to="/settings" className={cls} data-testid="nav-settings">Settings</NavLink>
        {user?.role === "admin" && <NavLink to="/admin" className={cls} data-testid="nav-admin">Admin</NavLink>}
      </nav>
      <div className="ml-auto flex items-center gap-3">
        {user && <span className="font-mono text-[11px] text-t2 hidden sm:inline" data-testid="nav-user-email">{user.email} · <span className="text-brand">{user.plan.toUpperCase()}</span></span>}
        <button onClick={async () => { await logout(); nav("/"); }} className="ibtn" title="Sign out" data-testid="nav-logout-button"><LogOut size={14} /></button>
      </div>
    </header>
  );
};

export const Card = ({ title, children, className = "", action, testid }) => (
  <section className={`panel flex flex-col ${className}`} data-testid={testid}>
    <div className="hdr"><span className="label text-t2">{title}</span>{action}</div>
    <div className="p-4 flex-1 min-h-0">{children}</div>
  </section>
);
