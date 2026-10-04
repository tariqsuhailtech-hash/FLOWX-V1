import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api } from "@/lib/api";

const Ctx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);

  const refresh = useCallback(async () => {
    try { const { data } = await api.get("/auth/me"); setUser(data); } catch { setUser(false); }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    if (!user) return;
    const id = setInterval(() => api.post("/me/heartbeat").catch(() => {}), 60000);
    return () => clearInterval(id);
  }, [user]);

  const finish = (data) => { localStorage.setItem("flowx_token", data.token); setUser(data.user); return data.user; };
  const login = async (email, password) => finish((await api.post("/auth/login", { email, password })).data);
  const register = async (email, password, name) => finish((await api.post("/auth/register", { email, password, name })).data);
  const logout = async () => { try { await api.post("/auth/logout"); } catch {} localStorage.removeItem("flowx_token"); setUser(false); };
  const updateSettings = async (patch) => { const { data } = await api.put("/me/settings", patch); setUser((u) => (u ? { ...u, settings: data } : u)); return data; };

  return <Ctx.Provider value={{ user, login, register, logout, refresh, setUser, updateSettings }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
