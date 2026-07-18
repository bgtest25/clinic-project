const API_URL = import.meta.env.VITE_API_URL;

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function apiFetch<T>(path: string, token: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      Authorization: `Bearer ${token}`,
      ...init.headers,
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new ApiError(body || res.statusText, res.status);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}
