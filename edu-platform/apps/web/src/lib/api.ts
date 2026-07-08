import type { AuthResponse, UserPublic } from "@edu/shared";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const ACCESS_KEY = "edu.access";
const REFRESH_KEY = "edu.refresh";

export const tokenStore = {
  get access() {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(ACCESS_KEY);
  },
  get refresh() {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(REFRESH_KEY);
  },
  set(access: string, refresh: string) {
    localStorage.setItem(ACCESS_KEY, access);
    localStorage.setItem(REFRESH_KEY, refresh);
  },
  clear() {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function raw<T>(path: string, options: RequestInit = {}, retry = true): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  const access = tokenStore.access;
  if (access) headers.set("Authorization", `Bearer ${access}`);

  const res = await fetch(`${API_URL}/api${path}`, { ...options, headers });

  // Попытка обновить access по refresh при 401.
  if (res.status === 401 && retry && tokenStore.refresh) {
    const ok = await tryRefresh();
    if (ok) return raw<T>(path, options, false);
  }

  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = await res.json();
      message = Array.isArray(body.message) ? body.message.join(", ") : body.message ?? message;
    } catch {
      /* ignore */
    }
    throw new ApiError(res.status, message);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

async function tryRefresh(): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: tokenStore.refresh }),
    });
    if (!res.ok) {
      tokenStore.clear();
      return false;
    }
    const data = (await res.json()) as AuthResponse;
    tokenStore.set(data.tokens.accessToken, data.tokens.refreshToken);
    return true;
  } catch {
    return false;
  }
}

export const api = {
  get: <T>(path: string) => raw<T>(path),
  post: <T>(path: string, body?: unknown) =>
    raw<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) =>
    raw<T>(path, { method: "PATCH", body: body ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown) =>
    raw<T>(path, { method: "PUT", body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => raw<T>(path, { method: "DELETE" }),
};

/** Прямая multipart-загрузка файла (driver=LOCAL) → возвращает MediaAsset. */
export async function uploadFile(file: File, kind: "IMAGE" | "VIDEO" | "AUDIO" | "FILE"): Promise<{ id: string; url: string; kind: string }> {
  const form = new FormData();
  form.append("file", file);
  const headers = new Headers();
  const access = tokenStore.access;
  if (access) headers.set("Authorization", `Bearer ${access}`);
  const res = await fetch(`${API_URL}/api/media/upload?kind=${kind}`, {
    method: "POST",
    headers,
    body: form,
  });
  if (!res.ok) throw new ApiError(res.status, "Не удалось загрузить файл");
  return res.json();
}

/** Абсолютный URL медиа: относительные /uploads/* дополняем адресом API. */
export function mediaUrl(url: string): string {
  if (!url) return url;
  if (url.startsWith("http")) return url;
  return `${API_URL}${url}`;
}

export const authApi = {
  async login(email: string, password: string): Promise<AuthResponse> {
    const data = await api.post<AuthResponse>("/auth/login", { email, password });
    tokenStore.set(data.tokens.accessToken, data.tokens.refreshToken);
    return data;
  },
  async register(input: { email: string; password: string; firstName: string; lastName: string; role?: string }): Promise<AuthResponse> {
    const data = await api.post<AuthResponse>("/auth/register", input);
    tokenStore.set(data.tokens.accessToken, data.tokens.refreshToken);
    return data;
  },
  me: () => api.get<UserPublic>("/auth/me"),
  async logout() {
    try {
      if (tokenStore.refresh) await api.post("/auth/logout", { refreshToken: tokenStore.refresh });
    } finally {
      tokenStore.clear();
    }
  },
};
