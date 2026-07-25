const BASE_URL = import.meta.env.VITE_API_BASE_URL as string;
// Uploaded files (e.g. package images) are served from the backend root, not under /api
export const ASSET_BASE_URL = BASE_URL.replace(/\/api\/?$/, "");

// Fired whenever any request comes back 401, so AuthContext can clear stale
// user state and let the route guard redirect to /login — without apiClient
// (a plain module, outside React) needing to know about React state.
export const SESSION_EXPIRED_EVENT = "auth:session-expired";

type RequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
};

async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { body, headers, ...rest } = options;

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    headers: {
      "Content-Type": "application/json",
      // Tells the backend which session cookie to trust when both a customer
      // and a staff session exist in the same browser.
      "X-Portal": "customer",
      ...headers,
    },
    credentials: "include",
    body: body !== undefined ? JSON.stringify(body) : undefined,
    ...rest,
  });

  if (!response.ok) {
    if (response.status === 401) window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
    const error = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(error.message || "Request failed");
  }

  return response.json() as Promise<T>;
}

export const apiClient = {
  get: <T>(endpoint: string, options?: RequestOptions) =>
    request<T>(endpoint, { method: "GET", ...options }),

  post: <T>(endpoint: string, body: unknown, options?: RequestOptions) =>
    request<T>(endpoint, { method: "POST", body, ...options }),

  put: <T>(endpoint: string, body: unknown, options?: RequestOptions) =>
    request<T>(endpoint, { method: "PUT", body, ...options }),

  patch: <T>(endpoint: string, body: unknown, options?: RequestOptions) =>
    request<T>(endpoint, { method: "PATCH", body, ...options }),

  delete: <T>(endpoint: string, options?: RequestOptions) =>
    request<T>(endpoint, { method: "DELETE", ...options }),

  // FormData uploads — browser must set its own multipart Content-Type with boundary
  upload: async <T>(endpoint: string, formData: FormData): Promise<T> => {
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      method: "POST",
      credentials: "include",
      headers: { "X-Portal": "customer" },
      body: formData,
    });

    if (!response.ok) {
      if (response.status === 401) window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
      const error = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(error.message || "Upload failed");
    }

    return response.json() as Promise<T>;
  },
};
