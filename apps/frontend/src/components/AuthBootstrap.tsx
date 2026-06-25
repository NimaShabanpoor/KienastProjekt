// Stellt die Session nach einem Seiten-Reload per Refresh-Cookie wieder her

import { useEffect, useState, type ReactNode } from 'react';
import { authApi } from '../api/auth';
import { useAuthStore } from '../store/authStore';

export function AuthBootstrap({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const restoreSession = async () => {
      const { accessToken, user, setAuth, logout } = useAuthStore.getState();

      if (accessToken || !user) {
        setReady(true);
        return;
      }

      try {
        const { accessToken: newToken } = await authApi.refresh();
        setAuth(user, newToken);
      } catch {
        logout();
      } finally {
        setReady(true);
      }
    };

    void restoreSession();
  }, []);

  if (!ready) {
    return (
      <div className="flex items-center justify-center h-screen text-neutral-500">
        Laden...
      </div>
    );
  }

  return <>{children}</>;
}
