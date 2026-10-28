import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, api } from "../lib/api";

/** Loads `path` (null = skip), optionally repeating every `everyMs`. */
export function useFetch<T>(path: string | null, everyMs?: number) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(path !== null);
  const alive = useRef(true);

  const load = useCallback(async () => {
    if (path === null) return;
    try {
      const d = await api<T>(path);
      if (alive.current) {
        setData(d);
        setError(null);
      }
    } catch (e) {
      if (alive.current) {
        setError(e instanceof ApiError ? e.message : "Something went wrong.");
      }
    } finally {
      if (alive.current) setLoading(false);
    }
  }, [path]);

  useEffect(() => {
    alive.current = true;
    setData(null);
    setLoading(path !== null);
    void load();
    if (!everyMs || path === null) {
      return () => {
        alive.current = false;
      };
    }
    const id = setInterval(() => {
      if (!document.hidden) void load();
    }, everyMs);
    return () => {
      alive.current = false;
      clearInterval(id);
    };
  }, [load, everyMs, path]);

  return { data, error, loading, reload: load };
}
