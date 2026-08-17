// Auth-API-Funktionen

import { apiClient } from './client';
import type { Role } from '@schuladmin/shared/types/roles';

interface LoginResponse {
  requiresTOTP: boolean;
  accessToken?: string;
  tempToken?: string;
  user?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: Role;
    totpEnabled: boolean;
  };
}

export const authApi = {
  login: async (email: string, password: string) => {
    const { data } = await apiClient.post<{ data: LoginResponse }>('/api/v1/auth/login', {
      email,
      password,
    });
    return data.data;
  },

  verify2FA: async (tempToken: string, totpCode: string) => {
    const { data } = await apiClient.post<{ data: LoginResponse }>('/api/v1/auth/2fa/verify', {
      tempToken,
      totpCode,
    });
    return data.data;
  },

  setup2FA: async () => {
    const { data } = await apiClient.post<{
      data: { qrCodeUrl: string; secret: string; backupCodes: string[] };
    }>('/api/v1/auth/2fa/setup');
    return data.data;
  },

  confirm2FA: async (totpCode: string) => {
    const { data } = await apiClient.post<{ data: { backupCodes: string[] } }>(
      '/api/v1/auth/2fa/confirm',
      { totpCode }
    );
    return data.data;
  },

  logout: async () => {
    await apiClient.post('/api/v1/auth/logout');
  },

  getMe: async () => {
    const { data } = await apiClient.get<{ data: LoginResponse['user'] }>('/api/v1/auth/me');
    return data.data;
  },
};
