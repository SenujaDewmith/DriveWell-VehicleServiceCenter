export const BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";

// Fired whenever any request comes back 401, so AuthProvider can clear stale
// auth state and let the dashboard route guard redirect to /login — without
// this plain module (outside React) needing to know about React state.
export const SESSION_EXPIRED_EVENT = "auth:session-expired";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      // Tells the backend which session cookie to trust when both a customer
      // and a staff session exist in the same browser.
      "X-Portal": "staff",
      ...options?.headers,
    },
    ...options,
  });
  if (!res.ok) {
    if (res.status === 401) window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || "Request failed");
  }
  return res.json();
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PUT", body: JSON.stringify(body) }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: "PATCH",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
  // FormData uploads — browser must set its own multipart Content-Type with boundary
  upload: <T>(path: string, formData: FormData) =>
    fetch(`${BASE}${path}`, {
      method: "POST",
      credentials: "include",
      headers: { "X-Portal": "staff" },
      body: formData,
    }).then(async (res) => {
      if (!res.ok) {
        if (res.status === 401) window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
        const err = await res.json().catch(() => ({ message: res.statusText }));
        throw new Error(err.message || "Upload failed");
      }
      return res.json() as Promise<T>;
    }),
};
