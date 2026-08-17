// Axios-Client mit automatischem Token-Refresh
// Interceptors für Auth-Header und 401-Behandlung

import axios from 'axios';
import { useAuthStore } from '../store/authStore';

const API_BASE_URL = import.meta.env['VITE_API_URL'] ?? 'http://localhost:3001';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // httpOnly Cookie für Refresh-Token senden
  headers: {
    'Content-Type': 'application/json',
  },
});

// Separater Client für den Token-Refresh: nutzt dieselbe Basis-URL,
// löst aber KEINE Response-Interceptor-Schleife aus.
const refreshClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

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
// Wartende Requests: werden bei Erfolg mit neuem Token fortgesetzt,
// bei Fehler abgelehnt (sonst hängen sie für immer).
interface PendingRequest {
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
}
let pendingRequests: PendingRequest[] = [];

// Response-Interceptor: 401 = Token-Refresh versuchen
apiClient.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (!axios.isAxiosError(error)) return Promise.reject(error);

    const originalRequest = error.config;
    const status = error.response?.status;

    // 401 und noch kein Retry-Versuch
    if (status === 401 && originalRequest && !originalRequest.headers['_retry']) {
      if (isRefreshing) {
        // Auf den laufenden Refresh warten
        return new Promise((resolve, reject) => {
          pendingRequests.push({
            resolve: (token: string) => {
              if (originalRequest.headers) {
                originalRequest.headers.Authorization = `Bearer ${token}`;
              }
              resolve(apiClient(originalRequest));
            },
            reject,
          });
        });
      }

      originalRequest.headers['_retry'] = 'true';
      isRefreshing = true;

      try {
        const { data } = await refreshClient.post<{ data: { accessToken: string } }>(
          '/api/v1/auth/refresh',
          {}
        );

        const newToken = data.data.accessToken;
        useAuthStore.getState().setAccessToken(newToken);

        // Ausstehende Requests mit neuem Token fortsetzen
        pendingRequests.forEach((p) => p.resolve(newToken));
        pendingRequests = [];

        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
        }

        return apiClient(originalRequest);
      } catch (refreshError) {
        // Refresh fehlgeschlagen – wartende Requests ablehnen und abmelden
        pendingRequests.forEach((p) => p.reject(refreshError));
        pendingRequests = [];
        useAuthStore.getState().logout();
        window.location.href = '/login';
        return Promise.reject(error);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);
