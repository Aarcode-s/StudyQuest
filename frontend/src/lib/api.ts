const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";
export const API_ROOT = BASE.replace(/\/api\/v1\/?$/, "");
const TOKEN_KEY = "sq_token";
const REFRESH_KEY = "sq_refresh";
const REQUEST_TIMEOUT_MS = 90_000;

// The API sends exactly this text when a newer login replaced this device.
const SESSION_REPLACED_DETAIL = "Signed in on another device";
const SESSION_REPLACED_MESSAGE =
  "You were signed out because your account was signed in on another device.";
const SESSION_ENDED_MESSAGE = "Your session ended. Please log in again.";
const UNREACHABLE_MESSAGE =
  "Can't reach the server. If it was idle it may be waking up (up to a minute). Try again shortly.";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

export const tokenStore = {
  get: () => read(TOKEN_KEY),
  set: (token: string) => write(TOKEN_KEY, token),
  getRefresh: () => read(REFRESH_KEY),
  setRefresh: (token: string) => write(REFRESH_KEY, token),
  clear() {
    try {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(REFRESH_KEY);
    } catch {
      /* ignore */
    }
  },
};

let onUnauthorized: ((reason?: string) => void) | null = null;
export function setUnauthorizedHandler(
  fn: ((reason?: string) => void) | null,
) {
  onUnauthorized = fn;
}

function endSession(reason: string) {
  tokenStore.clear();
  onUnauthorized?.(reason);
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

async function timedFetch(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

type RefreshResult = "ok" | "rejected" | "unreachable";
let refreshing: Promise<RefreshResult> | null = null;

/** Trades the refresh token for a new access token. Shared, so several
 *  requests that fail at the same moment trigger only one refresh. */
function refreshAccessToken(): Promise<RefreshResult> {
  if (refreshing) return refreshing;
  const refresh = tokenStore.getRefresh();
  if (!refresh) return Promise.resolve("rejected");

  refreshing = (async (): Promise<RefreshResult> => {
    try {
      const res = await timedFetch(`${BASE}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refresh }),
      });
      if (res.status === 401 || res.status === 422) return "rejected";
      // Server trouble or rate limit: stay signed in and try again later.
      if (!res.ok) return "unreachable";
      const data = (await res.json()) as { access_token?: string };
      if (!data.access_token) return "unreachable";
      tokenStore.set(data.access_token);
      return "ok";
    } catch {
      return "unreachable";
    }
  })().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

type Options = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  auth?: boolean;
  keepalive?: boolean;
  /** Return the response body as text (used for the CSV export). */
  text?: boolean;
  /** Skip the sign-out handling when the server answers 401 (used by logout). */
  silentUnauthorized?: boolean;
};

export async function api<T>(path: string, opts: Options = {}): Promise<T> {
  if (!BASE) {
    throw new ApiError(
      0,
      "App is misconfigured: VITE_API_URL was not set when this site was built.",
    );
  }
  const {
    method = "GET",
    body,
    auth = true,
    keepalive = false,
    text = false,
    silentUnauthorized = false,
  } = opts;

  for (let attempt = 0; attempt < 2; attempt++) {
    const headers: Record<string, string> = {};
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (auth) {
      const token = tokenStore.get();
      if (token) headers["Authorization"] = `Bearer ${token}`;
    }

    let res: Response;
    try {
      res = await timedFetch(`${BASE}${path}`, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        keepalive,
      });
    } catch {
      throw new ApiError(0, UNREACHABLE_MESSAGE);
    }

    if (res.status === 204) return undefined as T;
    if (text && res.ok) return (await res.text()) as T;
    let data: unknown = null;
    try {
      data = await res.json();
    } catch {
      /* empty or non-JSON body */
    }
    if (res.ok) return data as T;

    const detail = (data as { detail?: unknown } | null)?.detail;
    if (res.status === 401 && auth && !silentUnauthorized) {
      if (detail === SESSION_REPLACED_DETAIL) {
        endSession(SESSION_REPLACED_MESSAGE);
        throw new ApiError(401, SESSION_REPLACED_MESSAGE);
      }
      if (attempt === 0) {
        // Most likely the 30-minute access token expired: renew it and retry once.
        const result = await refreshAccessToken();
        if (result === "ok") continue;
        if (result === "unreachable") throw new ApiError(0, UNREACHABLE_MESSAGE);
      }
      endSession(SESSION_ENDED_MESSAGE);
      throw new ApiError(401, SESSION_ENDED_MESSAGE);
    }
    throw new ApiError(res.status, messageFromDetail(detail, res.status));
  }
  throw new ApiError(401, SESSION_ENDED_MESSAGE);
}
