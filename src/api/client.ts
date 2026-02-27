const DEFAULT_API_BASE = 'https://bojovic-backend-production.up.railway.app/api';
const envApiBase = import.meta.env.VITE_API_BASE_URL?.trim();
export const API_BASE = (envApiBase && envApiBase.length > 0 ? envApiBase : DEFAULT_API_BASE).replace(
  /\/+$/,
  '',
);

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const headers = new Headers(options?.headers ?? {});
  if (!(options?.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(`${API_BASE}${path}`, {
    headers,
    ...options,
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(error.message || `API error: ${res.status}`);
  }

  if (res.status === 204 || res.headers.get('content-length') === '0') {
    return undefined as T;
  }

  const raw = await res.text();
  if (!raw) {
    return undefined as T;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    return raw as T;
  }
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  postForm: <T>(path: string, formData: FormData) =>
    request<T>(path, { method: 'POST', body: formData }),
  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
