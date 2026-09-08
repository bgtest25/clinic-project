import { useCallback } from 'react';
import { useAuth } from '../auth/AuthContext';
import { apiFetch, ApiError } from './client';

export function useApiFetch() {
  const { token, refreshToken, logout } = useAuth();

  return useCallback(
    async <T>(path: string, init: RequestInit = {}): Promise<T> => {
      if (!token) throw new ApiError('Not authenticated', 401);

      try {
        return await apiFetch<T>(path, token, init);
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          const fresh = await refreshToken();
          if (!fresh) {
            logout();
            throw new ApiError('Session expired', 401);
          }
          return await apiFetch<T>(path, fresh, init);
        }
        throw err;
      }
    },
    [token, refreshToken, logout],
  );
}
