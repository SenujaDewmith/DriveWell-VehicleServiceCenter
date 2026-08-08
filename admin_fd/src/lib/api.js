export const BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";

// Fired whenever any request comes back 401, so AuthProvider can clear stale
// auth state and let the dashboard route guard redirect to /login — without
// this plain module (outside React) needing to know about React state.
export const SESSION_EXPIRED_EVENT = "auth:session-expired";

async function request(path, options) {
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
  get: (path) => request(path),
  post: (path, body) => request(path, { method: "POST", body: JSON.stringify(body) }),
  put: (path, body) => request(path, { method: "PUT", body: JSON.stringify(body) }),
  patch: (path, body) =>
    request(path, {
      method: "PATCH",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
  delete: (path) => request(path, { method: "DELETE" }),
  // FormData uploads — browser must set its own multipart Content-Type with boundary
  upload: (path, formData) =>
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
      return res.json();
    }),
  // Binary downloads (PDF reports, etc.) — returns a Blob plus the filename
  // the server suggested via Content-Disposition, instead of parsing JSON.
  downloadFile: (path) =>
    fetch(`${BASE}${path}`, {
      credentials: "include",
      headers: { "X-Portal": "staff" },
    }).then(async (res) => {
      if (!res.ok) {
        if (res.status === 401) window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
        const err = await res.json().catch(() => ({ message: res.statusText }));
        throw new Error(err.message || "Download failed");
      }
      const disposition = res.headers.get("Content-Disposition") || "";
      const match = disposition.match(/filename="?([^"]+)"?/);
      const blob = await res.blob();
      return { blob, filename: match?.[1] };
    }),
};
