import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { api, setUnauthorizedHandler, tokenStore } from "../lib/api";
import type { TokenResponse, User } from "../lib/types";
import { AuthContext } from "./context";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  // Only "loading" if there is a saved token we must verify with the server.
  const [loading, setLoading] = useState(() => tokenStore.get() !== null);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      tokenStore.clear();
      setUser(null);
    });

    if (tokenStore.get()) {
      api<User>("/auth/me")
        .then(setUser)
        .catch(() => tokenStore.clear())
        .finally(() => setLoading(false));
    }

    return () => setUnauthorizedHandler(null);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const t = await api<TokenResponse>("/auth/login", {
      method: "POST",
      body: { email, password },
      auth: false,
    });
    tokenStore.set(t.access_token);
    try {
      setUser(await api<User>("/auth/me"));
    } catch (e) {
      tokenStore.clear();
      throw e;
    }
  }, []);

  const register = useCallback(
    async (email: string, username: string, password: string) => {
      await api<User>("/auth/register", {
        method: "POST",
        body: { email, username, password },
        auth: false,
      });
      await login(email, password);
    },
    [login],
  );

  const logout = useCallback(() => {
    tokenStore.clear();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, register, logout }),
    [user, loading, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}