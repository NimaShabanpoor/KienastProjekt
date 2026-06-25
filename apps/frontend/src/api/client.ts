// Axios-Client mit automatischem Token-Refresh
// Interceptors für Auth-Header und 401-Behandlung

import axios from 'axios';
import { useAuthStore } from '../store/authStore';

export const apiClient = axios.create({
  // Im Dev-Modus Vite-Proxy nutzen (gleiche Origin → Cookies funktionieren)
  baseURL: import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? '' : 'http://localhost:3001'),
  withCredentials: true, // httpOnly Cookie für Refresh-Token senden
  headers: {
    'Content-Type': 'application/json',
  },
});

const AUTH_PATHS = ['/api/v1/auth/login', '/api/v1/auth/2fa/verify', '/api/v1/auth/refresh'];

function isAuthRequest(url: string | undefined): boolean {
  if (!url) return false;
  return AUTH_PATHS.some((path) => url.includes(path));
}

// Request-Interceptor: Access Token zum Header hinzufügen
apiClient.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().accessToken;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Flag um mehrfache Refresh-Versuche zu verhindern
let isRefreshing = false;
let pendingRequests: Array<(token: string) => void> = [];

// Response-Interceptor: 401 = Token-Refresh versuchen
apiClient.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (!axios.isAxiosError(error)) return Promise.reject(error);

    const originalRequest = error.config;
    const status = error.response?.status;

    // Kein Token-Refresh bei Login/2FA – sonst 401-Kaskade in der Konsole
    if (
      status === 401 &&
      originalRequest &&
      !originalRequest.headers['_retry'] &&
      !isAuthRequest(originalRequest.url)
    ) {
      if (isRefreshing) {
        // Auf den laufenden Refresh warten
        return new Promise((resolve) => {
          pendingRequests.push((token: string) => {
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${token}`;
            }
            resolve(apiClient(originalRequest));
          });
        });
      }

      originalRequest.headers['_retry'] = 'true';
      isRefreshing = true;

      try {
        const { data } = await apiClient.post<{ data: { accessToken: string } }>(
          '/api/v1/auth/refresh',
          {}
        );

        const newToken = data.data.accessToken;
        useAuthStore.getState().setAccessToken(newToken);

        // Ausstehende Requests mit neuem Token ausführen
        pendingRequests.forEach((cb) => cb(newToken));
        pendingRequests = [];

        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
        }

        return apiClient(originalRequest);
      } catch {
        // Refresh fehlgeschlagen – Abmelden
        useAuthStore.getState().logout();
        pendingRequests = [];
        window.location.href = '/login';
        return Promise.reject(error);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);
