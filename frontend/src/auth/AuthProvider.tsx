import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { ApiError, api, setUnauthorizedHandler, tokenStore } from "../lib/api";
import type { ProfilePatch, TokenResponse, User } from "../lib/types";
import { AuthContext } from "./context";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // Only "loading" if there is a saved token we must verify with the server.
  const [loading, setLoading] = useState(() => tokenStore.get() !== null);

  useEffect(() => {
    setUnauthorizedHandler((reason) => {
      tokenStore.clear();
      setUser(null);
      if (reason) setNotice(reason);
    });

    if (tokenStore.get()) {
      api<User>("/auth/me")
        .then(setUser)
        .catch((e) => {
          // A 401 already signed the user out. Anything else (server asleep,
          // no network) keeps the saved login so a reload can try again.
          if (e instanceof ApiError && e.status === 401) tokenStore.clear();
        })
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
    tokenStore.setRefresh(t.refresh_token);
    try {
      setUser(await api<User>("/auth/me"));
      setNotice(null);
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
    // Tell the server too, so the saved tokens stop working everywhere.
    api("/auth/logout", {
      method: "POST",
      keepalive: true,
      silentUnauthorized: true,
    }).catch(() => {});
    tokenStore.clear();
    setUser(null);
    setNotice(null);
  }, []);

  const deleteAccount = useCallback(async (password: string) => {
    // Throws on a wrong password (403) and leaves the user signed in.
    await api("/auth/delete-account", { method: "POST", body: { password } });
    tokenStore.clear();
    setUser(null);
    setNotice("Your account was deleted.");
  }, []);

  const updateProfile = useCallback(async (patch: ProfilePatch) => {
    setUser(await api<User>("/auth/me", { method: "PATCH", body: patch }));
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      notice,
      login,
      register,
      logout,
      updateProfile,
      deleteAccount,
    }),
    [user, loading, notice, login, register, logout, updateProfile, deleteAccount],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
