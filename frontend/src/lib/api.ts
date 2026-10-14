const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";
export const API_ROOT = BASE.replace(/\/api\/v1\/?$/, "");
const TOKEN_KEY = "sq_token";
const REQUEST_TIMEOUT_MS = 90_000;

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export const tokenStore = {
  get(): string | null {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set(token: string) {
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch {
      /* ignore */
    }
  },
  clear() {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* ignore */
    }
  },
};

let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(fn: (() => void) | null) {
  onUnauthorized = fn;
}

function messageFromDetail(detail: unknown, status: number): string {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && detail.length > 0) {
    const first = detail[0] as { loc?: unknown[]; msg?: string };
    const field = first.loc?.[first.loc.length - 1];
    const msg = first.msg ?? "Invalid input";
    return typeof field === "string" ? `${field}: ${msg}` : msg;
  }
  if (status === 429) return "Too many attempts. Wait a minute and try again.";
  return "Something went wrong. Please try again.";
}

type Options = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  auth?: boolean;
  keepalive?: boolean;
};

export async function api<T>(path: string, opts: Options = {}): Promise<T> {
  if (!BASE) {
    throw new ApiError(
      0,
      "App is misconfigured: VITE_API_URL was not set when this site was built.",
    );
  }
  const { method = "GET", body, auth = true, keepalive = false } = opts;
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (auth) {
    const token = tokenStore.get();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      keepalive,
      signal: controller.signal,
    });
  } catch {
    throw new ApiError(
      0,
      "Can't reach the server. If it was idle it may be waking up (up to a minute). Try again shortly.",
    );
  } finally {
    clearTimeout(timer);
  }

  if (res.status === 204) return undefined as T;
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    /* empty or non-JSON body */
  }
  if (!res.ok) {
    if (res.status === 401 && auth) onUnauthorized?.();
    const detail = (data as { detail?: unknown } | null)?.detail;
    throw new ApiError(res.status, messageFromDetail(detail, res.status));
  }
  return data as T;
}