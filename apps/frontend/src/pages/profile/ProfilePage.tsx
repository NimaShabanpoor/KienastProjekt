// Profileinstellungen: Stammdaten, Passwort ändern, Abmelden

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { ChangePasswordSchema, ROLE_LABELS } from '@schuladmin/shared';
import type { ChangePasswordInput } from '@schuladmin/shared';
import { KeyRound, LogOut, User } from 'lucide-react';
import { authApi } from '../../api/auth';
import { useAuthStore } from '../../store/authStore';
import { useLogout } from '../../hooks/useAuth';

export default function ProfilePage() {
  const user = useAuthStore((s) => s.user);
  const logoutMutation = useLogout();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ChangePasswordInput>({
    resolver: zodResolver(ChangePasswordSchema),
  });

  const changePasswordMutation = useMutation({
    mutationFn: (data: ChangePasswordInput) =>
      authApi.changePassword({
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
        confirmPassword: data.confirmPassword,
      }),
    onSuccess: () => {
      reset();
      // Refresh-Token wurde serverseitig invalidiert – neu anmelden
      setTimeout(() => logoutMutation.mutate(), 1200);
    },
  });

  const passwordError = (() => {
    const err = changePasswordMutation.error;
    if (!err || !axios.isAxiosError(err)) return null;
    const data = err.response?.data as { error?: string } | undefined;
    return data?.error ?? 'Passwort konnte nicht geändert werden.';
  })();

  const fieldClass = 'input-modern';

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <User className="w-6 h-6 text-brand-red" />
        <div>
          <h1 className="page-title">Profileinstellungen</h1>
          <p className="page-desc">Persönliche Daten, Passwort und Abmeldung</p>
        </div>
      </div>

      <section className="surface-card p-5">
        <h2 className="text-sm font-semibold text-neutral-900 mb-4">Allgemeine Daten</h2>
        <dl className="grid gap-3 sm:grid-cols-2 text-sm">
          <div>
            <dt className="text-xs font-medium text-neutral-500 mb-0.5">Vorname</dt>
            <dd className="text-neutral-900 font-medium">{user?.firstName ?? '–'}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-neutral-500 mb-0.5">Nachname</dt>
            <dd className="text-neutral-900 font-medium">{user?.lastName ?? '–'}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs font-medium text-neutral-500 mb-0.5">E-Mail</dt>
            <dd className="text-neutral-900 font-medium">{user?.email ?? '–'}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-neutral-500 mb-0.5">Rolle</dt>
            <dd className="text-neutral-900 font-medium">
              {user?.role ? ROLE_LABELS[user.role] : '–'}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-neutral-500 mb-0.5">Zwei-Faktor-Auth</dt>
            <dd className="text-neutral-900 font-medium">
              {user?.totpEnabled ? 'Aktiviert' : 'Nicht aktiviert'}
            </dd>
          </div>
        </dl>
      </section>

      <section className="surface-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <KeyRound className="w-4 h-4 text-neutral-600" />
          <h2 className="text-sm font-semibold text-neutral-900">Passwort ändern</h2>
        </div>
        <p className="text-xs text-neutral-500 mb-4">
          Mindestens 12 Zeichen, mit Gross-/Kleinbuchstaben, Zahl und Sonderzeichen (@$!%*?&).
        </p>

        <form
          onSubmit={(e) => void handleSubmit((data) => changePasswordMutation.mutate(data))(e)}
          className="space-y-3"
        >
          <div>
            <label htmlFor="currentPassword" className="block text-xs font-semibold text-neutral-600 mb-1.5">
              Aktuelles Passwort
            </label>
            <input
              id="currentPassword"
              type="password"
              autoComplete="current-password"
              className={fieldClass}
              {...register('currentPassword')}
            />
            {errors.currentPassword && (
              <p className="text-error text-sm mt-1">{errors.currentPassword.message}</p>
            )}
          </div>
          <div>
            <label htmlFor="newPassword" className="block text-xs font-semibold text-neutral-600 mb-1.5">
              Neues Passwort
            </label>
            <input
              id="newPassword"
              type="password"
              autoComplete="new-password"
              className={fieldClass}
              {...register('newPassword')}
            />
            {errors.newPassword && (
              <p className="text-error text-sm mt-1">{errors.newPassword.message}</p>
            )}
          </div>
          <div>
            <label htmlFor="confirmPassword" className="block text-xs font-semibold text-neutral-600 mb-1.5">
              Neues Passwort bestätigen
            </label>
            <input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              className={fieldClass}
              {...register('confirmPassword')}
            />
            {errors.confirmPassword && (
              <p className="text-error text-sm mt-1">{errors.confirmPassword.message}</p>
            )}
          </div>

          {passwordError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800" role="alert">
              {passwordError}
            </div>
          )}
          {changePasswordMutation.isSuccess && (
            <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2.5 text-sm text-green-800" role="status">
              Passwort wurde geändert. Du wirst abgemeldet…
            </div>
          )}

          <button
            type="submit"
            disabled={changePasswordMutation.isPending}
            className="inline-flex h-10 items-center px-4 rounded-lg bg-brand-red text-white text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            {changePasswordMutation.isPending ? 'Speichern…' : 'Passwort speichern'}
          </button>
        </form>
      </section>

      <section className="surface-card p-5">
        <h2 className="text-sm font-semibold text-neutral-900 mb-2">Sitzung</h2>
        <p className="text-sm text-neutral-500 mb-4">
          Du wirst abgemeldet und zur Anmeldeseite weitergeleitet.
        </p>
        <button
          type="button"
          onClick={() => logoutMutation.mutate()}
          disabled={logoutMutation.isPending}
          className="inline-flex h-10 items-center gap-2 px-4 rounded-lg border border-neutral-300 text-sm font-medium text-neutral-800 hover:bg-neutral-50 disabled:opacity-50"
        >
          <LogOut className="w-4 h-4" />
          {logoutMutation.isPending ? 'Abmelden…' : 'Abmelden'}
        </button>
      </section>
    </div>
  );
}
