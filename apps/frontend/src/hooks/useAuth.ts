// Auth-Hook: Login, 2FA, Logout

import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../api/auth';
import { useAuthStore } from '../store/authStore';

export function useLogin() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);

  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      authApi.login(email, password),
    onSuccess: (data) => {
      if (data.requiresTOTP) {
        // 2FA erforderlich: tempToken im Session Storage für 2FA-Seite
        sessionStorage.setItem('tempToken', data.tempToken ?? '');
        void navigate('/2fa');
        return;
      }
      if (data.accessToken && data.user) {
        setAuth(data.user, data.accessToken);
        void navigate('/');
      }
    },
  });
}

export function useVerify2FA() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);

  return useMutation({
    mutationFn: ({ tempToken, totpCode }: { tempToken: string; totpCode: string }) =>
      authApi.verify2FA(tempToken, totpCode),
    onSuccess: (data) => {
      if (data.accessToken && data.user) {
        setAuth(data.user, data.accessToken);
        sessionStorage.removeItem('tempToken');
        void navigate('/');
      }
    },
  });
}

export function useLogout() {
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);

  return useMutation({
    mutationFn: authApi.logout,
    onSuccess: () => {
      logout();
      void navigate('/login');
    },
    onError: () => {
      // Auch bei Fehler lokal abmelden
      logout();
      void navigate('/login');
    },
  });
}
