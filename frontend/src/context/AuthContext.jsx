import { useState, useEffect, useCallback } from "react";
import { AuthContext } from "./AuthContextValue";

const API = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem("token"));
  const [loading, setLoading] = useState(true);

  // Persist token to localStorage whenever it changes
  useEffect(() => {
    if (token) {
      localStorage.setItem("token", token);
    } else {
      localStorage.removeItem("token");
    }
  }, [token]);

  // refreshToken — declared BEFORE the verify effect that calls it
  const refreshToken = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/auth/refresh`, {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setToken(data.token);
        const profileRes = await fetch(`${API}/api/auth/profile`, {
          headers: { Authorization: `Bearer ${data.token}` },
        });
        if (profileRes.ok) {
          const profileData = await profileRes.json();
          setUser(profileData.user);
        }
        return data.token;
      } else {
        setToken(null);
        setUser(null);
        return null;
      }
    } catch {
      setToken(null);
      setUser(null);
      return null;
    }
  }, []);

  // On mount, verify the stored token is still valid
  useEffect(() => {
    const verify = async () => {
      if (!token) { setLoading(false); return; }
      try {
        const res = await fetch(`${API}/api/auth/profile`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
        } else {
          await refreshToken();
        }
      } catch {
        setToken(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    verify();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const login = useCallback(async (email, password) => {
    const res = await fetch(`${API}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Login failed");
    setToken(data.token);
    setUser(data.user);
    return data;
  }, []);

  const signup = useCallback(async (name, email, password) => {
    const res = await fetch(`${API}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ name, email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Signup failed");
    setToken(data.token);
    setUser(data.user);
    return data;
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch(`${API}/api/auth/logout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      });
    } catch { /* ignore */ }
    setToken(null);
    setUser(null);
  }, [token]);

  // Authenticated fetch helper — auto-attaches Bearer token
  const authFetch = useCallback(async (url, options = {}) => {
    const headers = {
      "Content-Type": "application/json",
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`,
    };
    const res = await fetch(`${API}${url}`, { ...options, headers, credentials: "include" });
    if (res.status === 401) {
      const newToken = await refreshToken();
      if (newToken) {
        return fetch(`${API}${url}`, {
          ...options,
          headers: { ...headers, Authorization: `Bearer ${newToken}` },
          credentials: "include",
        });
      }
    }
    return res;
  }, [token, refreshToken]);

  return (
    <AuthContext.Provider value={{ user, token, loading, login, signup, logout, authFetch, refreshToken }}>
      {children}
    </AuthContext.Provider>
  );
};
