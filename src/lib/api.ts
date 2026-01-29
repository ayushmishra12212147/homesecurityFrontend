const API_BASE = (import.meta as any).env?.VITE_API_BASE || "http://localhost:8080";

export function getToken() {
  return localStorage.getItem("adminToken");
}

export function setToken(token: string | null) {
  if (!token) localStorage.removeItem("adminToken");
  else localStorage.setItem("adminToken", token);
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "content-type": "application/json",
    ...(options.headers as any),
  };
  if (token) headers.authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const msg = data?.error || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data as T;
}

export const api = {
  login: (body: { email: string; password: string; fingerprint: string }) =>
    request<{ token: string; email: string }>("/api/admin/auth/login", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  changePassword: (body: { oldPassword: string; newPassword: string }) =>
    request<{ ok: true; token: string }>("/api/admin/auth/change-password", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  summary: () => request<{ total: number; online: number; offline: number }>("/api/admin/devices/summary"),
  listDevices: (q: string, sinceIso?: string, untilIso?: string) => {
    const sp = new URLSearchParams();
    sp.set("q", q);
    if (sinceIso) sp.set("since", sinceIso);
    if (untilIso) sp.set("until", untilIso);
    return request<{ devices: any[] }>(`/api/admin/devices?${sp.toString()}`);
  },
  getDevice: (deviceId: string) => request<{ device: any }>(`/api/admin/devices/${encodeURIComponent(deviceId)}`),
  getLocationLogs: (deviceId: string, sinceIso?: string, untilIso?: string) => {
    const sp = new URLSearchParams();
    if (sinceIso) sp.set("since", sinceIso);
    if (untilIso) sp.set("until", untilIso);
    const query = sp.toString();
    return request<{ logs: Array<{ _id: string; deviceId: string; lat: number; lng: number; address?: string; timestamp: string; createdAt: string }> }>(
      `/api/admin/devices/${encodeURIComponent(deviceId)}/logs${query ? `?${query}` : ""}`
    );
  },
};


